import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  __resetSyncRecordCacheForTests,
  acceptServerSnapshot,
  advanceBaselineOnSave,
  applyRowPatch,
  changedTopLevelDomains,
  CONFLICT_RETRY_LIMIT,
  createDefaultAppearance,
  createDefaultBrandProfile,
  createNewRow,
  getDirtyDomains,
  loadStudioDocument,
  loadSyncRecord,
  markDirtyDomains,
  mergeRecoveredIdbDocument,
  mergeStudioDocuments,
  pickHigherRevisionRecord,
  normalizeBrandProfile,
  normalizeDocument,
  normalizeRow,
  persistStudioDocument,
  reconcileSaveConflict,
} from "../document-store.js";

// normalizeRow is a WHITELIST: any field it doesn't copy is silently
// stripped from the row on every patch. These tests pin the fields that
// other parts of the app write (media, carousel, scheduler write-backs)
// so the whitelist can't regress without a failing test.

describe("normalizeRow field preservation", () => {
  const fullRow = () => normalizeRow({
    id: "r1",
    note: "A post",
    platform: "ig_post",
    status: "draft",
    mediaUrl: "https://cdn.example/img.png",
    thumbnailUrl: "https://cdn.example/thumb.png",
    imageUrl: "https://cdn.example/legacy.png",
    videoUrl: "https://cdn.example/vid.mp4",
    mediaKind: "carousel",
    carouselSlides: [{ id: "s1" }, { id: "s2" }],
    tags: ["studio-notes", "design"],
    reelDuration: 42,
    igPostId: "igp_1",
    liPostUrn: "urn:li:share:1",
    liPermalink: "https://linkedin.com/feed/1",
    publishError: "boom",
    publishErrorAt: "2026-06-01T00:00:00.000Z",
    publishMode: "manual",
    storyLink: "https://rangerandfox.tv",
    platforms: ["ig_post", "linkedin"],
    firstComment: "First comment with #hashtags",
    storyLayouts: { ig_post: [[{ id: "bg" }]], linkedin: [[{ id: "bg" }]] },
    storyPreset: "linkedin",
    storyFrameIds: ["f1", "f2"],
  });

  it("keeps media + editorial + scheduler write-back fields", () => {
    const row = fullRow();
    expect(row.mediaUrl).toBe("https://cdn.example/img.png");
    expect(row.thumbnailUrl).toBe("https://cdn.example/thumb.png");
    expect(row.imageUrl).toBe("https://cdn.example/legacy.png");
    expect(row.videoUrl).toBe("https://cdn.example/vid.mp4");
    expect(row.mediaKind).toBe("carousel");
    expect(row.carouselSlides).toHaveLength(2);
    expect(row.tags).toEqual(["studio-notes", "design"]);
    expect(row.reelDuration).toBe(42);
    expect(row.igPostId).toBe("igp_1");
    expect(row.liPostUrn).toBe("urn:li:share:1");
    expect(row.liPermalink).toBe("https://linkedin.com/feed/1");
    expect(row.publishError).toBe("boom");
    expect(row.publishErrorAt).toBe("2026-06-01T00:00:00.000Z");
    expect(row.publishMode).toBe("manual");
    expect(row.storyLink).toBe("https://rangerandfox.tv");
    expect(row.platforms).toEqual(["ig_post", "linkedin"]);
    expect(row.firstComment).toBe("First comment with #hashtags");
    // Designer per-outlet state — losing these resets outlet layouts and
    // the size dropdown on every save (gotcha #1 class).
    expect(row.storyLayouts).toEqual({ ig_post: [[{ id: "bg" }]], linkedin: [[{ id: "bg" }]] });
    expect(row.storyPreset).toBe("linkedin");
    expect(row.storyFrameIds).toEqual(["f1", "f2"]);
  });

  it("survives an unrelated patch (the original data-loss bug)", () => {
    const patched = applyRowPatch(fullRow(), { note: "Renamed" }, "tester");
    expect(patched.note).toBe("Renamed");
    expect(patched.mediaUrl).toBe("https://cdn.example/img.png");
    expect(patched.carouselSlides).toHaveLength(2);
    expect(patched.mediaKind).toBe("carousel");
    expect(patched.reelDuration).toBe(42);
    expect(patched.publishError).toBe("boom");
    expect(patched.liPermalink).toBe("https://linkedin.com/feed/1");
    expect(patched.publishMode).toBe("manual");
    expect(patched.platforms).toEqual(["ig_post", "linkedin"]);
  });

  it("preserves mediaItems across a patch (multi-image gallery)", () => {
    const items = [{ url: "https://cdn.example/1.jpg", kind: "image" }, { url: "https://cdn.example/2.jpg", kind: "image" }];
    const row = normalizeRow({ note: "gallery", mediaItems: items });
    expect(row.mediaItems).toEqual(items);
    const patched = applyRowPatch(row, { caption: "hi" }, "tester");
    expect(patched.mediaItems).toEqual(items);
  });

  it("createNewRow carries gallery + channel overrides onto the new row", () => {
    const items = [{ url: "https://cdn.example/1.jpg", kind: "image" }, { url: "https://cdn.example/2.jpg", kind: "image" }];
    const row = createNewRow({
      note: "gallery post",
      platform: "ig_post",
      platforms: ["ig_post", "linkedin"],
      mediaItems: items,
      mediaKind: "carousel",
      mediaUrl: items[0].url,
      thumbnailUrl: items[0].url,
    }, "tester", 0);
    expect(row.mediaItems).toEqual(items);
    expect(row.mediaKind).toBe("carousel");
    expect(row.mediaUrl).toBe(items[0].url);
    expect(row.thumbnailUrl).toBe(items[0].url);
    expect(row.platforms).toEqual(["ig_post", "linkedin"]);
  });

  it("defaults missing fields without inventing data", () => {
    const row = normalizeRow({ note: "bare" });
    expect(row.mediaUrl).toBeNull();
    expect(row.carouselSlides).toBeNull();
    expect(row.tags).toEqual([]);
    expect(row.reelDuration).toBeNull();
    expect(row.publishMode).toBe("auto");
    expect(row.platforms).toEqual([row.platform]);
  });
});

describe("mergeStudioDocuments (conflict/poll merge)", () => {
  const doc = (rows, extra = {}) => ({ rows, auditLog: [], ...extra });
  const row = (id, updatedAt, fields = {}) => ({ id, updatedAt, ...fields });

  it("keeps the local row when it is newer (typing survives a refresh)", () => {
    const local = doc([row("a", "2026-07-07T10:00:05Z", { caption: "typed locally" })]);
    const server = doc([row("a", "2026-07-07T10:00:00Z", { caption: "stale" })]);
    const merged = mergeStudioDocuments(server, local);
    expect(merged.rows).toHaveLength(1);
    expect(merged.rows[0].caption).toBe("typed locally");
  });

  it("takes the server row when it is newer (scheduler outcomes land)", () => {
    const local = doc([row("a", "2026-07-07T10:00:00Z", { status: "scheduled" })]);
    const server = doc([row("a", "2026-07-07T10:00:09Z", { status: "posted" })]);
    const merged = mergeStudioDocuments(server, local);
    expect(merged.rows[0].status).toBe("posted");
  });

  it("keeps rows that exist on only one side, local order first", () => {
    const local = doc([row("a", "2026-07-07T10:00:00Z"), row("new-local", "2026-07-07T10:00:01Z")]);
    const server = doc([row("a", "2026-07-07T10:00:00Z"), row("new-server", "2026-07-07T10:00:02Z")]);
    const merged = mergeStudioDocuments(server, local);
    expect(merged.rows.map((r) => r.id)).toEqual(["a", "new-local", "new-server"]);
  });

  it("prefers the longer audit log; keeps an explicitly dirty local domain", () => {
    const local = doc([], { instagram: { account: "local" }, auditLog: [{ id: 1 }] });
    const server = doc([], { instagram: { account: "server" }, auditLog: [{ id: 1 }, { id: 2 }] });
    const merged = mergeStudioDocuments(server, local, { dirtyDomains: ["instagram"] });
    expect(merged.auditLog).toHaveLength(2);
    expect(merged.instagram.account).toBe("local");
  });

  it("treats a missing updatedAt as oldest", () => {
    const local = doc([row("a", undefined, { caption: "no stamp" })]);
    const server = doc([row("a", "2026-07-07T10:00:00Z", { caption: "stamped" })]);
    const merged = mergeStudioDocuments(server, local);
    expect(merged.rows[0].caption).toBe("stamped");
  });
});

// ── Document contract: normalization preserves every domain + unknown fields ──
describe("normalizeDocument / load field preservation", () => {
  beforeEach(() => localStorage.clear());

  const validRow = () => normalizeRow({ id: "r1", platform: "ig_post", status: "draft", note: "n" });

  it("survives a fully populated persist → reload round trip", () => {
    const scope = "user_roundtrip";
    const full = {
      schemaVersion: 3,
      rows: [validRow()],
      auditLog: [],
      instagram: { account: { id: "acct" }, media: null, syncedAt: null },
      brandProfile: normalizeBrandProfile({ businessName: "Acme", keyTopics: ["design"] }),
      appearance: { accent: "violet", density: "dense" },
      review: { token: "share-tok" },
      lastSavedAt: "2026-07-01T00:00:00.000Z",
      customUnknownDomain: { foo: 1 },
    };
    persistStudioDocument(full, scope);
    const loaded = loadStudioDocument(scope);

    expect(loaded.brandProfile.businessName).toBe("Acme");
    expect(loaded.brandProfile.keyTopics).toEqual(["design"]);
    expect(loaded.appearance).toEqual({ accent: "violet", density: "dense" });
    expect(loaded.review).toEqual({ token: "share-tok" });
    expect(loaded.instagram.account.id).toBe("acct");
    expect(loaded.rows).toHaveLength(1);
    expect(loaded.customUnknownDomain).toEqual({ foo: 1 }); // unknown field retained
  });

  it("backfills every current domain on a legacy doc lacking them, keeping unknown fields", () => {
    const scope = "user_legacy";
    persistStudioDocument({ rows: [validRow()], weirdLegacyField: "keep-me" }, scope); // no schemaVersion/brandProfile/appearance/review
    const loaded = loadStudioDocument(scope);

    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.brandProfile).toEqual(createDefaultBrandProfile());
    expect(loaded.appearance).toEqual(createDefaultAppearance());
    expect(loaded.review).toBeNull();
    expect(loaded.weirdLegacyField).toBe("keep-me");
    expect(loaded.rows).toHaveLength(1);
  });

  it("normalizeDocument keeps unknown fields and never drops brandProfile/appearance/review", () => {
    const out = normalizeDocument({
      rows: [validRow()],
      brandProfile: { businessName: "Keep" },
      appearance: { accent: "cobalt", density: "comfy" },
      review: { token: "t" },
      experimentalFlag: true,
    });
    expect(out.brandProfile.businessName).toBe("Keep");
    expect(out.appearance.accent).toBe("cobalt");
    expect(out.review).toEqual({ token: "t" });
    expect(out.experimentalFlag).toBe(true);
  });

  it("preserves an EXPLICIT empty rows array (a cleared board is not re-seeded)", () => {
    // normalizeDocument keeps an explicit []; only a missing/invalid rows field
    // (a genuinely new document) receives seed rows via createInitialDocument.
    expect(normalizeDocument({ schemaVersion: 3, rows: [] }).rows).toEqual([]);
    expect(normalizeDocument({ schemaVersion: 3 }).rows.length).toBeGreaterThan(0); // missing -> seeded

    const scope = "user_empty";
    persistStudioDocument({ schemaVersion: 3, rows: [], brandProfile: normalizeBrandProfile({ businessName: "Solo" }) }, scope);
    const loaded = loadStudioDocument(scope);
    expect(loaded.rows).toEqual([]); // survives persist -> reload
    expect(loaded.brandProfile.businessName).toBe("Solo");
  });
});

// ── Merge contract: EXPLICIT dirty-domain resolution (no value inference) ──
describe("mergeStudioDocuments explicit dirty-domain contract", () => {
  const bp = (name) => ({ ...createDefaultBrandProfile(), businessName: name });

  it("a non-dirty local domain (even a diverging value) loses to the server", () => {
    const server = { rows: [], brandProfile: bp("Acme") };
    const local = { rows: [], brandProfile: bp("LocalOnly") }; // differs, but NOT dirty
    const merged = mergeStudioDocuments(server, local, { dirtyDomains: [] });
    expect(merged.brandProfile.businessName).toBe("Acme");
  });

  it("a generated local default is never dirty → server wins", () => {
    const server = { rows: [], brandProfile: bp("Acme") };
    const local = { rows: [], brandProfile: createDefaultBrandProfile() };
    const merged = mergeStudioDocuments(server, local, { dirtyDomains: [] });
    expect(merged.brandProfile.businessName).toBe("Acme");
  });

  it("an explicitly dirty domain keeps the local value", () => {
    const server = { rows: [], brandProfile: bp("Server") };
    const local = { rows: [], brandProfile: bp("LocalEdit") };
    const merged = mergeStudioDocuments(server, local, { dirtyDomains: ["brandProfile"] });
    expect(merged.brandProfile.businessName).toBe("LocalEdit");
  });

  it("explicit local null wins ONLY when the domain is dirty", () => {
    const server = { rows: [], review: { token: "srv" } };
    const dirty = mergeStudioDocuments(server, { rows: [], review: null }, { dirtyDomains: ["review"] });
    expect(dirty.review).toBeNull();
    const clean = mergeStudioDocuments(server, { rows: [], review: null }, { dirtyDomains: [] });
    expect(clean.review).toEqual({ token: "srv" }); // not dirty -> server value kept
  });

  it("a dirty flag with no local value present cannot override the server", () => {
    const server = { rows: [], appearance: { accent: "emerald", density: "comfy" } };
    const local = { rows: [] }; // no appearance key at all
    const merged = mergeStudioDocuments(server, local, { dirtyDomains: ["appearance"] });
    expect(merged.appearance).toEqual({ accent: "emerald", density: "comfy" });
  });

  it("row updatedAt merge is intact regardless of dirty domains", () => {
    const server = { rows: [{ id: "a", updatedAt: "2026-07-07T10:00:09Z", caption: "server" }] };
    const local = { rows: [{ id: "a", updatedAt: "2026-07-07T10:00:00Z", caption: "local" }], brandProfile: bp("x") };
    const merged = mergeStudioDocuments(server, local, { dirtyDomains: ["brandProfile"] });
    expect(merged.rows[0].caption).toBe("server"); // newer server row wins
  });
});

// ── Explicit dirty-domain metadata: capture, persistence, clearing ──
describe("sync record + dirty-domain metadata", () => {
  beforeEach(() => { localStorage.clear(); __resetSyncRecordCacheForTests(); });

  it("changedTopLevelDomains reports mutated domains, excluding rows/audit/bookkeeping", () => {
    const prev = { rows: [{ id: "a" }], auditLog: [], brandProfile: { businessName: "x" }, appearance: { accent: "orange" }, lastSavedAt: "t1", schemaVersion: 3 };
    const next = { rows: [{ id: "b" }], auditLog: [{ id: 1 }], brandProfile: { businessName: "y" }, appearance: { accent: "orange" }, lastSavedAt: "t2", schemaVersion: 3 };
    expect(changedTopLevelDomains(prev, next)).toEqual(["brandProfile"]);
  });

  it("markDirtyDomains is durable, per-scope, idempotent, and excludes rows", () => {
    markDirtyDomains("user_a", ["brandProfile", "rows"]);
    markDirtyDomains("user_a", ["brandProfile", "appearance"]);
    expect(getDirtyDomains("user_a").sort()).toEqual(["appearance", "brandProfile"]);
    expect(getDirtyDomains("user_b")).toEqual([]);
  });

  it("the record stores only { version, dirty } — no full baseline document", () => {
    markDirtyDomains("user_a", ["brandProfile"]);
    acceptServerSnapshot("user_a", { version: 5 });
    const rec = loadSyncRecord("user_a");
    expect(rec.version).toBe(5);
    expect(rec.dirty).toEqual(["brandProfile"]); // preserved across a server accept
    expect(rec.baseline).toBeUndefined(); // no full-document duplication
    expect(Object.keys(rec).sort()).toEqual(["dirty", "revision", "version"]); // minimal record + monotonic revision
    expect(typeof rec.revision).toBe("number");
  });

  it("persistSyncRecord bumps a monotonic revision on every mutation", () => {
    markDirtyDomains("user_a", ["brandProfile"]);
    const r1 = loadSyncRecord("user_a").revision;
    markDirtyDomains("user_a", ["appearance"]);
    const r2 = loadSyncRecord("user_a").revision;
    acceptServerSnapshot("user_a", { version: 2 });
    const r3 = loadSyncRecord("user_a").revision;
    expect(r2).toBeGreaterThan(r1);
    expect(r3).toBeGreaterThan(r2);
  });

  it("pickHigherRevisionRecord keeps the higher revision (out-of-order write guard rule)", () => {
    const hi = { revision: 5, version: 9, dirty: ["brandProfile"] };
    const lo = { revision: 2, version: 3, dirty: ["appearance"] };
    expect(pickHigherRevisionRecord(hi, lo)).toEqual(hi); // an older (lower-rev) write cannot win
    expect(pickHigherRevisionRecord(lo, hi)).toEqual(hi);
    // A legacy record (no revision -> 0) never beats a revisioned one.
    expect(pickHigherRevisionRecord({ version: 1, dirty: ["review"] }, lo)).toEqual({ revision: 2, version: 3, dirty: ["appearance"] });
  });

  it("advanceBaselineOnSave clears a sent domain that is unchanged, retains one edited in-flight", () => {
    markDirtyDomains("user_a", ["brandProfile", "appearance"]);
    const sent = { schemaVersion: 3, rows: [], brandProfile: { businessName: "Sent" }, appearance: { accent: "violet" } };
    // brandProfile still equals what was sent; appearance was edited while in flight.
    const current = { schemaVersion: 3, rows: [], brandProfile: { businessName: "Sent" }, appearance: { accent: "cobalt" } };
    advanceBaselineOnSave("user_a", { sentDocument: sent, savedVersion: 6, sentDirty: ["brandProfile", "appearance"], currentDocument: current });
    const rec = loadSyncRecord("user_a");
    expect(rec.version).toBe(6);
    expect(rec.dirty).toEqual(["appearance"]); // brandProfile cleared, appearance retained
  });
});

// ── Anonymous → authenticated import (#8) ──
describe("loadStudioDocument anonymous→authenticated import", () => {
  beforeEach(() => localStorage.clear());

  it("adopts a scope-less legacy document whole, keeping every current + unknown domain", () => {
    const legacy = {
      schemaVersion: 3,
      rows: [normalizeRow({ id: "r1", platform: "ig_post", status: "draft", note: "n" })],
      auditLog: [],
      instagram: { account: { id: "ig" }, media: null, syncedAt: null },
      brandProfile: normalizeBrandProfile({ businessName: "Imported" }),
      appearance: { accent: "cobalt", density: "dense" },
      review: { token: "rev" },
      experimentalDomain: { keep: true },
    };
    localStorage.setItem("rf_studio_document", JSON.stringify(legacy)); // pre-scope key
    const loaded = loadStudioDocument("user_new"); // no scoped key yet

    expect(loaded.brandProfile.businessName).toBe("Imported");
    expect(loaded.appearance).toEqual({ accent: "cobalt", density: "dense" });
    expect(loaded.review).toEqual({ token: "rev" });
    expect(loaded.instagram.account.id).toBe("ig");
    expect(loaded.experimentalDomain).toEqual({ keep: true });
  });

  it("(#11) the same scope-less legacy document cannot be imported into a second account", () => {
    const legacy = { schemaVersion: 3, rows: [], brandProfile: normalizeBrandProfile({ businessName: "Imported" }) };
    localStorage.setItem("rf_studio_document", JSON.stringify(legacy));

    const first = loadStudioDocument("user_first"); // claims the legacy doc
    expect(first.brandProfile.businessName).toBe("Imported");

    const second = loadStudioDocument("user_second"); // must NOT re-import it
    expect(second.brandProfile.businessName).toBe(""); // fresh default, not "Imported"
  });

  it("(#5) two authenticated accounts cannot import the same legacy rows/media", () => {
    localStorage.setItem("rf_rows", JSON.stringify([{ id: "r1", platform: "ig_post", status: "draft" }]));
    localStorage.setItem("rf_ig_media", JSON.stringify({ data: [{ id: "m1" }] }));

    const a = loadStudioDocument("user_a"); // first account claims + imports the legacy rows
    expect(a.rows.some((r) => r.id === "r1")).toBe(true);

    const b = loadStudioDocument("user_b"); // second account cannot re-import them
    expect(b.rows.some((r) => r.id === "r1")).toBe(false);
  });

  it("(#6) FAILS CLOSED: when the one-time claim cannot persist, the document is NOT adopted", () => {
    const legacy = { schemaVersion: 3, rows: [], brandProfile: normalizeBrandProfile({ businessName: "Imported" }) };
    localStorage.setItem("rf_studio_document", JSON.stringify(legacy));
    // localStorage writes fail (so the claim cannot be recorded durably).
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    try {
      const a = loadStudioDocument("user_a");
      // Not adopted: without a durable claim, a later account could otherwise
      // receive the same doc, so we refuse to import at all.
      expect(a.brandProfile.businessName).toBe("");
    } finally {
      setItem.mockRestore();
    }
  });
});

// ── IndexedDB recovery: server-authoritative, provenance + explicit-dirty gated ──
describe("mergeRecoveredIdbDocument", () => {
  const bp = (name) => ({ ...createDefaultBrandProfile(), businessName: name });
  const current = () => ({ schemaVersion: 3, rows: [], brandProfile: bp("SERVER"), appearance: { accent: "emerald", density: "comfy" }, review: { token: "srv" } });

  it("a raw-present default IDB domain does NOT override the server when not dirty", () => {
    const idbRaw = { schemaVersion: 3, rows: [], brandProfile: bp(""), appearance: { accent: "orange", density: "comfy" }, review: null };
    const merged = mergeRecoveredIdbDocument(current(), idbRaw, []);
    expect(merged.brandProfile.businessName).toBe("SERVER");
    expect(merged.appearance.accent).toBe("emerald");
    expect(merged.review).toEqual({ token: "srv" });
  });

  it("a raw-ABSENT IDB domain is never dirty even when flagged dirty (provenance guard)", () => {
    const idbRaw = { schemaVersion: 3, rows: [], appearance: { accent: "orange", density: "comfy" } }; // no brandProfile key
    const merged = mergeRecoveredIdbDocument(current(), idbRaw, ["brandProfile"]);
    expect(merged.brandProfile.businessName).toBe("SERVER"); // absent -> cannot override
  });

  it("a raw-present IDB domain that is explicitly dirty overrides the server (real local edit)", () => {
    const idbRaw = { schemaVersion: 3, rows: [], brandProfile: bp("LOCALEDIT") };
    const merged = mergeRecoveredIdbDocument(current(), idbRaw, ["brandProfile"]);
    expect(merged.brandProfile.businessName).toBe("LOCALEDIT");
  });

  it("a raw-present IDB domain that is NOT dirty loses to the server", () => {
    const idbRaw = { schemaVersion: 3, rows: [], brandProfile: bp("STALE") };
    const merged = mergeRecoveredIdbDocument(current(), idbRaw, []);
    expect(merged.brandProfile.businessName).toBe("SERVER");
  });

  it("preserves row updatedAt merging (a newer IDB row wins)", () => {
    const older = normalizeRow({ id: "a", platform: "ig_post", status: "draft", caption: "old", updatedAt: "2026-07-07T10:00:00.000Z" });
    const cur = { schemaVersion: 3, rows: [older], brandProfile: bp("SERVER") };
    const idbRaw = { schemaVersion: 3, rows: [{ id: "a", platform: "ig_post", status: "draft", caption: "new", updatedAt: "2026-07-07T10:00:09.000Z" }] };
    const merged = mergeRecoveredIdbDocument(cur, idbRaw, []);
    expect(merged.rows[0].caption).toBe("new");
  });
});

// ── Canonical conflict reconciliation helper (shared by live save + replay) ──
describe("reconcileSaveConflict", () => {
  const bp = (name) => ({ ...createDefaultBrandProfile(), businessName: name });
  const doc = (name) => ({ schemaVersion: 3, rows: [], brandProfile: bp(name) });

  it("409 → fetch server → merge by captured dirty domains → retry on current version → success", async () => {
    const local = doc("LocalEdit"); // brandProfile is the captured dirty domain
    let calls = 0;
    const saveDoc = async (d, ver) => {
      calls += 1;
      if (calls === 1) throw new Error("Version conflict"); // stale version
      return { version: (ver ?? 0) + 1, updatedAt: "x", saved: d, sentVersion: ver };
    };
    const fetchDoc = async () => ({ document: doc("Server"), version: 7 }); // server has a different value

    const result = await reconcileSaveConflict({ document: local, version: 1, dirtyDomains: ["brandProfile"], fetchDoc, saveDoc });

    expect(result.ok).toBe(true);
    expect(calls).toBe(2); // one conflict, one successful retry
    expect(result.payload.sentVersion).toBe(7); // retried on the current server version
    expect(result.document.brandProfile.businessName).toBe("LocalEdit"); // dirty domain kept
  });

  it("a NON-dirty domain does not revert the server during conflict reconciliation", async () => {
    const local = doc("StaleLocal"); // brandProfile present but NOT dirty
    let calls = 0;
    const saveDoc = async (d) => {
      calls += 1;
      if (calls === 1) throw new Error("Version conflict");
      return { version: 8, saved: d };
    };
    const fetchDoc = async () => ({ document: doc("ServerValue"), version: 7 });

    const result = await reconcileSaveConflict({ document: local, version: 1, dirtyDomains: [], fetchDoc, saveDoc });
    expect(result.ok).toBe(true);
    expect(result.document.brandProfile.businessName).toBe("ServerValue"); // server wins (not dirty)
  });

  it("repeated conflict exceeding the bounded limit → { ok:false }, no infinite loop", async () => {
    let calls = 0;
    const saveDoc = async () => { calls += 1; throw new Error("Version conflict"); };
    const fetchDoc = async () => ({ document: doc("Server"), version: 9 });

    const result = await reconcileSaveConflict({ document: doc("Local"), version: 1, dirtyDomains: ["brandProfile"], fetchDoc, saveDoc });

    expect(result.ok).toBe(false);
    expect(calls).toBe(CONFLICT_RETRY_LIMIT + 1); // initial attempt + bounded retries
  });

  it("bubbles a non-conflict error so the caller can retain the entry and stop", async () => {
    const saveDoc = async () => { throw new Error("Network error"); };
    const fetchDoc = async () => ({ document: doc("Server"), version: 9 });
    await expect(
      reconcileSaveConflict({ document: doc("Local"), version: 1, dirtyDomains: [], fetchDoc, saveDoc }),
    ).rejects.toThrow("Network error");
  });

  it("isScopeValid=false before a save returns scope-changed without writing", async () => {
    let calls = 0;
    const saveDoc = async () => { calls += 1; return { version: 2 }; };
    const fetchDoc = async () => ({ document: doc("Server"), version: 9 });
    const result = await reconcileSaveConflict({ document: doc("Local"), version: 1, dirtyDomains: [], fetchDoc, saveDoc, isScopeValid: () => false });
    expect(result).toEqual({ ok: false, reason: "scope-changed" });
    expect(calls).toBe(0); // never wrote
  });

  it("(#1) a save that SUCCEEDS is finalized even if the scope changed during the await", async () => {
    let valid = true;
    const saveDoc = async () => { valid = false; return { version: 3, updatedAt: "x" }; }; // scope flips mid-save
    const fetchDoc = async () => ({ document: doc("Server"), version: 9 });
    const result = await reconcileSaveConflict({ document: doc("Local"), version: 1, dirtyDomains: [], fetchDoc, saveDoc, isScopeValid: () => valid });
    expect(result.ok).toBe(true); // completed write is reported as success
    expect(result.version).toBe(3);
  });

  it("a null-version queued save reconciles instead of overwriting an existing document", async () => {
    // Server rejects the null-version create (create-only: row exists) with a
    // Version conflict; reconcile fetches the server doc + version and retries
    // on that version rather than blindly overwriting.
    const local = doc("Local"); // brandProfile not dirty here
    let calls = 0;
    const sentVersions = [];
    const saveDoc = async (d, ver) => {
      calls += 1;
      sentVersions.push(ver);
      if (calls === 1) throw new Error("Version conflict"); // null-version create refused
      return { version: 8, saved: d };
    };
    const fetchDoc = async () => ({ document: doc("ServerValue"), version: 7 });

    const result = await reconcileSaveConflict({ document: local, version: null, dirtyDomains: [], fetchDoc, saveDoc });
    expect(result.ok).toBe(true);
    expect(sentVersions[0]).toBeNull(); // first attempt was the null-version create
    expect(sentVersions[1]).toBe(7); // retried on the current server version, not null
    expect(result.document.brandProfile.businessName).toBe("ServerValue"); // no overwrite of server
  });

  it("an account switch BETWEEN the conflict fetch and the retry stops before the retry write", async () => {
    let valid = true;
    let saves = 0;
    const saveDoc = async () => { saves += 1; if (saves === 1) throw new Error("Version conflict"); return { version: 2 }; };
    const fetchDoc = async () => { valid = false; return { document: doc("Server"), version: 7 }; }; // scope changes during fetch
    const result = await reconcileSaveConflict({ document: doc("Local"), version: 1, dirtyDomains: [], fetchDoc, saveDoc, isScopeValid: () => valid });
    expect(result).toEqual({ ok: false, reason: "scope-changed" });
    expect(saves).toBe(1); // the retry never wrote under the new scope
  });
});
