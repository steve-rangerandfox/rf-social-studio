/* eslint-disable react-refresh/only-export-components */
import React, { useState, useRef, useEffect, useCallback, useContext, createContext, useMemo } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useNavigate, useLocation } from "react-router-dom";

import {
  fetchInstagramFeed,
  fetchStudioDocument,
  saveStudioDocument,
  setApiUserId,
} from "../../lib/api-client.js";
import {
  acceptServerSnapshot,
  advanceBaselineOnSave,
  appendAuditEntries,
  applyRowPatch,
  changedTopLevelDomains,
  createAuditEntry,
  createDefaultBrandProfile,
  createNewRow,
  exportStudioData,
  getDirtyDomains,
  hydrateSyncRecord,
  isSameDocumentContent,
  loadIdbDocumentRaw,
  loadStudioDocument,
  loadSyncRecord,
  markDirtyDomains,
  markRowDeleted,
  mergeRecoveredIdbDocument,
  mergeStudioDocuments,
  normalizeBrandProfile,
  normalizeDocument,
  persistStudioDocument,
  persistStudioDocumentDurably,
  reconcileSaveConflict,
  setSyncRecordIntegrityHandler,
  flushScopedPersist,
  flushStudioPersist,
  restoreDeletedRow,
} from "./document-store.js";
import { addToSyncQueue, getSyncQueueByScope, deleteSyncEntry } from "../../lib/idb-store.js";
import { useToast } from "../../components/Toaster.jsx";
import { materializeForSchedule } from "./materialize-designed-media.js";
import {
  ACCENTS,
  DEFAULT_APPEARANCE,
  isRowNeedingAttention,
  loadTeam,
  MONTHS_FULL,
  nowPT,
  PLATFORMS,
  ptPickerToISO,
  saveTeam,
  STATUSES,
  suggestBestSlot,
  T,
  uid,
} from "./shared.js";

// ─── Route <-> View mapping ────────────────────────────────────────
export const viewFromPath = {
  "/app": "list",
  "/app/calendar": "calendar",
  "/app/grid": "grid",
  "/app/analytics": "analytics",
  "/app/brand": "brand",
  "/app/assets": "assets",
};
export const pathFromView = {
  list: "/app",
  calendar: "/app/calendar",
  grid: "/app/grid",
  analytics: "/app/analytics",
  brand: "/app/brand",
  assets: "/app/assets",
};

const StudioContext = createContext(null);

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within a StudioProvider");
  return ctx;
}

export function StudioProvider({ children }) {
  const { userId, getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const storageScope = userId || "anonymous";
  const actorName =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    userId ||
    "anonymous";
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year] = useState(now.getFullYear());
  const [studioDoc, setStudioDoc] = useState(() => loadStudioDocument(storageScope));
  const [sel, setSel] = useState(new Set());
  const [view, setViewState] = useState(() => viewFromPath[location.pathname] || "list");
  const setView = (v) => {
    setViewState(v);
    navigate(pathFromView[v] || "/");
  };
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [timeScale, setTimeScale] = useState("month");
  const [composer, setComposer] = useState(null);
  const [addPostDraft, setAddPostDraft] = useState(null);
  const [story, setStory] = useState(null);
  const [showAssets, setAssets] = useState(false);
  const [showConn, setShowConn] = useState(null);
  const [showSettings, setSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState("General");
  const openSettingsTab = (tab) => { setSettingsInitialTab(tab || "General"); setSettings(true); };
  const [team, setTeam] = useState(() => loadTeam());
  const updateTeam = (newTeam) => { setTeam(newTeam); saveTeam(newTeam); };
  const [connections, setConns] = useState({ instagram: false, tiktok: false, facebook: false, linkedin: false });
  // In-memory profile snapshot for LinkedIn — cleared on reload, but the
  // underlying session cookie + Supabase li_tokens row persists. A
  // reload requires the user to click "Connect" again to re-hydrate
  // (v1 compromise — a future pass can poll a status endpoint).
  const [linkedinAccount, setLinkedinAccount] = useState(null);
  const [saveState, setSaveState] = useState(() => ({
    status: studioDoc.lastSavedAt ? "saved" : "idle",
    lastSavedAt: studioDoc.lastSavedAt,
    error: null,
  }));
  // ─── Per-scope synchronization runtime (scope-owned coordinator) ───
  // ONE canonical runtime per scope, kept in a map keyed by storage scope, so
  // returning to A reuses A's runtime + its single lane (no second concurrent A
  // runtime). Async operations CAPTURE their originating runtime; they finalize
  // that runtime's DURABLE per-scope state (using its own latest doc + dirty
  // metadata) even after a switch, but touch React state / active controls only
  // while the runtime is still active.
  const makeRuntime = (scope) => ({
    scope,
    version: loadSyncRecord(scope).version, // accepted server version (refined by readiness)
    // Seed from this scope's OWN stored document (or a fresh default), NEVER the
    // active studioDoc — creating runtime B while A is active must not seed B
    // with A's document.
    latestDoc: loadStudioDocument(scope),
    // Canonical ACCEPTED server state, kept separate from the installed local
    // overlay: normalized server content after fetch/poll, the exact accepted
    // result.document after every successful save, or null when the server has
    // confirmed absence. The lane prepares queued writes against it and dedups
    // the live save against it — never against the local overlay itself.
    acceptedDoc: null,
    initialFetchDone: false,                 // initial server state established?
    hydrated: false,                         // sync-record hydration complete (dirty may persist immediately)
    ready: null,                             // combined local-recovery readiness promise
    laneBusy: false,                         // the single outbound lane is running
    laneDirty: false,                        // a pump was requested while the lane was busy
    pendingDirty: new Set(),                  // domains dirtied before hydration completed
    conflictRuns: 0,
  });
  const runtimesRef = useRef(new Map());     // scope -> canonical runtime
  const getRuntime = (scope) => {
    let rt = runtimesRef.current.get(scope);
    if (!rt) { rt = makeRuntime(scope); runtimesRef.current.set(scope, rt); }
    return rt;
  };
  const activeRuntimeRef = useRef(null);
  if (activeRuntimeRef.current === null) activeRuntimeRef.current = getRuntime(storageScope);
  // Mirror the latest document onto the ACTIVE runtime every render (captures the
  // freshest doc even on the switch render, before the scope-load effect swaps).
  activeRuntimeRef.current.latestDoc = studioDoc;
  const isActive = (rt) => activeRuntimeRef.current === rt;
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingUndo, setPendingUndo] = useState(null);
  const [tokenBannerDismissed, setTokenBannerDismissed] = useState(false);
  const [openComments, setOC] = useState(new Set());
  const [publishConfirm, setPublishConfirm] = useState(null);
  const [showCommandPalette, setCommandPalette] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [inlineCreateActive, setInlineCreateActive] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const toastApi = useToast();
  // Back-compat shim for the legacy (msg, color) signature. New call-sites
  // should use toastApi.success/error/etc directly via useToast().
  const showToast = useCallback((msg, color) => {
    if (color === T.red) {
      toastApi.error(msg);
    } else {
      toastApi.success(msg);
    }
  }, [toastApi]);
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const monthRefs = useRef({});
  // Set by ListView (year view) — scrolls the virtualizer to a month, which
  // works even when that month isn't currently rendered (unlike a DOM ref).
  const yearScrollRef = useRef(null);
  const currentUser = actorName;

  // ─── Derived data (memoized) ─────────────────────────────────────
  const rows = useMemo(
    () => studioDoc.rows.filter((row) => !row.deletedAt),
    [studioDoc],
  );

  const filteredRows = useMemo(() => rows.filter((row) => {
    const q = query.trim().toLowerCase();
    const assigneeName = team.find((member) => member.id === row.assignee)?.name?.toLowerCase() || "";
    const matchesQuery = !q || [row.note, row.caption, assigneeName].filter(Boolean).some((value) => value.toLowerCase().includes(q));
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "ready"
        ? row.status === "approved" || row.status === "scheduled"
        : row.status === statusFilter);
    const matchesPlatform =
      platformFilter === "all" ||
      (platformFilter === "instagram" ? row.platform.startsWith("ig")
        : row.platform === platformFilter);
    const matchesAttention = !attentionOnly || isRowNeedingAttention(row);
    return matchesQuery && matchesStatus && matchesPlatform && matchesAttention;
  }), [rows, query, statusFilter, platformFilter, attentionOnly, team]);

  const igConfig = useMemo(() => studioDoc.instagram?.account || null, [studioDoc]);
  const igMedia = useMemo(() => studioDoc.instagram?.media || null, [studioDoc]);
  const reviewConfig = useMemo(() => studioDoc.review || null, [studioDoc]);
  const brandProfile = useMemo(
    () => normalizeBrandProfile(studioDoc.brandProfile || createDefaultBrandProfile()),
    [studioDoc],
  );

  // Appearance settings (accent + density) travel inside the studio
  // document so they sync across devices like everything else.
  const appearance = useMemo(
    () => ({ ...DEFAULT_APPEARANCE, ...(studioDoc.appearance || {}) }),
    [studioDoc],
  );

  // Push the chosen accent onto :root so every --accent consumer follows.
  useEffect(() => {
    const a = ACCENTS[appearance.accent] || ACCENTS.orange;
    const root = document.documentElement;
    root.style.setProperty("--accent", a.hex);
    root.style.setProperty("--accent-bright", a.bright);
    root.style.setProperty("--accent-tint", a.tint);
    root.style.setProperty("--accent-faint", a.faint);
  }, [appearance.accent]);

  const allSorted = useMemo(() => [...filteredRows].sort((a, b) => {
    const da = a.scheduledAt ? new Date(a.scheduledAt) : new Date(0);
    const db = b.scheduledAt ? new Date(b.scheduledAt) : new Date(0);
    if (da.getTime() === db.getTime()) {
      return (a.order || 0) - (b.order || 0);
    }
    return da - db;
  }), [filteredRows]);

  const sorted = useMemo(() => timeScale === "year"
    ? allSorted.filter(r => r.scheduledAt && new Date(r.scheduledAt).getFullYear() === year)
    : allSorted.filter(r => {
        if (!r.scheduledAt) return false;
        const d = new Date(r.scheduledAt);
        return d.getMonth() === month && d.getFullYear() === year;
      }), [allSorted, timeScale, month, year]);

  const grouped = useMemo(() => MONTHS_FULL.map((mName, mi) => ({
    mi, mName,
    rows: sorted.filter(r => {
      if (!r.scheduledAt) return false;
      return new Date(r.scheduledAt).getMonth() === mi;
    }),
  })), [sorted]);

  const { igC, liC, readyC, reviewC, attentionCount } = useMemo(() => ({
    igC: filteredRows.filter(r => r.platform !== "linkedin").length,
    liC: filteredRows.filter(r => r.platform === "linkedin").length,
    readyC: filteredRows.filter(r => r.status === "approved" || r.status === "scheduled").length,
    reviewC: filteredRows.filter(r => r.status === "needs_review").length,
    attentionCount: filteredRows.filter((row) => isRowNeedingAttention(row)).length,
  }), [filteredRows]);

  const monthCounts = useMemo(() => MONTHS_FULL.map((_, mi) =>
    rows.filter(r => r.scheduledAt && new Date(r.scheduledAt).getMonth() === mi && new Date(r.scheduledAt).getFullYear() === year).length
  ), [rows, year]);
  const maxMonthCount = useMemo(() => Math.max(...monthCounts, 1), [monthCounts]);

  // ─── Combined local-recovery readiness (one promise per runtime) ───
  // Runtime readiness = revision-aware sync-record hydration + pre-hydration
  // dirty merge + raw IndexedDB document recovery (provenance-aware) installed
  // into rt.latestDoc + scoped persistence. All outbound work (ensureInitialized,
  // queue drain, live save, polling) awaits this before touching the server, so
  // no write can happen before local recovery completes.
  const buildReadiness = (rt) => (async () => {
    // Capture the recovery BASE at readiness start: the IDB candidate is
    // classified against this snapshot, so edits made while the (possibly
    // deferred) IDB load is pending are never mistaken for recovered content.
    const recoveryBase = rt.latestDoc;
    try { await hydrateSyncRecord(rt.scope); } catch { /* localStorage/in-memory stands */ }
    rt.hydrated = true; // set before the merge so a concurrent edit persists directly too (idempotent)
    // Merge domains dirtied before hydration finished at a higher revision.
    if (rt.pendingDirty.size) { try { await markDirtyDomains(rt.scope, [...rt.pendingDirty]); } catch { /* integrity surfaced separately */ } }
    rt.version = loadSyncRecord(rt.scope).version;
    // Raw IDB recovery: install a genuinely newer local snapshot's dirty domains.
    let idbRaw = null;
    try { idbRaw = await loadIdbDocumentRaw(rt.scope); } catch { idbRaw = null; }
    if (idbRaw && idbRaw.lastSavedAt && (!recoveryBase.lastSavedAt || idbRaw.lastSavedAt > recoveryBase.lastSavedAt)) {
      // 1. Recover the IDB candidate against the captured BASE using durable
      //    dirty metadata (provenance + explicit dirty, as before).
      const recovered = mergeRecoveredIdbDocument(recoveryBase, idbRaw, getDirtyDomains(rt.scope));
      // 2. OVERLAY runtime mutations made while recovery was pending: any
      //    top-level domain that changed between the base and the CURRENT
      //    rt.latestDoc wins over the recovered value; rows merge by updatedAt.
      const mutatedSince = changedTopLevelDomains(recoveryBase, rt.latestDoc);
      const finalDoc = mergeStudioDocuments(recovered, rt.latestDoc, { dirtyDomains: mutatedSince });
      if (!isSameDocumentContent(finalDoc, rt.latestDoc)) {
        rt.latestDoc = finalDoc;
        if (isActive(rt)) setStudioDoc(finalDoc);
        // Readiness cannot complete successfully until the recovered/overlaid
        // document is DURABLE. On failure, preserve the recovered dirty metadata
        // and surface the scoped integrity error.
        const durable = await persistStudioDocumentDurably({ ...finalDoc, lastSavedAt: finalDoc.lastSavedAt || null }, rt.scope);
        if (!durable) {
          const recoveredDirty = [...new Set([...getDirtyDomains(rt.scope), ...mutatedSince])];
          if (recoveredDirty.length) markDirtyDomains(rt.scope, recoveredDirty);
          if (isActive(rt)) {
            setSaveState((current) => ({
              ...current,
              status: "error",
              error: "Save integrity at risk — recovered changes could not be stored durably.",
            }));
          }
        }
      }
    }
  })();

  // ─── Outbound lane (one per scope: replay drain, then a single live save) ───
  // Finalize a successful write:
  //   1. advance version + clear synced dirty (against the runtime's OWN latest
  //      doc, so in-flight edits stay dirty);
  //   2. set rt.acceptedDoc to the EXACT accepted result.document — the local
  //      overlay installed below is never marked accepted merely because this
  //      older write succeeded;
  //   3. install the visible/local doc = merge(acceptedDoc, rt.latestDoc) with
  //      only REMAINING dirty domains winning and rows by updatedAt;
  //   4. await BOTH sync-record durability and installed-document durability —
  //      throws if either reached no durable store, so the caller can gate
  //      queue acknowledgement on it.
  const finalizeWriteSuccess = async (rt, { sentDocument, savedVersion, sentDirty, acceptedDocument }) => {
    const recDurable = advanceBaselineOnSave(rt.scope, { sentDocument, savedVersion, sentDirty, currentDocument: rt.latestDoc });
    if (savedVersion != null) rt.version = savedVersion;
    // acceptedDocument is the server's canonical accepted content (its returned
    // document when present, else the sent doc) — NOT merely what we sent, so a
    // field the server canonicalized propagates into acceptedDoc + the overlay.
    rt.acceptedDoc = acceptedDocument || sentDocument;
    const remainingDirty = getDirtyDomains(rt.scope);
    const installed = mergeStudioDocuments(rt.acceptedDoc, rt.latestDoc, { dirtyDomains: remainingDirty });
    rt.latestDoc = installed;
    const docDurable = persistStudioDocumentDurably(
      { ...installed, lastSavedAt: installed.lastSavedAt || new Date().toISOString() },
      rt.scope,
    );
    if (isActive(rt)) setStudioDoc(installed);
    const [recOk, docOk] = await Promise.all([
      Promise.resolve(recDurable).catch(() => false),
      docDurable,
    ]);
    if (!recOk || !docOk) throw new Error("finalization not durable");
  };

  // Establish server state for the runtime (retryable). Awaits combined readiness
  // first, so the merge sees the fully recovered local doc. A transient GET
  // failure leaves initialFetchDone false so a later trigger retries; local
  // docs/dirty/queue are all retained.
  const ensureInitialized = async (rt) => {
    if (rt.ready) await rt.ready; // full local recovery before any server op
    if (rt.initialFetchDone) return true;
    if (!isActive(rt)) return false;
    let payload;
    try {
      payload = await fetchStudioDocument();
    } catch (error) {
      if (error?.message === "Studio persistence is not configured") {
        rt.initialFetchDone = true; // definitive: no server persistence
        return true;
      }
      return false; // transient — retry on the next trigger
    }
    if (!isActive(rt)) return false;
    if (!payload?.document) {
      // Confirmed absence: acceptedDocument = null + accepted null version
      // (retaining dirty) so the next write uses the server's create-only
      // null-version contract.
      rt.acceptedDoc = null;
      rt.version = null;
      acceptServerSnapshot(rt.scope, { version: null });
      rt.initialFetchDone = true;
      return true;
    }
    // Normalize and ESTABLISH the accepted server document, then merge (explicit
    // dirty domains) and INSTALL as rt.latestDoc before setStudioDoc/persist so
    // the lane only ever sees the merged doc.
    rt.acceptedDoc = normalizeDocument(payload.document);
    const merged = mergeStudioDocuments(rt.acceptedDoc, rt.latestDoc, { dirtyDomains: getDirtyDomains(rt.scope) });
    rt.version = payload.version ?? null;
    rt.latestDoc = merged;
    rt.initialFetchDone = true;
    acceptServerSnapshot(rt.scope, { version: payload.version ?? null });
    setStudioDoc(merged);
    persistStudioDocument(
      { ...merged, lastSavedAt: payload.updatedAt || payload.document.lastSavedAt || null },
      rt.scope,
    );
    setSaveState({ status: "saved", lastSavedAt: payload.updatedAt || payload.document.lastSavedAt || null, error: null });
    return true;
  };

  // Drain this scope's queue oldest-first; stop at the first unresolved entry so
  // a newer live save can never bypass it. Returns true only on a clean drain.
  const drainQueue = async (rt) => {
    const queue = await getSyncQueueByScope(rt.scope);
    for (const entry of queue) {
      if (entry.scope !== rt.scope) continue; // defensive
      if (entry.type !== "save" || !entry.document) return false; // malformed -> unresolved, stop
      // Prepare the write against the ACCEPTED server document BEFORE the first
      // attempt: captured dirty domains may win, rows merge by updatedAt, and
      // every non-dirty domain stays server-owned — so a stale/generated queued
      // snapshot can never overwrite the server even when its stored version
      // happens to match the current one. The write itself uses the runtime's
      // CURRENT accepted version, not the entry's stored one.
      const entryDirty = Array.isArray(entry.dirtyDomains) ? entry.dirtyDomains : [];
      const prepared = rt.acceptedDoc
        ? mergeStudioDocuments(rt.acceptedDoc, entry.document, { dirtyDomains: entryDirty })
        : entry.document; // confirmed absence -> the entry creates the document
      const result = await reconcileSaveConflict({
        document: prepared,
        version: rt.version,
        dirtyDomains: entryDirty,
        fetchDoc: () => fetchStudioDocument(),
        saveDoc: (doc, ver) => saveStudioDocument(doc, ver),
        isScopeValid: () => isActive(rt), // never START a write/fetch under a switched scope
      });
      if (!result.ok) return false; // unresolved (conflict-exhausted / scope-changed / network) -> stop
      try {
        await finalizeWriteSuccess(rt, { sentDocument: result.document, savedVersion: result.version, sentDirty: entryDirty, acceptedDocument: result.acceptedDocument });
      } catch {
        // Finalization not durable -> surface the scoped integrity error (active
        // scope only), retain the entry, stop later replay.
        if (isActive(rt)) {
          setSaveState((current) => ({
            ...current,
            status: "error",
            error: "Save integrity at risk — unsynced changes could not be stored durably.",
          }));
        }
        return false;
      }
      await deleteSyncEntry(entry.id); // ack ONLY after durable finalization
    }
    return true;
  };

  // After a clean drain, send the latest document once on the resulting version
  // with the current dirty domains. Never before the server's existence is known.
  const liveSave = async (rt) => {
    if (rt.version == null && !rt.initialFetchDone) return; // create-only gate
    const savedAt = new Date().toISOString();
    const nextDocument = { ...(rt.latestDoc || {}), lastSavedAt: savedAt };
    const sentDirty = getDirtyDomains(rt.scope);
    // Dedup against the ACCEPTED server document (structural, ignoring
    // lastSavedAt): when the local overlay carries no divergence and nothing is
    // dirty, there is nothing to send — an unchanged initial fetch or an idle
    // re-pump never causes a redundant server write.
    if (rt.acceptedDoc && sentDirty.length === 0 && isSameDocumentContent(rt.latestDoc, rt.acceptedDoc)) return;
    let result;
    try {
      result = await reconcileSaveConflict({
        document: nextDocument,
        version: rt.version,
        dirtyDomains: sentDirty,
        fetchDoc: () => fetchStudioDocument(),
        saveDoc: (doc, ver) => saveStudioDocument(doc, ver),
        isScopeValid: () => isActive(rt),
      });
    } catch (error) {
      if (error?.message === "Studio persistence is not configured" || error?.message === "user context is required") {
        if (isActive(rt)) setSaveState({ status: "saved", lastSavedAt: savedAt, error: null });
        return;
      }
      if (error?.retryable) {
        // Offline/transient: queue the edit for replay; retain local + dirty.
        addToSyncQueue({ type: "save", document: nextDocument, scope: rt.scope, version: rt.version, dirtyDomains: sentDirty }).catch(() => {});
        if (isActive(rt)) setSaveState({ status: "offline", lastSavedAt: savedAt, error: "Offline - changes saved locally and will sync when reconnected." });
      } else if (isActive(rt)) {
        setSaveState({ status: "error", lastSavedAt: savedAt, error: "Server persistence failed. Local browser copy is still available." });
      }
      return;
    }
    if (!result.ok) {
      // Retain local document + dirty metadata. Only the ACTIVE scope surfaces a
      // status; a stale-scope failure never touches another scope's UI.
      if (isActive(rt) && result.reason === "retry-exhausted") {
        setSaveState({ status: "conflict", lastSavedAt: savedAt, error: "Unresolved version conflict - your local changes are kept. Edit again to retry." });
      }
      return;
    }
    try {
      // Install the accepted result.document (server-side non-dirty changes) while
      // keeping remaining dirty domains + newer rows.
      await finalizeWriteSuccess(rt, { sentDocument: nextDocument, savedVersion: result.version, sentDirty, acceptedDocument: result.acceptedDocument });
    } catch {
      if (isActive(rt)) setSaveState({ status: "error", lastSavedAt: savedAt, error: "Save integrity at risk — unsynced changes could not be stored durably." });
      return;
    }
    if (isActive(rt)) {
      setSaveState({ status: "saved", lastSavedAt: result.payload?.updatedAt || savedAt, error: null });
    }
  };

  // The single outbound lane. Live save and replay never write concurrently for
  // a scope; polling is only allowed while the lane is idle.
  const pumpLane = async (rt) => {
    if (rt.laneBusy) { rt.laneDirty = true; return; }
    rt.laneBusy = true;
    try {
      // Establish server state first (retryable, after full local recovery). Only
      // then may the lane drain the queue and perform the single live save.
      const ready = await ensureInitialized(rt);
      if (!ready) return; // init unavailable — retain everything; a later trigger retries
      const drained = await drainQueue(rt);
      if (drained) await liveSave(rt); // one live save after a clean drain
    } catch {
      // transient; a later trigger re-pumps
    } finally {
      rt.laneBusy = false;
      if (rt.laneDirty && isActive(rt)) { rt.laneDirty = false; pumpLane(rt); }
    }
  };

  // ─── Effects ─────────────────────────────────────────────────────
  // Scoped save-integrity error: only the ACTIVE runtime's failure alters the
  // visible save state (a stale inactive-scope failure must not touch it).
  useEffect(() => {
    setSyncRecordIntegrityHandler((failScope) => {
      const active = activeRuntimeRef.current;
      if (active && active.scope === failScope) {
        setSaveState((current) => ({
          ...current,
          status: "error",
          error: "Save integrity at risk — unsynced changes could not be stored durably.",
        }));
      }
    });
    return () => setSyncRecordIntegrityHandler(null);
  }, []);

  useEffect(() => {
    // Persist the OUTGOING scope's latest document DURABLY (localStorage
    // synchronously; immediate IndexedDB when localStorage fails) and flush its
    // pending debounced IDB write BEFORE replacing it, so an edit made just
    // before an account switch (inside the debounce window) survives on return
    // even when localStorage is unavailable.
    const prevRt = activeRuntimeRef.current;
    if (prevRt && prevRt.scope !== storageScope && prevRt.latestDoc) {
      try {
        persistStudioDocumentDurably({ ...prevRt.latestDoc, lastSavedAt: new Date().toISOString() }, prevRt.scope);
        flushScopedPersist(prevRt.scope);
      } catch { /* best-effort */ }
    }

    setApiUserId(userId || "", userId ? () => getToken() : null);
    // ONE canonical runtime per scope: returning to a scope REUSES its runtime
    // (and its single lane), so no second concurrent runtime is created for it.
    const rt = getRuntime(storageScope);
    const isNewRuntime = rt.ready === null;
    activeRuntimeRef.current = rt;
    // Use the runtime's OWN latest document: a new runtime was seeded from its
    // own scoped storage by makeRuntime (never the active studioDoc); a returning
    // runtime's in-memory latestDoc is canonical (storage may be staler when
    // localStorage writes are failing). Never seed from another scope's document.
    const docToShow = rt.latestDoc;
    setStudioDoc(docToShow);
    setSaveState((current) => ({
      ...current,
      status: "idle",
      lastSavedAt: docToShow.lastSavedAt || null,
      error: null,
    }));
    // Build combined local-recovery readiness exactly once per runtime.
    if (isNewRuntime) rt.ready = buildReadiness(rt);
    // The outbound lane owns initialization (retryable) + drain + live save.
    // Only signed-in scopes talk to the server.
    if (userId) rt.ready.then(() => { if (isActive(rt)) pumpLane(rt); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, storageScope, userId]);

  const updateDocument = useCallback((mutator, auditEntryFactory) => {
    const rt = activeRuntimeRef.current;
    setStudioDoc((current) => {
      const next = mutator(current);
      const withAudit = auditEntryFactory
        ? appendAuditEntries(next, [auditEntryFactory(next)])
        : next;
      // Capture EXPLICIT dirty intent at mutation time: which top-level domains
      // this real user mutation actually changed (rows excluded — they use
      // updatedAt merge).
      const changed = changedTopLevelDomains(current, withAudit);
      if (changed.length) {
        // Record in the runtime synchronously so a save begun before this render
        // (and finalized after a switch) compares against the freshest doc, and
        // so a pre-hydration edit is not lost.
        changed.forEach((d) => rt.pendingDirty.add(d));
        // Persist immediately once hydration is done; otherwise readiness merges
        // pendingDirty at a higher revision when it completes.
        if (rt.hydrated) markDirtyDomains(rt.scope, changed);
      }
      // Update the runtime's latest document synchronously (not just on render),
      // so an in-flight save's finalization sees this edit.
      rt.latestDoc = withAudit;
      return withAudit;
    });
    setSaveState((current) => ({ ...current, status: "saving", error: null }));
  }, []);

  // Debounced local persist + lane pump. The single outbound lane owns all
  // server writes (drain queue, then one live save) and serializes them per scope.
  useEffect(() => {
    const rt = activeRuntimeRef.current;
    const timeoutId = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const nextDocument = { ...studioDoc, lastSavedAt: savedAt };
      // Durable persist: localStorage failure alone must not block the outbound
      // lane — an immediate IndexedDB write still satisfies durability. Only
      // when BOTH stores fail is the lane withheld and the error surfaced.
      persistStudioDocumentDurably(nextDocument, rt.scope).then((saved) => {
        if (!saved) {
          setSaveState((current) => ({
            status: "error",
            error: "Browser storage is full. Your latest changes are not safely persisted yet.",
            lastSavedAt: current.lastSavedAt,
          }));
          return;
        }
        if (userId) pumpLane(rt); // only signed-in scopes drive the server lane
      });
    }, 180);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageScope, studioDoc, userId]);

  // On tab close, synchronously flush the latest doc so an edit made inside
  // the 180ms/400ms debounce windows isn't lost. localStorage.setItem is
  // synchronous (reliable on unload); the IDB flush is best-effort.
  useEffect(() => {
    const handler = () => {
      try {
        persistStudioDocument({ ...studioDoc, lastSavedAt: new Date().toISOString() }, storageScope);
        flushStudioPersist();
      } catch { /* best-effort on unload */ }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [studioDoc, storageScope]);

  useEffect(() => {
    if (saveState.status === "error" && saveState.error) {
      showToast(saveState.error, T.red);
    }
  }, [saveState, showToast]);

  // ─── Online / offline detection ─────────────────────────────────
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ─── Reconnect: pump the outbound lane ──────────────────────────
  // The lane (drain queue oldest-first, then one live save) is the single
  // outbound path per scope; coming online just triggers it.
  useEffect(() => {
    if (!isOnline || !userId) return;
    pumpLane(activeRuntimeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, userId, storageScope]);

  // ─── Multi-device sync polling ──────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const rt = activeRuntimeRef.current;
    const interval = setInterval(async () => {
      // Poll only when the outbound lane is IDLE — never over an in-flight write.
      if (rt.laneBusy || !isActive(rt)) return;
      try {
        const payload = await fetchStudioDocument();
        if (!payload?.document || !isActive(rt)) return;

        // Only update if the server version is newer -- and MERGE with the
        // local copy (per row newest-wins; per domain by EXPLICIT dirty set)
        // instead of replacing it, so unsynced local state survives the refresh.
        if (payload.version != null && payload.version > (rt.version || 0)) {
          // Normalize + ESTABLISH the accepted server document, merge by explicit
          // dirty domains, and INSTALL as rt.latestDoc before setStudioDoc so the
          // lane never sees the pre-merge document.
          rt.acceptedDoc = normalizeDocument(payload.document);
          const merged = mergeStudioDocuments(rt.acceptedDoc, rt.latestDoc, { dirtyDomains: getDirtyDomains(rt.scope) });
          const changed = !isSameDocumentContent(merged, rt.latestDoc);
          rt.version = payload.version;
          // Accepted a newer server snapshot -> advance the accepted version even
          // when the merged result is byte-identical (dirty domains preserved).
          acceptServerSnapshot(rt.scope, { version: payload.version });
          if (!changed) return;
          rt.latestDoc = merged;
          setStudioDoc(merged);
          persistStudioDocument(
            { ...merged, lastSavedAt: payload.updatedAt },
            rt.scope,
          );
          showToast("Updated from another device", T.mint);
        }
      } catch {
        // Silent failure -- will retry on next interval
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [userId, storageScope, showToast]);

  // (IndexedDB raw recovery is now part of the runtime readiness promise —
  // buildReadiness — so no independent recovery effect is needed. This keeps
  // outbound work gated on complete local recovery.)

  useEffect(() => {
    let cancelled = false;
    if (igConfig?.username) {
      return () => { cancelled = true; };
    }
    // Skip fetch if last sync was < 5 minutes ago
    const lastSyncAt = studioDoc.instagram?.syncedAt;
    if (lastSyncAt && Date.now() - new Date(lastSyncAt).getTime() < 5 * 60 * 1000) {
      return () => { cancelled = true; };
    }
    fetchInstagramFeed()
      .then((feed) => {
        if (cancelled) return;
        updateDocument(
          (current) => ({
            ...current,
            instagram: {
              account: feed.account,
              media: { ...(feed.media || {}), _syncedAt: feed.syncedAt },
              syncedAt: feed.syncedAt,
            },
          }),
          () => createAuditEntry("instagram.restored", currentUser, "Restored Instagram session from the server"),
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- syncedAt intentionally excluded to avoid re-fetch loop
  }, [currentUser, igConfig, updateDocument]);

  useEffect(() => {
    setConns(c => ({ ...c, instagram: !!igConfig?.username }));
  }, [igConfig]);

  // ─── Callbacks ───────────────────────────────────────────────────
  const handleTokenRefresh = useCallback(async () => {
    if (!igConfig?.username) return;
    try {
      const feed = await fetchInstagramFeed();
      updateDocument(
        (current) => ({
          ...current,
          instagram: {
            account: feed.account,
            media: { ...feed.media, _syncedAt: feed.syncedAt },
            syncedAt: feed.syncedAt,
          },
        }),
        () => createAuditEntry("instagram.refreshed", currentUser, "Refreshed Instagram session and media cache"),
      );
      showToast("Instagram session refreshed", T.mint);
    } catch {
      showToast("Instagram session needs a refresh — reconnect from Connections.", T.red);
    }
  }, [currentUser, igConfig, showToast, updateDocument]);

  const update = (id, patch) =>
    updateDocument(
      (current) => ({
        ...current,
        rows: current.rows.map((row) => (row.id === id ? applyRowPatch(row, patch, currentUser) : row)),
      }),
      Object.keys(patch).every((field) => ["note", "caption", "storyElements", "comments"].includes(field))
        ? null
        : () => createAuditEntry("post.updated", currentUser, "Updated a post", { id, fields: Object.keys(patch) }),
    );

  // Canonical scheduling operation — the ONE path a row takes into scheduled
  // state, so materialization is guaranteed before the scheduled worker can see
  // it. Every UI transition into "scheduled" (Approve & schedule, DetailPanel
  // status select, Row inline status) must route through this.
  //
  // Legacy designed carousels store `carouselSlides` with no rendered frames.
  // The scheduled worker runs in Node and cannot render them, so they are
  // rendered + uploaded in the browser here FIRST; carouselFrameUrls (and the
  // scheduled status) are persisted together in one document write. If
  // materialization fails, the row is left unscheduled and the failure surfaced.
  const schedulePost = useCallback(async (id, scheduledAt) => {
    const row = rows.find((r) => r.id === id);
    if (!row || row.status === "posted") return false;
    if (!scheduledAt) {
      showToast("A scheduled date is required", T.amber);
      return false;
    }

    let mediaPatch = null;
    try {
      // Materialization (render + upload) is owned by the materialization module
      // and returns media results only — no scheduled-state decision.
      mediaPatch = await materializeForSchedule(row);
    } catch {
      showToast("Couldn't render the carousel slides — post was not scheduled", T.amber);
      return false;
    }

    // schedulePost is the SOLE owner of the scheduled lifecycle: one atomic
    // update carrying the materialized media patch (if any) plus the scheduled
    // status and scheduledAt. The row is never scheduled without its frames.
    update(id, { ...(mediaPatch || {}), status: "scheduled", scheduledAt });
    const when = new Date(scheduledAt).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    showToast(`Scheduled for ${when}`, T.mint);
    return true;
  // `update` is defined above and is stable per-render; safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, showToast]);

  // One-click approve: pick the next sensible slot for the row's platform and
  // schedule through the canonical operation. No-op for already-posted rows.
  const approveAndSchedule = useCallback((id) => {
    const row = rows.find((r) => r.id === id);
    if (!row || row.status === "posted") return null;
    const scheduledAt = suggestBestSlot(row.platform, rows, new Date());
    schedulePost(id, scheduledAt);
    return scheduledAt;
  // `schedulePost` is stable per-render; safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const softDelete = useCallback((ids) => {
    const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
    setPendingDelete({ rows: rows.filter((row) => idSet.has(row.id)), count: idSet.size });
    updateDocument(
      (current) => ({
        ...current,
        rows: current.rows.map((row) => (idSet.has(row.id) ? markRowDeleted(row, currentUser) : row)),
      }),
      () => createAuditEntry("post.deleted", currentUser, "Soft-deleted posts", { ids: [...idSet] }),
    );
    setSel(s => { const n = new Set(s); idSet.forEach(id => n.delete(id)); return n; });
  }, [currentUser, rows, updateDocument]);

  const remove = (id) => softDelete([id]);
  const toggleSel = (id, v) => setSel(s => { const n = new Set(s); v ? n.add(id) : n.delete(id); return n; });
  const toggleAll = (v) => setSel(v ? new Set(sorted.map(r => r.id)) : new Set());
  const bulkDel = () => { softDelete([...sel]); };
  const toggleOC = (id) => setOC(s => { const n = new Set(s); s.has(id) ? n.delete(id) : n.add(id); return n; });
  const MAX_COMMENTS_PER_ROW = 500;
  const addComment = (rowId, c) => {
    const existing = rows.find(r => r.id === rowId)?.comments || [];
    if (existing.length >= MAX_COMMENTS_PER_ROW) return;
    update(rowId, { comments: [...existing, c] });
  };

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    const restoreIds = new Set(pendingDelete.rows.map((row) => row.id));
    updateDocument(
      (current) => ({
        ...current,
        rows: current.rows.map((row) => (restoreIds.has(row.id) ? restoreDeletedRow(row, currentUser) : row)),
      }),
      () => createAuditEntry("post.restored", currentUser, "Restored soft-deleted posts", { ids: [...restoreIds] }),
    );
    setPendingDelete(null);
  }, [currentUser, pendingDelete, updateDocument]);

  const createPostForDate = useCallback((dateObj, title) => {
    const trimmed = (title || "").trim();
    if (!trimmed) return;
    const targetYear = dateObj.getFullYear();
    const targetMonth = dateObj.getMonth();
    const day = dateObj.getDate();
    const iso = ptPickerToISO(targetYear, targetMonth, day, 9, 0);
    const newRow = createNewRow({ scheduledAt: iso, note: trimmed, platform: "ig_post" }, currentUser, studioDoc.rows.length);
    updateDocument(
      (current) => ({
        ...current,
        rows: [...current.rows, newRow],
      }),
      () => createAuditEntry("post.created", currentUser, "Created a post on a calendar day", { scheduledAt: iso, title: trimmed }),
    );
    // Drop straight into the editor — a fresh post shouldn't need a second click.
    setSelectedRowId(newRow.id);
  }, [currentUser, updateDocument, studioDoc.rows.length]);

  const createPostDraft = ({ title, caption, dateValue, timeValue, platform, platforms, tags, firstComment, mediaUrl, thumbnailUrl, mediaItems, mediaKind, carouselFrameUrls, createAnother, openDesigner }) => {
    const [targetYear, targetMonth, day] = dateValue.split("-").map(Number);
    const [hour, minute] = timeValue.split(":").map(Number);
    const iso = ptPickerToISO(targetYear, targetMonth - 1, day, hour, minute);
    const newRow = createNewRow({
      scheduledAt: iso,
      note: title,
      platform: platform || "ig_post",
      ...(Array.isArray(platforms) && platforms.length ? { platforms } : {}),
      ...(Array.isArray(tags) && tags.length ? { tags } : {}),
      ...(firstComment ? { firstComment } : {}),
      ...(caption ? { caption } : {}),
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      ...(Array.isArray(mediaItems) && mediaItems.length ? { mediaItems } : {}),
      ...(mediaKind ? { mediaKind } : {}),
      ...(Array.isArray(carouselFrameUrls) && carouselFrameUrls.length ? { carouselFrameUrls } : {}),
    }, currentUser, studioDoc.rows.length);
    updateDocument(
      (current) => ({
        ...current,
        rows: [...current.rows, newRow],
      }),
      () => createAuditEntry("post.created", currentUser, "Created a new post draft", { scheduledAt: iso, title, platform }),
    );
    if (createAnother) return; // keep the Create Post window open for the next one
    setAddPostDraft(null);
    // "Design it" paths land in the right tool immediately; otherwise drop
    // straight into the editor — a fresh post shouldn't need a second click.
    if (openDesigner) { setStory(newRow); return; }
    setSelectedRowId(newRow.id);
  };

  const getNextAvailableWeekday = () => {
    const pt = nowPT();
    const candidate = new Date(pt.getFullYear(), pt.getMonth(), pt.getDate() + 1);
    // Skip Saturday (6) and Sunday (0)
    while (candidate.getDay() === 0 || candidate.getDay() === 6) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate;
  };

  const startInlineCreate = () => {
    setInlineCreateActive(true);
  };

  const commitInlineCreate = (title) => {
    const nextDay = getNextAvailableWeekday();
    const dateValue = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
    const timeValue = "09:00";
    const platform = "ig_post";

    const [targetYear, targetMonth, day] = dateValue.split("-").map(Number);
    const [hour, minute] = timeValue.split(":").map(Number);
    const iso = ptPickerToISO(targetYear, targetMonth - 1, day, hour, minute);

    const newRow = createNewRow({ scheduledAt: iso, note: title, platform }, currentUser, studioDoc.rows.length);
    updateDocument(
      (current) => ({
        ...current,
        rows: [...current.rows, newRow],
      }),
      () => createAuditEntry("post.created", currentUser, "Created a new post draft (inline)", { scheduledAt: iso, title, platform }),
    );
    setInlineCreateActive(false);
    setSelectedRowId(newRow.id);
  };

  const cancelInlineCreate = () => {
    setInlineCreateActive(false);
  };

  const add = (targetMonth = month, day = 1, targetYear = year) => {
    const nowVal = nowPT();
    const fallbackDay =
      targetYear === nowVal.getFullYear() && targetMonth === nowVal.getMonth()
        ? Math.max(day, nowVal.getDate())
        : day;
    setAddPostDraft(new Date(targetYear, targetMonth, fallbackDay, 9, 0));
  };

  const jumpToMonth = (mi) => {
    if (timeScale === "year") {
      yearScrollRef.current?.(mi);
    } else {
      setMonth(mi);
    }
  };

  const commitReorder = useCallback((from, to) => {
    if (from === null || to === null || from === to) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const orderMap = new Map(reordered.map((item, order) => [item.id, order]));
    updateDocument(
      (current) => ({
        ...current,
        rows: current.rows.map((item) => (orderMap.has(item.id) ? applyRowPatch(item, { order: orderMap.get(item.id) }, currentUser) : item)),
      }),
      () => createAuditEntry("post.reordered", currentUser, "Reordered posts in the current view", { from, to }),
    );
  }, [currentUser, sorted, updateDocument]);

  const jumpToStatsFilter = (next) => {
    setView("list");
    setQuery("");
    setAttentionOnly(false);
    setStatusFilter(next.status ?? "all");
    setPlatformFilter(next.platform ?? "all");
  };

  // ─── Generic undo system ─────────────────────────────────────────
  const registerUndo = useCallback((message, undoFn) => {
    setPendingUndo((current) => {
      if (current?.timer) clearTimeout(current.timer);
      return null;
    });
    const id = uid();
    const timer = setTimeout(() => {
      setPendingUndo((current) => (current?.id === id ? null : current));
    }, 10000);
    setPendingUndo({ id, message, undo: undoFn, timer });
  }, []);

  const triggerUndo = useCallback(() => {
    setPendingUndo((current) => {
      if (current) {
        if (current.timer) clearTimeout(current.timer);
        try { current.undo(); } catch { /* ignore */ }
      }
      return null;
    });
  }, []);

  const dismissUndo = useCallback(() => {
    setPendingUndo((current) => {
      if (current?.timer) clearTimeout(current.timer);
      return null;
    });
  }, []);

  // Bulk actions: status, platform, assignee (single document update + undo)
  const bulkSetStatus = useCallback((status) => {
    const selectedIds = [...sel];
    if (selectedIds.length === 0) return;

    const previousStatuses = new Map();
    for (const row of studioDoc.rows) {
      if (sel.has(row.id)) previousStatuses.set(row.id, row.status);
    }

    const statusLabel = STATUSES[status]?.label || status;
    updateDocument(
      (current) => ({
        ...current,
        rows: current.rows.map((row) =>
          sel.has(row.id) ? applyRowPatch(row, { status }, currentUser) : row
        ),
      }),
      () => createAuditEntry("post.bulk_updated", currentUser, `Set ${selectedIds.length} posts to ${statusLabel}`),
    );

    registerUndo(`${selectedIds.length} post${selectedIds.length !== 1 ? "s" : ""} set to ${statusLabel}`, () => {
      updateDocument(
        (current) => ({
          ...current,
          rows: current.rows.map((row) => {
            const prev = previousStatuses.get(row.id);
            return prev !== undefined ? applyRowPatch(row, { status: prev }, currentUser) : row;
          }),
        }),
        () => createAuditEntry("post.bulk_undo", currentUser, "Undid bulk status change"),
      );
    });
  }, [sel, studioDoc.rows, currentUser, updateDocument, registerUndo]);

  const bulkSetPlatform = useCallback((platform) => {
    const selectedIds = [...sel];
    if (selectedIds.length === 0) return;

    const previousPlatforms = new Map();
    for (const row of studioDoc.rows) {
      if (sel.has(row.id)) previousPlatforms.set(row.id, row.platform);
    }

    const platformLabel = PLATFORMS[platform]?.label || platform;
    updateDocument(
      (current) => ({
        ...current,
        rows: current.rows.map((row) =>
          sel.has(row.id) ? applyRowPatch(row, { platform }, currentUser) : row
        ),
      }),
      () => createAuditEntry("post.bulk_updated", currentUser, `Set ${selectedIds.length} posts to ${platformLabel}`),
    );

    registerUndo(`${selectedIds.length} post${selectedIds.length !== 1 ? "s" : ""} set to ${platformLabel}`, () => {
      updateDocument(
        (current) => ({
          ...current,
          rows: current.rows.map((row) => {
            const prev = previousPlatforms.get(row.id);
            return prev !== undefined ? applyRowPatch(row, { platform: prev }, currentUser) : row;
          }),
        }),
        () => createAuditEntry("post.bulk_undo", currentUser, "Undid bulk channel change"),
      );
    });
  }, [sel, studioDoc.rows, currentUser, updateDocument, registerUndo]);

  const bulkSetAssignee = useCallback((assignee) => {
    const selectedIds = [...sel];
    if (selectedIds.length === 0) return;

    const previousAssignees = new Map();
    for (const row of studioDoc.rows) {
      if (sel.has(row.id)) previousAssignees.set(row.id, row.assignee ?? null);
    }

    const assigneeLabel = assignee
      ? team.find((m) => m.id === assignee)?.name || "assignee"
      : "Unassigned";
    updateDocument(
      (current) => ({
        ...current,
        rows: current.rows.map((row) =>
          sel.has(row.id) ? applyRowPatch(row, { assignee }, currentUser) : row
        ),
      }),
      () => createAuditEntry("post.bulk_updated", currentUser, `Assigned ${selectedIds.length} posts to ${assigneeLabel}`),
    );

    registerUndo(`${selectedIds.length} post${selectedIds.length !== 1 ? "s" : ""} assigned to ${assigneeLabel}`, () => {
      updateDocument(
        (current) => ({
          ...current,
          rows: current.rows.map((row) => {
            if (!previousAssignees.has(row.id)) return row;
            const prev = previousAssignees.get(row.id);
            return applyRowPatch(row, { assignee: prev }, currentUser);
          }),
        }),
        () => createAuditEntry("post.bulk_undo", currentUser, "Undid bulk assignee change"),
      );
    });
  }, [sel, studioDoc.rows, currentUser, updateDocument, registerUndo, team]);

  const makeDrag = useCallback((row, idx) => ({
    isDragging: draggingId === row.id,
    isDragOver: dragOverId === row.id && draggingId !== row.id,
    onPointerDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragIdx.current = idx;
      dragOverIdx.current = idx;
      setDraggingId(row.id);
      setDragOverId(row.id);
      const onUp = () => {
        commitReorder(dragIdx.current, dragOverIdx.current);
        setDraggingId(null);
        setDragOverId(null);
        dragIdx.current = null;
        dragOverIdx.current = null;
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointerup", onUp);
    },
    onMouseEnter: () => {
      if (dragIdx.current === null) return;
      dragOverIdx.current = idx;
      if (dragOverId !== row.id) setDragOverId(row.id);
    },
  }), [draggingId, dragOverId, commitReorder]);

  // ─── Context value ───────────────────────────────────────────────
  const value = {
    // Auth / identity
    currentUser, storageScope, userId, isOnline,

    // Document
    studioDoc, updateDocument,

    // Core state
    month, setMonth, year,
    view, setView,
    query, setQuery,
    statusFilter, setStatusFilter,
    platformFilter, setPlatformFilter,
    attentionOnly, setAttentionOnly,
    timeScale, setTimeScale,
    composer, setComposer,
    addPostDraft, setAddPostDraft,
    story, setStory,
    showAssets, setAssets,
    showConn, setShowConn,
    showSettings, setSettings, settingsInitialTab, openSettingsTab,
    team, updateTeam,
    connections, setConns,
    saveState,
    pendingDelete, setPendingDelete,
    pendingUndo, registerUndo, triggerUndo, dismissUndo,
    tokenBannerDismissed, setTokenBannerDismissed,
    openComments,
    publishConfirm, setPublishConfirm,
    showCommandPalette, setCommandPalette,
    selectedRowId, setSelectedRowId,
    inlineCreateActive, startInlineCreate, commitInlineCreate, cancelInlineCreate,
    showToast,
    sel, setSel,
    monthRefs,
    yearScrollRef,

    // Derived
    rows, filteredRows, igConfig, igMedia, reviewConfig,
    allSorted, sorted, grouped,
    igC, liC, readyC, reviewC, attentionCount,
    monthCounts, maxMonthCount,

    // Actions
    update, approveAndSchedule, schedulePost, softDelete, undoDelete, remove,
    toggleSel, toggleAll, bulkDel,
    bulkSetStatus, bulkSetPlatform, bulkSetAssignee,
    toggleOC, addComment,
    createPostDraft, createPostForDate, add,
    commitReorder, jumpToMonth, jumpToStatsFilter,
    handleTokenRefresh,
    makeDrag,

    // LinkedIn (in-memory snapshot only)
    linkedinAccount,
    setLinkedinAccount,

    // Brand profile
    brandProfile,
    updateBrandProfile: (patch) => updateDocument(
      (current) => ({
        ...current,
        brandProfile: normalizeBrandProfile({
          ...createDefaultBrandProfile(),
          ...current.brandProfile,
          ...patch,
          updatedAt: new Date().toISOString(),
        }),
      }),
      () => createAuditEntry("brand_profile.updated", currentUser, "Brand profile edited"),
    ),

    // Appearance (accent + density)
    appearance,
    updateAppearance: (patch) => updateDocument(
      (current) => ({
        ...current,
        appearance: { ...DEFAULT_APPEARANCE, ...current.appearance, ...patch },
      }),
      () => createAuditEntry("appearance.updated", currentUser, "Appearance settings changed", patch),
    ),

    // Export helper
    exportData: () => { exportStudioData(studioDoc); showToast("Backup downloaded", T.mint); },
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
