import React from "react";
import { useStudio } from "../StudioContext.jsx";
import {
  MONTHS_SHORT,
  PLATFORMS,
  STATUSES,
  T,
  TEAM,
  formatRelativeStamp,
  isRowNeedingAttention,
} from "../shared.js";

function formatCount(n) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function isScheduledInFuture(row) {
  if (!row.scheduledAt) {
    return false;
  }

  return new Date(row.scheduledAt).getTime() >= Date.now();
}

export function Analytics({ rows }) {
  const { igMedia, connections } = useStudio();
  const now = new Date();
  const activeRows = rows.filter((row) => !row.deletedAt);

  // ── Performance: engagement on real published media (likes + comments come
  //    free with the basic scope; reach/impressions need the insights scope —
  //    a future upgrade). Posts published through Relay are badged via their
  //    stored igPostId. ──
  const media = Array.isArray(igMedia?.data) ? igMedia.data : [];
  const relayPostIds = new Set(activeRows.map((r) => r.igPostId || r.igMediaId).filter(Boolean));
  const withEngagement = media.map((m) => ({
    ...m,
    engagement: (m.like_count || 0) + (m.comments_count || 0),
    viaRelay: relayPostIds.has(m.id),
  }));
  const totalEngagement = withEngagement.reduce((sum, m) => sum + m.engagement, 0);
  const avgEngagement = withEngagement.length ? Math.round(totalEngagement / withEngagement.length) : 0;
  const topPosts = [...withEngagement].sort((a, b) => b.engagement - a.engagement).slice(0, 5);
  const syncedAt = igMedia?._syncedAt || null;
  const total = activeRows.length;
  const ready = activeRows.filter((row) => row.status === "approved" || row.status === "scheduled").length;
  const needsAttention = activeRows.filter((row) => isRowNeedingAttention(row)).length;
  const approvalQueue = activeRows
    .filter((row) => ["idea", "draft", "needs_review"].includes(row.status))
    .sort((a, b) => new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0));
  const upcoming = activeRows
    .filter(isScheduledInFuture)
    .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));
  const recentActivity = [...activeRows]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 8);

  const upcomingCoverageDays = new Set(
    upcoming
      .slice(0, 14)
      .map((row) => row.scheduledAt && new Date(row.scheduledAt).toISOString().slice(0, 10))
      .filter(Boolean),
  ).size;

  const monthSeries = Array.from({ length: 6 }, (_, offset) => {
    const cursor = new Date(now.getFullYear(), now.getMonth() - (5 - offset), 1);
    const label = MONTHS_SHORT[cursor.getMonth()];
    const items = activeRows.filter((row) => {
      if (!row.scheduledAt) {
        return false;
      }
      const date = new Date(row.scheduledAt);
      return date.getFullYear() === cursor.getFullYear() && date.getMonth() === cursor.getMonth();
    });

    return {
      label,
      ig: items.filter((row) => row.platform.startsWith("ig")).length,
      li: items.filter((row) => row.platform === "linkedin").length,
    };
  });
  const maxBar = Math.max(...monthSeries.map((point) => point.ig + point.li), 1);

  return (
    <div className="analytics-area">
      <div className="analytics-hero">
        <div className="analytics-kicker">01 \u00B7 State of the queue</div>
        <h2 className="analytics-hero-title">
          {total} {total === 1 ? "post" : "posts"} in the queue.
        </h2>
        <p className="analytics-hero-sub">
          Schedule covers {upcomingCoverageDays} of the next 14 days.
        </p>
      </div>

      {/* Typographic stat strip — each number is a hero moment, not
          a KPI card. Mono context line underneath, hairline rule
          between columns. */}
      <section className="analytics-stat-strip">
        <div className="analytics-stat">
          <span className="analytics-stat-num">{ready}</span>
          <span className="analytics-stat-label">Ready to ship</span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-stat-num analytics-stat-num-accent">{needsAttention}</span>
          <span className="analytics-stat-label">Need attention</span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-stat-num">{approvalQueue.length}</span>
          <span className="analytics-stat-label">In review</span>
        </div>
      </section>

      <section className="analytics-section">
        <div className="analytics-section-head">
          <h3 className="analytics-section-title">How posts perform</h3>
          {syncedAt && <span className="analytics-section-meta">Synced {formatRelativeStamp(syncedAt)}</span>}
        </div>
        {!connections.instagram ? (
          <p className="analytics-empty">Connect Instagram to see how published posts perform — likes and comments per post, straight from the API.</p>
        ) : withEngagement.length === 0 ? (
          <p className="analytics-empty">No published media yet — performance shows up here after your first posts go live.</p>
        ) : (
          <>
            <div className="analytics-perf-strip">
              <div className="analytics-stat">
                <span className="analytics-stat-num">{formatCount(totalEngagement)}</span>
                <span className="analytics-stat-label">Engagement · last {withEngagement.length} posts</span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-num">{formatCount(avgEngagement)}</span>
                <span className="analytics-stat-label">Average per post</span>
              </div>
              <div className="analytics-stat">
                <span className="analytics-stat-num">{formatCount(topPosts[0]?.engagement || 0)}</span>
                <span className="analytics-stat-label">Best post</span>
              </div>
            </div>
            <ul className="analytics-list">
              {topPosts.map((m) => (
                <li key={m.id} className="analytics-list-item analytics-post-item">
                  {(m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) && (
                    <img className="analytics-post-thumb" src={m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url} alt="" loading="lazy" />
                  )}
                  <span className="analytics-list-title">
                    {m.caption?.split("\n")[0]?.slice(0, 64) || "Instagram post"}
                    {m.viaRelay && <span className="analytics-via-relay" title="Published through Relay">Relay</span>}
                  </span>
                  <span className="analytics-list-meta">
                    {formatCount(m.like_count || 0)} likes · {formatCount(m.comments_count || 0)} comments
                    {m.timestamp ? ` · ${formatRelativeStamp(m.timestamp)}` : ""}
                  </span>
                  {m.permalink && (
                    <a className="analytics-post-link" href={m.permalink} target="_blank" rel="noopener noreferrer">View ↗</a>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="analytics-section">
        <h3 className="analytics-section-title">Publishing volume</h3>
        <div className="analytics-chart">
          {monthSeries.map((point, i) => (
            <div key={i} className="analytics-chart-col">
              <div className="analytics-chart-bars">
                {point.li > 0 && (
                  <div
                    className="analytics-chart-bar analytics-chart-bar-li"
                    style={{ height: `${(point.li / maxBar) * 100}%` }}
                    title={`${point.li} LinkedIn posts`}
                  />
                )}
                {point.ig > 0 && (
                  <div
                    className="analytics-chart-bar analytics-chart-bar-ig"
                    style={{ height: `${(point.ig / maxBar) * 100}%` }}
                    title={`${point.ig} Instagram posts`}
                  />
                )}
              </div>
              <div className="analytics-chart-label">{point.label}</div>
            </div>
          ))}
        </div>
        <div className="analytics-chart-legend">
          <span><span className="analytics-chart-dot" style={{ background: T.pink }} /> Instagram</span>
          <span><span className="analytics-chart-dot" style={{ background: T.blue }} /> LinkedIn</span>
        </div>
      </section>

      <section className="analytics-section">
        <h3 className="analytics-section-title">Awaiting approval</h3>
        {approvalQueue.length === 0 ? (
          <p className="analytics-empty">Nothing waiting for approval.</p>
        ) : (
          <ul className="analytics-list">
            {approvalQueue.slice(0, 6).map((row) => (
              <li key={row.id} className="analytics-list-item">
                <span className="analytics-list-title">{row.note || "Untitled post"}</span>
                <span className="analytics-list-meta">
                  {STATUSES[row.status]?.label} · {formatRelativeStamp(row.updatedAt)}
                </span>
                <span className="analytics-list-platform" style={{ background: PLATFORMS[row.platform].bg, color: PLATFORMS[row.platform].color }}>
                  {PLATFORMS[row.platform].short}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="analytics-section">
        <h3 className="analytics-section-title">Recent activity</h3>
        <ul className="analytics-list">
          {recentActivity.map((row) => (
            <li key={row.id} className="analytics-list-item">
              <span className="analytics-list-title">{row.note || "Untitled post"}</span>
              <span className="analytics-list-meta">
                Updated {formatRelativeStamp(row.updatedAt)} · v{row.version || 1} · {TEAM.find((member) => member.id === row.updatedBy)?.name || row.updatedBy || "Studio"}
              </span>
              <span className="analytics-list-platform" style={{ background: PLATFORMS[row.platform].bg, color: PLATFORMS[row.platform].color }}>
                {PLATFORMS[row.platform].short}
              </span>
              <span className="analytics-list-status">{STATUSES[row.status]?.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
