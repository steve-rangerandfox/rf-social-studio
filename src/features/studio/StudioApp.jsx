import "./studio.css";
import React, { useCallback, useEffect, useState, lazy, Suspense } from "react";

import { StudioProvider, useStudio } from "./StudioContext.jsx";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts.js";
import { LoadingShell } from "../../components/LoadingShell.jsx";
import { ErrorBoundary } from "../../components/ErrorBoundary.jsx";
import { useToast } from "../../components/Toaster.jsx";

// Compact per-view fallback so a single view throwing doesn't take over
// the entire app — chrome (sidebar, topbar) stays usable.
function viewFallback(scope) {
  return ({ reset }) => (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        gap: 12,
        color: "#5E574C",
        fontFamily: '"Switzer", "Helvetica Neue", Arial, system-ui, sans-serif',
      }}
    >
      <div style={{ fontFamily: '"Bricolage Grotesque", "Switzer", sans-serif', fontSize: 22, fontWeight: 700, color: "#09090b", letterSpacing: "-0.02em" }}>
        {scope} hit a snag
      </div>
      <div style={{ fontSize: 14, maxWidth: 380, textAlign: "center", lineHeight: 1.55 }}>
        The {scope.toLowerCase()} view failed to render. Your drafts are untouched — try reloading just this view.
      </div>
      <button
        style={{
          padding: "9px 18px",
          background: "#09090b",
          color: "#ffffff",
          border: "none",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
        onClick={reset}
      >
        Try again
      </button>
    </div>
  );
}

import {
  AssetLibrary,
  CalendarView,
  ConnectionPanel,
  IGGridView,
  Analytics,
  SettingsPanel,
} from "./components/StudioSurfaces.jsx";
import { AddPostModal } from "./components/AddPostModal.jsx";
import { Composer } from "./components/Composer.jsx";
const StoryDesigner = lazy(() => import("./components/StoryDesigner.jsx").then(m => ({ default: m.StoryDesigner })));
import { MonthMiniMap } from "./components/MonthMiniMap.jsx";
import { TokenExpiryBanner } from "./components/TokenExpiryBanner.jsx";
import { UndoDeleteToast } from "./components/UndoDeleteToast.jsx";
import { UndoToast } from "./components/UndoToast.jsx";
import { PublishConfirmModal } from "./components/PublishConfirmModal.jsx";
import { CommandPalette } from "./components/CommandPalette.jsx";
import { FirstRunHint } from "./components/FirstRunHint.jsx";
import { ShortcutsOverlay } from "./components/ShortcutsOverlay.jsx";

import { Sidebar } from "./components/Sidebar.jsx";
import { Topbar } from "./components/Topbar.jsx";
import { NavDrawer } from "./components/NavDrawer.jsx";
import { StrategyModal } from "./components/StrategyModal.jsx";
import { StatsBar } from "./components/StatsBar.jsx";
import { Toolbar } from "./components/Toolbar.jsx";
import { ListView } from "./components/ListView.jsx";
import { BulkActions } from "./components/BulkActions.jsx";
import { DetailPanel } from "./components/DetailPanel.jsx";

import { createAuditEntry } from "./document-store.js";
import { disconnectInstagram, disconnectLinkedIn } from "../../lib/api-client.js";
import { PLATFORMS, T } from "./shared.js";

// ─── Inner shell (consumes StudioContext) ─────────────────────────
function StudioShell() {
  const ctx = useStudio();
  const {
    // State
    view, month, year, timeScale,
    composer, setComposer,
    addPostDraft, setAddPostDraft,
    story, setStory,
    showAssets, setAssets,
    showConn, setShowConn,
    showSettings, setSettings, settingsInitialTab, openSettingsTab,
    connections, setConns,
    pendingDelete, setPendingDelete,
    tokenBannerDismissed, setTokenBannerDismissed,
    publishConfirm, setPublishConfirm,
    showCommandPalette, setCommandPalette,
    selectedRowId, setSelectedRowId,
    // Data
    filteredRows, rows, igConfig, igMedia,
    // Actions
    update, showToast, createPostDraft,
    add, startInlineCreate, setView, undoDelete, handleTokenRefresh,
    updateDocument, currentUser, exportData,
    team, updateTeam,
    brandProfile, updateBrandProfile,
    linkedinAccount, setLinkedinAccount,
  } = ctx;

  // ─── Keyboard shortcuts ─────────────────────────────────────────
  const getModals = useCallback(
    () => ({ composer, story, addPostDraft, publishConfirm }),
    [composer, story, addPostDraft, publishConfirm],
  );
  const closeModal = useCallback((name) => {
    if (name === "composer") setComposer(null);
    else if (name === "story") setStory(null);
    else if (name === "addPostDraft") setAddPostDraft(null);
    else if (name === "publishConfirm") setPublishConfirm(null);
  }, [setComposer, setStory, setAddPostDraft, setPublishConfirm]);

  const addForMonth = useCallback(() => view === "list" ? startInlineCreate() : add(month), [view, startInlineCreate, add, month]);
  const toggleCommandPalette = useCallback(() => setCommandPalette(v => !v), [setCommandPalette]);
  const onSavePressed = useCallback(() => showToast("Already saved · changes auto-sync", T.mint), [showToast]);
  useKeyboardShortcuts({ add: addForMonth, setView, getModals, closeModal, toggleCommandPalette, onSavePressed });

  // Mobile nav drawer — visible only at narrow breakpoints (CSS-gated).
  const [navOpen, setNavOpen] = useState(false);
  // Monthly-strategy modal (AI planner)
  const [strategyOpen, setStrategyOpen] = useState(false);

  // Plan-gate prompt — api-client dispatches this when an AI endpoint
  // returns 402 PLAN_UPGRADE_REQUIRED. We surface a warning toast with
  // an Upgrade action that drops the user into Settings → Billing.
  const toast = useToast();
  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {};
      const planLabel = detail.requiredPlan === "team" ? "Team" : "Essentials";
      toast.warning(`This is a ${planLabel} feature. Start a 14-day trial to use it.`, {
        action: { label: "Upgrade", onClick: () => openSettingsTab("Billing") },
        duration: 0,
      });
    };
    window.addEventListener("rf:plan-upgrade-required", handler);
    return () => window.removeEventListener("rf:plan-upgrade-required", handler);
  }, [toast, openSettingsTab]);

  // Only one right-side panel open at a time: opening settings/connection closes detail panel
  useEffect(() => {
    if ((showSettings || showConn) && selectedRowId) {
      setSelectedRowId(null);
    }
  }, [showSettings, showConn, selectedRowId, setSelectedRowId]);

  // Document title easter egg — when the user tabs away, leave a calm reminder
  useEffect(() => {
    const defaultTitle = "RF Social Studio";
    const awayTitle = "\u2190 still here when you\u2019re ready";
    const handleVisibility = () => {
      document.title = document.hidden ? awayTitle : defaultTitle;
    };
    document.addEventListener("visibilitychange", handleVisibility);
    document.title = defaultTitle;
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.title = defaultTitle;
    };
  }, []);

  return (
    <div className="app">
      <Sidebar />

      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />

      <main className="main">
        <Topbar onOpenNav={() => setNavOpen(true)} onOpenStrategy={() => setStrategyOpen(true)} />
        <StatsBar />
        <Toolbar />

        {/* List view */}
        <ErrorBoundary scope="List" fallback={viewFallback("List")}>
          <ListView />
        </ErrorBoundary>

        {/* Calendar view */}
        {view === "calendar" && (
          <ErrorBoundary scope="Calendar" fallback={viewFallback("Calendar")}>
            <CalendarView
              rows={filteredRows} month={month} year={year}
              onSelectRow={(id) => setSelectedRowId(id)}
              onAddDay={(d, targetMonth = month, targetYear = year) => { add(targetMonth, d, targetYear); }}
            />
          </ErrorBoundary>
        )}

        {/* Grid view */}
        {view === "grid" && (
          <ErrorBoundary scope="Grid" fallback={viewFallback("Grid")}>
            <IGGridView
              rows={filteredRows} igMedia={igMedia} igAccount={igConfig}
              onOpen={r => r.platform === "ig_story" ? setStory(r) : setComposer({ row: r, postNow: false })}
            />
          </ErrorBoundary>
        )}

        {/* Analytics view */}
        {view === "analytics" && (
          <ErrorBoundary scope="Analytics" fallback={viewFallback("Analytics")}>
            <Analytics rows={rows} />
          </ErrorBoundary>
        )}
      </main>

      {/* Mini-map — only in year list view */}
      {view === "list" && timeScale === "year" && (
        <MonthMiniMap rows={rows} year={year} currentMonth={month} onJump={ctx.jumpToMonth} />
      )}

      {/* Assets panel */}
      {showAssets && (
        <AssetLibrary
          onClose={() => setAssets(false)}
          onSelect={a => { showToast(`"${a.name}" selected`, T.mint); setAssets(false); }}
        />
      )}

      {/* Bulk action bar */}
      <BulkActions />

      {/* Detail panel */}
      {selectedRowId && <DetailPanel />}

      {/* ─── Modals / overlays ─────────────────────────────────────── */}
      {composer && (
        <Composer
          row={composer.row}
          postNow={composer.postNow}
          onClose={() => setComposer(null)}
          onPosted={({ mediaId, mediaUrl } = {}) => {
            update(composer.row.id, {
              status: "posted",
              postedAt: new Date().toISOString(),
              igMediaId: mediaId ?? null,
              igPublishedUrl: mediaUrl ?? null,
            });
            showToast(`Posted to ${PLATFORMS[composer.row.platform === "ig_story" ? "ig_post" : composer.row.platform].label}`, T.mint);
            setComposer(null);
          }}
        />
      )}

      {addPostDraft && (
        <AddPostModal
          initialDate={addPostDraft}
          onClose={() => setAddPostDraft(null)}
          onCreate={(draft) => { createPostDraft(draft); showToast(`Added "${draft.title}"`, T.mint); }}
        />
      )}

      {story && (
        <Suspense fallback={<LoadingShell variant="overlay" label="Loading designer" />}>
          <StoryDesigner
            row={story}
            onClose={() => setStory(null)}
            onSave={els => update(story.id, { storyElements: els })}
          />
        </Suspense>
      )}

      {showConn && (
        <ConnectionPanel
          platform={showConn}
          connected={connections[showConn]}
          igConfig={igConfig}
          igMedia={igMedia}
          onIGSave={cfg => {
            updateDocument(
              (current) => ({
                ...current,
                instagram: { ...current.instagram, account: cfg },
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
            showToast(`${feed.media?.data?.length || 0} posts synced from Instagram`, T.mint);
          }}
          onConnect={() => { setConns(c => ({ ...c, [showConn]: true })); setShowConn(null); }}
          onDisconnect={() => {
            if (showConn === "instagram") {
              disconnectInstagram();
              updateDocument(
                (current) => ({
                  ...current,
                  instagram: { account: null, media: null, syncedAt: null },
                }),
                () => createAuditEntry("instagram.disconnected", currentUser, "Disconnected Instagram"),
              );
              showToast("Instagram disconnected", T.red);
            }
            setShowConn(null);
          }}
          liAccount={linkedinAccount}
          onLIConnect={(account) => {
            setLinkedinAccount(account);
            setConns((c) => ({ ...c, linkedin: true }));
            showToast(`LinkedIn connected${account.name ? ` as ${account.name}` : ""}`, T.mint);
            setShowConn(null);
          }}
          onLIDisconnect={() => {
            disconnectLinkedIn();
            setLinkedinAccount(null);
            setConns((c) => ({ ...c, linkedin: false }));
            showToast("LinkedIn disconnected", T.red);
            setShowConn(null);
          }}
          onClose={() => setShowConn(null)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          onClose={() => setSettings(false)}
          onExport={exportData}
          team={team}
          onTeamUpdate={updateTeam}
          brandProfile={brandProfile}
          onBrandProfileUpdate={updateBrandProfile}
          initialTab={settingsInitialTab}
        />
      )}

      {/* Toasts now render via the Toaster mounted at main.jsx root */}
      {pendingDelete && (
        <UndoDeleteToast
          key={pendingDelete.rows.map(r => r.id).join("-")}
          count={pendingDelete.count}
          onUndo={undoDelete}
          onDone={() => setPendingDelete(null)}
        />
      )}

      <UndoToast />

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

      {/* Command palette */}
      {showCommandPalette && <CommandPalette onClose={() => setCommandPalette(false)} />}

      {/* Monthly strategy / AI planner */}
      {strategyOpen && (
        <StrategyModal onClose={() => setStrategyOpen(false)} initialMonth={month} initialYear={year} />
      )}

      {/* First-run hint */}
      <FirstRunHint />
      <ShortcutsOverlay />
    </div>
  );
}

// ─── Top-level export wraps in provider ───────────────────────────
export default function App() {
  return (
    <StudioProvider>
      <StudioShell />
    </StudioProvider>
  );
}
