import {
  clampCaption,
  clampNote,
  createSeedRows,
  DEFAULT_APPEARANCE,
  makeDefaultElements,
  PLATFORMS,
  STATUSES,
  uid,
} from "./shared.js";
import {
  saveDocument as idbSave,
  loadDocument as idbLoad,
  saveSyncRecord as idbSaveSyncRecord,
  loadSyncRecord as idbLoadSyncRecord,
} from "../../lib/idb-store.js";

const DOCUMENT_STORAGE_KEY = "rf_studio_document";
// Durable, per-scope synchronization record. Stored SEPARATELY from the user
// document so the sync contract survives reload. Holds the canonically
// normalized accepted baseline document, the accepted server version, and the
// EXPLICIT set of top-level document domains the user has dirtied since that
// baseline. Dirty domains are captured at mutation time — never inferred from
// value differences or full-snapshot equality at merge/replay time.
const SYNC_RECORD_STORAGE_KEY = "rf_studio_sync";
// One-shot marker recording which scope adopted the pre-auth, scope-less
// document. Prevents a second account from re-importing the same legacy doc.
const LEGACY_IMPORT_CLAIM_KEY = "rf_studio_legacy_import_claimed";
const LEGACY_ROWS_KEY = "rf_rows";
const LEGACY_IG_MEDIA_KEY = "rf_ig_media";
const STORE_VERSION = 3;

// Brand Profile feeds the AI caption generator + the monthly-strategy
// generator + the default hashtag set on every new row. Stored inside
// the studio document so it travels with the user's account and exports.
export function createDefaultBrandProfile() {
  return {
    businessName: "",
    tagline: "",
    description: "",
    audience: "",
    toneVoice: "",
    keyTopics: [],
    callToAction: "",
    defaultHashtags: [],
    bannedPhrases: [],
    exampleCaptions: [],
    learnedFromUrl: "",
    updatedAt: null,
  };
}

export function normalizeBrandProfile(profile) {
  const base = createDefaultBrandProfile();
  if (!profile || typeof profile !== "object") return base;
  return {
    ...base,
    ...profile,
    keyTopics: Array.isArray(profile.keyTopics) ? profile.keyTopics.filter((t) => typeof t === "string") : [],
    defaultHashtags: Array.isArray(profile.defaultHashtags) ? profile.defaultHashtags.filter((t) => typeof t === "string") : [],
    bannedPhrases: Array.isArray(profile.bannedPhrases) ? profile.bannedPhrases.filter((t) => typeof t === "string") : [],
    exampleCaptions: Array.isArray(profile.exampleCaptions)
      ? profile.exampleCaptions.filter((e) => e && typeof e.text === "string")
      : [],
  };
}

// Appearance (accent + density) is a persistent document-level domain. The
// constant shape lives in shared.js; document-store owns the canonical default
// factory + normalizer so load/normalize never drops or resets a valid value.
export function createDefaultAppearance() {
  return { ...DEFAULT_APPEARANCE };
}

export function normalizeAppearance(appearance) {
  if (!appearance || typeof appearance !== "object") return createDefaultAppearance();
  return { ...createDefaultAppearance(), ...appearance };
}

// Client-review share-link config is server-written and null until enabled.
// Canonical default is null; normalization only guards the type.
export function normalizeReview(review) {
  return review && typeof review === "object" ? review : null;
}
const MAX_AUDIT_ENTRIES = 1000;
const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function normalizeScope(scope = "anonymous") {
  return String(scope || "anonymous").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_") || "anonymous";
}

function getDocumentStorageKey(scope = "anonymous") {
  return `${DOCUMENT_STORAGE_KEY}:${normalizeScope(scope)}`;
}

function getSyncRecordKey(scope = "anonymous") {
  return `${SYNC_RECORD_STORAGE_KEY}:${normalizeScope(scope)}`;
}

// Top-level keys that are never dirty-tracked: rows use updatedAt merge, and the
// rest are bookkeeping the server always owns.
const NON_DIRTY_TRACKED_KEYS = new Set(["rows", "auditLog", "lastSavedAt", "schemaVersion"]);

// The synchronization record is the MINIMUM durable state the merge/replay
// contract needs: the accepted server version and the explicit set of dirty
// top-level domains. The full baseline document is intentionally NOT stored —
// no merge or recovery path consumes it, so duplicating the whole document here
// would be dead weight. Durability is layered: an in-memory cache (fast path),
// localStorage (synchronous, survives reload), and IndexedDB (durable fallback
// when localStorage is unavailable). A write that reaches NO durable store
// raises a save-integrity error.
const syncRecordCache = new Map(); // normalizedScope -> { version, dirty[] }
let syncRecordIntegrityHandler = null;

export function setSyncRecordIntegrityHandler(fn) {
  syncRecordIntegrityHandler = typeof fn === "function" ? fn : null;
}

// The record carries a MONOTONIC revision so out-of-order durable writes and
// stale hydration can be resolved deterministically. Legacy records without a
// revision read as revision 0 and remain usable.
function normalizeSyncRecord(raw) {
  if (!raw || typeof raw !== "object") return { revision: 0, version: null, dirty: [] };
  return {
    revision: typeof raw.revision === "number" && raw.revision >= 0 ? raw.revision : 0,
    version: typeof raw.version === "number" ? raw.version : null,
    dirty: Array.isArray(raw.dirty)
      ? [...new Set(raw.dirty.filter((d) => typeof d === "string" && !NON_DIRTY_TRACKED_KEYS.has(d)))]
      : [],
  };
}

// Choose the record with the higher revision (ties keep the incumbent). Pure +
// exported so both hydration and the IDB write guard share one rule.
export function pickHigherRevisionRecord(a, b) {
  const ra = normalizeSyncRecord(a);
  const rb = normalizeSyncRecord(b);
  return rb.revision > ra.revision ? rb : ra;
}

export function loadSyncRecord(scope = "anonymous") {
  const key = normalizeScope(scope);
  if (syncRecordCache.has(key)) return syncRecordCache.get(key);
  const rec = normalizeSyncRecord(lsGet(getSyncRecordKey(scope)));
  syncRecordCache.set(key, rec);
  return rec;
}

// Persist the sync record. The in-memory cache is updated synchronously (fast
// path). Returns a Promise<boolean> that resolves TRUE once the record is
// DURABLE and FALSE if it reached no durable store (never rejects, so unawaited
// callers can't leak). localStorage success satisfies durability immediately
// (the IDB mirror is then best-effort); if localStorage fails, durability awaits
// IndexedDB, and if both fail a scoped integrity error is raised.
export function persistSyncRecord(scope, record) {
  const key = normalizeScope(scope);
  // Bump the revision monotonically from the highest known (cache or durable).
  const prev = syncRecordCache.has(key)
    ? syncRecordCache.get(key)
    : normalizeSyncRecord(lsGet(getSyncRecordKey(scope)));
  const base = normalizeSyncRecord(record);
  const clean = { revision: (prev.revision || 0) + 1, version: base.version, dirty: base.dirty };
  syncRecordCache.set(key, clean); // in-memory fast path (not durable on its own)

  let localOk = false;
  try {
    localStorage.setItem(getSyncRecordKey(scope), JSON.stringify(clean));
    localOk = true;
  } catch {
    localOk = false; // localStorage full/unavailable — IndexedDB is the fallback
  }

  // Durable IndexedDB mirror with the SAME revision. The idb layer refuses to
  // overwrite a higher-revision record, so an older async write cannot clobber a
  // newer one.
  const idbDurable = idbSaveSyncRecord(key, clean).then(() => true, () => false);

  if (localOk) {
    idbDurable.catch(() => {}); // localStorage already durable; IDB is best-effort
    return Promise.resolve(true);
  }
  // localStorage failed — durability now depends on IndexedDB.
  return idbDurable.then((ok) => {
    if (!ok && syncRecordIntegrityHandler) syncRecordIntegrityHandler(scope);
    return ok;
  });
}

// Seed the in-memory cache from durable storage, selecting the HIGHER-revision
// record across localStorage and IndexedDB (not merely whichever is non-empty).
// Must complete before any path consumes dirty metadata for the scope.
export async function hydrateSyncRecord(scope = "anonymous") {
  const key = normalizeScope(scope);
  const localRec = normalizeSyncRecord(lsGet(getSyncRecordKey(scope)));
  let idbRec = null;
  try {
    idbRec = await idbLoadSyncRecord(key);
  } catch {
    idbRec = null; // IndexedDB unavailable — localStorage/in-memory stands
  }
  const chosen = pickHigherRevisionRecord(localRec, idbRec);
  // If the cache already holds a strictly-higher revision written this session,
  // keep it (a durable read must not regress live in-memory state).
  const cached = syncRecordCache.get(key);
  const winner = cached && cached.revision > chosen.revision ? cached : chosen;
  syncRecordCache.set(key, winner);
  return winner;
}

export function clearSyncRecord(scope = "anonymous") {
  const key = normalizeScope(scope);
  const prev = syncRecordCache.get(key) || normalizeSyncRecord(lsGet(getSyncRecordKey(scope)));
  // A cleared record still bumps the revision so it wins over any lingering
  // higher-revision durable copy (the IDB guard rejects lower revisions).
  const cleared = { revision: (prev.revision || 0) + 1, version: null, dirty: [] };
  syncRecordCache.set(key, cleared);
  try { localStorage.setItem(getSyncRecordKey(scope), JSON.stringify(cleared)); } catch { /* ignore */ }
  idbSaveSyncRecord(key, cleared).catch(() => {});
}

// Test-only: drop the in-memory cache so a fresh load reflects durable storage.
export function __resetSyncRecordCacheForTests() {
  syncRecordCache.clear();
}

export function getDirtyDomains(scope = "anonymous") {
  return loadSyncRecord(scope).dirty;
}

// Which top-level document domains actually changed between two documents.
// Rows/auditLog/bookkeeping are excluded. Used at MUTATION time to capture
// explicit dirty intent (not at merge/replay time to infer it).
export function changedTopLevelDomains(prevDoc, nextDoc) {
  const prev = prevDoc && typeof prevDoc === "object" ? prevDoc : {};
  const next = nextDoc && typeof nextDoc === "object" ? nextDoc : {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed = [];
  for (const key of keys) {
    if (NON_DIRTY_TRACKED_KEYS.has(key)) continue;
    if (!deepEqual(prev[key], next[key])) changed.push(key);
  }
  return changed;
}

// Mark real user-mutated top-level domains dirty (idempotent set-add). Returns
// the durability promise (resolved when durable, rejects if no durable store).
export function markDirtyDomains(scope, domainKeys) {
  if (!domainKeys || domainKeys.length === 0) return Promise.resolve(true);
  const record = loadSyncRecord(scope);
  const dirty = new Set(record.dirty);
  for (const k of domainKeys) if (!NON_DIRTY_TRACKED_KEYS.has(k)) dirty.add(k);
  return persistSyncRecord(scope, { version: record.version, dirty: [...dirty] });
}

// Accept a server snapshot (initial fetch, poll, conflict merge): advance the
// accepted version, PRESERVE dirty domains (unsynced local work not yet sent).
// Returns the durability promise.
export function acceptServerSnapshot(scope, { version } = {}) {
  const record = loadSyncRecord(scope);
  return persistSyncRecord(scope, { version: version ?? null, dirty: record.dirty });
}

// After a successful save: advance the accepted version and CLEAR each SENT
// dirty domain only if the active document still equals the value that was sent
// (retain domains edited while the request was in flight).
export function advanceBaselineOnSave(scope, { sentDocument, savedVersion, sentDirty, currentDocument } = {}) {
  const record = loadSyncRecord(scope);
  const sent = new Set(sentDirty || []);
  const sentDoc = sentDocument || {};
  const curDoc = currentDocument || {};
  const nextDirty = record.dirty.filter((domain) => {
    if (!sent.has(domain)) return true; // not part of this save — keep dirty
    return !deepEqual(curDoc[domain], sentDoc[domain]); // edited in flight -> keep; unchanged -> clear
  });
  // Returns the durability promise so callers can await it before acknowledging
  // (deleting) a queue entry.
  return persistSyncRecord(scope, { version: savedVersion ?? null, dirty: nextDirty });
}

function lsGet(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

// Coalesce IndexedDB writes so a burst of keystrokes results in a single
// transaction. localStorage stays synchronous — it's what callers read
// the return value for, and it's fast enough for per-keystroke writes
// in practice. IDB is the slower of the two; debouncing only that side
// captures the latency win without changing the observable API.
const IDB_WRITE_DEBOUNCE_MS = 400;
const pendingIdbWrites = new Map(); // scope -> { timer, document }

// SINGLE ordered persistence lane per scope for ALL IndexedDB document writes
// (debounced, immediate-durable, flush, recovery, finalization). Every write is
// chained onto the scope's tail so writes execute strictly in enqueue order — a
// stale earlier write can never finish AFTER and replace a newer document.
const docWriteLanes = new Map(); // scope -> Promise (tail; always resolves)

function enqueueDocIdbWrite(scope, document) {
  const prevTail = docWriteLanes.get(scope) || Promise.resolve();
  // Chain regardless of a prior write's outcome so one failure can't stall the
  // lane; the write itself only starts after the previous one has settled.
  const attempt = prevTail.then(() => idbSave(scope, document), () => idbSave(scope, document));
  docWriteLanes.set(scope, attempt.then(() => {}, () => {})); // tail never rejects
  return attempt.then(() => true, () => false); // per-call durability result
}

function scheduleIdbWrite(scope, document) {
  const pending = pendingIdbWrites.get(scope);
  if (pending?.timer) clearTimeout(pending.timer);
  const timer = setTimeout(() => {
    const slot = pendingIdbWrites.get(scope);
    pendingIdbWrites.delete(scope);
    if (!slot) return;
    enqueueDocIdbWrite(scope, slot.document); // debounced write joins the ordered lane
  }, IDB_WRITE_DEBOUNCE_MS);
  pendingIdbWrites.set(scope, { timer, document });
}

// Drop any pending debounced write for a scope (its document is about to be
// superseded by a newer, ordered write) so it can't run out of turn later.
function cancelPendingIdbWrite(scope) {
  const pending = pendingIdbWrites.get(scope);
  if (pending?.timer) clearTimeout(pending.timer);
  pendingIdbWrites.delete(scope);
}

/**
 * Flush any pending IndexedDB writes immediately (all scopes). Used from
 * beforeunload handlers. Writes still go through each scope's ordered lane.
 */
export function flushStudioPersist() {
  for (const [scope, slot] of pendingIdbWrites) {
    if (slot.timer) clearTimeout(slot.timer);
    enqueueDocIdbWrite(scope, slot.document);
  }
  pendingIdbWrites.clear();
}

export function persistStudioDocument(document, scope = "anonymous") {
  const normalized = normalizeScope(scope);
  let lsSaved = false;
  try {
    localStorage.setItem(getDocumentStorageKey(scope), JSON.stringify(document));
    lsSaved = true;
  } catch {
    // localStorage full — IndexedDB is the fallback
  }
  scheduleIdbWrite(normalized, document);
  return lsSaved;
}

// Awaitable DURABLE document persistence for ordering-sensitive paths (scope
// transitions, write finalization, recovery install, the debounced local save).
// localStorage is written synchronously when available. The IndexedDB write ALWAYS
// goes through the scope's ordered lane (superseding any pending debounced write),
// so document writes for a scope can never land out of order. Resolves true once a
// durable store holds this document; false when both fail. Never rejects.
export function persistStudioDocumentDurably(document, scope = "anonymous") {
  const normalized = normalizeScope(scope);
  cancelPendingIdbWrite(normalized); // this newer write supersedes any pending debounced one
  let lsSaved = false;
  try {
    localStorage.setItem(getDocumentStorageKey(scope), JSON.stringify(document));
    lsSaved = true;
  } catch {
    lsSaved = false;
  }
  const idbDurable = enqueueDocIdbWrite(normalized, document); // ordered, immediate
  if (lsSaved) {
    idbDurable.catch(() => {}); // localStorage already durable; IDB mirror is best-effort
    return Promise.resolve(true);
  }
  return idbDurable; // localStorage failed — durability depends on the ordered IDB write
}

// Awaitable SCOPED flush: pushes this scope's pending debounced write onto the
// ordered lane, then awaits the whole lane so all queued writes have settled.
export async function flushScopedPersist(scope = "anonymous") {
  const key = normalizeScope(scope);
  const slot = pendingIdbWrites.get(key);
  if (slot) {
    if (slot.timer) clearTimeout(slot.timer);
    pendingIdbWrites.delete(key);
    enqueueDocIdbWrite(key, slot.document);
  }
  await (docWriteLanes.get(key) || Promise.resolve());
  return true;
}

// Async RAW loader for IndexedDB recovery. Returns the stored object verbatim
// — no normalization — so raw top-level field PRESENCE is preserved for dirty
// classification. Normalization would default-fill absent domains, which would
// make an absent field indistinguishable from a real one; that distinction is
// exactly what decides whether an IDB domain may override accepted server data.
// Domain normalization + the authoritative merge happen in
// mergeRecoveredIdbDocument, after provenance is captured.
export async function loadIdbDocumentRaw(scope = "anonymous") {
  try {
    const doc = await idbLoad(normalizeScope(scope));
    if (doc && doc.schemaVersion) return doc;
  } catch {
    // IndexedDB unavailable
  }
  return null;
}

function isValidRow(row) {
  return Boolean(
    row &&
      typeof row === "object" &&
      typeof row.id === "string" &&
      (row.scheduledAt === null || row.scheduledAt === undefined || typeof row.scheduledAt === "string") &&
      typeof row.platform === "string" &&
      typeof row.status === "string" &&
      Object.hasOwn(PLATFORMS, row.platform) &&
      Object.hasOwn(STATUSES, row.status),
  );
}

function normalizeAuditEntry(entry) {
  return {
    id: entry.id || uid(),
    type: entry.type || "document.updated",
    actor: entry.actor || "system",
    at: entry.at || new Date().toISOString(),
    summary: entry.summary || "Studio document updated",
    meta: entry.meta || {},
  };
}

export function normalizeRow(row, actor = "system") {
  const now = new Date().toISOString();
  // Multi-channel: `platforms` is the full set; `platform` is the canonical
  // primary (publish/calendar/filters use it). Keep them consistent.
  let platforms = Array.isArray(row.platforms)
    ? row.platforms.filter((pl) => Object.hasOwn(PLATFORMS, pl))
    : [];
  let platform = Object.hasOwn(PLATFORMS, row.platform) ? row.platform : "ig_post";
  if (!platforms.length) platforms = [platform];
  if (!platforms.includes(platform)) platform = platforms[0];
  const status = Object.hasOwn(STATUSES, row.status) ? row.status : "idea";

  return {
    id: row.id || uid(),
    scheduledAt: row.scheduledAt ?? null,
    note: clampNote(row.note),
    caption: clampCaption(row.caption, platform),
    platform,
    platforms,
    status,
    assignee: row.assignee ?? null,
    comments: Array.isArray(row.comments) ? row.comments : [],
    storyElements: row.storyElements || (platform === "ig_story" ? makeDefaultElements(row.note) : null),
    // Multi-canvas artboards: array of per-page element arrays. Null until the
    // designer saves pages; storyElements stays as page 0 for back-compat
    // (scheduler/export read storyElements).
    storyPages: Array.isArray(row.storyPages) ? row.storyPages : null,
    // Designer per-outlet state: arrangements per canvas size + the size
    // the designer was last viewing. Stripping these resets every outlet
    // layout on save (gotcha #1 class).
    storyLayouts: row.storyLayouts && typeof row.storyLayouts === "object" ? row.storyLayouts : null,
    storyPreset: typeof row.storyPreset === "string" ? row.storyPreset : null,
    // Multi-frame story publishing: one frame per canvas as { url, kind }
    // (kind "image" | "video"), plus resume bookkeeping the scheduler writes
    // back after a partial publish. storyFrameUrls is the legacy (image-only)
    // shape, still read as a fallback.
    storyFrames: Array.isArray(row.storyFrames) ? row.storyFrames : null,
    storyFrameUrls: Array.isArray(row.storyFrameUrls) ? row.storyFrameUrls : null,
    storyFrameIds: Array.isArray(row.storyFrameIds) ? row.storyFrameIds : null,
    storyFramesPosted: Number.isInteger(row.storyFramesPosted) ? row.storyFramesPosted : 0,
    // Publish mode: "auto" goes through the API scheduler; "manual" is
    // skipped by the scheduler so the user posts by hand (e.g. to add an
    // Instagram Story link sticker, which the API can't attach).
    publishMode: row.publishMode === "manual" ? "manual" : "auto",
    storyLink: typeof row.storyLink === "string" ? row.storyLink : "",
    // First comment to post right after the post itself (customize step);
    // stored now, publish-path wiring is a follow-up.
    firstComment: typeof row.firstComment === "string" ? row.firstComment : "",
    order: Number.isFinite(row.order) ? row.order : 0,
    createdAt: row.createdAt || now,
    createdBy: row.createdBy || actor,
    updatedAt: row.updatedAt || now,
    updatedBy: row.updatedBy || actor,
    deletedAt: row.deletedAt || null,
    deletedBy: row.deletedBy || null,
    postedAt: row.postedAt ?? null,
    igMediaId: row.igMediaId ?? null,
    igPublishedUrl: row.igPublishedUrl ?? null,
    igPermalink: row.igPermalink ?? null,
    // Media + editorial fields. normalizeRow is a whitelist, so anything
    // missing here is silently stripped on every patch — keep this list in
    // sync with all row writers (DetailPanel, CarouselComposer,
    // StoryDesigner, and the inngest scheduler's write-backs).
    mediaUrl: row.mediaUrl ?? null,
    thumbnailUrl: row.thumbnailUrl ?? null,
    imageUrl: row.imageUrl ?? null,
    videoUrl: row.videoUrl ?? null,
    mediaKind: row.mediaKind ?? null,
    // Native multi-image / carousel gallery: [{ url, kind }]. Uploaded on the
    // post (no designer). Without this line every patch strips it — the
    // "images not retained after exiting the carousel" bug.
    mediaItems: Array.isArray(row.mediaItems) ? row.mediaItems : null,
    carouselSlides: Array.isArray(row.carouselSlides) ? row.carouselSlides : null,
    // Rendered slide images for a designed carousel — written by the
    // composer's "Render & save", consumed by the scheduler, cleared when
    // slides are edited after a render.
    carouselFrameUrls: Array.isArray(row.carouselFrameUrls) ? row.carouselFrameUrls : null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    reelDuration: Number.isFinite(row.reelDuration) ? row.reelDuration : null,
    reelAudio: row.reelAudio ?? null,
    igPostId: row.igPostId ?? null,
    liPostUrn: row.liPostUrn ?? null,
    liPermalink: row.liPermalink ?? null,
    publishError: row.publishError ?? null,
    publishErrorAt: row.publishErrorAt ?? null,
    version: Number.isFinite(row.version) ? row.version : 1,
  };
}

function createInitialDocument(seedRows = createSeedRows()) {
  return {
    schemaVersion: STORE_VERSION,
    rows: seedRows.map((row, index) => normalizeRow({ ...row, order: index }, "seed")),
    auditLog: [
      normalizeAuditEntry({
        type: "document.seeded",
        actor: "system",
        summary: "Initialized studio document from starter data",
      }),
    ],
    instagram: {
      account: null,
      media: null,
      syncedAt: null,
    },
    brandProfile: createDefaultBrandProfile(),
    appearance: createDefaultAppearance(),
    review: null,
    lastSavedAt: null,
  };
}

function migrateLegacyDocument() {
  const legacyRows = lsGet(LEGACY_ROWS_KEY);
  const legacyMedia = lsGet(LEGACY_IG_MEDIA_KEY);

  if (!Array.isArray(legacyRows) || legacyRows.length === 0) {
    return createInitialDocument();
  }

  return {
    schemaVersion: STORE_VERSION,
    rows: legacyRows.filter(isValidRow).map((row, index) => normalizeRow({ ...row, order: index }, "migration")),
    auditLog: [
      normalizeAuditEntry({
        type: "document.migrated",
        actor: "system",
        summary: "Migrated legacy local data into the document store",
      }),
    ],
    instagram: {
      account: null,
      media: legacyMedia || null,
      syncedAt: legacyMedia?._syncedAt || null,
    },
    brandProfile: createDefaultBrandProfile(),
    appearance: createDefaultAppearance(),
    review: null,
    lastSavedAt: null,
  };
}

export function purgeDeletedRows(document) {
  const now = Date.now();
  const before = document.rows.length;

  const rows = document.rows.filter((row) => {
    if (!row.deletedAt) return true; // Keep non-deleted rows
    const deletedMs = new Date(row.deletedAt).getTime();
    return (now - deletedMs) < PURGE_AFTER_MS; // Keep if deleted < 30 days ago
  });

  const purged = before - rows.length;
  if (purged === 0) return document;

  return { ...document, rows };
}

export function migrateDocument(document) {
  if (!document || typeof document !== "object") return createInitialDocument();

  // Preserve the whole stored document (including unknown fields). Migration
  // only advances the version marker; a field is removed ONLY when a future
  // version transition intentionally does so. Domain normalization + default
  // backfill are handled by normalizeDocument, not here.
  const doc = { ...document };

  if (!doc.schemaVersion) doc.schemaVersion = 2; // v1 → v2: added schemaVersion
  if (doc.schemaVersion < 3) doc.schemaVersion = 3; // v2 → v3: brandProfile backfilled by normalizeDocument

  return doc;
}

// Canonical whole-document normalizer. Preserves the complete stored document
// (current AND unknown fields), normalizes each known domain without discarding
// valid values, and backfills canonical defaults for any missing domain. This
// REPLACES the old field allowlist — new document-level fields survive by
// default; only an explicit migration removes a field.
export function normalizeDocument(raw) {
  if (!raw || typeof raw !== "object") return createInitialDocument();

  const doc = { ...raw }; // retain every field, including unknown ones

  // Distinguish an EXPLICIT rows array (even empty — a user who cleared their
  // board) from missing/invalid rows on a genuinely new document. Only the
  // latter gets seed rows, and only via createInitialDocument.
  doc.rows = Array.isArray(raw.rows)
    ? raw.rows.filter(isValidRow).map((row) => normalizeRow(row))
    : createInitialDocument().rows;
  doc.auditLog = Array.isArray(raw.auditLog)
    ? raw.auditLog.slice(0, MAX_AUDIT_ENTRIES).map(normalizeAuditEntry)
    : [];
  doc.instagram = raw.instagram && typeof raw.instagram === "object"
    ? raw.instagram
    : { account: null, media: null, syncedAt: null };
  doc.brandProfile = normalizeBrandProfile(raw.brandProfile);
  doc.appearance = normalizeAppearance(raw.appearance);
  doc.review = normalizeReview(raw.review);
  doc.lastSavedAt = raw.lastSavedAt || null;
  doc.schemaVersion = STORE_VERSION;

  return doc;
}

// Acquire the one-time claim over ALL unscoped legacy sources for a scope.
// Returns true only if this scope already owns the claim or can durably record
// it (FAIL CLOSED: if the claim cannot persist, no import — otherwise a second
// account could later receive the same legacy data).
function acquireLegacyClaim(scope) {
  const normScope = normalizeScope(scope);
  const claimedBy = lsGet(LEGACY_IMPORT_CLAIM_KEY);
  if (claimedBy && claimedBy !== normScope) return false; // owned by another account
  try {
    localStorage.setItem(LEGACY_IMPORT_CLAIM_KEY, JSON.stringify(normScope));
    return lsGet(LEGACY_IMPORT_CLAIM_KEY) === normScope;
  } catch {
    return false;
  }
}

export function loadStudioDocument(scope = "anonymous") {
  const stored = lsGet(getDocumentStorageKey(scope));
  let raw = stored && typeof stored === "object" ? stored : null;
  let useLegacyMigration = false;

  // Anonymous-to-authenticated import. The SAME one-time claim governs EVERY
  // unscoped legacy source (rf_studio_document, rf_rows, rf_ig_media): the first
  // authenticated scope claims them; a second account never re-imports any of
  // them. If the claim cannot be acquired, initialize a fresh scoped document.
  if (!raw && scope !== "anonymous") {
    const legacyDoc = lsGet(DOCUMENT_STORAGE_KEY);
    const legacyRows = lsGet(LEGACY_ROWS_KEY);
    const legacyMedia = lsGet(LEGACY_IG_MEDIA_KEY);
    const hasUnscopedLegacy =
      (legacyDoc && typeof legacyDoc === "object") ||
      (Array.isArray(legacyRows) && legacyRows.length > 0) ||
      (legacyMedia && typeof legacyMedia === "object");
    if (hasUnscopedLegacy && acquireLegacyClaim(scope)) {
      if (legacyDoc && typeof legacyDoc === "object") raw = legacyDoc;
      else useLegacyMigration = true; // import rf_rows / rf_ig_media via migrateLegacyDocument
    }
  }

  let document;
  if (raw) {
    document = migrateDocument(raw);
  } else if (scope === "anonymous" || useLegacyMigration) {
    // Anonymous is the pre-auth owner and migrates its own legacy data freely.
    document = migrateLegacyDocument();
  } else {
    // Authenticated scope with no claim (or no legacy) -> fresh scoped document.
    document = createInitialDocument();
  }
  document = normalizeDocument(document);
  document = purgeDeletedRows(document);

  return document;
}

export function createAuditEntry(type, actor, summary, meta = {}) {
  return normalizeAuditEntry({
    type,
    actor,
    summary,
    meta,
  });
}

export function appendAuditEntries(document, entries) {
  return {
    ...document,
    auditLog: [...entries, ...document.auditLog].slice(0, MAX_AUDIT_ENTRIES),
  };
}

// Structural deep-equality for the plain-JSON document domains. Used to decide
// whether a domain differs from the synchronized baseline (a genuine edit) or
// is byte-identical (unchanged). Not JSON.stringify-based: key order must not
// affect the verdict.
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const aArr = Array.isArray(a);
  if (aArr !== Array.isArray(b)) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.hasOwn(b, k) || !deepEqual(a[k], b[k])) return false;
  }
  return true;
}

// Row-level merge keys handled explicitly below; every other top-level key is a
// document domain resolved by the baseline contract.
const ROW_MERGE_KEYS = new Set(["rows", "auditLog"]);

// Per-domain selection driven by EXPLICIT dirty metadata (no value inference):
//   - domain explicitly dirty AND locally present -> local wins (incl. null)
//   - otherwise                                   -> server wins
// Rows use updatedAt merge (handled separately). A local side that does not
// actually carry the domain (undefined) can never override the server, even if
// the domain is flagged dirty — provenance protection for IDB recovery.
function pickDomain(serverVal, localVal, key, dirtySet) {
  if (dirtySet.has(key) && localVal !== undefined) return localVal;
  return serverVal;
}

// Normalize a single top-level domain value the same way normalizeDocument
// does, so an IDB recovery candidate is compared to the server/evidence in a
// consistent shape. Unknown domains and lastSavedAt pass through unchanged.
function normalizeDomainValue(key, value) {
  switch (key) {
    case "brandProfile": return normalizeBrandProfile(value);
    case "appearance": return normalizeAppearance(value);
    case "review": return normalizeReview(value);
    case "instagram": return value && typeof value === "object" ? value : { account: null, media: null, syncedAt: null };
    case "schemaVersion": return STORE_VERSION;
    default: return value;
  }
}

// IndexedDB recovery merge. The accepted current/server document is
// authoritative; the raw IDB snapshot is a local recovery CANDIDATE. A candidate
// top-level domain may override accepted server data ONLY when it is raw-present
// in the IDB snapshot AND that domain is explicitly dirty for this scope
// (durable dirty metadata — never inferred from values). Absent raw fields
// (which normalization would otherwise default-fill) carry no candidate value,
// so provenance protects the server. Row updatedAt merging is preserved via
// mergeStudioDocuments. `lastSavedAt` only admits a candidate upstream; it never
// decides field precedence here.
export function mergeRecoveredIdbDocument(currentDoc, idbRaw, dirtyDomains = []) {
  if (!idbRaw || typeof idbRaw !== "object") return currentDoc;

  // Provenance-limited candidate: carry a value ONLY for domains actually
  // present in the raw snapshot. Rows/auditLog are normalized without the
  // seed-row fallback (recovery must never invent seed rows).
  const candidate = {
    rows: Array.isArray(idbRaw.rows) ? idbRaw.rows.filter(isValidRow).map((row) => normalizeRow(row)) : [],
    auditLog: Array.isArray(idbRaw.auditLog) ? idbRaw.auditLog.slice(0, MAX_AUDIT_ENTRIES).map(normalizeAuditEntry) : [],
  };
  for (const key of Object.keys(idbRaw)) {
    if (ROW_MERGE_KEYS.has(key)) continue;
    candidate[key] = normalizeDomainValue(key, idbRaw[key]);
  }

  return mergeStudioDocuments(currentDoc, candidate, { dirtyDomains });
}

// Merge a fresh server document with the local working copy (used after a
// version conflict, by the offline replay, and by the multi-device sync poll).
//
// Rows merge one by one on their updatedAt stamp — the newer edit wins — so a
// caption being typed locally survives a write that landed from another tab,
// device, or the scheduler. Rows present on only one side are kept (creations
// sync both ways; deletions are soft, so a deletedAt stamp travels as a normal
// row update). The audit log takes the longer of the two.
//
// Every other top-level document domain (brandProfile, appearance, review,
// instagram, and any unknown field) is resolved by the EXPLICIT dirty set in
// `options.dirtyDomains`: a domain is taken from local only when it is flagged
// dirty (a real user mutation), otherwise the server value wins. No value
// inference, no baseline diffing, no full-snapshot equality. See pickDomain.
export function mergeStudioDocuments(serverDoc, localDoc, options = {}) {
  const { dirtyDomains = [] } = options;
  const dirtySet = dirtyDomains instanceof Set ? dirtyDomains : new Set(dirtyDomains);
  const server = serverDoc && typeof serverDoc === "object" ? serverDoc : {};
  const local = localDoc && typeof localDoc === "object" ? localDoc : {};

  const serverRows = Array.isArray(server.rows) ? server.rows : [];
  const localRows = Array.isArray(local.rows) ? local.rows : [];
  const serverById = new Map(serverRows.map((r) => [r.id, r]));
  const seen = new Set();
  const rows = localRows.map((localRow) => {
    seen.add(localRow.id);
    const serverRow = serverById.get(localRow.id);
    if (!serverRow) return localRow;
    const localAt = Date.parse(localRow.updatedAt || "") || 0;
    const serverAt = Date.parse(serverRow.updatedAt || "") || 0;
    return serverAt > localAt ? serverRow : localRow;
  });
  for (const serverRow of serverRows) {
    if (!seen.has(serverRow.id)) rows.push(serverRow);
  }

  const auditLog = (server.auditLog?.length || 0) > (local.auditLog?.length || 0)
    ? server.auditLog
    : local.auditLog;

  const merged = {};
  const domainKeys = new Set([...Object.keys(server), ...Object.keys(local)]);
  for (const key of domainKeys) {
    if (ROW_MERGE_KEYS.has(key)) continue;
    const picked = pickDomain(server[key], local[key], key, dirtySet);
    if (picked !== undefined) merged[key] = picked;
  }

  merged.rows = rows;
  if (auditLog) merged.auditLog = auditLog;
  return merged;
}

// Order-insensitive whole-document content equality, ignoring lastSavedAt.
// Used by the outbound lane to dedup rt.latestDoc against the ACCEPTED server
// document — structural deepEqual, never JSON string comparison, because merge
// construction can reorder keys without changing content.
export function isSameDocumentContent(a, b) {
  if (!a || !b) return false;
  return deepEqual({ ...a, lastSavedAt: null }, { ...b, lastSavedAt: null });
}

// Canonical bounded optimistic-lock reconciliation. Same mechanism the live
// save uses (normalizeDocument + mergeStudioDocuments + bounded retry), but
// UI-free and with the network boundary injected so the offline replay can
// share ONE conflict/merge contract instead of re-implementing it.
//
// `fetchDoc` returns { document, version } from the server; `saveDoc(doc, ver)`
// performs the write under the CURRENT authenticated identity (the caller owns
// identity — a reconciled document never nominates one) and rejects with an
// Error whose message is "Version conflict" on a stale version.
//
// On a version conflict it fetches the authoritative server document + version,
// normalizes both sides, and merges using the queue entry's CAPTURED dirty
// domains (`dirtyDomains`) — dirty domain -> queued/local value may win;
// non-dirty domain -> server wins — then retries on the current server version,
// up to `limit` times. Returns { ok: true, payload, document, version } on
// success, or { ok: false, reason } when retries are exhausted, no server
// document is available, or the scope changed mid-flight. Non-conflict errors
// reject so the caller can retain the entry and stop.
//
// `isScopeValid()` is an optional cancellation guard. It is checked BEFORE
// starting any save or fetch (never start a new request for an inactive
// runtime), and AFTER a conflict fetch before retrying. A save that has already
// SUCCEEDED is reported as success even if the scope changed during the await —
// the write was made with the captured (A) identity, so the caller can finalize
// A's durable state without touching B. Non-conflict errors reject so the caller
// can retain the entry and stop.
export const CONFLICT_RETRY_LIMIT = 3;

export async function reconcileSaveConflict({ document, version = null, dirtyDomains = [], fetchDoc, saveDoc, limit = CONFLICT_RETRY_LIMIT, isScopeValid }) {
  const scopeOk = () => (isScopeValid ? isScopeValid() : true);
  let doc = normalizeDocument(document);
  let ver = version;

  for (let attempt = 0; attempt <= limit; attempt++) {
    if (!scopeOk()) return { ok: false, reason: "scope-changed" }; // never START a write for an inactive runtime
    try {
      const payload = await saveDoc(doc, ver);
      // Succeeded: finalize regardless of a mid-flight scope change.
      // `document` is what we SENT; `acceptedDocument` is the server's canonical
      // accepted content — its own returned document when the response carries one
      // (so server-canonicalized non-dirty fields propagate), else the sent doc.
      const acceptedDocument = payload?.document ? normalizeDocument(payload.document) : doc;
      return { ok: true, payload, document: doc, acceptedDocument, version: payload?.version ?? null };
    } catch (error) {
      if (error?.message !== "Version conflict") throw error; // network/other — caller retains + stops
      if (attempt === limit) break; // bounded retries exhausted
      if (!scopeOk()) return { ok: false, reason: "scope-changed" }; // don't fetch/retry after a switch
      const server = await fetchDoc();
      if (!scopeOk()) return { ok: false, reason: "scope-changed" }; // don't retry after a switch
      if (!server?.document) return { ok: false, reason: "no-server-doc" };
      const serverDoc = normalizeDocument(server.document);
      // Resolve with the entry's CAPTURED dirty domains (not a replay-time
      // baseline lookup), then retry on the current server version.
      doc = mergeStudioDocuments(serverDoc, doc, { dirtyDomains });
      ver = server.version ?? null;
    }
  }

  return { ok: false, reason: "retry-exhausted" };
}

export function createNewRow(overrides, actor, order) {
  return normalizeRow(
    {
      // Pass EVERY override through — normalizeRow's allowlist is the only
      // gate. The old explicit field list here silently dropped anything it
      // didn't name (mediaItems, platforms, mediaKind…), so a post created
      // with an uploaded gallery arrived empty.
      ...overrides,
      id: uid(),
      scheduledAt: overrides.scheduledAt ?? null,
      note: overrides.note || "",
      caption: overrides.caption || "",
      platform: overrides.platform || "ig_post",
      status: overrides.status || "idea",
      assignee: overrides.assignee ?? null,
      comments: overrides.comments || [],
      storyElements: overrides.storyElements || null,
      postedAt: overrides.postedAt ?? null,
      igMediaId: overrides.igMediaId ?? null,
      igPublishedUrl: overrides.igPublishedUrl ?? null,
      igPermalink: overrides.igPermalink ?? null,
      order,
      version: 1,
    },
    actor,
  );
}

export function applyRowPatch(row, patch, actor) {
  const platform = patch.platform && Object.hasOwn(PLATFORMS, patch.platform) ? patch.platform : row.platform;
  const status = patch.status && Object.hasOwn(STATUSES, patch.status) ? patch.status : row.status;

  return normalizeRow(
    {
      ...row,
      ...patch,
      platform,
      status,
      note: patch.note !== undefined ? clampNote(patch.note) : row.note,
      caption: patch.caption !== undefined ? clampCaption(patch.caption, platform) : row.caption,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
      version: (row.version || 1) + 1,
    },
    actor,
  );
}

export function markRowDeleted(row, actor) {
  return {
    ...row,
    deletedAt: new Date().toISOString(),
    deletedBy: actor,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
    version: (row.version || 1) + 1,
  };
}

export function restoreDeletedRow(row, actor) {
  return {
    ...row,
    deletedAt: null,
    deletedBy: null,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
    version: (row.version || 1) + 1,
  };
}

export function exportStudioData(studioDocument) {
  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: studioDocument.schemaVersion,
    rows: studioDocument.rows,
    auditLog: studioDocument.auditLog,
    instagram: {
      account: studioDocument.instagram?.account || null,
      syncedAt: studioDocument.instagram?.syncedAt || null,
      mediaCount: studioDocument.instagram?.media?.data?.length || 0,
    },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `rf-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
