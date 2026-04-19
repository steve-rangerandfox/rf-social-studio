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
  const platform = Object.hasOwn(PLATFORMS, row.platform) ? row.platform : "ig_post";
  const status = Object.hasOwn(STATUSES, row.status) ? row.status : "idea";

  return {
    id: row.id || uid(),
    scheduledAt: row.scheduledAt ?? null,
    note: clampNote(row.note),
    caption: clampCaption(row.caption, platform),
    platform,
    status,
    assignee: row.assignee ?? null,
    comments: Array.isArray(row.comments) ? row.comments : [],
    storyElements: row.storyElements || (platform === "ig_story" ? makeDefaultElements(row.note) : null),
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

export function createNewRow(overrides, actor, order) {
  return normalizeRow(
    {
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
