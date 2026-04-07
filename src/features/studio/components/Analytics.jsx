import React from "react";
import {
  MONTHS_SHORT,
  PLATFORMS,
  STATUSES,
  T,
  TEAM,
  formatRelativeStamp,
  isRowNeedingAttention,
} from "../shared.js";

function isScheduledInFuture(row) {
  if (!row.scheduledAt) {
    return false;
  }

  return new Date(row.scheduledAt).getTime() >= Date.now();
}

export function Analytics({ rows }) {
  const now = new Date();
  const activeRows = rows.filter((row) => !row.deletedAt);
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
        <h2 className="analytics-hero-title">
          {total} {total === 1 ? "post" : "posts"} in the queue.
        </h2>
        <p className="analytics-hero-sub">
          {ready} ready to ship. {needsAttention > 0 && <>{needsAttention} need attention. </>}
          Schedule covers {upcomingCoverageDays} of the next 14 days.
        </p>
      </div>

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
