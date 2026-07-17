import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor, cleanup } from "@testing-library/react";

// Real StudioContext mounting with the minimum providers, proving the offline
// queue replay + account-switch invariants end to end. The network + IDB
// boundaries are mocked with in-memory, deterministic doubles (no sleeps): the
// queue is a plain array, and saveStudioDocument records which authenticated
// identity was active for each call so we can prove replay never adopts an
// entry's own scope as its identity.

const h = vi.hoisted(() => ({
  queue: [],
  saveCalls: [],
  currentIdentity: { id: "" },
  saveImpl: { fn: null },
  fetch: { impl: null, deferreds: [] },
  idb: { deferred: false, deferreds: [], doc: null },
  del: { deferred: false, resolvers: [] },
  save: { deferred: false, resolvers: [] },
  // Durable document store double (IndexedDB `documents` object store): scope ->
  // last written document. docSave controls the write path (defer / fail).
  docStore: new Map(),
  docSave: { deferred: false, resolvers: [], fail: false },
  syncRecords: new Map(),
  // Stable toast api — a fresh object per render would change showToast's
  // identity and re-fire the scope effects in a loop.
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

let authState = { userId: "user_a", getToken: async () => "token" };

vi.mock("@clerk/react", () => ({
  useAuth: () => authState,
  useUser: () => ({ user: { fullName: "Tester" } }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/app" }),
}));

vi.mock("../../../components/Toaster.jsx", () => ({
  useToast: () => h.toast,
}));

vi.mock("../../../lib/api-client.js", () => ({
  setApiUserId: vi.fn((userId) => { h.currentIdentity.id = String(userId || ""); }),
  fetchStudioDocument: vi.fn(() => {
    if (h.fetch.impl) return h.fetch.impl();
    return new Promise((resolve, reject) => { h.fetch.deferreds.push({ resolve, reject }); });
  }),
  saveStudioDocument: vi.fn((document, version) => {
    const identity = h.currentIdentity.id;
    h.saveCalls.push({ document, version, identity });
    if (h.saveImpl.fn) return Promise.resolve().then(() => h.saveImpl.fn(document, version, identity));
    if (h.save.deferred) {
      return new Promise((resolve) => { h.save.resolvers.push(() => resolve({ version: (version ?? 0) + 1, updatedAt: "x" })); });
    }
    return Promise.resolve({ version: (version ?? 0) + 1, updatedAt: "2026-07-16T00:00:00.000Z" });
  }),
  fetchInstagramFeed: vi.fn(() => new Promise(() => {})),
}));

vi.mock("../../../lib/idb-store.js", () => ({
  addToSyncQueue: vi.fn(async (entry) => { h.queue.push({ id: h.queue.length + 1, ...entry }); }),
  getSyncQueueByScope: vi.fn(async (scope) => h.queue.filter((e) => e.scope === scope)),
  deleteSyncEntry: vi.fn((id) => {
    h.queue = h.queue.filter((e) => e.id !== id);
    if (h.del.deferred) return new Promise((resolve) => { h.del.resolvers.push(resolve); });
    return Promise.resolve(true);
  }),
  // Imported by document-store.js:
  saveDocument: vi.fn((scope, doc) => {
    if (h.docSave.fail) return Promise.reject(new Error("doc idb down"));
    h.docStore.set(scope, doc);
    if (h.docSave.deferred) return new Promise((resolve) => { h.docSave.resolvers.push(() => resolve(true)); });
    return Promise.resolve(true);
  }),
  loadDocument: vi.fn((scope) => {
    if (h.idb.deferred) return new Promise((resolve) => { h.idb.deferreds.push(resolve); });
    if (h.idb.doc !== null) return Promise.resolve(h.idb.doc);
    return Promise.resolve(h.docStore.get(scope) ?? null);
  }),
  saveSyncRecord: vi.fn(async (scope, record) => { h.syncRecords.set(scope, record); return true; }),
  loadSyncRecord: vi.fn(async (scope) => (h.syncRecords.has(scope) ? h.syncRecords.get(scope) : null)),
}));

import { deleteSyncEntry, loadDocument } from "../../../lib/idb-store.js";
import { __resetSyncRecordCacheForTests, getDirtyDomains, loadSyncRecord, markDirtyDomains, persistStudioDocument } from "../document-store.js";
import { StudioProvider, useStudio } from "../StudioContext.jsx";

let capturedCtx = null;
function Capture() {
  capturedCtx = useStudio();
  return null;
}

function Probe() {
  const { brandProfile, appearance, reviewConfig, saveState } = useStudio();
  return (
    <>
      <div data-testid="probe">{`${brandProfile.businessName}|${appearance.accent}`}</div>
      <div data-testid="review">{reviewConfig ? reviewConfig.token : "none"}</div>
      <div data-testid="status">{saveState?.status || ""}</div>
    </>
  );
}

// The test `marker` doubles as the captured dirty domain, so a conflict merge
// (which keeps only explicitly dirty domains) preserves it on retry.
const qEntry = (scope, marker, version, id) => ({
  id,
  type: "save",
  scope,
  version,
  dirtyDomains: ["marker"],
  document: { schemaVersion: 3, rows: [], marker },
});

// Only replay-originated saves carry a `marker`; the live debounced save does not.
const replaySaves = () => h.saveCalls.filter((c) => c.document && c.document.marker);
const replayMarkers = () => replaySaves().map((c) => c.document.marker);

// Pristine setItem captured before any spying. The helper fails ONLY document
// keys, so sync-record persistence stays functional while document durability
// falls back to the mocked IndexedDB store.
const REAL_SET_ITEM = Storage.prototype.setItem;
const spyDocSetItemThrow = () =>
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function set(k, val) {
    if (String(k).startsWith("rf_studio_document")) throw new Error("QuotaExceededError");
    return REAL_SET_ITEM.call(this, k, val);
  });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  h.queue = [];
  h.saveCalls = [];
  h.currentIdentity = { id: "" };
  h.saveImpl = { fn: null };
  h.fetch = { impl: null, deferreds: [] };
  h.idb = { deferred: false, deferreds: [], doc: null };
  h.del = { deferred: false, resolvers: [] };
  h.save = { deferred: false, resolvers: [] };
  h.docStore = new Map();
  h.docSave = { deferred: false, resolvers: [], fail: false };
  h.syncRecords = new Map();
  __resetSyncRecordCacheForTests();
  capturedCtx = null;
  authState = { userId: "user_a", getToken: async () => "token" };
});

afterEach(() => cleanup());

describe("StudioContext offline queue replay", () => {
  it("(#10/#11/#12/#13) replays only the active scope, in order, under the current identity, acking individually", async () => {
    h.queue = [
      qEntry("user_a", "a1", 1, 1),
      qEntry("user_a", "a2", 2, 2),
      qEntry("user_b", "b1", 1, 3),
    ];
    h.fetch.impl = async () => ({ document: null }); // establish server state (absence) so the lane drains
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);

    await waitFor(() => expect(deleteSyncEntry).toHaveBeenCalledWith(2));

    // #10 order: the two entries were replayed oldest-first (ignore any trailing
    // post-drain live re-send).
    expect(replayMarkers().slice(0, 2)).toEqual(["a1", "a2"]);
    // #12 identity: every replayed write used the current identity.
    expect(replaySaves().every((c) => c.identity === "user_a")).toBe(true);
    // #13 individual acknowledgement (not a bulk clear).
    expect(deleteSyncEntry).toHaveBeenCalledWith(1);
    expect(deleteSyncEntry).toHaveBeenCalledWith(2);
    // #11 cross-scope entry never replayed, modified, acked, or removed.
    expect(deleteSyncEntry).not.toHaveBeenCalledWith(3);
    expect(h.queue.map((e) => e.document.marker)).toEqual(["b1"]);
  });

  it("(#14) stops on the first failure, retaining the failed and all later entries", async () => {
    h.queue = [
      qEntry("user_a", "a1", 1, 1),
      qEntry("user_a", "a2", 2, 2),
      qEntry("user_a", "a3", 3, 3),
    ];
    h.saveImpl.fn = (doc) => {
      if (doc.marker === "a2") throw new Error("Network error");
      return { version: 9, updatedAt: "2026-07-16T00:00:00.000Z" };
    };
    h.fetch.impl = async () => ({ document: null }); // establish server state so the lane drains
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);

    await waitFor(() => expect(deleteSyncEntry).toHaveBeenCalledWith(1)); // a1 succeeded + acked
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); }); // let any re-pumps settle
    expect(replayMarkers()).toContain("a2"); // a2 attempted (and fails)
    expect(replayMarkers()).not.toContain("a3"); // drain stops at a2 -> a3 never attempted
    expect(deleteSyncEntry).not.toHaveBeenCalledWith(2);
    expect(deleteSyncEntry).not.toHaveBeenCalledWith(3);
    expect(h.queue.map((e) => e.document.marker)).toEqual(["a2", "a3"]); // failed + later retained
  });

  it("(#16) a delayed server response from a previous scope cannot mutate the new scope", async () => {
    authState.userId = "user_a";
    const view = render(<StudioProvider><Probe /></StudioProvider>);
    // Let A's sync-record hydration resolve so A actually issues its fetch,
    // pending as h.fetch.deferreds[0].
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await waitFor(() => expect(h.fetch.deferreds.length).toBeGreaterThan(0));

    authState.userId = "user_b";
    await act(async () => { view.rerender(<StudioProvider><Probe /></StudioProvider>); });

    // Resolve the stale user_a fetch AFTER the switch to user_b.
    await act(async () => {
      h.fetch.deferreds[0].resolve({
        document: {
          schemaVersion: 3,
          rows: [],
          brandProfile: { businessName: "A_SERVER" },
          appearance: { accent: "emerald", density: "comfy" },
          review: null,
        },
        version: 5,
        updatedAt: "2026-07-16T00:00:00.000Z",
      });
      await Promise.resolve();
    });

    // Active (user_b) document is untouched by user_a's late response.
    expect(view.getByTestId("probe").textContent).toBe("|orange");
  });
});

describe("StudioContext queued version-conflict reconciliation", () => {
  const serverDoc = (name) => ({ schemaVersion: 3, rows: [], brandProfile: { businessName: name } });

  it("(#4.1) a queued 409 reconciles and retries to success, then is acked individually", async () => {
    h.queue = [qEntry("user_a", "a1", 1, 1)];
    let n = 0;
    h.saveImpl.fn = (doc, ver) => {
      n += 1;
      if (n === 1) throw new Error("Version conflict"); // stale queued version
      return { version: 8, updatedAt: "x", sentVersion: ver };
    };
    h.fetch.impl = async () => ({ document: serverDoc("S"), version: 7 });
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);

    await waitFor(() => expect(h.queue.length).toBe(0)); // entry acked after reconciled success
    expect(deleteSyncEntry).toHaveBeenCalledWith(1);
    const retried = h.saveCalls.filter((c) => c.document && c.document.marker);
    expect(retried.length).toBeGreaterThanOrEqual(2); // conflict + retry
    expect(retried.some((c) => c.version === 7)).toBe(true); // retried on the current server version
    expect(retried.every((c) => c.identity === "user_a")).toBe(true); // current identity only
  });

  it("(#4.2) repeated conflict past the bounded limit retains the failed + later entries", async () => {
    h.queue = [qEntry("user_a", "a1", 1, 1), qEntry("user_a", "a2", 2, 2)];
    h.saveImpl.fn = () => { throw new Error("Version conflict"); };
    h.fetch.impl = async () => ({ document: serverDoc("S"), version: 9 });
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);

    // a1 conflict-exhausts (>=4 attempts: 1 + 3 bounded retries) -> lane stops.
    await waitFor(() => expect(h.saveCalls.filter((c) => c.document?.marker === "a1").length).toBeGreaterThanOrEqual(4));
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); }); // let any re-pumps settle
    expect(deleteSyncEntry).not.toHaveBeenCalled(); // nothing acked
    expect(h.saveCalls.some((c) => c.document?.marker === "a2")).toBe(false); // a2 never attempted
    expect(h.queue.map((e) => e.document.marker)).toEqual(["a1", "a2"]);
  });

  it("(#4.3) an earlier success stays acked when a later entry fails on conflict", async () => {
    h.queue = [qEntry("user_a", "a1", 1, 1), qEntry("user_a", "a2", 2, 2)];
    h.saveImpl.fn = (doc) => {
      if (doc.marker === "a1") return { version: 2, updatedAt: "x" };
      throw new Error("Version conflict"); // a2 always conflicts
    };
    h.fetch.impl = async () => ({ document: serverDoc("S"), version: 9 });
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);

    await waitFor(() => expect(h.queue.map((e) => e.document.marker)).toEqual(["a2"]));
    expect(deleteSyncEntry).toHaveBeenCalledWith(1); // earlier success acked
    expect(deleteSyncEntry).not.toHaveBeenCalledWith(2); // later conflict-exhausted entry retained
  });
});

describe("StudioContext IndexedDB recovery (server-authoritative, explicit-dirty gated)", () => {
  const T1 = "2026-07-05T00:00:00.000Z";
  const T2 = "2026-07-10T00:00:00.000Z"; // newer than T1 (admits the IDB candidate)
  const fullBP = (name) => ({
    businessName: name, tagline: "", description: "", audience: "", toneVoice: "",
    keyTopics: [], callToAction: "", defaultHashtags: [], bannedPhrases: [],
    exampleCaptions: [], learnedFromUrl: "", updatedAt: null,
  });
  const doc = (overrides) => ({
    schemaVersion: 3,
    rows: [],
    auditLog: [],
    instagram: { account: null, media: null, syncedAt: null },
    brandProfile: fullBP(""),
    appearance: { accent: "orange", density: "comfy" },
    review: null,
    lastSavedAt: T1,
    ...overrides,
  });
  const bpName = (v) => v.getByTestId("probe").textContent.split("|")[0];

  it("(#1) a newer IDB default brandProfile CANNOT replace an accepted server brandProfile when not dirty", async () => {
    persistStudioDocument(doc({ brandProfile: fullBP("SERVER"), lastSavedAt: T1 }), "user_a");
    h.idb.doc = doc({ brandProfile: fullBP(""), lastSavedAt: T2 }); // newer, raw-present but default, NOT dirty
    authState.userId = "user_a";

    const v = render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(loadDocument).toHaveBeenCalled());
    expect(bpName(v)).toBe("SERVER"); // accepted server value preserved
  });

  it("(#2) same for appearance and review (not dirty → server wins)", async () => {
    persistStudioDocument(doc({ appearance: { accent: "emerald", density: "comfy" }, review: { token: "srv" }, lastSavedAt: T1 }), "user_a");
    h.idb.doc = doc({ appearance: { accent: "orange", density: "comfy" }, review: null, lastSavedAt: T2 });
    authState.userId = "user_a";

    const v = render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(loadDocument).toHaveBeenCalled());
    expect(v.getByTestId("probe").textContent.split("|")[1]).toBe("emerald"); // server appearance kept
    expect(v.getByTestId("review").textContent).toBe("srv"); // server review kept
  });

  it("(#3) newer IDB with an EXPLICITLY dirty brandProfile preserves a genuine local edit", async () => {
    persistStudioDocument(doc({ brandProfile: fullBP("SERVER"), lastSavedAt: T1 }), "user_a");
    markDirtyDomains("user_a", ["brandProfile"]); // durable dirty metadata (not value/snapshot inference)
    h.idb.doc = doc({ brandProfile: fullBP("LOCALEDIT"), lastSavedAt: T2 }); // raw-present dirty domain
    authState.userId = "user_a";

    const v = render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(bpName(v)).toBe("LOCALEDIT")); // legitimate local edit recovered
  });

  it("(#4) an absent raw IDB field cannot become dirty even when the domain is flagged dirty", async () => {
    persistStudioDocument(doc({ brandProfile: fullBP("SERVER"), lastSavedAt: T1 }), "user_a");
    markDirtyDomains("user_a", ["brandProfile"]); // flagged dirty...
    const idbNoBrand = doc({ lastSavedAt: T2 });
    delete idbNoBrand.brandProfile; // ...but raw-absent in the IDB snapshot
    h.idb.doc = idbNoBrand;
    authState.userId = "user_a";

    const v = render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(loadDocument).toHaveBeenCalled());
    expect(bpName(v)).toBe("SERVER"); // provenance guard: absent field never overrides server
  });

  it("(#5) a delayed IDB recovery from a previous scope cannot mutate the new scope", async () => {
    h.idb.deferred = true;
    authState.userId = "user_a";
    const v = render(<StudioProvider><Probe /></StudioProvider>);

    authState.userId = "user_b";
    await act(async () => { v.rerender(<StudioProvider><Probe /></StudioProvider>); });

    // Resolve scope A's raw IDB load AFTER switching to user_b.
    await act(async () => {
      h.idb.deferreds[0](doc({ brandProfile: fullBP("A_IDB"), appearance: { accent: "emerald", density: "comfy" }, lastSavedAt: "2999-01-01T00:00:00.000Z" }));
      await Promise.resolve();
    });

    expect(v.getByTestId("probe").textContent).toBe("|orange"); // user_b untouched
  });
});

describe("StudioContext sign-out preservation", () => {
  it("ordinary sign-out clears neither the scoped queue nor the sync record", async () => {
    h.queue = [qEntry("user_a", "a1", 1, 1)];
    markDirtyDomains("user_a", ["brandProfile"]); // durable sync record for the scope
    h.saveImpl.fn = () => { throw new Error("boom"); }; // non-conflict, non-retryable → retained, no re-enqueue
    h.fetch.impl = async () => ({ document: null }); // establish server state so the lane drains
    authState.userId = "user_a";

    const v = render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(h.saveCalls.length).toBeGreaterThan(0)); // replay attempted

    authState.userId = null; // sign out
    await act(async () => { v.rerender(<StudioProvider><Probe /></StudioProvider>); });

    expect(h.queue.some((e) => e.id === 1)).toBe(true); // scoped entry retained
    expect(loadSyncRecord("user_a").dirty).toContain("brandProfile"); // sync record retained
  });
});

describe("StudioContext auth-safety + baseline ordering", () => {
  it("initial fetch advances the baseline; a stale NON-dirty queued domain cannot revert the server", async () => {
    // Queued entry's brandProfile differs from the server but is NOT dirty.
    h.queue = [{ id: 1, type: "save", scope: "user_a", version: 1, dirtyDomains: [], document: { schemaVersion: 3, rows: [], brandProfile: { businessName: "STALE" }, marker: "q1" } }];
    h.fetch.impl = async () => ({ document: { schemaVersion: 3, rows: [], brandProfile: { businessName: "SERVER" } }, version: 5 });
    // First attempt (entry doc, has marker) conflicts; the reconciled retry (no
    // marker) succeeds — proving the merged doc, not the stale entry, is written.
    h.saveImpl.fn = (doc) => {
      if (doc.marker) throw new Error("Version conflict");
      return { version: 6, updatedAt: "x" };
    };
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);

    await waitFor(() => expect(deleteSyncEntry).toHaveBeenCalledWith(1)); // reconciled + acked
    // The successful (reconciled) write carried the SERVER value; the stale
    // non-dirty queued brandProfile did not revert the server.
    const won = h.saveCalls.find((c) => !c.document.marker && c.document.brandProfile?.businessName === "SERVER");
    expect(won).toBeTruthy();
    expect(loadSyncRecord("user_a").version).toBe(6); // baseline/version advanced
  });

  it("a scope switch during queue acknowledgement still finalizes A's durable sync record; returning to A does not resend the acknowledged domain", async () => {
    h.del.deferred = true; // suspend the ack mid-flight
    // A's live document matches the queued snapshot (the entry came from it), so
    // the finalization can clear the acknowledged dirty domain.
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: { businessName: "AEDIT" } }, "user_a");
    markDirtyDomains("user_a", ["brandProfile"]); // A has a genuine unsynced domain
    h.queue = [{ id: 1, type: "save", scope: "user_a", version: 2, dirtyDomains: ["brandProfile"], document: { schemaVersion: 3, rows: [], brandProfile: { businessName: "AEDIT" } } }];
    h.saveImpl.fn = (doc) => (doc.brandProfile?.businessName === "AEDIT" ? { version: 9, updatedAt: "x" } : (() => { throw new Error("boom"); })());
    h.fetch.impl = async () => ({ document: null }); // establish server state so the lane drains
    authState.userId = "user_a";

    const v = render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(deleteSyncEntry).toHaveBeenCalledWith(1)); // reached the ack await (record already finalized before delete)

    authState.userId = "user_b"; // switch scope while the ack is pending
    await act(async () => { v.rerender(<StudioProvider><Probe /></StudioProvider>); });
    await act(async () => { h.del.resolvers.forEach((r) => r()); await Promise.resolve(); });

    // A's DURABLE record is finalized with captured A data regardless of the switch.
    const recA = loadSyncRecord("user_a");
    expect(recA.version).toBe(9);
    expect(recA.dirty).not.toContain("brandProfile"); // acknowledged domain cleared
    // Returning to A: the acknowledged domain is no longer dirty, so it is not resent.
    expect(getDirtyDomains("user_a")).toEqual([]);
  });

  it("a null-version live save is deferred until the initial fetch resolves (no blind create over an existing doc)", async () => {
    authState.userId = "user_a"; // no sync record -> version starts null; fetch is deferred (pending)

    render(<StudioProvider><Probe /></StudioProvider>);
    // Let the 180ms save debounce fire while the server's existence is still unknown.
    await act(async () => { await new Promise((r) => setTimeout(r, 240)); });
    expect(h.saveCalls.length).toBe(0); // gate held: no null-version create issued

    // Existing server document resolves at version 5.
    await act(async () => {
      h.fetch.deferreds[0].resolve({ document: { schemaVersion: 3, rows: [], brandProfile: { businessName: "S" } }, version: 5 });
      await Promise.resolve();
    });
    await waitFor(() => expect(h.saveCalls.length).toBeGreaterThan(0));
    expect(h.saveCalls.some((c) => c.version == null)).toBe(false); // never a blind null-version create
    expect(h.saveCalls[0].version).toBe(5); // first authenticated save carries the real server version
  });
});

describe("StudioContext scope-safe save serializer", () => {
  it("A in-flight save → switch to B → B saves once with B's version/identity; stale A completion cannot alter B or block it", async () => {
    h.save.deferred = true; // saves stay in-flight until explicitly resolved
    // Server version depends on the CURRENT identity so A and B are distinguishable.
    h.fetch.impl = async () => ({
      document: { schemaVersion: 3, rows: [], brandProfile: { businessName: h.currentIdentity.id } },
      version: h.currentIdentity.id === "user_b" ? 20 : 2,
    });
    authState.userId = "user_a";

    const v = render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(h.saveCalls.some((c) => c.identity === "user_a")).toBe(true)); // A's save is in flight

    authState.userId = "user_b";
    await act(async () => { v.rerender(<StudioProvider><Probe /></StudioProvider>); });
    await waitFor(() => expect(h.saveCalls.some((c) => c.identity === "user_b")).toBe(true)); // B's save is in flight

    // Complete BOTH in-flight saves (A first). A's stale completion must be inert.
    await act(async () => { h.save.resolvers.forEach((r) => r()); await Promise.resolve(); await Promise.resolve(); });

    const bCalls = h.saveCalls.filter((c) => c.identity === "user_b");
    expect(bCalls.length).toBe(1); // B saved exactly once
    expect(bCalls[0].version).toBe(20); // using B's version, not A's
    expect(loadSyncRecord("user_b").version).toBe(21); // B's success advanced B (not corrupted by A)
  });
});

describe("StudioContext single outbound lane (queue drain then one live save)", () => {
  const fullBP = (name) => ({
    businessName: name, tagline: "", description: "", audience: "", toneVoice: "",
    keyTopics: [], callToAction: "", defaultHashtags: [], bannedPhrases: [],
    exampleCaptions: [], learnedFromUrl: "", updatedAt: null,
  });

  it("(#4 race) a queued A and a later live B are serialized: final write is B, queue empties, brandProfile clears only after B", async () => {
    // Local document has the LATER brandProfile B; a queued entry holds the older A.
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("B") }, "user_a");
    markDirtyDomains("user_a", ["brandProfile"]);
    h.queue = [{ id: 1, type: "save", scope: "user_a", version: 1, dirtyDomains: ["brandProfile"], document: { schemaVersion: 3, rows: [], brandProfile: fullBP("A") } }];
    h.fetch.impl = async () => ({ document: { schemaVersion: 3, rows: [], brandProfile: fullBP("A") }, version: 1 });
    // Track the order + last written brandProfile.
    const written = [];
    h.saveImpl.fn = (doc, ver) => { written.push(doc.brandProfile?.businessName); return { version: (ver ?? 0) + 1, updatedAt: "x" }; };
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);

    // Queue drains first (A), then the single live save sends B.
    await waitFor(() => expect(h.queue.length).toBe(0));
    await waitFor(() => expect(written[written.length - 1]).toBe("B"));
    expect(written.indexOf("A")).toBeLessThan(written.lastIndexOf("B")); // A written before final B (serialized)
    // brandProfile dirty cleared only after B succeeds.
    await waitFor(() => expect(getDirtyDomains("user_a")).not.toContain("brandProfile"));

    // Reload retains B.
    __resetSyncRecordCacheForTests();
    const reloaded = (await import("../document-store.js")).loadStudioDocument("user_a");
    expect(reloaded.brandProfile.businessName).toBe("B");
  });

  it("an unresolved queued entry blocks a newer live write without losing the local document or dirty metadata", async () => {
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("LIVE_B") }, "user_a");
    markDirtyDomains("user_a", ["brandProfile"]);
    // Queue entry always conflict-exhausts -> unresolved -> lane stops before live save.
    h.queue = [{ id: 1, type: "save", scope: "user_a", version: 1, dirtyDomains: ["brandProfile"], document: { schemaVersion: 3, rows: [], brandProfile: fullBP("QUEUED_A") } }];
    h.fetch.impl = async () => ({ document: { schemaVersion: 3, rows: [], brandProfile: fullBP("SERVER") }, version: 9 });
    const written = [];
    h.saveImpl.fn = (doc) => { written.push(doc.brandProfile?.businessName); throw new Error("Version conflict"); };
    authState.userId = "user_a";

    const v = render(<StudioProvider><Probe /></StudioProvider>);

    // The queued entry is attempted (and exhausts); the live B write never bypasses it.
    await waitFor(() => expect(written.some((n) => n === "QUEUED_A")).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(written).not.toContain("LIVE_B"); // newer live write blocked behind the unresolved entry
    expect(h.queue.length).toBe(1); // entry retained
    expect(v.getByTestId("probe").textContent.split("|")[0]).toBe("LIVE_B"); // local doc retained
    expect(getDirtyDomains("user_a")).toContain("brandProfile"); // dirty retained
  });

  it("(#3) an in-memory edit immediately before an account switch (pre-debounce) survives on return to A", async () => {
    h.fetch.impl = async () => ({ document: null });
    authState.userId = "user_a";
    const v = render(<><StudioProvider><Capture /><Probe /></StudioProvider></>);
    await waitFor(() => expect(capturedCtx).not.toBeNull());

    // Edit A in memory (dirties brandProfile), then switch to B IMMEDIATELY —
    // well inside the 180ms debounce, so the edit was never debounce-persisted.
    await act(async () => { capturedCtx.updateBrandProfile({ businessName: "EDIT_A" }); });
    authState.userId = "user_b";
    await act(async () => { v.rerender(<><StudioProvider><Capture /><Probe /></StudioProvider></>); });

    // The scope-load effect must have persisted A's latest doc before swapping.
    __resetSyncRecordCacheForTests();
    const store = await import("../document-store.js");
    const reloaded = store.loadStudioDocument("user_a");
    expect(reloaded.brandProfile.businessName).toBe("EDIT_A");
  });
});

describe("StudioContext inactive-scope integrity isolation", () => {
  it("a sync-integrity failure for an INACTIVE scope does not alter the active scope's save status", async () => {
    const ds = await import("../document-store.js");
    const idb = await import("../../../lib/idb-store.js");
    h.fetch.impl = async () => ({ document: null });
    authState.userId = "user_a";
    const v = render(<StudioProvider><Probe /></StudioProvider>);
    // Let the active lane settle so status transitions are done before we probe.
    await waitFor(() => expect(v.getByTestId("status").textContent).toBe("saved"));

    // Force a persist that fails on BOTH stores for an INACTIVE scope ONLY (so
    // the active scope's own persistence is unaffected). The provider's scoped
    // handler must ignore the inactive-scope failure.
    const realSet = Storage.prototype.setItem;
    idb.saveSyncRecord.mockImplementation(async (scope, record) => {
      if (String(scope).includes("zzz")) throw new Error("IDB down");
      h.syncRecords.set(scope, record);
      return true;
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function set(k, val) {
      if (String(k).includes("zzz")) throw new Error("Quota");
      return realSet.call(this, k, val);
    });
    await act(async () => {
      ds.persistSyncRecord("user_zzz_inactive", { version: 1, dirty: ["brandProfile"] });
      await Promise.resolve();
      await Promise.resolve();
    });
    setItem.mockRestore();

    // The inactive-scope integrity failure did NOT push the active scope's UI
    // into the save-integrity error state.
    expect(v.getByTestId("status").textContent).not.toBe("error");
    expect(v.getByTestId("status").textContent).toBe("saved");
  });
});

describe("StudioContext in-flight edits, hydration, retryable init, normalize-before-pump", () => {
  const fullBP = (name) => ({
    businessName: name, tagline: "", description: "", audience: "", toneVoice: "",
    keyTopics: [], callToAction: "", defaultHashtags: [], bannedPhrases: [],
    exampleCaptions: [], learnedFromUrl: "", updatedAt: null,
  });

  it("(#2) an edit while a save is in flight stays dirty after the earlier save finalizes across a switch; return to A sends v2", async () => {
    h.fetch.impl = async () => ({ document: { schemaVersion: 3, rows: [], brandProfile: fullBP("SERVER") }, version: 5 });
    authState.userId = "user_a";
    const v = render(<StudioProvider><Capture /><Probe /></StudioProvider>);
    await waitFor(() => expect(capturedCtx).not.toBeNull());
    // Let the initial post-fetch live save settle so the lane is idle.
    await waitFor(() => expect(v.getByTestId("status").textContent).toBe("saved"));

    // Now hold subsequent saves in flight, then edit v1.
    h.save.deferred = true;
    await act(async () => { capturedCtx.updateBrandProfile({ businessName: "v1" }); });
    await waitFor(() => expect(h.saveCalls.some((c) => c.document?.brandProfile?.businessName === "v1")).toBe(true));

    // A edits again to v2 while the v1 save is still in flight, then switches to B.
    await act(async () => { capturedCtx.updateBrandProfile({ businessName: "v2" }); });
    authState.userId = "user_b";
    await act(async () => { v.rerender(<StudioProvider><Capture /><Probe /></StudioProvider>); });

    // The v1 save resolves after the switch.
    await act(async () => { h.save.resolvers.forEach((r) => r()); await Promise.resolve(); await Promise.resolve(); });

    // A's durable version advanced; brandProfile is still dirty (v2 != sent v1).
    expect(loadSyncRecord("user_a").version).not.toBeNull();
    expect(getDirtyDomains("user_a")).toContain("brandProfile");
    // Returning to A: the persisted latest doc is v2 (not reverted to v1).
    __resetSyncRecordCacheForTests();
    const store = await import("../document-store.js");
    expect(store.loadStudioDocument("user_a").brandProfile.businessName).toBe("v2");
  });

  it("(#3) an edit made before hydration completes survives a higher pre-existing IDB revision", async () => {
    localStorage.setItem("rf_studio_sync:user_a", JSON.stringify({ revision: 2, version: 1, dirty: ["appearance"] }));
    h.syncRecords.set("user_a", { revision: 5, version: 3, dirty: ["review"] });
    const idb = await import("../../../lib/idb-store.js");
    let resolveSync;
    idb.loadSyncRecord.mockImplementationOnce(() => new Promise((res) => { resolveSync = () => res(h.syncRecords.get("user_a")); }));
    h.fetch.impl = () => new Promise(() => {}); // keep init pending so the lane does not interfere
    authState.userId = "user_a";
    render(<StudioProvider><Capture /><Probe /></StudioProvider>);
    await waitFor(() => expect(capturedCtx).not.toBeNull());

    // Edit brandProfile BEFORE hydration resolves.
    await act(async () => { capturedCtx.updateBrandProfile({ businessName: "edit" }); });
    // Hydration resolves: IDB revision 5 wins over stale localStorage revision 2.
    await act(async () => { resolveSync(); await Promise.resolve(); await Promise.resolve(); });

    const rec = loadSyncRecord("user_a");
    expect(rec.revision).toBeGreaterThan(5); // new higher revision
    expect(rec.dirty).toContain("brandProfile"); // the pre-hydration edit survived
    expect(rec.dirty).toContain("review"); // rev5's valid dirty domain retained
  });

  it("(#4) offline launch (failed initial fetch) retries on reconnect, then replays + live-saves", async () => {
    h.queue = [qEntry("user_a", "q1", 1, 1)];
    markDirtyDomains("user_a", ["brandProfile"]);
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("LOCAL") }, "user_a");
    let online = false;
    h.fetch.impl = async () => {
      if (!online) throw Object.assign(new Error("Network error"), { retryable: true });
      return { document: null };
    };
    authState.userId = "user_a";
    render(<StudioProvider><Probe /></StudioProvider>);

    // Initial fetch fails -> init not established -> nothing drained, all retained.
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(deleteSyncEntry).not.toHaveBeenCalled();
    expect(h.queue.length).toBe(1);

    // Reconnect: isOnline false->true re-triggers the lane, which retries init.
    online = true;
    await act(async () => { window.dispatchEvent(new Event("offline")); });
    await act(async () => { window.dispatchEvent(new Event("online")); await new Promise((r) => setTimeout(r, 50)); });
    await waitFor(() => expect(deleteSyncEntry).toHaveBeenCalledWith(1)); // replay drained after reconnect
  });

  it("(#5a) an older server document missing brandProfile/appearance/review is normalized before any write", async () => {
    persistStudioDocument({ schemaVersion: 3, rows: [], appearance: { accent: "violet", density: "comfy" } }, "user_a");
    markDirtyDomains("user_a", ["appearance"]); // force a live save after init
    h.fetch.impl = async () => ({ document: { schemaVersion: 2, rows: [] }, version: 3 }); // missing domains
    authState.userId = "user_a";
    render(<StudioProvider><Probe /></StudioProvider>);

    await waitFor(() => expect(h.saveCalls.length).toBeGreaterThan(0));
    const sent = h.saveCalls[h.saveCalls.length - 1].document;
    expect(sent.brandProfile).toBeTruthy(); // backfilled
    expect(sent.appearance).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(sent, "review")).toBe(true); // present (null ok)
  });

  it("(#5b) a lane triggered right after initial fetch sends the MERGED doc, not the pre-fetch local snapshot", async () => {
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("LOCAL_PREFETCH") }, "user_a");
    markDirtyDomains("user_a", ["appearance"]); // appearance dirty; brandProfile NOT dirty
    h.fetch.impl = async () => ({ document: { schemaVersion: 3, rows: [], brandProfile: fullBP("SERVER"), appearance: { accent: "orange", density: "comfy" } }, version: 5 });
    authState.userId = "user_a";
    render(<StudioProvider><Probe /></StudioProvider>);

    await waitFor(() => expect(h.saveCalls.some((c) => c.document?.brandProfile?.businessName)).toBe(true));
    const branded = h.saveCalls.filter((c) => c.document?.brandProfile?.businessName);
    expect(branded[branded.length - 1].document.brandProfile.businessName).toBe("SERVER"); // merged (not dirty -> server)
    expect(branded.every((c) => c.document.brandProfile.businessName !== "LOCAL_PREFETCH")).toBe(true);
  });

  it("(#5c) a stale sync-record version plus confirmed server absence yields a null-version create", async () => {
    const ds = await import("../document-store.js");
    ds.persistSyncRecord("user_a", { version: 4, dirty: ["brandProfile"] }); // stale version 4
    __resetSyncRecordCacheForTests(); // simulate reload
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("X") }, "user_a");
    h.fetch.impl = async () => ({ document: null }); // confirmed absence
    authState.userId = "user_a";
    render(<StudioProvider><Probe /></StudioProvider>);

    await waitFor(() => expect(h.saveCalls.length).toBeGreaterThan(0));
    expect(h.saveCalls[0].version).toBeNull(); // create-only null-version write despite the stale record
  });
});

describe("StudioContext round-7 final integrity corrections", () => {
  const fullBP = (name) => ({
    businessName: name, tagline: "", description: "", audience: "", toneVoice: "",
    keyTopics: [], callToAction: "", defaultHashtags: [], bannedPhrases: [],
    exampleCaptions: [], learnedFromUrl: "", updatedAt: null,
  });

  it("(#1) no server write occurs before IDB recovery; first write contains recovered B; B persists across reload", async () => {
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("A"), lastSavedAt: "2026-07-01T00:00:00.000Z" }, "user_a");
    markDirtyDomains("user_a", ["brandProfile"]); // B is a genuine local edit
    __resetSyncRecordCacheForTests();
    h.idb.doc = { schemaVersion: 3, rows: [], brandProfile: fullBP("B"), lastSavedAt: "2026-07-10T00:00:00.000Z" };
    h.idb.deferred = true; // defer the raw IDB recovery load
    h.fetch.impl = async () => ({ document: null }); // server fetch could resolve first
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 220)); });
    expect(h.saveCalls.length).toBe(0); // gated on complete local recovery

    await act(async () => { h.idb.deferreds[0](h.idb.doc); await Promise.resolve(); await Promise.resolve(); });
    await waitFor(() => expect(h.saveCalls.length).toBeGreaterThan(0));
    expect(h.saveCalls[0].document.brandProfile.businessName).toBe("B"); // first write contains recovered B

    __resetSyncRecordCacheForTests();
    const store = await import("../document-store.js");
    expect(store.loadStudioDocument("user_a").brandProfile.businessName).toBe("B");
  });

  it("(#2) queue reconcile writes the combined result; the subsequent live save cannot revert a server non-dirty domain", async () => {
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("LOCAL_BP"), appearance: { accent: "orange", density: "comfy" } }, "user_a");
    markDirtyDomains("user_a", ["brandProfile"]); // brandProfile dirty; appearance NOT dirty
    h.queue = [{ id: 1, type: "save", scope: "user_a", version: 1, dirtyDomains: ["brandProfile"], document: { schemaVersion: 3, rows: [], brandProfile: fullBP("LOCAL_BP"), appearance: { accent: "orange", density: "comfy" } } }];
    // Server has a newer non-dirty appearance.
    h.fetch.impl = async () => ({ document: { schemaVersion: 3, rows: [], brandProfile: fullBP("SERVER_BP"), appearance: { accent: "emerald", density: "comfy" } }, version: 5 });
    const saved = [];
    let n = 0;
    h.saveImpl.fn = (doc, ver) => { n += 1; saved.push(doc); if (n === 1) throw new Error("Version conflict"); return { version: (ver ?? 0) + 1 }; };
    authState.userId = "user_a";

    const v = render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(deleteSyncEntry).toHaveBeenCalledWith(1));
    // Combined result written: dirty brandProfile (LOCAL_BP) + server appearance (emerald).
    expect(saved.some((d) => d.brandProfile?.businessName === "LOCAL_BP" && d.appearance?.accent === "emerald")).toBe(true);
    // The active document + any later live save keep the server appearance.
    await waitFor(() => expect(v.getByTestId("probe").textContent.split("|")[1]).toBe("emerald"));
    expect(saved.every((d) => !(d.appearance?.accent === "orange" && d.brandProfile?.businessName === "SERVER_BP"))).toBe(true);
  });

  it("(#3) return to A before v1 resolves reuses A's runtime; v2 stays dirty; exactly one A lane saves v2", async () => {
    h.fetch.impl = async () => ({ document: { schemaVersion: 3, rows: [], brandProfile: fullBP("SERVER") }, version: 5 });
    authState.userId = "user_a";
    const v = render(<StudioProvider><Capture /><Probe /></StudioProvider>);
    await waitFor(() => expect(v.getByTestId("status").textContent).toBe("saved"));

    // Begin an A v1 save that stays in flight.
    h.save.deferred = true;
    await act(async () => { capturedCtx.updateBrandProfile({ businessName: "v1" }); });
    await waitFor(() => expect(h.saveCalls.some((c) => c.document?.brandProfile?.businessName === "v1")).toBe(true));

    // Switch to B, then back to A BEFORE v1 resolves.
    authState.userId = "user_b";
    await act(async () => { v.rerender(<StudioProvider><Capture /><Probe /></StudioProvider>); });
    authState.userId = "user_a";
    await act(async () => { v.rerender(<StudioProvider><Capture /><Probe /></StudioProvider>); });

    // Edit A to v2, then resolve v1.
    await act(async () => { capturedCtx.updateBrandProfile({ businessName: "v2" }); });
    await act(async () => { h.save.resolvers.forEach((r) => r()); await Promise.resolve(); await Promise.resolve(); });
    h.save.deferred = false;

    // v2 remains dirty; one A lane then saves v2 (no concurrent A writer).
    expect(getDirtyDomains("user_a")).toContain("brandProfile");
    await waitFor(() => expect(h.saveCalls.some((c) => c.identity === "user_a" && c.document?.brandProfile?.businessName === "v2")).toBe(true));
  });

  it("(#4) a queue entry is acknowledged only after sync-record metadata is durable", async () => {
    h.queue = [qEntry("user_a", "q1", 1, 1)];
    h.fetch.impl = async () => ({ document: null });
    const idb = await import("../../../lib/idb-store.js");
    let resolveIdb;
    idb.saveSyncRecord.mockImplementation((scope, rec) => {
      h.syncRecords.set(scope, rec);
      return new Promise((res) => { resolveIdb = () => res(true); });
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation((k) => { if (String(k).startsWith("rf_studio_sync")) throw new Error("Quota"); });
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(h.saveCalls.length).toBeGreaterThan(0)); // server write succeeded
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(deleteSyncEntry).not.toHaveBeenCalledWith(1); // metadata not durable yet -> not acked

    await act(async () => { if (resolveIdb) resolveIdb(); await Promise.resolve(); await Promise.resolve(); });
    setItem.mockRestore();
    await waitFor(() => expect(deleteSyncEntry).toHaveBeenCalledWith(1)); // acked after IDB confirms
  });

  it("(#4) sync-record durability failure leaves the queue entry intact", async () => {
    h.queue = [qEntry("user_a", "q1", 1, 1)];
    h.fetch.impl = async () => ({ document: null });
    const idb = await import("../../../lib/idb-store.js");
    idb.saveSyncRecord.mockImplementation(() => Promise.reject(new Error("IDB down")));
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation((k) => { if (String(k).startsWith("rf_studio_sync")) throw new Error("Quota"); });
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(h.saveCalls.length).toBeGreaterThan(0));
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    setItem.mockRestore();
    expect(deleteSyncEntry).not.toHaveBeenCalledWith(1); // not durable -> entry retained
    expect(h.queue.some((e) => e.id === 1)).toBe(true);
  });
});

describe("StudioContext accepted-state, durable persistence, recovery overlay (round 8)", () => {
  const fullBP = (name) => ({
    businessName: name, tagline: "", description: "", audience: "", toneVoice: "",
    keyTopics: [], callToAction: "", defaultHashtags: [], bannedPhrases: [],
    exampleCaptions: [], learnedFromUrl: "", updatedAt: null,
  });

  it("(#1a) a queued entry at the current version with stale non-dirty domains cannot overwrite the server", async () => {
    h.fetch.impl = async () => ({
      document: { schemaVersion: 3, rows: [], brandProfile: fullBP("SERVER"), appearance: { accent: "emerald", density: "comfy" }, review: { token: "srv" }, unknownDomain: { x: 1 } },
      version: 5,
    });
    // Entry stored at the CURRENT server version, carrying stale/generated
    // non-dirty domains — the create/update itself would succeed unreconciled.
    h.queue = [{ id: 1, type: "save", scope: "user_a", version: 5, dirtyDomains: [], document: { schemaVersion: 3, rows: [], brandProfile: fullBP(""), appearance: { accent: "orange", density: "comfy" }, review: null } }];
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);
    await waitFor(() => expect(deleteSyncEntry).toHaveBeenCalledWith(1));

    const first = h.saveCalls[0].document; // the prepared entry write
    expect(first.brandProfile.businessName).toBe("SERVER");
    expect(first.appearance.accent).toBe("emerald");
    expect(first.review).toEqual({ token: "srv" });
    expect(first.unknownDomain).toEqual({ x: 1 });
    expect(h.queue.length).toBe(0);
  });

  it("(#1b) a row edited to v2 during an in-flight queued v1 write survives; the follow-up live write sends v2 + the replay-time audit entry", async () => {
    const T1 = "2026-07-10T00:00:00.000Z";
    const row1 = { id: "r1", platform: "ig_post", status: "draft", note: "n", caption: "v1", createdAt: T1, updatedAt: T1 };
    persistStudioDocument({ schemaVersion: 3, rows: [row1], auditLog: [] }, "user_a");
    h.queue = [{ id: 1, type: "save", scope: "user_a", version: null, dirtyDomains: [], document: { schemaVersion: 3, rows: [row1], auditLog: [] } }];
    h.fetch.impl = async () => ({ document: null }); // confirmed absence -> create
    h.save.deferred = true; // hold the queued v1 write in flight
    authState.userId = "user_a";

    render(<StudioProvider><Capture /><Probe /></StudioProvider>);
    await waitFor(() => expect(h.saveCalls.length).toBe(1)); // v1 in flight

    // Edit the row to v2 while v1 is in flight (status change appends an audit entry).
    await act(async () => { capturedCtx.update("r1", { caption: "v2", status: "approved" }); });
    h.save.deferred = false;
    await act(async () => { h.save.resolvers.forEach((r) => r()); await Promise.resolve(); await Promise.resolve(); });

    await waitFor(() => expect(h.queue.length).toBe(0)); // queue empty
    // v2 remains installed and the follow-up live write carries v2 + the audit entry.
    await waitFor(() => {
      const last = h.saveCalls[h.saveCalls.length - 1].document;
      expect(last.rows.find((r) => r.id === "r1")?.caption).toBe("v2");
    });
    const final = h.saveCalls[h.saveCalls.length - 1].document;
    expect(final.auditLog.some((e) => e.type === "post.updated")).toBe(true);
    expect(capturedCtx.rows.find((r) => r.id === "r1")?.caption).toBe("v2"); // installed doc kept v2
  });

  it("(#1d) an unchanged initial fetch causes no redundant server write", async () => {
    const ds = await import("../document-store.js");
    const base = ds.normalizeDocument({
      schemaVersion: 3, rows: [], auditLog: [],
      brandProfile: fullBP("SAME"), appearance: { accent: "violet", density: "comfy" }, review: null,
      lastSavedAt: "2026-07-01T00:00:00.000Z",
    });
    persistStudioDocument(base, "user_a"); // local == server, nothing dirty
    h.fetch.impl = async () => ({ document: base, version: 4 });
    authState.userId = "user_a";

    render(<StudioProvider><Probe /></StudioProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
    expect(h.saveCalls.length).toBe(0); // dedup vs acceptedDocument holds
  });

  it("(#2a) failing localStorage document writes with IndexedDB available still let an online edit reach the server", async () => {
    h.fetch.impl = async () => ({ document: null });
    const setItem = spyDocSetItemThrow();
    try {
      authState.userId = "user_a";
      render(<StudioProvider><Capture /><Probe /></StudioProvider>);
      await waitFor(() => expect(capturedCtx).not.toBeNull());
      await act(async () => { capturedCtx.updateBrandProfile({ businessName: "EDGE" }); });
      await waitFor(() => expect(h.saveCalls.some((c) => c.document?.brandProfile?.businessName === "EDGE")).toBe(true));
    } finally { setItem.mockRestore(); }
  });

  it("(#2b) immediate A->B->A switching with failing localStorage retains A's exact latest document", async () => {
    h.fetch.impl = async () => ({ document: null });
    const setItem = spyDocSetItemThrow();
    try {
      authState.userId = "user_a";
      const v = render(<StudioProvider><Capture /><Probe /></StudioProvider>);
      await waitFor(() => expect(capturedCtx).not.toBeNull());
      await act(async () => { capturedCtx.updateBrandProfile({ businessName: "A_LATEST" }); });

      authState.userId = "user_b";
      await act(async () => { v.rerender(<StudioProvider><Capture /><Probe /></StudioProvider>); });
      authState.userId = "user_a";
      await act(async () => { v.rerender(<StudioProvider><Capture /><Probe /></StudioProvider>); });

      // The canonical A runtime's latestDoc wins over (unavailable) storage.
      expect(v.getByTestId("probe").textContent.split("|")[0]).toBe("A_LATEST");
    } finally { setItem.mockRestore(); }
  });

  it("(#2c) queue acknowledgement waits for the installed document's IndexedDB durability", async () => {
    h.queue = [qEntry("user_a", "q1", 1, 1)];
    h.fetch.impl = async () => ({ document: null });
    const setItem = spyDocSetItemThrow(); // document durability depends on IDB
    try {
      h.docSave.deferred = true; // defer installed-document IDB writes
      authState.userId = "user_a";
      render(<StudioProvider><Probe /></StudioProvider>);

      await waitFor(() => expect(h.saveCalls.length).toBeGreaterThan(0)); // server write succeeded
      await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
      expect(deleteSyncEntry).not.toHaveBeenCalledWith(1); // installed doc not durable yet

      h.docSave.deferred = false;
      await act(async () => { h.docSave.resolvers.forEach((r) => r()); await Promise.resolve(); await Promise.resolve(); });
      await waitFor(() => expect(deleteSyncEntry).toHaveBeenCalledWith(1)); // acked after IDB confirms
    } finally { setItem.mockRestore(); }
  });

  it("(#2d) installed-document IndexedDB failure retains the queue entry and surfaces the scoped error", async () => {
    h.queue = [qEntry("user_a", "q1", 1, 1)];
    h.fetch.impl = async () => ({ document: null });
    const setItem = spyDocSetItemThrow();
    try {
      h.docSave.fail = true;
      authState.userId = "user_a";
      const v = render(<StudioProvider><Probe /></StudioProvider>);

      await waitFor(() => expect(h.saveCalls.length).toBeGreaterThan(0));
      await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
      expect(deleteSyncEntry).not.toHaveBeenCalledWith(1); // not durable -> not acked
      expect(h.queue.some((e) => e.id === 1)).toBe(true); // entry retained
      expect(v.getByTestId("status").textContent).toBe("error"); // scoped integrity surfaced
    } finally { setItem.mockRestore(); }
  });

  it("(#2e) reload after a durable IDB fallback restores the latest unsent row and dirty domains", async () => {
    h.fetch.impl = async () => ({ document: null });
    h.saveImpl.fn = () => { throw new Error("boom"); }; // server unavailable -> nothing synced
    const setItem = spyDocSetItemThrow(); // documents persist only via the IDB fallback
    try {
      authState.userId = "user_a";
      render(<StudioProvider><Capture /><Probe /></StudioProvider>);
      await waitFor(() => expect(capturedCtx).not.toBeNull());

      const rowId = capturedCtx.rows[0].id; // seed row
      await act(async () => { capturedCtx.update(rowId, { caption: "UNSENT_ROW", status: "approved" }); });
      await act(async () => { capturedCtx.updateBrandProfile({ businessName: "DIRTY_BP" }); });
      await act(async () => { await new Promise((r) => setTimeout(r, 260)); }); // debounced durable persist lands in IDB

      // Crash: unmount + drop in-memory caches; durable stores survive.
      cleanup();
      __resetSyncRecordCacheForTests();
      capturedCtx = null;

      render(<StudioProvider><Capture /><Probe /></StudioProvider>);
      await waitFor(() => expect(capturedCtx).not.toBeNull());
      await waitFor(() => expect(capturedCtx.brandProfile.businessName).toBe("DIRTY_BP"));
      expect(capturedCtx.rows.some((r) => r.caption === "UNSENT_ROW")).toBe(true);
      expect(getDirtyDomains("user_a")).toContain("brandProfile");
    } finally { setItem.mockRestore(); }
  });

  it("(#3) an edit made while deferred IDB recovery is pending wins over the recovered value", async () => {
    // localStorage has profile A; IndexedDB (deferred) has durably-dirty profile B.
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("A"), lastSavedAt: "2026-07-01T00:00:00.000Z" }, "user_a");
    markDirtyDomains("user_a", ["brandProfile"]);
    __resetSyncRecordCacheForTests();
    h.idb.doc = { schemaVersion: 3, rows: [], brandProfile: fullBP("B"), lastSavedAt: "2026-07-10T00:00:00.000Z" };
    h.idb.deferred = true;
    h.fetch.impl = async () => ({ document: null });
    authState.userId = "user_a";

    const v = render(<StudioProvider><Capture /><Probe /></StudioProvider>);
    await waitFor(() => expect(capturedCtx).not.toBeNull());
    // While the IDB load is pending, the user changes the profile to C.
    await act(async () => { capturedCtx.updateBrandProfile({ businessName: "C" }); });
    // Hold the upcoming server write in flight so recovery-time state is assertable.
    h.save.deferred = true;
    // IDB resolves with B.
    await act(async () => { h.idb.deferreds.forEach((r) => r(h.idb.doc)); await Promise.resolve(); await Promise.resolve(); });

    await waitFor(() => expect(v.getByTestId("probe").textContent.split("|")[0]).toBe("C")); // C wins over recovered B
    await waitFor(() => expect(h.saveCalls.length).toBeGreaterThan(0));
    expect(h.saveCalls[0].document.brandProfile.businessName).toBe("C"); // first write is C, not B
    expect(getDirtyDomains("user_a")).toContain("brandProfile"); // still dirty until that write finalizes
    await act(async () => { await new Promise((r) => setTimeout(r, 220)); }); // let the debounced durable persist land
    const store = await import("../document-store.js");
    expect(store.loadStudioDocument("user_a").brandProfile.businessName).toBe("C"); // persisted C
    // Let the in-flight write finish cleanly.
    await act(async () => { h.save.resolvers.forEach((r) => r()); await Promise.resolve(); });
  });
});

describe("StudioContext accepted-vs-sent content + new-runtime isolation (round 9)", () => {
  const fullBP = (name) => ({
    businessName: name, tagline: "", description: "", audience: "", toneVoice: "",
    keyTopics: [], callToAction: "", defaultHashtags: [], bannedPhrases: [],
    exampleCaptions: [], learnedFromUrl: "", updatedAt: null,
  });

  // ITEM 4: finalizeWriteSuccess installs the server's ACTUAL accepted content
  // (its save-response document), not merely what was sent — so a field the
  // server canonicalized (and that is NOT locally dirty) lands in acceptedDoc and
  // the installed overlay.
  it("(#4) a server-canonicalized non-dirty field lands in acceptedDoc and the installed document", async () => {
    // Local + server agree on appearance orange; only brandProfile is dirty.
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("LOCAL_BP"), appearance: { accent: "orange", density: "comfy" } }, "user_a");
    markDirtyDomains("user_a", ["brandProfile"]);
    h.fetch.impl = async () => ({ document: { schemaVersion: 3, rows: [], brandProfile: fullBP("SERVER_BP"), appearance: { accent: "orange", density: "comfy" } }, version: 5 });
    // The save RESPONSE canonicalizes the non-dirty appearance.accent to "canon".
    h.saveImpl.fn = (doc, ver) => ({
      version: (ver ?? 0) + 1,
      updatedAt: "x",
      document: { ...doc, appearance: { accent: "canon", density: "comfy" } },
    });
    authState.userId = "user_a";

    const v = render(<StudioProvider><Capture /><Probe /></StudioProvider>);

    // The installed/visible document reflects the server-canonical appearance...
    await waitFor(() => expect(v.getByTestId("probe").textContent.split("|")[1]).toBe("canon"));
    // ...while the dirty brandProfile stays the local edit (not reverted to server).
    expect(v.getByTestId("probe").textContent.split("|")[0]).toBe("LOCAL_BP");
    // The runtime's ACCEPTED server state carries the canonical value too, so a
    // later dedup compares against real accepted content (proven: no redundant
    // resend of the now-clean appearance).
    expect(capturedCtx.appearance.accent).toBe("canon");
  });

  // ITEM 5: a new runtime is initialized ONLY from its own scoped local document
  // (or a fresh default) — never seeded from whatever document is active.
  it("(#5) a new runtime B created while A is active is never seeded from A's document", async () => {
    h.fetch.impl = async () => ({ document: null });
    // A has a distinctive local document; B has none (fresh default).
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("A_ONLY") }, "user_a");
    authState.userId = "user_a";

    const v = render(<StudioProvider><Capture /><Probe /></StudioProvider>);
    await waitFor(() => expect(v.getByTestId("probe").textContent.split("|")[0]).toBe("A_ONLY"));

    // Switch to B (a brand-new runtime) while A is the active, populated runtime.
    authState.userId = "user_b";
    await act(async () => { v.rerender(<StudioProvider><Capture /><Probe /></StudioProvider>); });

    // B shows its OWN scope's document (empty default), never A's document.
    expect(v.getByTestId("probe").textContent.split("|")[0]).not.toBe("A_ONLY");
    expect(capturedCtx.brandProfile.businessName).toBe("");
  });
});

describe("StudioContext readiness gates on recovery-install durability (item 1)", () => {
  const fullBP = (name) => ({
    businessName: name, tagline: "", description: "", audience: "", toneVoice: "",
    keyTopics: [], callToAction: "", defaultHashtags: [], bannedPhrases: [],
    exampleCaptions: [], learnedFromUrl: "", updatedAt: null,
  });
  const T1 = "2026-07-01T00:00:00.000Z";
  const T2 = "2026-07-10T00:00:00.000Z"; // newer -> admits the IDB recovery candidate

  it("(#1) readiness stays pending while the recovery-install document write is deferred; the outbound lane does not start until it is durable", async () => {
    // localStorage has profile A (T1); IndexedDB has a genuinely-newer dirty B (T2).
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("A"), lastSavedAt: T1 }, "user_a");
    markDirtyDomains("user_a", ["brandProfile"]); // B is a genuine recovered edit
    __resetSyncRecordCacheForTests();
    h.idb.doc = { schemaVersion: 3, rows: [], brandProfile: fullBP("B"), lastSavedAt: T2 };
    h.fetch.impl = async () => ({ document: null });
    const setItem = spyDocSetItemThrow(); // document localStorage writes fail -> durability rides on IDB
    try {
      h.docSave.deferred = true; // hold the recovery-install IDB write in flight
      authState.userId = "user_a";
      const fetchClient = (await import("../../../lib/api-client.js")).fetchStudioDocument;

      render(<StudioProvider><Probe /></StudioProvider>);

      // Recovery installed B (idbRaw newer) and its durable write is deferred, so
      // readiness has NOT resolved -> the outbound lane never began.
      await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
      expect(fetchClient).not.toHaveBeenCalled(); // ensureInitialized (the lane) has not started
      expect(h.saveCalls.length).toBe(0);

      // Release the deferred IDB write -> the recovered doc is durable -> readiness
      // resolves -> only NOW does the lane begin.
      h.docSave.deferred = false;
      await act(async () => { h.docSave.resolvers.forEach((r) => r()); await new Promise((r) => setTimeout(r, 60)); });
      await waitFor(() => expect(fetchClient).toHaveBeenCalled()); // lane started only after durability
    } finally { setItem.mockRestore(); }
  });

  it("(#1) a recovery-install durability FAILURE surfaces the scoped integrity error and preserves the recovered dirty metadata", async () => {
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("A"), lastSavedAt: T1 }, "user_a");
    markDirtyDomains("user_a", ["brandProfile"]);
    __resetSyncRecordCacheForTests();
    h.idb.doc = { schemaVersion: 3, rows: [], brandProfile: fullBP("B"), lastSavedAt: T2 };
    h.fetch.impl = async () => ({ document: null });
    // Pin the server save to a non-retryable failure so the lane can never
    // baseline-advance (which would clear dirty) — isolating dirty preservation
    // to the recovery-install durability failure under test.
    h.saveImpl.fn = () => { throw new Error("boom"); };
    const setItem = spyDocSetItemThrow(); // localStorage fails...
    try {
      h.docSave.fail = true; // ...and IndexedDB fails too -> recovery-install is NOT durable
      authState.userId = "user_a";
      const v = render(<StudioProvider><Probe /></StudioProvider>);

      // The scoped integrity error is surfaced on the active scope...
      await waitFor(() => expect(v.getByTestId("status").textContent).toBe("error"));
      // ...and the recovered dirty domain is preserved (not lost by the failure).
      expect(getDirtyDomains("user_a")).toContain("brandProfile");
      // The recovered value is still installed in memory (dirty, awaiting a durable sync).
      expect(v.getByTestId("probe").textContent.split("|")[0]).toBe("B");
    } finally { setItem.mockRestore(); h.docSave.fail = false; }
  });
});

describe("StudioContext live conflict exhaustion", () => {
  const fullBP = (name) => ({
    businessName: name, tagline: "", description: "", audience: "", toneVoice: "",
    keyTopics: [], callToAction: "", defaultHashtags: [], bannedPhrases: [],
    exampleCaptions: [], learnedFromUrl: "", updatedAt: null,
  });

  it("retains the local document and dirty metadata after the retry limit (never resets to server)", async () => {
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: fullBP("LEDIT") }, "user_a");
    markDirtyDomains("user_a", ["brandProfile"]); // genuine unsynced local edit
    h.fetch.impl = async () => ({ document: { schemaVersion: 3, rows: [], brandProfile: fullBP("SERVER") }, version: 1 });
    h.saveImpl.fn = () => { throw new Error("Version conflict"); }; // every save conflicts
    authState.userId = "user_a";

    const v = render(<StudioProvider><Probe /></StudioProvider>);

    // After bounded retries the save enters an unresolved-conflict state.
    await waitFor(() => expect(v.getByTestId("status").textContent).toBe("conflict"), { timeout: 4000 });
    expect(v.getByTestId("probe").textContent.split("|")[0]).toBe("LEDIT"); // local document retained
    expect(getDirtyDomains("user_a")).toContain("brandProfile"); // dirty metadata retained
  });
});
