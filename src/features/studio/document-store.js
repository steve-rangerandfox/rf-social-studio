import {
  clampCaption,
  clampNote,
  createSeedRows,
  makeDefaultElements,
  PLATFORMS,
  STATUSES,
  uid,
} from "./shared.js";
import { saveDocument as idbSave, loadDocument as idbLoad } from "../../lib/idb-store.js";

const DOCUMENT_STORAGE_KEY = "rf_studio_document";
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
const MAX_AUDIT_ENTRIES = 1000;
const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function normalizeScope(scope = "anonymous") {
  return String(scope || "anonymous").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_") || "anonymous";
}

function getDocumentStorageKey(scope = "anonymous") {
  return `${DOCUMENT_STORAGE_KEY}:${normalizeScope(scope)}`;
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

function scheduleIdbWrite(scope, document) {
  const pending = pendingIdbWrites.get(scope);
  if (pending?.timer) clearTimeout(pending.timer);

  const timer = setTimeout(() => {
    const slot = pendingIdbWrites.get(scope);
    pendingIdbWrites.delete(scope);
    if (!slot) return;
    idbSave(scope, slot.document).catch(() => {});
  }, IDB_WRITE_DEBOUNCE_MS);

  pendingIdbWrites.set(scope, { timer, document });
}

/**
 * Flush any pending IndexedDB writes immediately. Use from beforeunload
 * handlers or explicit "Save now" UI actions.
 */
export function flushStudioPersist() {
  for (const [scope, slot] of pendingIdbWrites) {
    if (slot.timer) clearTimeout(slot.timer);
    idbSave(scope, slot.document).catch(() => {});
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

// Async loader for IndexedDB — used as progressive enhancement after initial render
export async function loadStudioDocumentAsync(scope = "anonymous") {
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

  let doc = { ...document };

  // v1 → v2: added schemaVersion
  if (!doc.schemaVersion) {
    doc.schemaVersion = 2;
  }

  // v2 → v3: added brandProfile (fed into AI caption + strategy generators)
  if (doc.schemaVersion < 3) {
    doc.brandProfile = normalizeBrandProfile(doc.brandProfile);
    doc.schemaVersion = 3;
  } else {
    // Always normalise even on v3 — keeps the shape stable after manual edits.
    doc.brandProfile = normalizeBrandProfile(doc.brandProfile);
  }

  return doc;
}

export function loadStudioDocument(scope = "anonymous") {
  const storageKey = getDocumentStorageKey(scope);
  const stored = lsGet(storageKey);
  let document;

  if (!stored || typeof stored !== "object") {
    if (scope !== "anonymous") {
      const legacy = lsGet(DOCUMENT_STORAGE_KEY);
      if (legacy && typeof legacy === "object") {
        document = {
          schemaVersion: STORE_VERSION,
          rows: Array.isArray(legacy.rows) ? legacy.rows.filter(isValidRow).map((row) => normalizeRow(row)) : createInitialDocument().rows,
          auditLog: Array.isArray(legacy.auditLog)
            ? legacy.auditLog.slice(0, MAX_AUDIT_ENTRIES).map(normalizeAuditEntry)
            : [],
          instagram: legacy.instagram || { account: null, media: null, syncedAt: null },
          review: legacy.review || null,
          lastSavedAt: legacy.lastSavedAt || null,
        };
      }
    }
    if (!document) {
      document = migrateLegacyDocument();
    }
  } else {
    const rows = Array.isArray(stored.rows) ? stored.rows.filter(isValidRow).map((row) => normalizeRow(row)) : [];
    document = {
      schemaVersion: STORE_VERSION,
      rows: rows.length ? rows : createInitialDocument().rows,
      auditLog: Array.isArray(stored.auditLog)
        ? stored.auditLog.slice(0, MAX_AUDIT_ENTRIES).map(normalizeAuditEntry)
        : [],
      instagram: stored.instagram || { account: null, media: null, syncedAt: null },
      // Client-review share-link config (written server-side; must survive
      // the round trip through this whitelist or every save revokes the link)
      review: stored.review || null,
      lastSavedAt: stored.lastSavedAt || null,
    };
  }

  // Apply schema migrations and auto-purge old soft-deleted rows
  document = migrateDocument(document);
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

// Merge a fresh server document with the local working copy (used after a
// version conflict and by the multi-device sync poll). Rows merge one by one
// on their updatedAt stamp — the newer edit wins — so a caption being typed
// locally survives a write that landed from another tab, device, or the
// scheduler. Rows present on only one side are kept (creations sync both
// ways; deletions are soft, so a deletedAt stamp travels as a normal row
// update). Non-row fields prefer the local copy; the audit log takes the
// longer of the two.
export function mergeStudioDocuments(serverDoc, localDoc) {
  const serverRows = Array.isArray(serverDoc?.rows) ? serverDoc.rows : [];
  const localRows = Array.isArray(localDoc?.rows) ? localDoc.rows : [];
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
  const auditLog = (serverDoc?.auditLog?.length || 0) > (localDoc?.auditLog?.length || 0)
    ? serverDoc.auditLog
    : localDoc?.auditLog;
  return { ...serverDoc, ...localDoc, rows, ...(auditLog ? { auditLog } : {}) };
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
