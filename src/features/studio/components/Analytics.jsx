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
  const posted = activeRows.filter((row) => row.status === "posted").length;
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
    .slice(0, 6);
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
  const upcomingCoverageDays = new Set(
    upcoming
      .slice(0, 14)
      .map((row) => row.scheduledAt && new Date(row.scheduledAt).toISOString().slice(0, 10))
      .filter(Boolean),
  ).size;
  const platformMix = [
    { key: "Instagram", value: activeRows.filter((row) => row.platform.startsWith("ig")).length },
    { key: "LinkedIn", value: activeRows.filter((row) => row.platform === "linkedin").length },
  ];
  const maxPlatform = Math.max(...platformMix.map((item) => item.value), 1);
  const statusMix = Object.entries(STATUSES).map(([status, meta]) => ({
    key: meta.label,
    value: activeRows.filter((row) => row.status === status).length,
    color: meta.dot,
  }));
  const maxStatus = Math.max(...statusMix.map((item) => item.value), 1);

  return (
    <div className="analytics-area">
      <div className="analytics-grid">
        <div className="an-card">
          <div className="an-title">Workflow Health</div>
          <div className="an-big">{total}</div>
          <div className="an-sub">Posts in the active planning system</div>
          <div className="an-inline-stats">
            {[["Ready", ready], ["Needs attention", needsAttention], ["Posted", posted]].map(([label, value]) => (
              <div key={label} className="an-inline-stat">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="an-card">
          <div className="an-title">Schedule Coverage</div>
          <div className="an-big">{upcomingCoverageDays}/14</div>
          <div className="an-sub">Days covered in the next two weeks</div>
          <div className="an-inline-stats">
            <div className="an-inline-stat">
              <span>Upcoming posts</span>
              <strong>{upcoming.length}</strong>
            </div>
            <div className="an-inline-stat">
              <span>Approved or scheduled</span>
              <strong>{ready}</strong>
            </div>
          </div>
        </div>

        <div className="an-card">
          <div className="an-title">Trust Signal</div>
          <div className="an-big" style={{ fontSize: 22, lineHeight: 1.15 }}>Operational only</div>
          <div className="an-sub">
            Performance analytics stay intentionally quiet until real platform reporting is connected.
          </div>
        </div>

        <div className="an-card wide">
          <div className="an-title">Publishing Volume</div>
          <div className="chart-bars">{monthSeries.map((point, i) => (
            <div key={i} className="chart-bar-wrap">
              <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:1,flex:1,width:"100%"}}>
                <div className="chart-bar" style={{height:`${(point.li/maxBar)*100}%`,background:T.blue,minHeight:3}}/>
                <div className="chart-bar" style={{height:`${(point.ig/maxBar)*100}%`,background:T.pink,minHeight:3}}/>
              </div>
              <div className="chart-bar-label">{point.label}</div>
            </div>
          ))}</div>
          <div style={{display:"flex",gap:14,marginTop:10}}>{[{c:T.pink,l:"Instagram"},{c:T.blue,l:"LinkedIn"}].map(x=><div key={x.l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:T.textSub}}><div style={{width:8,height:8,borderRadius:2,background:x.c}}/>{x.l}</div>)}</div>
        </div>

        <div className="an-card">
          <div className="an-title">Platform Mix</div>
          {platformMix.map((item) => (
            <div key={item.key} className="bar-row">
              <span className="bar-label">{item.key}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(item.value / maxPlatform) * 100}%`, background: item.key === "Instagram" ? T.pink : T.blue }} />
              </div>
              <span className="bar-val">{item.value}</span>
            </div>
          ))}
          <div style={{height:12}} />
          <div className="an-title">Status Mix</div>
          {statusMix.map((item) => (
            <div key={item.key} className="bar-row">
              <span className="bar-label">{item.key}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(item.value / maxStatus) * 100}%`, background: item.color }} />
              </div>
              <span className="bar-val">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="an-card">
          <div className="an-title">Needs Approval</div>
          <div className="an-list">
            {approvalQueue.length === 0 && <div className="an-empty-note">No posts are waiting for approval right now.</div>}
            {approvalQueue.slice(0, 6).map((row) => (
              <div key={row.id} className="an-list-row">
                <div>
                  <div className="perf-note">{row.note || "Untitled post"}</div>
                  <div className="an-list-meta">{STATUSES[row.status]?.label} • {formatRelativeStamp(row.updatedAt)}</div>
                </div>
                <span className="perf-plat" style={{ background: PLATFORMS[row.platform].bg, color: PLATFORMS[row.platform].color }}>
                  {PLATFORMS[row.platform].short}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="an-card full">
          <div className="an-title">Recent Activity</div>
          <div className="an-list">
            {recentActivity.map((row) => (
              <div key={row.id} className="an-list-row">
                <div>
                  <div className="perf-note">{row.note || "Untitled post"}</div>
                  <div className="an-list-meta">
                    Updated {formatRelativeStamp(row.updatedAt)} • v{row.version || 1} • {TEAM.find((member) => member.id === row.updatedBy)?.name || row.updatedBy || "Studio"}
                  </div>
                </div>
                <div className="an-list-trailing">
                  <span className="perf-plat" style={{ background: PLATFORMS[row.platform].bg, color: PLATFORMS[row.platform].color }}>
                    {PLATFORMS[row.platform].short}
                  </span>
                  <span className="an-status-text">{STATUSES[row.status]?.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
