import "./studio.css";
import React, { useCallback, useState } from "react";

import { StudioProvider, useStudio } from "./StudioContext.jsx";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts.js";

import {
  AssetLibrary,
  CalendarView,
  ConnectionPanel,
  IGGridView,
  Analytics,
  SettingsModal,
} from "./components/StudioSurfaces.jsx";
import { AddPostModal } from "./components/AddPostModal.jsx";
import { Composer } from "./components/Composer.jsx";
import { StoryDesigner } from "./components/StoryDesigner.jsx";
import { MonthMiniMap } from "./components/MonthMiniMap.jsx";
import { Toast } from "./components/Toast.jsx";
import { TokenExpiryBanner } from "./components/TokenExpiryBanner.jsx";
import { UndoDeleteToast } from "./components/UndoDeleteToast.jsx";
import { PublishConfirmModal } from "./components/PublishConfirmModal.jsx";
import { CommandPalette } from "./components/CommandPalette.jsx";

import { Sidebar } from "./components/Sidebar.jsx";
import { Topbar } from "./components/Topbar.jsx";
import { StatsBar } from "./components/StatsBar.jsx";
import { Toolbar } from "./components/Toolbar.jsx";
import { ListView } from "./components/ListView.jsx";
import { BulkActions } from "./components/BulkActions.jsx";
import { DetailPanel } from "./components/DetailPanel.jsx";

import { createAuditEntry } from "./document-store.js";
import { disconnectInstagram } from "../../lib/api-client.js";
import { PLATFORMS, T } from "./shared.js";

// ─── Inner shell (consumes StudioContext) ─────────────────────────
function StudioShell() {
  const [showCommandPalette, setCommandPalette] = useState(false);
  const ctx = useStudio();
  const {
    // State
    view, month, year, timeScale,
    composer, setComposer,
    addPostDraft, setAddPostDraft,
    story, setStory,
    showAssets, setAssets,
    showConn, setShowConn,
    showSettings, setSettings,
    connections, setConns,
    toast, setToast,
    pendingDelete, setPendingDelete,
    tokenBannerDismissed, setTokenBannerDismissed,
    publishConfirm, setPublishConfirm,
    selectedRowId, setSelectedRowId,
    // Data
    filteredRows, rows, igConfig, igMedia,
    // Actions
    update, showToast, createPostDraft,
    add, startInlineCreate, setView, undoDelete, handleTokenRefresh,
    updateDocument, currentUser, exportData,
    team, updateTeam,
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
  const toggleCommandPalette = useCallback(() => setCommandPalette(v => !v), []);
  useKeyboardShortcuts({ add: addForMonth, setView, getModals, closeModal, toggleCommandPalette });

  return (
    <div className="app">
      <Sidebar />

      <main className="main">
        <Topbar />
        <StatsBar />
        <Toolbar />

        {/* List view */}
        <ListView />

        {/* Calendar view */}
        {view === "calendar" && (
          <CalendarView
            rows={filteredRows} month={month} year={year}
            onSelectRow={(id) => setSelectedRowId(id)}
            onAddDay={(d, targetMonth = month, targetYear = year) => { add(targetMonth, d, targetYear); }}
          />
        )}

        {/* Grid view */}
        {view === "grid" && (
          <IGGridView
            rows={filteredRows} igMedia={igMedia} igAccount={igConfig}
            onOpen={r => r.platform === "ig_story" ? setStory(r) : setComposer({ row: r, postNow: false })}
          />
        )}

        {/* Analytics view */}
        {view === "analytics" && <Analytics rows={rows} />}
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
        <StoryDesigner
          row={story}
          onClose={() => setStory(null)}
          onSave={els => update(story.id, { storyElements: els })}
        />
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
          onConnect={() => { setConns(c => ({ ...c, [showConn]: true })); showToast("LinkedIn connected", T.mint); setShowConn(null); }}
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
            } else {
              setConns(c => ({ ...c, linkedin: false }));
              showToast("LinkedIn disconnected", T.red);
            }
            setShowConn(null);
          }}
          onClose={() => setShowConn(null)}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setSettings(false)}
          onExport={exportData}
          team={team}
          onTeamUpdate={updateTeam}
        />
      )}

      {/* Toasts */}
      {toast && <Toast key={toast.id} msg={toast.msg} color={toast.color} onDone={() => setToast(null)} />}

      {pendingDelete && (
        <UndoDeleteToast
          key={pendingDelete.rows.map(r => r.id).join("-")}
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

      {/* Command palette */}
      {showCommandPalette && <CommandPalette onClose={() => setCommandPalette(false)} />}
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
