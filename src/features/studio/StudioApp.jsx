import "./studio.css";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useNavigate, useLocation } from "react-router-dom";

import { SaveStatusBadge } from "../../components/SaveStatusBadge.jsx";
import {
  disconnectInstagram,
  fetchInstagramFeed,
  fetchStudioDocument,
  generateCaption,
  saveStudioDocument,
  generateStoryTips,
  setApiUserId,
} from "../../lib/api-client.js";
import {
  appendAuditEntries,
  applyRowPatch,
  createAuditEntry,
  createNewRow,
  exportStudioData,
  loadStudioDocument,
  markRowDeleted,
  persistStudioDocument,
  restoreDeletedRow,
} from "./document-store.js";
import {
  Analytics,
  AssetLibrary,
  CalendarView,
  ConnectionPanel,
  IGGridView,
  SettingsModal,
} from "./components/StudioSurfaces.jsx";
import {
  formatRelativeStamp,
  getReadinessChecks,
  isRowNeedingAttention,
  makeDefaultElements,
  MENTIONS,
  MONTHS_FULL,
  MONTHS_SHORT,
  nowPT,
  PLATFORMS,
  ptPickerToISO,
  STATUSES,
  T,
  TEAM,
  toPTDisplay,
  uid,
  WD_SHORT,
} from "./shared.js";

import { DateTimeCell } from "./components/DateTimeCell.jsx";
import { FilterMenu } from "./components/FilterMenu.jsx";
import { AddPostModal } from "./components/AddPostModal.jsx";
import { Composer } from "./components/Composer.jsx";
import { StoryDesigner } from "./components/StoryDesigner.jsx";
import { YearlyKPISummary } from "./components/YearlyKPISummary.jsx";
import { PlatformIcon } from "./components/PlatformIcon.jsx";
import { MonthMiniMap } from "./components/MonthMiniMap.jsx";
import { Row } from "./components/Row.jsx";
import { Toast } from "./components/Toast.jsx";
import { TokenExpiryBanner } from "./components/TokenExpiryBanner.jsx";
import { UndoDeleteToast } from "./components/UndoDeleteToast.jsx";
import { PublishConfirmModal } from "./components/PublishConfirmModal.jsx";

// ─── Route ↔ View mapping ────────────────────────────────────────
const viewFromPath = {
  "/": "list",
  "/calendar": "calendar",
  "/grid": "grid",
  "/analytics": "analytics",
};
const pathFromView = {
  list: "/",
  calendar: "/calendar",
  grid: "/grid",
  analytics: "/analytics",
};

// ─── APP ──────────────────────────────────────────────────────────
export default function App() {
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
  const [month, setMonth]         = useState(now.getMonth());
  const [year]                    = useState(now.getFullYear());
  const [studioDoc, setStudioDoc] = useState(() => loadStudioDocument(storageScope));
  const [sel, setSel]             = useState(new Set());
  const [view, setViewState]      = useState(() => viewFromPath[location.pathname] || "list");
  const setView = (v) => {
    setViewState(v);
    navigate(pathFromView[v] || "/");
  };
  const [query, setQuery]         = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [timeScale, setTimeScale] = useState("month"); // "month" | "year"
  const [composer, setComposer]   = useState(null);
  const [addPostDraft, setAddPostDraft] = useState(null);
  const [story, setStory]         = useState(null);
  const [showAssets, setAssets]   = useState(false);
  const [showConn, setShowConn]   = useState(null); // 'instagram' | 'linkedin' | null
  const [showSettings, setSettings] = useState(false);
  const [connections, setConns]   = useState({ instagram: false, linkedin: false });
  const [saveState, setSaveState] = useState(() => ({
    status: studioDoc.lastSavedAt ? "saved" : "idle",
    lastSavedAt: studioDoc.lastSavedAt,
    error: null,
  }));
  // Soft-delete buffer: { rows: Row[], timer: number } | null
  const [pendingDelete, setPendingDelete] = useState(null);
  // Token expiry banner dismissal
  const [tokenBannerDismissed, setTokenBannerDismissed] = useState(false);
  const [openComments, setOC]     = useState(new Set());
  const [toast, setToast]         = useState(null);
  // Publishing confirmation modal
  const [publishConfirm, setPublishConfirm] = useState(null);
  const showToast = useCallback((msg, color) => setToast({msg, color, id:uid()}), []);
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const monthRefs = useRef({});
  const currentUser = actorName;

  const rows = studioDoc.rows.filter((row) => !row.deletedAt);
  const filteredRows = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    const assigneeName = TEAM.find((member) => member.id === row.assignee)?.name?.toLowerCase() || "";
    const matchesQuery = !q || [row.note, row.caption, assigneeName].filter(Boolean).some((value) => value.toLowerCase().includes(q));
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "ready"
        ? row.status === "approved" || row.status === "scheduled"
        : row.status === statusFilter);
    const matchesPlatform =
      platformFilter === "all" ||
      (platformFilter === "instagram" ? row.platform.startsWith("ig") : row.platform === platformFilter);
    const matchesAttention = !attentionOnly || isRowNeedingAttention(row);

    return matchesQuery && matchesStatus && matchesPlatform && matchesAttention;
  });
  const igConfig = studioDoc.instagram?.account || null;
  const igMedia = studioDoc.instagram?.media || null;

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
      return () => {
        cancelled = true;
      };
    }

    fetchStudioDocument()
      .then((payload) => {
        if (cancelled || !payload?.document) {
          return;
        }

        setStudioDoc(payload.document);
        persistStudioDocument(
          {
            ...payload.document,
            lastSavedAt: payload.updatedAt || payload.document.lastSavedAt || null,
          },
          storageScope,
        );
        setSaveState({
          status: "saved",
          lastSavedAt: payload.updatedAt || payload.document.lastSavedAt || null,
          error: null,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
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
      const nextDocument = {
        ...studioDoc,
        lastSavedAt: savedAt,
      };
      const saved = persistStudioDocument(nextDocument, storageScope);

      if (!saved) {
        setSaveState((current) => ({
          status: "error",
          error: "Browser storage is full. Your latest changes are not safely persisted yet.",
          lastSavedAt: current.lastSavedAt,
        }));
        return;
      }

      saveStudioDocument(nextDocument)
        .then((payload) => {
          setSaveState({
            status: "saved",
            lastSavedAt: payload?.updatedAt || savedAt,
            error: null,
          });
        })
        .catch((error) => {
          if (error?.message === "Studio persistence is not configured" || error?.message === "user context is required") {
            setSaveState({
              status: "saved",
              lastSavedAt: savedAt,
              error: null,
            });
            return;
          }

          setSaveState({
            status: "error",
            lastSavedAt: savedAt,
            error: "Server persistence failed. Local browser copy is still available.",
          });
        });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [storageScope, studioDoc]);

  useEffect(() => {
    if (saveState.status === "error" && saveState.error) {
      showToast(saveState.error, T.red);
    }
  }, [saveState, showToast]);

  useEffect(() => {
    let cancelled = false;

    if (igConfig?.username) {
      return () => {
        cancelled = true;
      };
    }

    fetchInstagramFeed()
      .then((feed) => {
        if (cancelled) {
          return;
        }

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

    return () => {
      cancelled = true;
    };
  }, [currentUser, igConfig, updateDocument]);

  // Keep sidebar connection dot in sync with real IG config
  useEffect(() => {
    setConns(c => ({...c, instagram: !!igConfig?.username}));
  }, [igConfig]);

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
      showToast('Instagram session refreshed', T.mint);
    } catch {
      showToast('Token refresh failed — please reconnect Instagram', T.red);
    }
  }, [currentUser, igConfig, showToast, updateDocument]);

  const allSorted = [...filteredRows].sort((a,b) => {
    const da = a.scheduledAt ? new Date(a.scheduledAt) : new Date(0);
    const db = b.scheduledAt ? new Date(b.scheduledAt) : new Date(0);
    if (da.getTime() === db.getTime()) {
      return (a.order || 0) - (b.order || 0);
    }
    return da - db;
  });

  // Month-filtered list (month view) or all-year (year view)
  const sorted = timeScale === "year"
    ? allSorted.filter(r => r.scheduledAt && new Date(r.scheduledAt).getFullYear() === year)
    : allSorted.filter(r => {
        if (!r.scheduledAt) return false;
        const d = new Date(r.scheduledAt);
        return d.getMonth() === month && d.getFullYear() === year;
      });

  // Grouped by month for year view
  const grouped = MONTHS_FULL.map((mName, mi) => ({
    mi, mName,
    rows: sorted.filter(r => {
      if (!r.scheduledAt) return false;
      return new Date(r.scheduledAt).getMonth() === mi;
    }),
  }));

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
  const add = (targetMonth=month, day=1, targetYear=year) => {
    const now = nowPT();
    const fallbackDay =
      targetYear === now.getFullYear() && targetMonth === now.getMonth()
        ? Math.max(day, now.getDate())
        : day;
    setAddPostDraft(new Date(targetYear, targetMonth, fallbackDay, 9, 0));
  };
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

  // Soft-delete: remove row(s) immediately from UI, keep a buffer for undo.
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

  const remove    = (id) => softDelete([id]);
  const toggleSel = (id,v)  => setSel(s=>{const n=new Set(s);v?n.add(id):n.delete(id);return n;});
  const toggleAll = (v)     => setSel(v?new Set(sorted.map(r=>r.id)):new Set());
  const bulkDel   = ()      => { softDelete([...sel]); };
  const toggleOC  = (id)    => setOC(s=>{const n=new Set(s);s.has(id)?n.delete(id):n.add(id);return n;});
  const MAX_COMMENTS_PER_ROW = 500;
  const addComment= (rowId,c) => {
    const existing = rows.find(r=>r.id===rowId)?.comments||[];
    if (existing.length >= MAX_COMMENTS_PER_ROW) return; // cap to prevent unbounded growth
    update(rowId,{comments:[...existing,c]});
  };

  // Undo the most-recent delete — restore buffered rows
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

  const jumpToMonth = (mi) => {
    if (timeScale === "year") {
      const el = monthRefs.current[mi];
      if (el) {
        const container = el.closest('.t-area');
        if (container) {
          const offset = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
          container.scrollTo({ top: offset, behavior: 'smooth' });
        }
      }
    } else {
      setMonth(mi);
    }
  };

  const commitReorder = useCallback((from, to) => {
    if (from === null || to === null || from === to) {
      return;
    }
    const reordered = [...sorted];
    const [moved] = reordered.splice(from,1);
    reordered.splice(to,0,moved);
    const orderMap = new Map(reordered.map((item, order) => [item.id, order]));
    updateDocument(
      (current) => ({
        ...current,
        rows: current.rows.map((item) => (orderMap.has(item.id) ? applyRowPatch(item, { order: orderMap.get(item.id) }, currentUser) : item)),
      }),
      () => createAuditEntry("post.reordered", currentUser, "Reordered posts in the current view", { from, to }),
    );
  }, [currentUser, sorted, updateDocument]);

  // ─── Keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyboard = (e) => {
      // Don't trigger when typing in inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.contentEditable === 'true') return;

      // N = new post
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); add(month); }
      // / = focus search
      if (e.key === '/') { e.preventDefault(); document.querySelector('.ops-search')?.focus(); }
      // 1-4 = switch views
      if (e.key === '1') { e.preventDefault(); setView('list'); }
      if (e.key === '2') { e.preventDefault(); setView('calendar'); }
      if (e.key === '3') { e.preventDefault(); setView('grid'); }
      if (e.key === '4') { e.preventDefault(); setView('analytics'); }
      // Escape = close modals
      if (e.key === 'Escape') {
        if (composer) setComposer(null);
        else if (story) setStory(null);
        else if (addPostDraft) setAddPostDraft(null);
        else if (publishConfirm) setPublishConfirm(null);
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [month, composer, story, addPostDraft, publishConfirm]);

  const makeDrag = (row,idx) => ({
    isDragging: draggingId===row.id,
    isDragOver: dragOverId===row.id && draggingId!==row.id,
    onMouseDown:(e)=>{
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
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mouseup", onUp);
    },
    onMouseEnter:()=>{
      if (dragIdx.current === null) return;
      dragOverIdx.current = idx;
      if (dragOverId !== row.id) setDragOverId(row.id);
    },
  });

  const renderRow = (row, idx) => (
    <Row key={row.id} row={row} sel={sel.has(row.id)} currentUser={currentUser}
      onSel={v=>toggleSel(row.id,v)}
      onChange={p=>update(row.id,p)}
      onDel={()=>{remove(row.id);showToast("Post removed",T.red);}}
      onCompose={()=>setComposer({row,postNow:false})}
      onStory={()=>setStory(row)}
      onPostNow={(r)=>{
        const hasAccount = connections.instagram || connections.linkedin;
        if (hasAccount) {
          setPublishConfirm(r || row);
        } else {
          setComposer({row: r || row, postNow:true});
        }
      }}
      hasConnectedAccount={connections.instagram || connections.linkedin}
      dragHandlers={makeDrag(row,idx)}
      showComments={openComments.has(row.id)}
      onToggleComments={()=>toggleOC(row.id)}
      onAddComment={c=>addComment(row.id,c)}
    />
  );

  const igC    = filteredRows.filter(r=>r.platform!=="linkedin").length;
  const liC    = filteredRows.filter(r=>r.platform==="linkedin").length;
  const readyC = filteredRows.filter(r=>r.status==="approved"||r.status==="scheduled").length;
  const reviewC= filteredRows.filter(r=>r.status==="needs_review").length;
  const attentionCount = filteredRows.filter((row) => isRowNeedingAttention(row)).length;
  const jumpToStatsFilter = (next) => {
    setView("list");
    setQuery("");
    setAttentionOnly(false);
    setStatusFilter(next.status ?? "all");
    setPlatformFilter(next.platform ?? "all");
  };

  // Month sparkline data (post counts per month, scaled)
  const monthCounts = MONTHS_FULL.map((_, mi) =>
    rows.filter(r => r.scheduledAt && new Date(r.scheduledAt).getMonth()===mi && new Date(r.scheduledAt).getFullYear()===year).length
  );
  const maxMonthCount = Math.max(...monthCounts, 1);

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="s-logo">
          <div className="logo-mark">RF</div>
          <div><div className="logo-name">Ranger & Fox</div><div className="logo-sub">Social Studio</div></div>
        </div>
        <div className="s-sect">
          <span className="s-lbl">Calendar</span>
          {/* Time scale toggle */}
          <div className="time-toggle">
            {[["month","Month"],["year","Year"]].map(([v,l])=>(
              <button key={v} className={"time-toggle-btn "+(timeScale===v?"on":"")}
                onClick={()=>setTimeScale(v)}>{l}</button>
            ))}
          </div>
          {MONTHS_FULL.map((m,i)=>{
            const cnt = monthCounts[i];
            return (
              <div key={i} className={"m-item "+(timeScale==="month"&&month===i?"on":"")}
                onClick={()=>{ jumpToMonth(i); if(timeScale==="month") setMonth(i); }}>
                <span>{m}</span>
                <span className="m-ct">{cnt>0?cnt:""}</span>
              </div>
            );
          })}
        </div>
        <div className="s-div"/>
        <div className="s-team">
          <span className="s-lbl">Team</span>
          {TEAM.map(t=>(
            <div key={t.id} className="team-row">
              <div className="av" style={{background:t.color+"22",color:t.color}}>{t.initials}</div>
              <span className="team-name">{t.name}</span>
              <div className="online-dot" style={{background:t.id==="stephen"?T.mint:T.textDim,boxShadow:t.id==="stephen"?`0 0 5px ${T.mint}`:undefined}}/>
            </div>
          ))}
        </div>
        <div className="s-div"/>
        <div className="s-bottom">
          <span className="s-lbl">Connections</span>
          {[
            {key:"instagram", label:"Instagram"},
            {key:"linkedin",  label:"LinkedIn"},
          ].map(c => {
            const on = connections[c.key];
            return (
              <div key={c.key} className="conn-row" onClick={()=>setShowConn(c.key)}>
                <div className={"conn-dot "+(on?"on":"off")}/>
                <span className="conn-name">{c.label}</span>
                <span className={"conn-st "+(on?"on":"off")}>{on?"Live":"Setup →"}</span>
              </div>
            );
          })}
          <div style={{height:6}}/>
          <button className="s-settings-btn" onClick={()=>setSettings(true)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{flexShrink:0,opacity:.6}}>
              <circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M6.5 1v1.2M6.5 10.8V12M1 6.5h1.2M10.8 6.5H12M2.4 2.4l.85.85M9.75 9.75l.85.85M9.75 3.25l-.85.85M3.25 9.75l-.85.85" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Settings
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          {timeScale==="year"
            ? <><span className="tb-month">Year View</span><span className="tb-year">{year}</span></>
            : <><span className="tb-month">{MONTHS_FULL[month]}</span><span className="tb-year">{year}</span></>
          }
          <div className="tb-space"/>
          <SaveStatusBadge saveState={saveState} />
          <div className="view-toggle">
            {[["list","List"],["calendar","Cal"],["grid","Grid"],["analytics","Stats"]].map(([v,l])=>(
              <button key={v} className={"vt-btn "+(view===v?"on":"")} onClick={()=>setView(v)}>{l}</button>
            ))}
          </div>
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setAssets(v=>!v)}>
            {showAssets?"Assets ✕":"Assets"}
          </button>
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} title="Download all data as JSON backup"
            onClick={()=>{ exportStudioData(studioDoc); showToast('Backup downloaded', T.mint); }}>
            Export
          </button>
          <button className="btn btn-ghost" onClick={()=>add(month)}>+ Add</button>
        </div>

        {/* STATS — YTD in year view, monthly in month view */}
        {view==="list" && timeScale==="year"
          ? <YearlyKPISummary rows={rows} year={year}/>
          : (
            <div className="stats">
              {[
                { val: sorted.length, key: "Total posts", onClick: () => jumpToStatsFilter({}) },
                { val: igC, key: "Instagram", onClick: () => jumpToStatsFilter({ platform: "instagram" }) },
                { val: liC, key: "LinkedIn", onClick: () => jumpToStatsFilter({ platform: "linkedin" }) },
                { val: reviewC, key: "Needs review", onClick: () => jumpToStatsFilter({ status: "needs_review" }) },
                { val: readyC, key: "Approved / sched", onClick: () => jumpToStatsFilter({ status: "ready" }) },
              ].map((s,i)=>(
                <button key={i} className="stat clickable" onClick={s.onClick}>
                  <div className="stat-val">{s.val}</div>
                  <div className="stat-key">{s.key}</div>
                </button>
              ))}
            </div>
          )
        }

        {view !== "analytics" && (
          <div className="ops-toolbar">
            <input
              className="ops-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, captions, or owner"
            />
            <FilterMenu
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All statuses" },
                { value: "needs_review", label: "Needs review" },
                { value: "ready", label: "Approved / sched" },
                { value: "approved", label: "Approved" },
                { value: "scheduled", label: "Scheduled" },
                { value: "posted", label: "Posted" },
              ]}
            />
            <FilterMenu
              label="Channel"
              value={platformFilter}
              onChange={setPlatformFilter}
              options={[
                { value: "all", label: "All channels" },
                { value: "instagram", label: "Instagram" },
                { value: "linkedin", label: "LinkedIn" },
              ]}
            />
            <button className={`ops-chip subtle ${attentionOnly ? "on" : ""}`} onClick={() => setAttentionOnly((current) => !current)}>
              Needs attention {attentionCount > 0 ? `(${attentionCount})` : ""}
            </button>
            {(query || statusFilter !== "all" || platformFilter !== "all" || attentionOnly) && (
              <button className="ops-clear" onClick={() => { setQuery(""); setStatusFilter("all"); setPlatformFilter("all"); setAttentionOnly(false); }}>
                Reset
              </button>
            )}
            <div className="ops-count">{filteredRows.length} shown</div>
          </div>
        )}

        {/* LIST VIEW */}
        {view==="list"&&(
          <div className="t-area">
            {timeScale==="month" && (
              <div style={{margin:"0 0 14px",padding:"28px 28px 24px"}}>
                <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:42,fontWeight:800,letterSpacing:"-0.06em",lineHeight:0.95,color:T.ink}}>{MONTHS_FULL[month]}</div>
                <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:42,fontWeight:300,letterSpacing:"-0.06em",lineHeight:0.95,color:T.textDim,marginTop:4}}>{year}</div>
              </div>
            )}
            <div className="t-head">
              <div className="th"><input type="checkbox" className="cb" checked={sel.size===sorted.length&&sorted.length>0} onChange={e=>toggleAll(e.target.checked)}/></div>
              <div className="th"/>
              <div className="th">Date / Time PT</div>
              <div className="th">Title</div>
              <div className="th"/>
              <div className="th"/>
              <div className="th">Status</div>
              <div className="th"/>
            </div>

            {timeScale==="month" ? (
              <>
                {sorted.length===0
                  ? <div className="empty"><div className="e-icon">—</div><div className="e-t">No posts for {MONTHS_FULL[month]}</div><div className="e-s">Click "+ Add" to start</div></div>
                  : sorted.map((row,idx)=>renderRow(row,idx))
                }
                <div className="add-row"><button className="add-btn" onClick={()=>add(month)}>+ Add post</button></div>
              </>
            ) : (
              /* YEAR VIEW — grouped by month with sticky headers */
              <>
                {grouped.map(({ mi, mName, rows: mRows }) => {
                  const igM = mRows.filter(r=>r.platform.startsWith("ig")).length;
                  const liM = mRows.filter(r=>r.platform==="linkedin").length;
                  const barH = (n) => Math.max(Math.round((n/maxMonthCount)*14),2);
                  return (
                    <div key={mi} className="month-group"
                      ref={el=>{ if(el) monthRefs.current[mi]=el; }}>
                      <div className="month-anchor-header">
                        <span className="month-anchor-label">{mName} {year}</span>
                        <span className="month-anchor-count">{mRows.length} post{mRows.length!==1?"s":""}</span>
                        <div className="month-sparkline">
                          {igM > 0 && <div className="month-spark-bar ig fill" style={{height:barH(igM)}} title={`${igM} IG`}/>}
                          {liM > 0 && <div className="month-spark-bar li fill" style={{height:barH(liM)}} title={`${liM} LI`}/>}
                        </div>
                      </div>
                      {mRows.length === 0 ? (
                        <div className="month-empty">
                          <span className="month-empty-text">No posts scheduled for {mName}</span>
                          <button className="month-empty-add" onClick={()=>add(mi)}>+ Add first post for {mName}</button>
                        </div>
                      ) : (
                        mRows.map((row,idx) => renderRow(row, idx))
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {view==="calendar"&&<CalendarView rows={filteredRows} month={month} year={year}
          onCompose={r=>setComposer({row:r,postNow:false})} onStory={r=>setStory(r)}
          onEdit={r=>update(r.id,{note:r.note,caption:r.caption,platform:r.platform,status:r.status})}
          onAddDay={(d, targetMonth = month, targetYear = year)=>{add(targetMonth,d,targetYear);}}/>}

        {view==="grid"&&<IGGridView rows={filteredRows} igMedia={igMedia} igAccount={igConfig}
          onOpen={r=>r.platform==="ig_story"?setStory(r):setComposer({row:r,postNow:false})}/>}

        {view==="analytics"&&<Analytics rows={rows}/>}
      </main>

      {/* MINI-MAP — only in year list view */}
      {view==="list" && timeScale==="year" && (
        <MonthMiniMap rows={rows} year={year} currentMonth={month} onJump={jumpToMonth}/>
      )}

      {showAssets&&<AssetLibrary onClose={()=>setAssets(false)} onSelect={a=>{showToast(`"${a.name}" selected`,T.mint);setAssets(false);}}/>}

      {sel.size>0&&(
        <div className="bulk">
          <span className="bulk-lbl"><b>{sel.size}</b> selected</span>
          <button className="btn btn-ghost" style={{padding:"5px 11px",fontSize:12}} onClick={()=>setSel(new Set())}>Deselect</button>
          <button className="btn btn-danger" style={{padding:"5px 11px",fontSize:12}} onClick={bulkDel}>Delete</button>
        </div>
      )}

      {composer&&<Composer row={composer.row} postNow={composer.postNow} onClose={()=>setComposer(null)}
        onPosted={()=>{update(composer.row.id,{status:"posted"});showToast(`Posted to ${PLATFORMS[composer.row.platform==="ig_story"?"ig_post":composer.row.platform].label}`,T.mint);}}/>}
      {addPostDraft&&<AddPostModal
        initialDate={addPostDraft}
        onClose={()=>setAddPostDraft(null)}
        onCreate={(draft)=>{
          createPostDraft(draft);
          showToast(`Added "${draft.title}"`, T.mint);
        }}
      />}
      {story&&<StoryDesigner row={story} onClose={()=>setStory(null)} onSave={els=>update(story.id,{storyElements:els})}/>}
      {showConn&&<ConnectionPanel
        platform={showConn}
        connected={connections[showConn]}
        igConfig={igConfig}
        igMedia={igMedia}
        onIGSave={cfg => {
          updateDocument(
            (current) => ({
              ...current,
              instagram: {
                ...current.instagram,
                account: cfg,
              },
            }),
            () => createAuditEntry("instagram.connected", currentUser, `Connected Instagram as @${cfg.username}`),
          );
          showToast(`Connected as @${cfg.username}`, T.mint);
        }}
        onIGMediaSync={feed => {
          updateDocument(
            (current) => ({
              ...current,
              instagram: {
                account: feed.account || current.instagram?.account,
                media: { ...(feed.media || {}), _syncedAt: feed.syncedAt },
                syncedAt: feed.syncedAt,
              },
            }),
            () => createAuditEntry("instagram.synced", currentUser, "Synced Instagram media from the server"),
          );
          showToast(`${feed.media?.data?.length||0} posts synced from Instagram`, T.mint);
        }}
        onConnect={()=>{ setConns(c=>({...c,[showConn]:true})); showToast('LinkedIn connected', T.mint); setShowConn(null); }}
        onDisconnect={()=>{
          if (showConn==='instagram') {
            disconnectInstagram();
            updateDocument(
              (current) => ({
                ...current,
                instagram: {
                  account: null,
                  media: null,
                  syncedAt: null,
                },
              }),
              () => createAuditEntry("instagram.disconnected", currentUser, "Disconnected Instagram"),
            );
            showToast('Instagram disconnected', T.red);
          }
          else { setConns(c=>({...c,linkedin:false})); showToast('LinkedIn disconnected', T.red); }
          setShowConn(null);
        }}
        onClose={()=>setShowConn(null)}/>}
      {showSettings&&<SettingsModal onClose={()=>setSettings(false)}/>}
      {toast&&<Toast key={toast.id} msg={toast.msg} color={toast.color} onDone={()=>setToast(null)}/>}

      {/* Soft-delete undo toast */}
      {pendingDelete && (
        <UndoDeleteToast
          key={pendingDelete.rows.map(r=>r.id).join('-')}
          count={pendingDelete.count}
          onUndo={undoDelete}
          onDone={() => setPendingDelete(null)}
        />
      )}

      {/* Instagram token expiry warning banner */}
      {!tokenBannerDismissed && (
        <TokenExpiryBanner
          igConfig={igConfig}
          onRefresh={handleTokenRefresh}
          onDismiss={() => setTokenBannerDismissed(true)}
        />
      )}

      {/* Publish confirmation modal */}
      {publishConfirm && (
        <PublishConfirmModal
          row={publishConfirm}
          onConfirm={() => {
            const row = publishConfirm;
            setPublishConfirm(null);
            setComposer({ row, postNow: true });
          }}
          onCancel={() => setPublishConfirm(null)}
        />
      )}
    </div>
  );
}
