const DB_NAME = "rf_social_studio";
const DB_VERSION = 1;
const DOC_STORE = "documents";
const SYNC_QUEUE = "sync_queue";

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

export async function clearSyncQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE, "readwrite");
    tx.objectStore(SYNC_QUEUE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
