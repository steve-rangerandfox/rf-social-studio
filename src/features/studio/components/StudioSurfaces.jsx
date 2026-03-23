import React, { useEffect, useRef, useState } from "react";

import {
  exchangeInstagramCode,
  fetchInstagramFeed,
  getInstagramAuthorizeUrl,
} from "../../../lib/api-client.js";
import {
  MONTHS_FULL,
  MONTHS_SHORT,
  PLATFORMS,
  STATUSES,
  T,
  TEAM,
  WEEKDAYS,
  formatRelativeStamp,
  isRowNeedingAttention,
  makeDefaultElements,
  toPTDisplay,
  uid,
} from "../shared.js";

const IG_OAUTH_CALLBACK_PATH = "/instagram/oauth/callback";

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

export function CalendarView({ rows, month: initMonth, year: initYear, onStory, onAddDay, onEdit }) {
  const [calMonth, setCalMonth] = useState(initMonth);
  const [calYear,  setCalYear]  = useState(initYear);
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date();
    return today.getMonth() === initMonth && today.getFullYear() === initYear ? today.getDate() : 1;
  });
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [draft, setDraft] = useState(null);

  const prevMonth = () => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); };
  const nextMonth = () => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); };

  const firstDay = new Date(calYear,calMonth,1).getDay();
  const days = new Date(calYear,calMonth+1,0).getDate();
  const today = new Date();
  const isToday = d => today.getFullYear()===calYear&&today.getMonth()===calMonth&&today.getDate()===d;

  const rowDay = (r) => {
    if(!r.scheduledAt) return null;
    const d = new Date(r.scheduledAt);
    if(d.getFullYear()!==calYear || d.getMonth()!==calMonth) return null;
    return parseInt(new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",day:"numeric"}).format(d), 10);
  };

  const cells = [];
  const prevDays = new Date(calYear, calMonth, 0).getDate();
  for(let i=0;i<firstDay;i++) cells.push({ d: prevDays - firstDay + 1 + i, type:'prev' });
  for(let d=1;d<=days;d++) cells.push({ d, type:'curr' });
  const total = Math.ceil((firstDay + days) / 7) * 7;
  for(let d=1; cells.length < total; d++) cells.push({ d, type:'next' });

  useEffect(() => {
    setSelectedDay((current) => Math.min(current, days));
  }, [days]);

  const dayRows = rows
    .filter((row) => rowDay(row) === selectedDay)
    .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));
  const selectedRow = dayRows.find((row) => row.id === selectedRowId) || dayRows[0] || null;

  useEffect(() => {
    if (!dayRows.length) {
      if (selectedRowId !== null) {
        setSelectedRowId(null);
      }
      return;
    }

    if (!dayRows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(dayRows[0].id);
    }
  }, [dayRows, selectedRowId]);

  useEffect(() => {
    const nextSelected = dayRows.find((row) => row.id === selectedRowId) || dayRows[0] || null;
    setDraft(nextSelected ? { ...nextSelected } : null);
  }, [dayRows, selectedRowId]);

  return (
    <div className="cal-area">
      <div className="cal-shell">
        <div className="cal-main">
          <div className="cal-topline">
            <div>
              <div className="cal-title">{MONTHS_FULL[calMonth]} {calYear}</div>
              <div className="cal-subtitle">Select a day to review timing, readiness, and post details.</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
              <button className="cal-nav-btn" onClick={nextMonth}>›</button>
            </div>
          </div>
          <div className="cal-header">{WEEKDAYS.map(w=><div key={w} className="cal-wd">{w}</div>)}</div>
          <div className="cal-grid">
            {cells.map((cell,i)=>{
              const { d, type } = cell;
              const isCurr = type==='curr';
              const isOther = type==='prev' || type==='next';
              const count = isCurr ? rows.filter((row) => rowDay(row) === d).length : 0;
              return (
                <div
                  key={i}
                  className={`cal-cell ${isOther?"other":""} ${isCurr&&isToday(d)?"today":""} ${isCurr&&selectedDay===d?"selected":""}`}
                  onClick={() => {
                    if (!isCurr) {
                      return;
                    }
                    setSelectedDay(d);
                  }}
                >
                  <div className="cal-cell-head">
                    <div className="cal-dn" style={{color: isOther ? '#C9CDD5' : undefined}}>{d}</div>
                    {isCurr && count > 0 && <div className="cal-count">{count}</div>}
                  </div>
                  {isCurr && <>
                    <div className="cal-posts">
                      {rows.filter(r=>rowDay(r)===d).slice(0, 4).map(r=>{
                        const p=PLATFORMS[r.platform];
                        return (
                          <div
                            key={r.id}
                            className={`cal-post ${selectedRowId === r.id ? "is-selected" : ""}`}
                            style={{background:p.bg,color:p.color}}
                            onClick={e=>{e.stopPropagation();setSelectedDay(d);setSelectedRowId(r.id);}}
                          >
                            <span style={{width:4,height:4,borderRadius:"50%",background:p.color,flexShrink:0,display:"inline-block"}}/>
                            {r.note||p.short}
                          </div>
                        );
                      })}
                      {count > 4 && <div className="cal-more">+{count - 4} more</div>}
                    </div>
                    <div className="cal-add"><button className="cal-add-btn" onClick={(event)=>{event.stopPropagation();setSelectedDay(d);onAddDay(d, calMonth, calYear);}}>+</button></div>
                  </>}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="cal-panel">
          <div className="cal-panel-header">
            <div className="cal-panel-day">{MONTHS_FULL[calMonth]} {selectedDay}</div>
            <button className="btn btn-ghost" style={{padding:"6px 12px",fontSize:12}} onClick={() => onAddDay(selectedDay, calMonth, calYear)}>Add post</button>
          </div>
          <div className="cal-panel-sub">Posts scheduled for the selected day appear here so details stay out of the grid.</div>

          <div className="cal-panel-section">
            <div className="an-title" style={{marginBottom:10}}>Day Queue</div>
            {dayRows.length === 0 && <div className="cal-panel-empty">No posts are scheduled for this day yet.</div>}
            {dayRows.map((row) => (
              <button
                key={row.id}
                className={`cal-panel-item ${selectedRow?.id === row.id ? "on" : ""}`}
                onClick={() => setSelectedRowId(row.id)}
              >
                <div>
                  <div className="cal-panel-item-title">{row.note || "Untitled post"}</div>
                  <div className="cal-panel-item-meta">
                    {PLATFORMS[row.platform].short} • {STATUSES[row.status]?.label}
                  </div>
                </div>
                <span className="cal-panel-item-time">{toPTDisplay(row.scheduledAt)?.hour}:{toPTDisplay(row.scheduledAt)?.minute} {toPTDisplay(row.scheduledAt)?.ampm}</span>
              </button>
            ))}
          </div>

          <div className="cal-panel-section">
            <div className="an-title" style={{marginBottom:10}}>Selected Post</div>
            {!draft && <div className="cal-panel-empty">Choose a post to edit its caption, platform, and status.</div>}
            {draft && (
              <div className="cal-editor">
                <input
                  className="inp"
                  value={draft.note || ""}
                  onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Post title"
                />
                <textarea
                  className="txa"
                  style={{minHeight:120}}
                  value={draft.caption || ""}
                  placeholder="Write caption…"
                  onChange={(event) => setDraft((current) => ({ ...current, caption: event.target.value }))}
                />
                <div className="cal-chip-row">
                  {Object.entries(PLATFORMS).map(([key, platform]) => (
                    <button
                      key={key}
                      className={`ops-chip ${draft.platform === key ? "on" : ""}`}
                      onClick={() => setDraft((current) => ({ ...current, platform: key }))}
                    >
                      {platform.label}
                    </button>
                  ))}
                </div>
                <div className="cal-chip-row">
                  {Object.entries(STATUSES).map(([key, status]) => (
                    <button
                      key={key}
                      className={`ops-chip ${draft.status === key ? "on" : ""}`}
                      onClick={() => setDraft((current) => ({ ...current, status: key }))}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
                <div className="cal-panel-meta">
                  <span>Updated {formatRelativeStamp(draft.updatedAt)}</span>
                  <span>v{draft.version || 1}</span>
                </div>
                <div style={{display:"flex",gap:8,justifyContent:"space-between"}}>
                  {draft.platform === "ig_story" && (
                    <button className="btn btn-ghost" style={{padding:"8px 12px"}} onClick={() => onStory(draft)}>
                      Open Designer
                    </button>
                  )}
                  <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
                    <button className="btn btn-ghost" style={{padding:"8px 12px"}} onClick={() => setDraft(selectedRow ? { ...selectedRow } : null)}>
                      Reset
                    </button>
                    <button className="btn btn-primary" style={{padding:"8px 12px"}} onClick={() => onEdit(draft)}>
                      Save changes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AssetLibrary({ onClose, onSelect }) {
  const [assets, setAssets] = useState([
    {id:uid(),name:"RF Logo White",emoji:"RF",url:null,type:"image",favorite:true,addedAt:new Date().toISOString()},
    {id:uid(),name:"Mint BG Texture",emoji:"BG",url:null,type:"image",favorite:false,addedAt:new Date(Date.now()-86400000).toISOString()},
    {id:uid(),name:"Studio B-Roll",emoji:"VID",url:null,type:"video",favorite:true,addedAt:new Date(Date.now()-172800000).toISOString()},
    {id:uid(),name:"Team Photo",emoji:"CAM",url:null,type:"image",favorite:false,addedAt:new Date(Date.now()-259200000).toISOString()},
  ]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const fRef = useRef(null);

  useEffect(() => {
    if (!selectedId && assets[0]?.id) {
      setSelectedId(assets[0].id);
    }
  }, [assets, selectedId]);

  const upload = (files) => Array.from(files).forEach(f => {
    const id = uid();
    const url = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
    setAssets((current) => [
      {
        id,
        name: f.name,
        type: f.type.startsWith("image/") ? "image" : "video",
        url,
        emoji: f.type.startsWith("image/") ? "IMG" : "VID",
        favorite: false,
        addedAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setSelectedId(id);
  });

  const filteredAssets = assets.filter((asset) => {
    const matchesQuery = !query.trim() || asset.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "favorites" && asset.favorite) ||
      (filter === "recent" && Date.now() - new Date(asset.addedAt).getTime() < 7 * 86400000) ||
      asset.type === filter;

    return matchesQuery && matchesFilter;
  });
  const selectedAsset = assets.find((asset) => asset.id === selectedId) || filteredAssets[0] || assets[0] || null;

  const toggleFavorite = (id) => {
    setAssets((current) => current.map((asset) => asset.id === id ? { ...asset, favorite: !asset.favorite } : asset));
  };

  return (
    <div className="asset-drawer">
      <div className="asset-head">
        <div>
          <div className="asset-title">Asset Library</div>
          <div className="asset-head-sub">{assets.length} assets ready for planning and story design</div>
        </div>
        <button className="m-x" onClick={onClose}>×</button>
      </div>
      <div className="asset-body">
        <div className="asset-toolbar">
          <input
            className="asset-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search assets"
          />
          <div className="asset-tabs">
            {[
              ["all", "All"],
              ["image", "Images"],
              ["video", "Video"],
              ["favorites", "Favorites"],
              ["recent", "Recent"],
            ].map(([key, label]) => (
              <button key={key} className={`asset-tab ${filter === key ? "on" : ""}`} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="asset-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files);}} onClick={()=>fRef.current?.click()}>
          <input ref={fRef} type="file" accept="image/*,video/*,image/gif" multiple style={{display:"none"}} onChange={e=>upload(e.target.files)}/>
          <div style={{fontSize:20,opacity:0.4,marginBottom:6}}>↑</div><div style={{fontSize:12,color:T.textSub}}>Upload brand assets</div>
          <div style={{fontSize:10,color:T.textDim,marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>Images · Videos · GIFs</div>
        </div>

        {selectedAsset && (
          <div className="asset-focus">
            <div className="asset-focus-preview">
              {selectedAsset.url ? <img src={selectedAsset.url} className="asset-thumb" alt={selectedAsset.name}/> : <div className="asset-empty-thumb">{selectedAsset.emoji}</div>}
            </div>
            <div className="asset-focus-body">
              <div className="asset-focus-head">
                <div>
                  <div className="asset-focus-title">{selectedAsset.name}</div>
                  <div className="asset-focus-meta">{selectedAsset.type} • {formatRelativeStamp(selectedAsset.addedAt)}</div>
                </div>
                <button className={`asset-star ${selectedAsset.favorite ? "on" : ""}`} onClick={() => toggleFavorite(selectedAsset.id)}>
                  {selectedAsset.favorite ? "Saved" : "Save"}
                </button>
              </div>
              <button className="btn btn-primary" style={{alignSelf:"flex-start",padding:"8px 12px"}} onClick={() => onSelect?.(selectedAsset)}>
                Attach selected asset
              </button>
            </div>
          </div>
        )}

        <span className="s-lbl" style={{marginTop:4,display:"block"}}>Curated Assets</span>
        <div className="asset-grid">
          {filteredAssets.map((asset) => (
            <div key={asset.id} className={`asset-item ${selectedAsset?.id === asset.id ? "on" : ""}`} onClick={() => setSelectedId(asset.id)} title={asset.name}>
              {asset.url ? <img src={asset.url} className="asset-thumb" alt={asset.name}/> : <div className="asset-empty-thumb">{asset.emoji}</div>}
              <button className={`asset-fav ${asset.favorite ? "on" : ""}`} onClick={(event) => { event.stopPropagation(); toggleFavorite(asset.id); }}>
                {asset.favorite ? "★" : "☆"}
              </button>
              <div className="asset-name">
                <span>{asset.name}</span>
                <span>{asset.type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const IG_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;

function IGOAuthPanel({ igConfig, igMedia, onSave, onMediaSync, onDisconnect }) {
  const [connecting, setConnecting] = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [error,      setError]      = useState("");

  const isConnected = !!igConfig?.username;
  const redirectUri = new URL(IG_OAUTH_CALLBACK_PATH, window.location.origin).toString();

  const startOAuth = async () => {
    setError(""); setConnecting(true);
    let safeRedirectUri;
    try {
      safeRedirectUri = new URL(redirectUri).toString();
    } catch {
      setError("Invalid page origin — cannot start OAuth flow."); setConnecting(false); return;
    }

    let authorizeUrl;
    try {
      const data = await getInstagramAuthorizeUrl(safeRedirectUri);
      authorizeUrl = data.authorizeUrl;
    } catch (e) {
      const baseError = e.message || "Instagram OAuth could not start.";
      setError(
        baseError === "redirectUri is not allowed"
          ? `Redirect URI is not allowed. Add ${safeRedirectUri} to your server ALLOWED_ORIGINS and Meta app redirect URIs.`
          : baseError,
      );
      setConnecting(false);
      return;
    }

    const popup = window.open(authorizeUrl, "ig_oauth", "width=620,height=720,scrollbars=yes,resizable=yes");
    if (!popup) { setError("Popup blocked — allow popups for this page and try again."); setConnecting(false); return; }
    const timer = setInterval(() => {
      try {
        if (!popup || popup.closed) { clearInterval(timer); setConnecting(false); return; }
        const pu = popup.location.href;
        if (pu.startsWith(safeRedirectUri)) {
          const params = new URL(pu).searchParams;
          const code = params.get("code"), err = params.get("error"), state = params.get("state");
          popup.close(); clearInterval(timer);
          if (err) { setError("Denied: " + (params.get("error_description") || err)); setConnecting(false); return; }
          if (code && state) handleCode(code, safeRedirectUri, state);
        }
      } catch {
        return;
      }
    }, 500);
  };

  const handleCode = async (code, safeRedirectUri, state) => {
    try {
      const tokenData = await exchangeInstagramCode({ code, redirectUri: safeRedirectUri, state });
      onSave(tokenData.account);
      const feed = await fetchInstagramFeed();
      onMediaSync(feed);
    } catch(e) {
      setError(e.message || "Connection failed. Check the Instagram callback URL and production env settings.");
    }
    setConnecting(false);
  };

  const syncMedia = async () => {
    setSyncing(true); setError("");
    try { onMediaSync(await fetchInstagramFeed()); }
    catch(e) { setError(e.message || "Sync failed — token may have expired."); }
    setSyncing(false);
  };

  const daysLeft   = igConfig?.expiresAt ? Math.round((igConfig.expiresAt - Date.now()) / 86400000) : 0;
  const mediaCount = igMedia?.data?.length || 0;
  const syncedAt   = igMedia?._syncedAt ? new Date(igMedia._syncedAt).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : null;

  if (isConnected) {
    return (
      <>
        <div className="cp-status-row">
          <div className="cp-status-dot" style={{background:"#10B981"}}/>
          <span className="cp-status-text">Connected</span>
          <span className="cp-status-ts">{syncedAt ? `Synced ${syncedAt}` : `${mediaCount} posts loaded`}</span>
        </div>
        <div className="cp-account-row">
          <div className="cp-avatar" style={{background:"linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)"}}>
            {igConfig.username?.[0]?.toUpperCase() || "I"}
          </div>
          <div>
            <div className="cp-handle">@{igConfig.username}</div>
            <div className="cp-meta">Instagram · {igConfig.mediaCount || mediaCount} posts</div>
          </div>
        </div>

        <div style={{padding:"10px 0 4px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span className="cp-section-title">Server Session</span>
            <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color: daysLeft < 10 ? T.amber : T.textSub}}>
              {daysLeft > 0 ? `${daysLeft}d remaining` : "expired — reconnect"}
            </span>
          </div>
          <div className="cp-token-bar">
            <div style={{height:"100%",width:`${Math.max(2,Math.min(100,(daysLeft/60)*100))}%`,background: daysLeft < 10 ? T.amber : "#10B981",borderRadius:99,transition:"width .3s"}}/>
          </div>
        </div>

        <div style={{padding:"6px 0 0"}}>
          <div className="cp-section-title">Permissions</div>
          {["Read profile & media","Access media URLs & thumbnails","Read media metadata"].map(permission => (
            <div key={permission} style={{display:"flex",alignItems:"center",gap:7,fontSize:12.5,color:T.textSub,padding:"3px 0"}}>
              <span style={{color:"#10B981",fontWeight:700,fontSize:11}}>✓</span>{permission}
            </div>
          ))}
        </div>

        {error && <div style={{fontSize:11.5,color:T.red,padding:"6px 0 0"}}>{error}</div>}

        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button className="btn btn-ghost" style={{flex:1,padding:"7px 0",fontSize:12}} onClick={syncMedia} disabled={syncing}>
            {syncing ? "Syncing…" : `↻ Sync Posts (${mediaCount})`}
          </button>
          <button className="btn btn-danger" style={{padding:"7px 13px",fontSize:12}} onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="cp-status-row">
        <div className="cp-status-dot" style={{background:T.border2}}/>
        <span className="cp-status-text" style={{color:T.textDim}}>
          {connecting ? "Waiting for Instagram…" : "Not connected"}
        </span>
      </div>
      <div style={{fontSize:13,color:T.textSub,lineHeight:1.6,padding:"8px 0 14px"}}>
        Sign in with your Instagram account to sync your real grid and publish posts directly from Social Studio.
      </div>
      {error && <div style={{fontSize:11.5,color:T.red,padding:"0 0 10px"}}>{error}</div>}
      <button className="cp-ig-btn" onClick={startOAuth} disabled={connecting}>
        {connecting
          ? "Waiting for Instagram…"
          : <>{IG_ICON} Sign in with Instagram</>
        }
      </button>
      <p className="cp-setup-note" style={{marginTop:10}}>
        A popup will open on Instagram's website — sign in and approve access. You'll be redirected back automatically.
      </p>
      <p className="cp-setup-note" style={{marginTop:0}}>
        Callback URL: <code>{redirectUri}</code>
      </p>
    </>
  );
}

export function ConnectionPanel({ platform, connected, onConnect, onDisconnect, onClose, igConfig, igMedia, onIGSave, onIGMediaSync }) {
  const isIG = platform === "instagram";
  const [simulating, setSimulating] = useState(false);

  const simulate = async (action) => {
    setSimulating(true);
    await new Promise(r => setTimeout(r, 1200));
    action();
    setSimulating(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cp-modal" onClick={e => e.stopPropagation()}>
        <div className="m-head">
          <div>
            <div className="m-title">{isIG ? "Instagram" : "LinkedIn"}</div>
            <div className="m-sub">{isIG ? (igConfig?.username ? `@${igConfig.username}` : "Not connected") : (connected ? "@rangerandfox · Company Page" : "Not connected")}</div>
          </div>
          <button className="m-x" onClick={onClose}>×</button>
        </div>
        <div className="m-body">
          {isIG ? (
            <IGOAuthPanel
              igConfig={igConfig}
              igMedia={igMedia}
              onSave={onIGSave}
              onMediaSync={onIGMediaSync}
              onDisconnect={onDisconnect}
            />
          ) : (
            <>
              <div className="cp-status-row">
                <div className="cp-status-dot" style={{background: connected ? "#10B981" : T.border2}}/>
                <span className="cp-status-text" style={{color: connected ? T.text : T.textDim}}>
                  {simulating ? (connected ? "Disconnecting…" : "Connecting…") : connected ? "Connected" : "Not connected"}
                </span>
                {connected && <span className="cp-status-ts">Workspace record only</span>}
              </div>
              {connected ? (
                <>
                  <div className="cp-account-row">
                    <div className="cp-avatar" style={{background:`linear-gradient(135deg,${T.blue},#0A66C2)`}}>RF</div>
                    <div><div className="cp-handle">@rangerandfox</div><div className="cp-meta">LinkedIn Company Page</div></div>
                  </div>
                  <div className="cp-detail-grid">
                    {[
                      ["Connection state", "Saved to the studio workspace"],
                      ["Publishing route", "Server endpoint not connected yet"],
                      ["Scope", "Planning and readiness only"],
                    ].map(([label, value])=>(
                      <div key={label} className="cp-detail-card">
                        <div className="cp-detail-label">{label}</div>
                        <div className="cp-detail-value">{value}</div>
                      </div>))}
                  </div>
                </>
              ) : (
                <div style={{fontSize:13,color:T.textSub,lineHeight:1.6,padding:"6px 0 8px"}}>
                  Prepare LinkedIn workspace access now so publish routing can be added cleanly when the server-side integration is ready.
                  {[`Attach the company page record to this workspace`,"Complete server-side publish setup when the backend route is live"].map((s,i) => (
                    <div key={i} className="cp-step"><div className="cp-step-num">{i+1}</div><div className="cp-step-text">{s}</div></div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {!isIG && (
          <div className="m-foot">
            <button className="btn btn-ghost" style={{padding:"6px 13px",fontSize:12}} onClick={onClose}>Close</button>
            {connected
              ? <button className="btn btn-danger" style={{padding:"6px 13px",fontSize:12}} disabled={simulating} onClick={()=>simulate(onDisconnect)}>
                  {simulating ? "Disconnecting…" : "Disconnect"}
                </button>
              : <button className="btn btn-primary" style={{padding:"6px 14px",fontSize:12,background:T.blue}} disabled={simulating} onClick={()=>simulate(onConnect)}>
                  {simulating ? "Connecting…" : "Connect with LinkedIn →"}
                </button>
            }
          </div>
        )}
        {isIG && (
          <div className="m-foot">
            <button className="btn btn-ghost" style={{padding:"6px 13px",fontSize:12}} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

const SETTINGS_TABS = ["General","Team","Notifications","Integrations"];

export function SettingsModal({ onClose }) {
  const [tab, setTab] = useState("General");
  const [notifs, setNotifs] = useState({ review:true, comment:true, scheduled:false, posted:true });
  const ToggleRow = ({ label, sub, k }) => (
    <div className="settings-field-row">
      <div><div className="settings-field-label">{label}</div>{sub&&<div className="settings-field-sub">{sub}</div>}</div>
      <button className="settings-toggle" style={{background:notifs[k]?T.ink:T.border2}}
        onClick={()=>setNotifs(n=>({...n,[k]:!n[k]}))}>
        <div className="settings-toggle-knob" style={{left:notifs[k]?16:2}}/>
      </button>
    </div>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e=>e.stopPropagation()}>
        <div className="m-head">
          <div><div className="m-title">Settings</div><div className="m-sub">Social Studio preferences</div></div>
          <button className="m-x" onClick={onClose}>×</button>
        </div>
        <div className="m-body" style={{paddingTop:0}}>
          <div className="settings-tabs">
            {SETTINGS_TABS.map(t=>(
              <button key={t} className={"settings-tab "+(tab===t?"on":"")} onClick={()=>setTab(t)}>{t}</button>
            ))}
          </div>
          <div className="settings-note">
            Keep settings minimal and operational. Anything here should improve trust, ownership, or delivery confidence.
          </div>

          {tab==="General"&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div className="settings-card">
                <div className="settings-card-title">Workspace</div>
                <div className="field"><div className="lbl">Studio Name</div><input className="inp" defaultValue="Ranger & Fox"/></div>
              </div>
              <div className="field" style={{marginTop:12}}><div className="lbl">Default Platform</div>
                <div className="plat-tabs" style={{marginTop:0}}>
                  {Object.entries(PLATFORMS).map(([k,pl])=>(
                    <button key={k} className="plat-tab" style={{fontSize:11.5}}>{pl.label}</button>
                  ))}
                </div>
              </div>
              <div className="settings-card">
                <div className="settings-field-row" style={{marginTop:0}}>
                  <div><div className="settings-field-label">Timezone</div><div className="settings-field-sub">All times shown in Pacific</div></div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:T.textSub,background:T.s3,padding:"4px 9px",borderRadius:5,border:`1px solid ${T.border}`}}>PT (UTC−8)</div>
                </div>
                <div className="settings-field-row">
                  <div><div className="settings-field-label">Save confidence</div><div className="settings-field-sub">Show explicit save state throughout the studio</div></div>
                  <div style={{fontSize:11,fontWeight:600,color:T.textSub}}>Enabled</div>
                </div>
              </div>
            </div>
          )}

          {tab==="Team"&&(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {TEAM.map(t=>(
                <div key={t.id} className="settings-card" style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px"}}>
                  <div className="av" style={{width:32,height:32,background:t.color+"22",color:t.color,fontSize:11,borderRadius:7}}>{t.initials}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{t.name}</div>
                    <div style={{fontSize:11,color:T.textDim,marginTop:1}}>{t.id}@rangerandfox.com</div>
                  </div>
                  <div style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:99,background:t.id==="stephen"?T.s3:"transparent",border:`1px solid ${T.border}`,color:T.textSub}}>
                    {t.id==="stephen"?"Admin":"Editor"}
                  </div>
                </div>
              ))}
              <button className="btn btn-ghost" style={{fontSize:12,marginTop:4}}>+ Invite team member</button>
            </div>
          )}

          {tab==="Notifications"&&(
            <div className="settings-card">
              <ToggleRow label="Needs Review" sub="Alert when a post enters review" k="review"/>
              <ToggleRow label="New Comment" sub="Alert on post comments" k="comment"/>
              <ToggleRow label="Scheduled" sub="Confirm when a post is scheduled" k="scheduled"/>
              <ToggleRow label="Post Published" sub="Confirm when a post goes live" k="posted"/>
            </div>
          )}

          {tab==="Integrations"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[
                {name:"Slack",sub:"Post activity to a Slack channel",state:"Planned",color:"#611f69"},
                {name:"Zapier",sub:"Automate post workflows",state:"Planned",color:"#FF4A00"},
                {name:"Google Drive",sub:"Import assets from Drive",state:"Planned",color:"#4285F4"},
              ].map(i=>(
                <div key={i.name} className="settings-card" style={{display:"flex",alignItems:"center",gap:12,padding:"11px 13px"}}>
                  <div style={{width:32,height:32,borderRadius:7,background:i.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:i.color,flexShrink:0}}>{i.name[0]}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{i.name}</div><div style={{fontSize:11,color:T.textDim,marginTop:1}}>{i.sub}</div></div>
                  <div style={{fontSize:10.5,fontFamily:"'JetBrains Mono',monospace",color:T.textDim,textTransform:"uppercase",letterSpacing:".08em"}}>{i.state}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="m-foot">
          <button className="btn btn-ghost" style={{fontSize:12}} onClick={onClose}>Close</button>
          <button className="btn btn-primary" style={{fontSize:12}} onClick={onClose}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function pastISO(daysAgo, hour = 10) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0); return d.toISOString();
}

const EXISTING_IG_POSTS = [
  { id:"ex1",  note:"Moonvalley x R&F pipeline reveal",     platform:"ig_post",  scheduledAt:pastISO(3),  _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#e65c00,#f9d423)" },
  { id:"ex2",  note:"Motion tip #12 — Fabric transitions",  platform:"ig_story", scheduledAt:pastISO(5),  _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#0575e6,#021b79)" },
  { id:"ex3",  note:"Clio Awards shortlist ★",              platform:"ig_post",  scheduledAt:pastISO(8),  _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#1a1a2e,#a8c0d6)" },
  { id:"ex4",  note:"Microsoft Fabric — studio B-roll",     platform:"ig_post",  scheduledAt:pastISO(12), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#000000,#e0e0e0)" },
  { id:"ex5",  note:"Behind the scenes — Adobe collab",     platform:"ig_story", scheduledAt:pastISO(14), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#8B0000,#DAA520)" },
  { id:"ex6",  note:"Team spotlight — Jared R.",            platform:"ig_post",  scheduledAt:pastISO(18), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#0a1628,#1a3a6c)" },
  { id:"ex7",  note:"Motion tip #11 — Depth & parallax",    platform:"ig_story", scheduledAt:pastISO(21), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#1565C0,#e3f2fd)" },
  { id:"ex8",  note:"Stash Magazine feature",               platform:"ig_post",  scheduledAt:pastISO(24), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#FF6D00,#FF0000)" },
  { id:"ex9",  note:"New client: Moonvalley",               platform:"ig_post",  scheduledAt:pastISO(27), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#4a00e0,#8e2de2)" },
  { id:"ex10", note:"Studio open house recap",              platform:"ig_story", scheduledAt:pastISO(30), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#005c97,#363795)" },
  { id:"ex11", note:"Clio reel — making-of",                platform:"ig_post",  scheduledAt:pastISO(34), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#0f0c29,#302b63,#24243e)" },
  { id:"ex12", note:"Motion tip #10 — Camera moves",        platform:"ig_post",  scheduledAt:pastISO(38), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#134e5e,#71b280)" },
];

const CELL_GRADIENTS = [
  "linear-gradient(145deg,#0f0c29,#302b63)",
  "linear-gradient(145deg,#1a0533,#7c3aed)",
  "linear-gradient(145deg,#0c1445,#1a2a6c)",
  "linear-gradient(145deg,#0a0a0a,#1c1c1c)",
  "linear-gradient(145deg,#200122,#6f0000)",
  "linear-gradient(145deg,#0f2027,#2c5364)",
];

const MINI_SCALE = 0.703;

function IGCell({ post, index, onOpen, isQueued }) {
  const isStory = post.platform === "ig_story";
  const statusDot = STATUSES[post.status]?.dot || T.border2;
  const storyEls = isStory ? (post.storyElements || makeDefaultElements(post.note)) : null;
  const bgEl = storyEls?.find(e => e.locked);
  const fallbackBg = post.bg || CELL_GRADIENTS[index % CELL_GRADIENTS.length];

  return (
    <div
      className={"ig-cell" + (isQueued ? " is-queued" : "")}
      onClick={() => onOpen(post)}
      title={post.note}
    >
      {post.thumbnailUrl && (
        <img src={post.thumbnailUrl} alt={post.note}
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",pointerEvents:"none"}}/>
      )}

      {isStory && !post.thumbnailUrl && (
        <div style={{position:"absolute",inset:0,overflow:"hidden",background:"#080A0E"}}>
          <div style={{
            position:"absolute",top:0,left:0,
            width:290,height:515,
            transform:`scale(${MINI_SCALE})`,
            transformOrigin:"top left",
          }}>
            {!bgEl?.url && <div style={{position:"absolute",inset:0,background:fallbackBg}}/>}
            {bgEl?.url && bgEl.mediaType !== "video" && <img src={bgEl.url} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} alt=""/>}
            {bgEl?.url && <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0) 45%,rgba(0,0,0,0.25) 100%)"}}/>}
            {storyEls.filter(e => !e.locked && e.type === "text").map(el => (
              <div key={el.id} style={{
                position:"absolute",
                left:el.x,top:el.y,
                fontSize:el.fontSize,
                color:el.color,
                fontFamily:`'${el.fontFamily}',sans-serif`,
                fontWeight:el.fontWeight||600,
                letterSpacing:el.letterSpacing||0,
                lineHeight:1.25,
                whiteSpace:"pre-wrap",
                width:el.boxWidth||190,
                textShadow:el.shadow?"0 2px 12px rgba(0,0,0,0.8)":undefined,
                pointerEvents:"none",
              }}>{el.content}</div>
            ))}
            <div style={{position:"absolute",bottom:10,right:10,fontFamily:"'JetBrains Mono',monospace",fontSize:5,color:"rgba(255,255,255,0.18)",letterSpacing:2,textTransform:"uppercase"}}>R&F</div>
          </div>
        </div>
      )}

      {!isStory && !post.thumbnailUrl && (
        <div style={{
          position:"absolute",inset:0,
          background:fallbackBg,
          display:"flex",flexDirection:"column",
          padding:"11px 10px 9px",
        }}>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.25) 0%,rgba(0,0,0,0) 40%,rgba(0,0,0,0.7) 100%)"}}/>
          <div style={{position:"relative",zIndex:1,marginTop:"auto"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:6,fontWeight:600,color:"rgba(255,255,255,0.45)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>RANGER & FOX</div>
            <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:12,fontWeight:700,color:"#FFFFFF",lineHeight:1.2,letterSpacing:-0.3}}>{post.note || "Untitled"}</div>
          </div>
        </div>
      )}

      {post.thumbnailUrl && (
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0) 50%)",pointerEvents:"none",zIndex:1}}/>
      )}

      {!isQueued && <div className="ig-cell-status" style={{background: statusDot}}/>}
      {isStory && <div className="ig-cell-story-ring"/>}
      {isQueued && <div className="ig-cell-badge queued">QUEUED</div>}
      <div className="ig-cell-overlay">
        <span className="ig-cell-hover-label">{isQueued ? "Edit" : "View"}</span>
      </div>
    </div>
  );
}

export function IGGridView({ rows, onOpen, igMedia, igAccount }) {
  const existingPosts = igMedia?.data?.length
    ? igMedia.data.map(m => ({
        id: m.id,
        note: m.caption?.split("\n")[0]?.slice(0, 80) || "Instagram post",
        platform: "ig_post",
        scheduledAt: m.timestamp,
        _existing: true,
        thumbnailUrl: m.media_type === "VIDEO" ? (m.thumbnail_url || null) : (m.media_url || null),
        permalink: m.permalink,
      }))
    : EXISTING_IG_POSTS;

  const queued = [...rows]
    .filter(r => r.platform.startsWith("ig") && r.status !== "posted")
    .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));

  const allPosts = [...existingPosts, ...queued]
    .sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0));

  const firstQueuedIndex = allPosts.findIndex(p => !p._existing);
  const padded = [...allPosts];
  while (padded.length % 3 !== 0) padded.push(null);

  const queuedCount = queued.length;
  const storyCount = allPosts.filter((post) => post && post.platform === "ig_story").length;
  const readyQueue = queued.filter((post) => ["approved", "scheduled"].includes(post.status)).length;
  const attentionQueue = queued.filter((post) => isRowNeedingAttention(post)).length;
  const syncedLabel = igMedia?._syncedAt ? formatRelativeStamp(igMedia._syncedAt) : "Using seeded feed";

  return (
    <div className="ig-grid-area">
      <div className="ig-profile-wrap">
        <div className="ig-profile-header">
          <div className="ig-profile-avatar">RF</div>
          <div className="ig-profile-meta">
            <div className="ig-profile-kicker">Instagram planning surface</div>
            <div className="ig-profile-handle">{igAccount?.username || "rangerandfox"}</div>
            <div className="ig-profile-bio">Live Instagram media merges with the studio queue here so sequencing stays visible before anything is published.</div>
            <div className="ig-profile-stats">
              {[
                { val: existingPosts.length, key: "live" },
                { val: queuedCount, key: "queued" },
                { val: storyCount, key: "stories" },
                { val: readyQueue, key: "ready" },
              ].map(s => (
                <div key={s.key} className="ig-profile-stat">
                  <span className="ig-profile-stat-val">{s.val}</span>
                  <span className="ig-profile-stat-key">{s.key}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ig-profile-rail">
            <div className="ig-rail-card">
              <div className="ig-rail-label">Sync state</div>
              <div className="ig-rail-value">{igAccount?.username ? "Connected" : "Seeded feed"}</div>
              <div className="ig-rail-sub">Updated {syncedLabel}</div>
            </div>
            <div className="ig-rail-card">
              <div className="ig-rail-label">Queue health</div>
              <div className="ig-rail-value">{attentionQueue ? `${attentionQueue} needs attention` : "Calm"}</div>
              <div className="ig-rail-sub">{queuedCount} queued, {readyQueue} ready to ship</div>
            </div>
          </div>
        </div>

        <div className="ig-grid-frame" style={{borderTop:"none",borderRadius:"0 0 10px 10px"}}>
          <div className="ig-grid">
            {padded.map((post, i) => {
              const showDivider = firstQueuedIndex > 0 && i === firstQueuedIndex && i % 3 === 0;
              return (
                <React.Fragment key={post?.id || `pad-${i}`}>
                  {showDivider && (
                    <div className="ig-queued-divider">
                      <span className="ig-queued-divider-label">↑ Live on Instagram · Queued upcoming ↓</span>
                    </div>
                  )}
                  {post
                    ? <IGCell post={post} index={i} onOpen={onOpen} isQueued={!post._existing}/>
                    : <div className="ig-cell-empty"/>
                  }
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {queuedCount > 0 && (
          <div style={{fontSize:11,color:T.textDim,padding:"10px 2px 0",textAlign:"center",fontFamily:"'JetBrains Mono',monospace",letterSpacing:.3}}>
            {queuedCount} post{queuedCount!==1?"s":""} queued · click any queued tile to edit
          </div>
        )}
      </div>
    </div>
  );
}
