const DB_NAME = "rf_social_studio";
const DB_VERSION = 2;
const DOC_STORE = "documents";
const SYNC_QUEUE = "sync_queue";
const SYNC_RECORD_STORE = "sync_records";

// Module-scope cached connection. Reopening IndexedDB on every operation
// adds 5-50 ms of overhead (the upgrade handler re-runs even when no
// upgrade is needed). Cache the connection promise and reuse.
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  const promise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgraded the schema — drop our handle so the next
      // call reopens against the new version.
      db.onversionchange = () => {
        db.close();
        if (dbPromise === promise) dbPromise = null;
      };
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE); // key = scope string
      }
      if (!db.objectStoreNames.contains(SYNC_QUEUE)) {
        const store = db.createObjectStore(SYNC_QUEUE, { keyPath: "id", autoIncrement: true });
        store.createIndex("timestamp", "timestamp");
      }
      // v2: durable per-scope synchronization record (key = scope string).
      if (!db.objectStoreNames.contains(SYNC_RECORD_STORE)) {
        db.createObjectStore(SYNC_RECORD_STORE);
      }
    };
  });

  // Drop the cached promise if the connection fails so callers can
  // retry by reopening rather than getting the same rejected promise.
  promise.catch(() => {
    if (dbPromise === promise) dbPromise = null;
  });

  dbPromise = promise;
  return promise;
}

export async function saveDocument(scope, document) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, "readwrite");
    tx.objectStore(DOC_STORE).put(document, scope);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDocument(scope) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, "readonly");
    const request = tx.objectStore(DOC_STORE).get(scope);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Durable per-scope synchronization record { version, dirty[] }. The fallback
// store when localStorage cannot hold the record, so unsynced dirty domains
// survive a reload even if localStorage writes were failing.
// Revision-guarded write: within one transaction, read the existing record and
// only overwrite when the incoming revision is >= the stored one. This makes an
// older (out-of-order) async write unable to clobber a newer record.
export async function saveSyncRecord(scope, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_RECORD_STORE, "readwrite");
    const store = tx.objectStore(SYNC_RECORD_STORE);
    const getReq = store.get(scope);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      const existingRev = existing && typeof existing.revision === "number" ? existing.revision : -1;
      const incomingRev = record && typeof record.revision === "number" ? record.revision : 0;
      if (incomingRev >= existingRev) store.put(record, scope);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSyncRecord(scope) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_RECORD_STORE, "readonly");
    const request = tx.objectStore(SYNC_RECORD_STORE).get(scope);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function addToSyncQueue(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE, "readwrite");
    tx.objectStore(SYNC_QUEUE).add({ ...entry, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSyncQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE, "readonly");
    const request = tx.objectStore(SYNC_QUEUE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Scope-filtered read for offline replay. getAll() returns entries in ascending
// key (autoIncrement id) order, i.e. oldest-first, which replay depends on.
// Only entries whose stored `scope` matches are returned; other scopes' entries
// are never surfaced to a replay running under a different authenticated user.
export async function getSyncQueueByScope(scope) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE, "readonly");
    const request = tx.objectStore(SYNC_QUEUE).getAll();
    request.onsuccess = () => resolve((request.result || []).filter((entry) => entry && entry.scope === scope));
    request.onerror = () => reject(request.error);
  });
}

// Acknowledge a single processed entry by its id. Replay deletes per entry only
// after that entry's write succeeds, so a mid-queue failure never drops the
// entries that haven't been confirmed yet.
export async function deleteSyncEntry(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE, "readwrite");
    tx.objectStore(SYNC_QUEUE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Global destructive clear. Reserved for an explicit user-data reset — NOT used
// on reconnect, account switch, or ordinary sign-out (those must preserve other
// scopes' entries; replay acknowledges per entry instead).
export async function clearSyncQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE, "readwrite");
    tx.objectStore(SYNC_QUEUE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
