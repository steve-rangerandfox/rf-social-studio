import React from "react";
import {
  STATUSES,
  T,
  formatRelativeStamp,
  isRowNeedingAttention,
  makeDefaultElements,
} from "../shared.js";

function pastISO(daysAgo, hour = 10) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0); return d.toISOString();
}

const EXISTING_IG_POSTS = [
  { id:"ex1",  note:"Moonvalley x R&F pipeline reveal",     platform:"ig_post",  scheduledAt:pastISO(3),  _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#e65c00,#f9d423)" },
  { id:"ex2",  note:"Motion tip #12 — Fabric transitions",  platform:"ig_story", scheduledAt:pastISO(5),  _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#0575e6,#021b79)" },
  { id:"ex3",  note:"Clio Awards shortlist \u2605",              platform:"ig_post",  scheduledAt:pastISO(8),  _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#1a1a2e,#a8c0d6)" },
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
        <img src={post.thumbnailUrl} alt={post.note} className="ig-cell-thumb"/>
      )}

      {isStory && !post.thumbnailUrl && (
        <div className="ig-cell-canvas">
          <div className="ig-cell-canvas-inner" style={{transform:`scale(${MINI_SCALE})`}}>
            {!bgEl?.url && <div className="ig-cell-bg" style={{background:fallbackBg}}/>}
            {bgEl?.url && bgEl.mediaType !== "video" && <img src={bgEl.url} className="ig-cell-thumb" alt=""/>}
            {bgEl?.url && <div className="ig-cell-gradient"/>}
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
            <div className="ig-cell-watermark">R&F</div>
          </div>
        </div>
      )}

      {!isStory && !post.thumbnailUrl && (
        <div className="ig-cell-post-bg" style={{background:fallbackBg}}>
          <div className="ig-cell-post-gradient"/>
          <div className="ig-cell-post-content">
            <div className="ig-cell-post-kicker">RANGER & FOX</div>
            <div className="ig-cell-post-title">{post.note || "Untitled"}</div>
          </div>
        </div>
      )}

      {post.thumbnailUrl && (
        <div className="ig-cell-img-overlay"/>
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

function padToThree(posts) {
  const padded = [...posts];
  while (padded.length % 3 !== 0) padded.push(null);
  return padded;
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

  const published = [...existingPosts]
    .sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0));

  const queuedCount = queued.length;
  const storyCount = [...published, ...queued].filter((p) => p.platform === "ig_story").length;
  const readyQueue = queued.filter((post) => ["approved", "scheduled"].includes(post.status)).length;
  const attentionQueue = queued.filter((post) => isRowNeedingAttention(post)).length;
  const syncedLabel = igMedia?._syncedAt ? formatRelativeStamp(igMedia._syncedAt) : "Using seeded feed";

  const publishedPadded = padToThree(published);
  const queuedPadded = padToThree(queued);

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

        {/* Queued section — shown first for actionability */}
        {queuedCount > 0 && (
          <>
            <div className="ig-section-header">
              <span className="ig-section-header-label">Queued</span>
              <span className="ig-section-header-count">{queuedCount}</span>
            </div>
            <div className="ig-grid-frame ig-grid-frame-queued">
              <div className="ig-grid">
                {queuedPadded.map((post, i) =>
                  post
                    ? <IGCell key={post.id} post={post} index={i} onOpen={onOpen} isQueued/>
                    : <div key={`qpad-${i}`} className="ig-cell-empty"/>
                )}
              </div>
            </div>
          </>
        )}

        {/* Published section */}
        <div className="ig-section-header">
          <span className="ig-section-header-label">Published</span>
          <span className="ig-section-header-count">{published.length}</span>
        </div>
        <div className="ig-grid-frame ig-grid-frame-published" style={{borderRadius:"0 0 10px 10px"}}>
          <div className="ig-grid">
            {publishedPadded.map((post, i) =>
              post
                ? <IGCell key={post.id} post={post} index={i} onOpen={onOpen} isQueued={false}/>
                : <div key={`ppad-${i}`} className="ig-cell-empty"/>
            )}
          </div>
        </div>

        {queuedCount > 0 && (
          <div style={{fontSize:11,color:T.textDim,padding:"10px 2px 0",textAlign:"center",fontFamily:"'JetBrains Mono',monospace",letterSpacing:.3}}>
            {queuedCount} post{queuedCount!==1?"s":""} queued {"\u00b7"} click any queued tile to edit
          </div>
        )}
      </div>
    </div>
  );
}
