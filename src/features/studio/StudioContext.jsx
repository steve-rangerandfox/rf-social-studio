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
  appendAuditEntries,
  applyRowPatch,
  createAuditEntry,
  createDefaultBrandProfile,
  createNewRow,
  exportStudioData,
  loadStudioDocument,
  loadStudioDocumentAsync,
  markRowDeleted,
  normalizeBrandProfile,
  persistStudioDocument,
  restoreDeletedRow,
} from "./document-store.js";
import { addToSyncQueue, getSyncQueue, clearSyncQueue } from "../../lib/idb-store.js";
import { useToast } from "../../components/Toaster.jsx";
import {
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
  "/": "list",
  "/calendar": "calendar",
  "/grid": "grid",
  "/analytics": "analytics",
};
export const pathFromView = {
  list: "/",
  calendar: "/calendar",
  grid: "/grid",
  analytics: "/analytics",
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
  const documentVersionRef = useRef(null);
  const setDocumentVersion = (v) => { documentVersionRef.current = v; };
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
  const brandProfile = useMemo(
    () => normalizeBrandProfile(studioDoc.brandProfile || createDefaultBrandProfile()),
    [studioDoc],
  );

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

  // ─── Effects ─────────────────────────────────────────────────────
  useEffect(() => {
    const scopedDocument = loadStudioDocument(storageScope);
    setApiUserId(userId || "", userId ? () => getToken() : null);
    setStudioDoc(scopedDocument);
    setSaveState((current) => ({
      ...current,
      status: "idle",
      lastSavedAt: scopedDocument.lastSavedAt || null,
      error: null,
    }));
  }, [getToken, storageScope, userId]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      return () => { cancelled = true; };
    }
    fetchStudioDocument()
      .then((payload) => {
        if (cancelled || !payload?.document) return;
        setStudioDoc(payload.document);
        setDocumentVersion(payload.version ?? null);
        persistStudioDocument(
          { ...payload.document, lastSavedAt: payload.updatedAt || payload.document.lastSavedAt || null },
          storageScope,
        );
        setSaveState({
          status: "saved",
          lastSavedAt: payload.updatedAt || payload.document.lastSavedAt || null,
          error: null,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storageScope, userId]);

  const updateDocument = useCallback((mutator, auditEntryFactory) => {
    setStudioDoc((current) => {
      const next = mutator(current);
      const withAudit = auditEntryFactory
        ? appendAuditEntries(next, [auditEntryFactory(next)])
        : next;
      return withAudit;
    });
    setSaveState((current) => ({ ...current, status: "saving", error: null }));
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const nextDocument = { ...studioDoc, lastSavedAt: savedAt };
      const saved = persistStudioDocument(nextDocument, storageScope);
      if (!saved) {
        setSaveState((current) => ({
          status: "error",
          error: "Browser storage is full. Your latest changes are not safely persisted yet.",
          lastSavedAt: current.lastSavedAt,
        }));
        return;
      }
      saveStudioDocument(nextDocument, documentVersionRef.current)
        .then((payload) => {
          if (payload?.version != null) {
            setDocumentVersion(payload.version);
          }
          setSaveState({ status: "saved", lastSavedAt: payload?.updatedAt || savedAt, error: null });
        })
        .catch((error) => {
          if (error?.message === "Studio persistence is not configured" || error?.message === "user context is required") {
            setSaveState({ status: "saved", lastSavedAt: savedAt, error: null });
            return;
          }
          if (error?.message === "Version conflict") {
            showToast("Your changes conflict with a newer version. Refreshing\u2026", T.red);
            fetchStudioDocument()
              .then((payload) => {
                if (payload?.document) {
                  setStudioDoc(payload.document);
                  setDocumentVersion(payload.version ?? null);
                  persistStudioDocument(
                    { ...payload.document, lastSavedAt: payload.updatedAt || null },
                    storageScope,
                  );
                  setSaveState({ status: "saved", lastSavedAt: payload.updatedAt || null, error: null });
                }
              })
              .catch(() => {});
            return;
          }
          // Queue for offline sync if it was a retryable/network error
          if (error?.retryable) {
            addToSyncQueue({ type: "save", document: nextDocument, scope: storageScope, version: documentVersionRef.current }).catch(() => {});
            setSaveState({ status: "offline", lastSavedAt: savedAt, error: "Offline — changes saved locally and will sync when reconnected." });
          } else {
            setSaveState({ status: "error", lastSavedAt: savedAt, error: "Server persistence failed. Local browser copy is still available." });
          }
        });
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [showToast, storageScope, studioDoc]);

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

  // ─── Replay sync queue when coming back online ──────────────────
  useEffect(() => {
    if (!isOnline || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const queue = await getSyncQueue();
        if (cancelled || queue.length === 0) return;
        for (const entry of queue) {
          if (cancelled) return;
          if (entry.type === "save" && entry.document) {
            await saveStudioDocument(entry.document, entry.version ?? null);
          }
        }
        await clearSyncQueue();
        showToast("Offline changes synced to server", T.mint);
      } catch {
        // Will retry next time we come online
      }
    })();
    return () => { cancelled = true; };
  }, [isOnline, userId, showToast]);

  // ─── Multi-device sync polling ──────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(async () => {
      try {
        const payload = await fetchStudioDocument();
        if (!payload?.document) return;

        // Only update if server version is newer
        if (payload.version != null && payload.version > (documentVersionRef.current || 0)) {
          setStudioDoc(payload.document);
          setDocumentVersion(payload.version);
          persistStudioDocument(
            { ...payload.document, lastSavedAt: payload.updatedAt },
            storageScope,
          );
          showToast("Updated from another device", T.mint);
        }
      } catch {
        // Silent failure — will retry on next interval
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [userId, storageScope, showToast]);

  // ─── IndexedDB async hydration (progressive enhancement) ────────
  useEffect(() => {
    let cancelled = false;
    loadStudioDocumentAsync(storageScope).then((idbDoc) => {
      if (cancelled || !idbDoc) return;
      // Only use IDB doc if it's newer than what we have
      if (idbDoc.lastSavedAt && (!studioDoc.lastSavedAt || idbDoc.lastSavedAt > studioDoc.lastSavedAt)) {
        setStudioDoc(idbDoc);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageScope]);

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
      showToast("Token refresh failed — please reconnect Instagram", T.red);
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

  // One-click approve: flip status→scheduled and pick the next sensible
  // slot for the row's platform. No-op for already-posted rows.
  const approveAndSchedule = useCallback((id) => {
    const row = rows.find((r) => r.id === id);
    if (!row || row.status === "posted") return null;
    const scheduledAt = suggestBestSlot(row.platform, rows, new Date());
    update(id, { status: "scheduled", scheduledAt });
    const when = new Date(scheduledAt).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    showToast(`Scheduled for ${when}`, T.mint);
    return scheduledAt;
  // `update` is defined above and is stable per-render; safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, showToast]);

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
    updateDocument(
      (current) => ({
        ...current,
        rows: [...current.rows, createNewRow({ scheduledAt: iso, note: trimmed, platform: "ig_post" }, currentUser, current.rows.length)],
      }),
      () => createAuditEntry("post.created", currentUser, "Created a post on a calendar day", { scheduledAt: iso, title: trimmed }),
    );
  }, [currentUser, updateDocument]);

  const createPostDraft = ({ title, dateValue, timeValue, platform }) => {
    const [targetYear, targetMonth, day] = dateValue.split("-").map(Number);
    const [hour, minute] = timeValue.split(":").map(Number);
    const iso = ptPickerToISO(targetYear, targetMonth - 1, day, hour, minute);
    updateDocument(
      (current) => ({
        ...current,
        rows: [...current.rows, createNewRow({ scheduledAt: iso, note: title, platform: platform || "ig_post" }, currentUser, current.rows.length)],
      }),
      () => createAuditEntry("post.created", currentUser, "Created a new post draft", { scheduledAt: iso, title, platform }),
    );
    setAddPostDraft(null);
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
      const el = monthRefs.current[mi];
      if (el) {
        const container = el.closest(".t-area");
        if (container) {
          const offset = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
          container.scrollTo({ top: offset, behavior: "smooth" });
        }
      }
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
    showSettings, setSettings,
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

    // Derived
    rows, filteredRows, igConfig, igMedia,
    allSorted, sorted, grouped,
    igC, liC, readyC, reviewC, attentionCount,
    monthCounts, maxMonthCount,

    // Actions
    update, approveAndSchedule, softDelete, undoDelete, remove,
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

    // Export helper
    exportData: () => { exportStudioData(studioDoc); showToast("Backup downloaded", T.mint); },
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
