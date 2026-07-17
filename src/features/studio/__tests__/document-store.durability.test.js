import { describe, it, expect, vi, beforeEach } from "vitest";

// Durability of the sync record: when localStorage writes fail, the per-scope
// record (accepted version + dirty domains) must still survive a reload via the
// IndexedDB fallback, so unsynchronized brandProfile/appearance/review edits are
// not lost. IndexedDB is mocked as an in-memory store here.

const h = vi.hoisted(() => ({
  store: new Map(),      // sync records (keyed by scope)
  docStore: new Map(),   // documents (keyed by scope)
  docCalls: [],          // ordered tags of saveDocument invocations
  docDefer: null,        // { tag, release } — defers one document op mid-flight
  syncQueue: [],          // deferred sync-record commit thunks (when syncDefer)
  syncDefer: false,
}));

vi.mock("../../../lib/idb-store.js", () => ({
  // Document store: records call order and can defer one op so a later write is
  // enqueued while an earlier one is still in flight.
  saveDocument: vi.fn((scope, doc) => {
    const tag = doc && doc.tag;
    h.docCalls.push(tag);
    if (h.docDefer && h.docDefer.tag === tag) {
      return new Promise((res) => {
        h.docDefer.release = () => { h.docStore.set(scope, doc); res(true); };
      });
    }
    h.docStore.set(scope, doc);
    return Promise.resolve(true);
  }),
  loadDocument: vi.fn(async (scope) => (h.docStore.has(scope) ? h.docStore.get(scope) : null)),
  // Sync-record store: emulates the real transactional read-compare-put guard —
  // a write only lands if its revision is >= the stored one. Optionally deferred
  // so completion order can be controlled independently of call order.
  saveSyncRecord: vi.fn((scope, record) => {
    const commit = () => {
      const existing = h.store.get(scope);
      if (!existing || record.revision >= existing.revision) h.store.set(scope, record);
      return true;
    };
    if (h.syncDefer) return new Promise((res) => { h.syncQueue.push(() => res(commit())); });
    return Promise.resolve(commit());
  }),
  loadSyncRecord: vi.fn(async (scope) => (h.store.has(scope) ? h.store.get(scope) : null)),
}));

import {
  __resetSyncRecordCacheForTests,
  getDirtyDomains,
  hydrateSyncRecord,
  loadIdbDocumentRaw,
  mergeStudioDocuments,
  persistStudioDocumentDurably,
  persistSyncRecord,
} from "../document-store.js";

function resetDurabilityHarness() {
  h.store.clear();
  h.docStore.clear();
  h.docCalls.length = 0;
  h.docDefer = null;
  h.syncQueue.length = 0;
  h.syncDefer = false;
  __resetSyncRecordCacheForTests();
  localStorage.clear();
  vi.restoreAllMocks();
}

describe("sync-record durability (localStorage failure + IndexedDB success)", () => {
  beforeEach(resetDurabilityHarness);

  it("preserves explicit dirty domains across reload when localStorage writes throw", async () => {
    // localStorage unavailable for writes.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });

    // localStorage write fails, but IndexedDB succeeds -> the record is still
    // DURABLE (persistSyncRecord resolves true once a durable store confirms).
    const durable = await persistSyncRecord("user_a", { version: 3, dirty: ["brandProfile", "appearance", "review"] });
    expect(durable).toBe(true);
    expect(h.store.get("user_a")).toMatchObject({ version: 3, dirty: ["brandProfile", "appearance", "review"] }); // IDB has it (with a revision)

    // Simulate a reload: in-memory cache is gone; localStorage never held it.
    __resetSyncRecordCacheForTests();
    vi.restoreAllMocks();
    expect(getDirtyDomains("user_a")).toEqual([]); // nothing recoverable synchronously yet

    await hydrateSyncRecord("user_a"); // recover from the durable IDB copy
    expect(getDirtyDomains("user_a").slice().sort()).toEqual(["appearance", "brandProfile", "review"]);

    // Those unsynchronized edits now survive a server merge.
    const server = { rows: [], brandProfile: { businessName: "S" }, appearance: { accent: "orange", density: "comfy" }, review: null };
    const local = { rows: [], brandProfile: { businessName: "L" }, appearance: { accent: "violet", density: "comfy" }, review: { token: "t" } };
    const merged = mergeStudioDocuments(server, local, { dirtyDomains: getDirtyDomains("user_a") });
    expect(merged.brandProfile.businessName).toBe("L");
    expect(merged.appearance.accent).toBe("violet");
    expect(merged.review).toEqual({ token: "t" });
  });

  it("raises a save-integrity error only when BOTH localStorage and IndexedDB fail", async () => {
    const { setSyncRecordIntegrityHandler } = await import("../document-store.js");
    const onIntegrity = vi.fn();
    setSyncRecordIntegrityHandler(onIntegrity);

    // localStorage throws AND IDB rejects.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    const idb = await import("../../../lib/idb-store.js");
    idb.saveSyncRecord.mockRejectedValueOnce(new Error("IDB down"));

    persistSyncRecord("user_b", { version: 1, dirty: ["brandProfile"] });
    await Promise.resolve();
    await Promise.resolve();
    expect(onIntegrity).toHaveBeenCalled();
    setSyncRecordIntegrityHandler(null);
  });
});

describe("sync-record hydration selects the higher revision", () => {
  const KEY = "rf_studio_sync:user_a";
  beforeEach(resetDurabilityHarness);

  it("stale non-empty localStorage + newer IndexedDB dirty metadata -> IDB wins", async () => {
    localStorage.setItem(KEY, JSON.stringify({ revision: 1, version: 1, dirty: ["appearance"] }));
    h.store.set("user_a", { revision: 5, version: 9, dirty: ["brandProfile"] });
    const rec = await hydrateSyncRecord("user_a");
    expect(rec.revision).toBe(5);
    expect(getDirtyDomains("user_a")).toEqual(["brandProfile"]);
  });

  it("newer localStorage + stale IndexedDB -> localStorage wins", async () => {
    localStorage.setItem(KEY, JSON.stringify({ revision: 7, version: 4, dirty: ["review"] }));
    h.store.set("user_a", { revision: 2, version: 1, dirty: ["brandProfile"] });
    const rec = await hydrateSyncRecord("user_a");
    expect(rec.revision).toBe(7);
    expect(getDirtyDomains("user_a")).toEqual(["review"]);
  });

  it("a legacy record without a revision reads as revision 0 and loses to any revisioned record", async () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, dirty: ["appearance"] })); // legacy, no revision
    h.store.set("user_a", { revision: 1, version: 3, dirty: ["brandProfile"] });
    const rec = await hydrateSyncRecord("user_a");
    expect(rec.dirty).toEqual(["brandProfile"]);
  });
});

// ITEM 2: all document writes for one scope share one ordered persistence lane,
// so a stale earlier write can never finish after — and replace — a newer one.
describe("document persistence is serialized per scope (ordered write lane)", () => {
  beforeEach(resetDurabilityHarness);

  it("a deferred earlier write (C) cannot land after a newer write (D); D survives a reload", async () => {
    // localStorage unavailable -> durability rides entirely on the IDB lane.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });

    const scope = "user_lane";
    const docC = { schemaVersion: 3, rows: [], tag: "C" };
    const docD = { schemaVersion: 3, rows: [], tag: "D" };

    // Defer C's underlying IDB op so D is enqueued while C is still in flight.
    h.docDefer = { tag: "C" };

    const pC = persistStudioDocumentDurably(docC, scope);
    const pD = persistStudioDocumentDurably(docD, scope);

    // Flush microtasks: C's op starts (one microtask deep), D's stays queued
    // behind C's still-pending promise.
    await Promise.resolve();
    await Promise.resolve();

    // The lane must NOT have started D's op yet — it is chained behind C. There
    // is thus no way to let D's operation resolve before C's.
    expect(h.docCalls).toEqual(["C"]);

    // Let C complete. The lane guarantees D only RUNS after C, so D writes last.
    h.docDefer.release();
    await Promise.all([pC, pD]);

    expect(h.docCalls).toEqual(["C", "D"]);       // strict ordering preserved
    expect(h.docStore.get(scope).tag).toBe("D");  // newest survives in the store

    // Simulated reload: the durable copy read back is D, never the stale C.
    const reloaded = await loadIdbDocumentRaw(scope);
    expect(reloaded.tag).toBe("D");
  });
});

// ITEM 3: the IDB sync-record write retains the greatest-revision record
// transactionally, so a lower revision completing later never regresses it.
describe("sync-record revision never regresses under out-of-order IDB completion", () => {
  beforeEach(resetDurabilityHarness);

  it("a lower revision (N) completing after a higher one (N+1) cannot overwrite it", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    const scope = "user_rev";

    h.syncDefer = true; // hold both IDB writes so completion order is controllable

    const pN = persistSyncRecord(scope, { version: 10, dirty: ["appearance"] });                    // revision N
    const pN1 = persistSyncRecord(scope, { version: 11, dirty: ["brandProfile", "appearance"] });   // revision N+1

    // Two IDB writes are queued; complete N+1 FIRST, then N (the stale one) late.
    expect(h.syncQueue.length).toBe(2);
    h.syncQueue[1](); // N+1 commits
    h.syncQueue[0](); // N arrives late — its lower revision must be rejected
    await Promise.all([pN, pN1]);

    // The durable IDB record is the higher revision, with ITS version + domains.
    const durable = h.store.get(scope);
    expect(durable.version).toBe(11);
    expect(durable.dirty.slice().sort()).toEqual(["appearance", "brandProfile"]);

    // Clear the in-memory cache and hydrate: N+1 (dirty + version) must survive.
    __resetSyncRecordCacheForTests();
    vi.restoreAllMocks();
    const rec = await hydrateSyncRecord(scope);
    expect(rec.version).toBe(11);
    expect(getDirtyDomains(scope).slice().sort()).toEqual(["appearance", "brandProfile"]);
  });
});
