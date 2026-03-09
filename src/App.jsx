import { useState, useRef, useEffect, useCallback } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────
const T = {
  bg:"#F7F8FA",       // page background — cool light gray
  surface:"#FFFFFF",  // cards, sidebar, topbar
  s2:"#FAFBFC",       // subtle row hover
  s3:"#F0F1F4",       // active states, inputs
  border:"#E5E7EB",   // primary border
  border2:"#D1D5DB",  // stronger border, focused states
  ink:"#111318",      // primary action color — near-black cool
  inkFog:"rgba(17,19,24,0.05)",
  mint:"#111318", mintDim:"#0A0B0F", mintFog:"rgba(17,19,24,0.05)", // aliases
  text:"#111318",     // primary text
  textSub:"#4B5563",  // secondary text
  textDim:"#9CA3AF",  // tertiary / labels
  red:"#DC2626", amber:"#D97706", blue:"#2563EB",
  pink:"#DB2777", orange:"#EA580C", purple:"#7C3AED",
};

const PLATFORMS = {
  ig_post:  { label:"IG Post",  short:"IG Post",  color:"#BE185D", bg:"rgba(190,24,93,0.07)"  },
  ig_story: { label:"IG Story", short:"IG Story", color:"#9333EA", bg:"rgba(147,51,234,0.07)" },
  linkedin: { label:"LinkedIn", short:"LI",    color:"#0A66C2", bg:"rgba(10,102,194,0.07)" },
};

const STATUSES = {
  idea:         { label:"Idea",          dot:"#9CA3AF", next:"draft"         },
  draft:        { label:"Draft",         dot:"#6B7280", next:"needs_review"  },
  needs_review: { label:"Needs Review",  dot:"#F59E0B", next:"approved"      },
  approved:     { label:"Approved",      dot:"#10B981", next:"scheduled"     },
  scheduled:    { label:"Scheduled",     dot:"#3B82F6", next:"posted"        },
  posted:       { label:"Posted",        dot:"#111318", next:"idea"          },
};

const TEAM = [
  { id:"stephen", name:"Stephen", initials:"SC", color:"#0369A1" },
  { id:"allyson", name:"Allyson", initials:"AL", color:"#BE185D" },
  { id:"jared",   name:"Jared",   initials:"JR", color:"#7C3AED" },
];

const MONTHS_FULL = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WD_SHORT  = ["S","M","T","W","T","F","S"];

const MENTIONS = [
  {id:1,name:"Microsoft",handle:"microsoft"},
  {id:2,name:"Adobe",handle:"adobe"},
  {id:3,name:"Moonvalley",handle:"moonvalley"},
  {id:4,name:"Clio Awards",handle:"clioawards"},
  {id:5,name:"Stash Magazine",handle:"stashmedia"},
];

const MOCK_ANALYTICS = {
  posts: [
    {label:"Jan",ig:12,li:4,reach:2100},{label:"Feb",ig:9,li:6,reach:1800},
    {label:"Mar",ig:14,li:5,reach:2900},{label:"Apr",ig:11,li:8,reach:2400},
    {label:"May",ig:16,li:7,reach:3600},{label:"Jun",ig:13,li:9,reach:3100},
  ],
  topTimes: [
    {time:"9am",score:88},{time:"11am",score:72},{time:"3pm",score:94},
    {time:"6pm",score:81},{time:"8pm",score:67},
  ],
  engagement: { ig_post:4.2, ig_story:7.8, linkedin:3.1 },
  reach:      { ig_post:1840, ig_story:2200, linkedin:980 },
};

const TEMPLATES = {
  announce:{ name:"Announcement", bg:"#080A0E", layers:[
    {type:"label",text:"RANGER & FOX",x:20,y:24,sz:8.5,color:T.ink,ls:3},
    {type:"rule",x:20,y:44,ww:32,color:T.mint},
    {type:"head",key:"headline",x:20,y:155,sz:25,color:"#fff"},
    {type:"body",key:"sub",x:20,y:203,sz:12,color:"#aaa"},
  ]},
  showcase:{ name:"Work Showcase", bg:"#080A0E", layers:[
    {type:"label",text:"NOW SHOWING",x:20,y:24,sz:8,color:"#C9F5E5",ls:4},
    {type:"head",key:"headline",x:20,y:305,sz:21,color:"#fff"},
    {type:"body",key:"sub",x:20,y:342,sz:11,color:"#999"},
  ]},
  tip:{ name:"Weekly Tip", bg:"#050D08", layers:[
    {type:"label",text:"MOTION TIP",x:20,y:24,sz:8,color:T.ink,ls:4},
    {type:"num",key:"num",x:20,y:95,sz:54,color:T.mint},
    {type:"head",key:"headline",x:20,y:178,sz:21,color:"#fff"},
    {type:"body",key:"sub",x:20,y:215,sz:12,color:"#bbb"},
  ]},
};

const API_URL = "https://YOUR-APP.azurewebsites.net/api/social-post?code=YOUR-KEY";

function uid(){ return Math.random().toString(36).slice(2,9); }

// ─── PACIFIC TIME HELPERS ─────────────────────────────────────────
// All displayed times are Pacific. scheduledAt stored as ISO string (UTC).
function nowPT() {
  // Returns a Date object representing current PT wall-clock as if it were UTC
  const d = new Date();
  const ptStr = d.toLocaleString("en-US", { timeZone:"America/Los_Angeles" });
  return new Date(ptStr);
}

function toPTDisplay(isoString) {
  // Given ISO string, returns { month, day, hour12, minute, ampm }
  if (!isoString) return null;
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month:"numeric", day:"numeric",
    hour:"numeric", minute:"2-digit", hour12:true,
  }).formatToParts(d);
  const get = t => parts.find(p=>p.type===t)?.value||"";
  return {
    month: get("month"), day: get("day"),
    hour: get("hour"), minute: get("minute"), ampm: get("dayPeriod"),
  };
}

function ptPickerToISO(year, month, day, hour24, minute) {
  // Convert a PT wall-clock datetime to UTC ISO string
  const ptStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}T${String(hour24).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00`;
  // Use a trick: format the desired PT time as if local, then adjust
  // More reliable: create the date in PT via formatter
  const d = new Date(`${ptStr}-08:00`); // PST offset; close enough for UI purposes
  return d.toISOString();
}

// ─── SEED DATA ────────────────────────────────────────────────────
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

function makeISO(day, hour24, min, targetMonth) {
  const m = targetMonth !== undefined ? targetMonth : currentMonth;
  return ptPickerToISO(currentYear, m, day, hour24, min);
}

const SEED = () => [
  { id:uid(), scheduledAt:makeISO(4,9,0),  note:"AI workflow reveal — Weavy pipeline",     caption:"",  platform:"ig_post",  status:"approved",     assignee:"stephen", comments:[], order:0 },
  { id:uid(), scheduledAt:makeISO(8,11,0), note:"Weekly motion tip — ep. 12",              caption:"",  platform:"ig_story", status:"needs_review", assignee:"allyson", comments:[{id:uid(),author:"allyson",text:"Love the concept — can we add a Reels cut too?",ts:"2h ago"}], order:1 },
  { id:uid(), scheduledAt:makeISO(14,10,0),note:"Clio nomination announcement",            caption:"",  platform:"linkedin", status:"draft",        assignee:"jared",   comments:[], order:2 },
  { id:uid(), scheduledAt:makeISO(19,9,0), note:"Behind-the-scenes: Microsoft Fabric reel",caption:"", platform:"ig_post",  status:"idea",         assignee:null,      comments:[], order:3 },
  { id:uid(), scheduledAt:makeISO(23,14,0),note:"Team spotlight",                          caption:"",  platform:"ig_story", status:"idea",         assignee:null,      comments:[], order:4 },
  { id:uid(), scheduledAt:makeISO(28,14,0),note:"Monthly metrics + studio recap",          caption:"",  platform:"linkedin", status:"draft",        assignee:"stephen", comments:[], order:5 },
];

// ─── STYLES ───────────────────────────────────────────────────────
const G = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:${T.bg};color:${T.text};font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;font-feature-settings:'cv02','cv03','cv04','cv11';line-height:1.5}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.border2};border-radius:99px}
input,textarea,select,button{font-family:inherit}
.app{display:flex;height:100vh;overflow:hidden;position:relative}

/* SIDEBAR */
.sidebar{width:220px;flex-shrink:0;border-right:1px solid ${T.border};display:flex;flex-direction:column;background:${T.surface};overflow-y:auto}
.s-logo{padding:22px 20px 18px;border-bottom:1px solid ${T.border};display:flex;align-items:center;gap:12px;flex-shrink:0}
.logo-mark{width:30px;height:30px;border-radius:8px;background:${T.ink};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#F7F8FA;flex-shrink:0}
.logo-name{font-size:13.5px;font-weight:700;color:${T.text};letter-spacing:-.2px}
.logo-sub{font-size:10.5px;color:${T.textDim};font-weight:400;letter-spacing:.1px}
.s-sect{padding:18px 12px 8px}
.s-lbl{font-size:10px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:${T.textDim};padding:0 10px;margin-bottom:8px;font-family:'Inter',sans-serif;display:block;opacity:.7}
.m-item{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:400;color:${T.textSub};transition:all 0.1s;margin-bottom:1px;position:relative;user-select:none;line-height:1.4}
.m-item:hover{background:${T.s3};color:${T.text}}.m-item.on{background:${T.s3};color:${T.ink};font-weight:600}
.m-item.on::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:2.5px;height:58%;background:${T.ink};border-radius:99px}
.m-ct{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:${T.textDim};font-weight:500}
.m-item.on .m-ct{color:${T.textDim};opacity:0.8}
.s-div{height:1px;background:${T.border};margin:8px 10px}
.s-team{padding:0 10px 8px}
.team-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px}
.av{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;flex-shrink:0}
.team-name{font-size:13px;color:${T.textSub};font-weight:450}
.online-dot{width:5px;height:5px;border-radius:50%;margin-left:auto;flex-shrink:0}
.s-bottom{margin-top:auto;padding:12px 10px;border-top:1px solid ${T.border};flex-shrink:0}
.conn-row{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px}
.conn-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.conn-dot.on{background:${T.ink}}.conn-dot.off{background:${T.border2}}
.conn-name{font-size:13px;color:${T.textSub};font-weight:450}
.conn-st{font-size:10px;margin-left:auto;font-family:'JetBrains Mono',monospace}
.conn-st.on{color:${T.textSub};font-weight:600}.conn-st.off{color:${T.textDim}}

/* MAIN */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.topbar{height:52px;border-bottom:1px solid ${T.border};display:flex;align-items:center;padding:0 24px;gap:10px;background:${T.surface};flex-shrink:0}
.tb-month{font-size:16px;font-weight:700;color:${T.text};letter-spacing:-.4px;font-family:'Bricolage Grotesque',sans-serif}
.tb-year{font-size:16px;font-weight:300;color:${T.textDim};margin-left:4px;font-family:'Bricolage Grotesque',sans-serif}
.tb-space{flex:1}
.view-toggle{display:flex;border:1px solid ${T.border};border-radius:7px;overflow:hidden}
.vt-btn{padding:6px 12px;font-size:12px;font-weight:500;cursor:pointer;border:none;background:transparent;color:${T.textDim};transition:all 0.1s;display:flex;align-items:center;gap:5px;white-space:nowrap;letter-spacing:.1px}
.vt-btn:hover{color:${T.text}}.vt-btn.on{background:${T.s3};color:${T.text};font-weight:600}

/* STATS */
.stats{display:flex;border-bottom:1px solid ${T.border};flex-shrink:0;background:${T.surface}}
.stat{flex:1;padding:14px 28px;border-right:1px solid ${T.border}}
.stat:last-child{border-right:none}
.stat-val{font-size:20px;font-weight:600;letter-spacing:-0.5px;font-family:'Bricolage Grotesque',sans-serif;line-height:1;color:${T.text}}
.stat-key{font-size:11px;color:${T.textDim};font-weight:400;margin-top:5px;letter-spacing:.01em}

/* TABLE */
.t-area{flex:1;overflow-y:auto}
.t-head{display:grid;grid-template-columns:32px 20px 100px minmax(180px,1fr) 116px 148px 114px 148px;padding:0 32px 0 20px;height:36px;border-bottom:1px solid ${T.border};background:${T.surface};position:sticky;top:0;z-index:10;align-items:center}
.th{font-family:'Inter',sans-serif;font-size:10px;font-weight:500;letter-spacing:.03em;color:${T.textDim}}
.th.r{text-align:right}
.t-row{display:grid;grid-template-columns:32px 20px 100px minmax(180px,1fr) 116px 148px 114px 148px;padding:0 32px 0 20px;min-height:60px;border-bottom:1px solid ${T.border};align-items:center;transition:background 0.08s;position:relative}
.t-row:hover{background:#FAFBFD}.t-row.sel{background:${T.s3}}
.t-row.dragging{opacity:0.3}.t-row.drag-over::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:${T.ink};border-radius:99px}
.t-row .ra{display:flex;gap:6px;justify-content:flex-end;align-items:center}
.drag-handle{color:${T.border2};cursor:grab;font-size:14px;display:flex;align-items:center;padding:0 2px;user-select:none}
.drag-handle:hover{color:${T.textSub}}.drag-handle:active{cursor:grabbing}

/* DATETIME CELL */
.dt-cell{display:flex;flex-direction:column;gap:2px;cursor:pointer;padding:4px 6px;border-radius:5px;transition:background 0.08s;border:1px solid transparent;min-width:80px}
.dt-cell:hover{background:${T.s3};border-color:${T.border2}}
.dt-date{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500;color:${T.text};line-height:1.3;letter-spacing:-.1px}
.dt-time{font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.textDim};line-height:1.4;font-weight:400;margin-top:1px}
.dt-empty{font-size:11px;color:${T.textDim};font-style:italic}

/* DATETIME PICKER POPUP */
.dt-popup{position:fixed;background:${T.s2};border:1px solid ${T.border2};border-radius:12px;padding:14px;z-index:500;box-shadow:0 24px 60px rgba(0,0,0,0.7);width:240px;animation:popIn 0.15s cubic-bezier(0.34,1.3,0.64,1)}
@keyframes popIn{from{transform:scale(0.94) translateY(-4px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
.cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cal-nav-btn{background:transparent;border:1px solid ${T.border};border-radius:5px;color:${T.textSub};cursor:pointer;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all 0.1s}
.cal-nav-btn:hover{border-color:${T.border2};color:${T.text}}
.cal-nav-label{font-size:12.5px;font-weight:700;color:${T.text}}
.cal-wd-row{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px}
.cal-wd-cell{font-family:'JetBrains Mono',monospace;font-size:8.5px;color:${T.textDim};text-align:center;padding:2px 0;font-weight:500;letter-spacing:0.5px}
.cal-days{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cal-day-btn{background:transparent;border:none;border-radius:5px;font-size:11.5px;font-weight:500;color:${T.textSub};cursor:pointer;padding:4px 2px;text-align:center;transition:all 0.1s;font-family:'JetBrains Mono',monospace;line-height:1.6}
.cal-day-btn:hover{background:${T.s3};color:${T.text}}
.cal-day-btn.today{color:${T.ink};font-weight:700}
.cal-day-btn.sel{background:${T.ink};color:#F7F8FA;font-weight:700}
.cal-day-btn.empty{cursor:default;pointer-events:none;opacity:0}
.cal-divider{height:1px;background:${T.border};margin:12px -2px 10px}
.time-row{display:flex;align-items:center;gap:8px}
.time-lbl{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:${T.textDim};letter-spacing:0.8px;text-transform:uppercase;width:36px;flex-shrink:0}
.time-inp{background:${T.s3};border:1px solid ${T.border};border-radius:6px;color:${T.text};font-family:'JetBrains Mono',monospace;font-size:12.5px;padding:6px 8px;outline:none;width:100%;transition:border-color 0.1s}
.time-inp:focus{border-color:${T.border2}}
.time-inp::-webkit-calendar-picker-indicator{filter:invert(0.6) sepia(0) saturate(0)}
.tz-badge{font-family:'JetBrains Mono',monospace;font-size:9px;color:${T.textSub};background:${T.s3};border:1px solid ${T.border};border-radius:4px;padding:3px 6px;letter-spacing:0.8px;flex-shrink:0}
.dt-apply{width:100%;margin-top:10px;padding:8px;background:${T.ink};color:#F7F8FA;border:none;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;transition:background 0.1s;font-family:'Inter',sans-serif}
.dt-apply:hover{background:#2E2C28}

/* CAPTION CELL */
.cap-cell{display:flex;align-items:center;min-width:0;height:100%;padding:4px 0}
.cap-preview{font-size:12px;color:${T.textSub};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:text;flex:1;padding:4px 6px;border-radius:5px;border:1px solid transparent;transition:all 0.1s;line-height:1.4}
.cap-preview:hover{background:${T.s3};border-color:${T.border2};color:${T.text}}
.cap-empty{font-size:11px;color:${T.textDim};font-style:italic;cursor:text;padding:4px 6px;border-radius:5px;border:1px dashed transparent;transition:all 0.1s}
.cap-empty:hover{border-color:${T.border2};background:${T.s3}}

/* INLINE CAPTION EDITOR */
.cap-editor-row{grid-column:1/-1;background:${T.bg};border-top:1px solid ${T.border};padding:12px 22px 14px;display:flex;flex-direction:column;gap:10px}
.cap-txa{background:${T.s3};border:1px solid ${T.border};border-radius:8px;color:${T.text};font-size:13px;padding:10px 12px;outline:none;width:100%;resize:none;min-height:90px;line-height:1.6}
.cap-txa:focus{border-color:${T.border2}}
.cap-txa::placeholder{color:${T.textDim}}
.cap-footer{display:flex;align-items:center;justify-content:space-between}
.cap-char{font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.textDim}}
.cap-char.warn{color:${T.amber}}.cap-char.over{color:${T.red}}

/* COMMENT THREAD */
.thread{grid-column:1/-1;background:${T.bg};border-top:1px solid ${T.border};padding:12px 22px 14px 90px;display:flex;flex-direction:column;gap:10px}
.comment{display:flex;gap:10px;align-items:flex-start}
.comment-av{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0}
.comment-meta{display:flex;gap:6px;align-items:baseline;margin-bottom:3px}
.comment-name{font-size:12px;font-weight:600;letter-spacing:-.1px}
.comment-ts{font-size:10px;color:${T.textDim};font-family:'JetBrains Mono',monospace}
.comment-text{font-size:13px;color:${T.textSub};line-height:1.65}
.comment-input-row{display:flex;gap:8px;align-items:center;margin-top:4px}
.comment-input{flex:1;background:${T.s3};border:1px solid ${T.border};border-radius:6px;color:${T.text};font-size:12.5px;padding:7px 10px;outline:none}
.comment-input:focus{border-color:${T.border2}}
.comment-input::placeholder{color:${T.textDim}}

/* INPUTS */
.cb{width:14px;height:14px;border-radius:3px;cursor:pointer;appearance:none;border:1px solid ${T.border2};background:transparent;position:relative;flex-shrink:0;transition:all 0.1s}
.cb:checked{background:${T.ink};border-color:${T.ink}}
.cb:checked::after{content:'';position:absolute;left:3.5px;top:1.5px;width:5px;height:8px;border:2px solid #F7F8FA;border-left:none;border-top:none;transform:rotate(40deg)}
.note-in{width:100%;background:transparent;border:none;color:${T.text};font-size:13px;font-weight:400;padding:4px 0;border-radius:4px;outline:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.01em;font-family:"Inter",sans-serif}
.note-in:focus{background:${T.s3};outline:none;border-radius:4px;padding:4px 6px}
.note-in::placeholder{color:${T.textDim}}

/* PILLS */
.plat-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px 4px 8px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:none;outline:none;letter-spacing:.02em;transition:opacity .12s}
.plat-pill:hover{opacity:.75}
.pill-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;opacity:.85}
.status-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 0;border-radius:0;font-size:12px;font-weight:400;cursor:pointer;border:none;background:transparent;color:${T.textSub};transition:color .1s;white-space:nowrap;letter-spacing:-.01em}
.status-pill:hover{color:${T.text}}
.s-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-right:1px}
.assignee-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 0;border-radius:0;font-size:12px;font-weight:400;cursor:pointer;border:none;background:transparent;color:${T.textSub};transition:color .1s}
.assignee-pill:hover{color:${T.text}}

.ib{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:1px solid transparent;background:transparent;border-radius:5px;cursor:pointer;color:${T.textDim};font-size:13px;transition:all 0.1s}

.ib:hover{border-color:${T.border2};background:${T.s3};color:${T.text}}
.ib.p:hover{border-color:${T.border2};color:${T.text};background:${T.s3}}
.ib.d{opacity:0;transition:opacity .12s;color:${T.textDim}}.ib.d:hover{border-color:${T.red};color:${T.red};background:rgba(255,77,77,0.08)}.t-row:hover .ib.d{opacity:1}
.ib.c:hover{border-color:${T.purple};color:${T.purple};background:rgba(167,139,250,0.08)}
.ib.n:hover{border-color:${T.orange};color:${T.orange};background:rgba(247,119,55,0.08)}

.add-row{padding:0 20px;height:44px;display:flex;align-items:center;border-bottom:none}
.add-btn{display:flex;align-items:center;gap:5px;background:transparent;border:none;color:${T.textDim};font-size:12.5px;font-weight:400;cursor:pointer;padding:6px 8px;border-radius:5px;transition:color 0.1s}
.add-btn:hover{color:${T.textSub}}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:7px;font-size:12.5px;font-weight:500;cursor:pointer;border:none;transition:all 0.12s;letter-spacing:.02em}
.btn-ghost{background:transparent;color:${T.textSub};border:1px solid ${T.border2}}
.btn-ghost:hover{color:${T.text};background:${T.s3}}
.btn-primary{background:${T.ink};color:#F7F8FA;font-weight:600}
.btn-primary:hover{background:#2E2C28}
.btn-ai{background:rgba(167,139,250,0.12);color:${T.purple};border:1px solid rgba(167,139,250,0.25);font-weight:600}
.btn-ai:hover{background:rgba(167,139,250,0.2)}
.btn-now{background:rgba(59,130,246,0.12);color:${T.blue};border:1px solid rgba(59,130,246,0.25);font-weight:700}
.btn-now:hover{background:rgba(59,130,246,0.22)}
.btn-danger{background:rgba(255,77,77,0.1);color:${T.red};border:1px solid rgba(255,77,77,0.2)}
.btn-danger:hover{background:rgba(255,77,77,0.18)}
.btn:disabled{opacity:0.38;cursor:not-allowed}

/* BULK BAR */
.bulk{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:${T.s3};border:1px solid ${T.border2};border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;box-shadow:0 20px 60px rgba(0,0,0,0.6);z-index:50;animation:bIn 0.18s cubic-bezier(0.34,1.56,0.64,1)}
@keyframes bIn{from{transform:translateX(-50%) translateY(8px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
.bulk-lbl{font-size:13.5px;color:${T.textSub};font-weight:400}.bulk-lbl b{color:${T.text};font-weight:600}

/* CALENDAR VIEW */
.cal-area{flex:1;overflow-y:auto;padding:24px 28px}
.cal-header{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px}
.cal-wd{font-family:'Inter',sans-serif;font-size:10px;font-weight:500;letter-spacing:.05em;text-transform:uppercase;color:${T.textDim};text-align:center;padding-bottom:10px}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:${T.border}}
.cal-cell{background:${T.surface};min-height:130px;padding:10px;position:relative;transition:background 0.08s}
.cal-cell.other{background:${T.surface};border-color:${T.border}}.cal-cell.today{background:${T.s2}}
.cal-cell:hover{background:${T.s2}}
.cal-dn{font-family:'Inter',sans-serif;font-size:11.5px;font-weight:400;color:${T.textDim};margin-bottom:8px}
.cal-cell.today .cal-dn{color:${T.ink};font-weight:700}
.cal-posts{display:flex;flex-direction:column;gap:3px}
.cal-post{padding:4px 8px;border-radius:4px;font-size:10.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:5px;overflow:hidden;margin-bottom:1px}
.cal-post:hover{opacity:0.8}
.cal-add{position:absolute;bottom:5px;right:5px;opacity:0;transition:opacity 0.1s}
.cal-cell:hover .cal-add{opacity:1}
.cal-add-btn{width:20px;height:20px;border-radius:4px;background:${T.s3};border:1px solid ${T.border2};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;color:${T.textDim};transition:all 0.1s}
.cal-add-btn:hover{border-color:${T.border2};color:${T.text}}

/* ANALYTICS */
.analytics-area{flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:20px}
.analytics-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.an-card{background:${T.surface};border:1px solid ${T.border};border-radius:10px;padding:18px}
.an-card.wide{grid-column:span 2}.an-card.full{grid-column:1/-1}
.an-title{font-size:10.5px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:${T.textDim};font-family:'Inter',sans-serif;margin-bottom:16px;opacity:.65}
.an-big{font-size:34px;font-weight:700;letter-spacing:-1.5px;margin-bottom:5px;font-family:'Bricolage Grotesque',sans-serif;line-height:1}
.an-sub{font-size:12.5px;color:${T.textDim};font-weight:400;line-height:1.5}
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.bar-label{font-size:11px;color:${T.textSub};width:60px;flex-shrink:0;font-family:'JetBrains Mono',monospace}
.bar-track{flex:1;height:6px;background:${T.s3};border-radius:99px;overflow:hidden}
.bar-fill{height:100%;border-radius:99px;transition:width 0.6s cubic-bezier(0.34,1,0.64,1)}
.bar-val{font-size:11px;color:${T.textDim};width:36px;text-align:right;font-family:'JetBrains Mono',monospace}
.chart-bars{display:flex;gap:6px;align-items:flex-end;height:80px;margin-top:8px}
.chart-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.chart-bar{width:100%;border-radius:3px 3px 0 0;transition:height 0.5s}
.chart-bar-label{font-size:9.5px;color:${T.textDim};font-family:'JetBrains Mono',monospace}
.perf-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${T.border}}
.perf-row:last-child{border-bottom:none}
.perf-note{font-size:13px;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:12px}
.perf-plat{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:99px}
.perf-reach{font-size:12px;color:${T.textSub};font-family:'JetBrains Mono',monospace;width:60px;text-align:right}
.perf-eng{font-size:12px;font-weight:600;width:44px;text-align:right}

/* ASSET DRAWER */
.asset-drawer{position:fixed;right:0;top:0;bottom:0;width:320px;background:${T.surface};border-left:1px solid ${T.border};z-index:80;display:flex;flex-direction:column;animation:drawerIn 0.2s cubic-bezier(0.34,1.1,0.64,1)}
@keyframes drawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
.asset-head{padding:18px 18px 14px;border-bottom:1px solid ${T.border};display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.asset-title{font-size:14px;font-weight:700}
.asset-body{flex:1;overflow-y:auto;padding:14px}
.asset-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
.asset-item{aspect-ratio:1;border-radius:7px;border:1px solid ${T.border};overflow:hidden;cursor:pointer;position:relative;background:${T.s3};transition:all 0.1s}
.asset-item:hover{border-color:${T.border2};transform:scale(1.02)}
.asset-thumb{width:100%;height:100%;object-fit:cover}
.asset-empty-thumb{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px;opacity:0.4}
.asset-name{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);font-size:9px;padding:3px 5px;color:${T.textSub};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'JetBrains Mono',monospace}
.asset-upload{border:1.5px dashed ${T.border2};border-radius:8px;padding:20px;text-align:center;cursor:pointer;transition:all 0.12s;margin-bottom:4px}
.asset-upload:hover{border-color:${T.ink};background:${T.inkFog}}

/* MODAL */
.overlay{position:fixed;inset:0;background:rgba(20,18,15,0.65);z-index:100;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);animation:fIn 0.15s}
@keyframes fIn{from{opacity:0}to{opacity:1}}
.modal{background:${T.surface};border:1px solid ${T.border};border-radius:14px;width:560px;max-width:94vw;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.03);animation:mIn 0.2s cubic-bezier(0.34,1.2,0.64,1)}
@keyframes mIn{from{transform:translateY(10px) scale(0.98);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
.m-head{padding:19px 20px 17px;border-bottom:1px solid ${T.border};display:flex;align-items:flex-start;justify-content:space-between;flex-shrink:0}
.m-title{font-size:16px;font-weight:700;letter-spacing:-.35px;font-family:'Bricolage Grotesque',sans-serif}
.m-sub{font-size:13px;color:${T.textDim};margin-top:4px;font-weight:400;line-height:1.4}
.m-x{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid ${T.border};background:transparent;border-radius:5px;cursor:pointer;color:${T.textDim};font-size:16px;transition:all 0.1s;flex-shrink:0}
.m-x:hover{border-color:${T.border2};background:${T.s3};color:${T.text}}
.m-body{padding:18px 20px;display:flex;flex-direction:column;gap:15px;overflow-y:auto;flex:1}
.m-foot{padding:13px 20px;border-top:1px solid ${T.border};display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-shrink:0}
.field{display:flex;flex-direction:column;gap:5px}
.lbl{font-family:'Inter',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;color:${T.textDim};opacity:.7}
.inp{background:${T.s2};border:1px solid ${T.border};border-radius:7px;color:${T.text};font-size:14px;padding:10px 12px;outline:none;transition:border-color 0.1s;width:100%;font-weight:400;line-height:1.4}
.inp:focus{border-color:${T.border2}}
.txa{background:${T.s2};border:1px solid ${T.border};border-radius:7px;color:${T.text};font-size:14px;padding:10px 12px;outline:none;width:100%;resize:none;min-height:100px;line-height:1.65;font-weight:400}
.txa:focus{border-color:${T.border2}}
.txa::placeholder{color:${T.textDim}}
.plat-tabs{display:flex;gap:4px;background:${T.s3};padding:3px;border-radius:7px}
.plat-tab{flex:1;padding:6px 10px;border-radius:5px;border:none;background:transparent;cursor:pointer;text-align:center;font-size:11.5px;font-weight:500;color:${T.textSub};transition:all 0.1s}
.plat-tab:hover{color:${T.text}}
.upload{border:1.5px dashed ${T.border2};border-radius:8px;padding:24px 20px;text-align:center;cursor:pointer;transition:all 0.12s}
.upload:hover,.upload.drag{border-color:${T.ink};background:${T.inkFog}}
.upload input{display:none}
.fp{display:flex;align-items:center;gap:10px;background:${T.s3};border:1px solid ${T.border};border-radius:7px;padding:9px 11px}
.fn{font-size:12px;font-family:'JetBrains Mono',monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${T.textSub}}
.frm{background:transparent;border:none;color:${T.textDim};cursor:pointer;font-size:16px;padding:2px 4px}
.frm:hover{color:${T.red}}
.ip{width:100%;max-height:160px;object-fit:cover;border-radius:7px;border:1px solid ${T.border};margin-top:8px}
.char-row{display:flex;justify-content:flex-end;margin-top:3px}
.char{font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.textDim}}
.char.warn{color:${T.amber}}.char.over{color:${T.red}}

/* AI WRITER */
.ai-panel{background:${T.surface};border:1px solid ${T.border};border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:10px;animation:fIn 0.15s}
.ai-header{display:flex;align-items:center;gap:7px;margin-bottom:2px}
.ai-icon{font-size:14px}.ai-title{font-size:12px;font-weight:700;color:${T.textSub}}
.ai-result{background:${T.s3};border:1px solid ${T.border};border-radius:7px;padding:10px 12px;font-size:13px;color:${T.text};line-height:1.6;white-space:pre-wrap;max-height:160px;overflow-y:auto}
.ai-typing::after{content:'▋';animation:blink 0.8s infinite;color:${T.ink}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

/* MENTIONS */
.mw{position:relative}
.md{position:absolute;top:calc(100% + 4px);left:0;right:0;background:${T.s3};border:1px solid ${T.border2};border-radius:8px;z-index:200;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.5)}
.mi{display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;transition:background 0.08s}
.mi:hover{background:${T.border}}
.ma{width:24px;height:24px;border-radius:5px;background:${T.border2};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${T.textSub};flex-shrink:0}
.mn{font-size:12.5px;font-weight:600}.mh{font-size:11px;color:${T.textDim};font-family:'JetBrains Mono',monospace}

/* STORY */
.s-modal{width:820px;max-width:96vw}
.s-layout{display:flex;flex:1;overflow:hidden}
.s-bar{width:248px;flex-shrink:0;border-right:1px solid ${T.border};overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px}
.s-canvas-area{flex:1;display:flex;flex-direction:column;align-items:center;padding:18px;gap:12px;overflow-y:auto;background:${T.bg}}
.canvas{width:232px;height:412px;border-radius:16px;position:relative;overflow:hidden;border:1px solid ${T.border2};flex-shrink:0;box-shadow:0 24px 60px rgba(0,0,0,0.6)}
.canvas-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.canvas-ov{position:absolute;inset:0;pointer-events:none}
.tmpl-btn{width:100%;text-align:left;background:${T.s3};border:1px solid ${T.border};border-radius:7px;padding:8px 11px;cursor:pointer;transition:all 0.1s;font-size:12.5px;font-weight:600;color:${T.textSub};margin-bottom:3px}
.tmpl-btn:hover{border-color:${T.border2};color:${T.text}}.tmpl-btn.on{border-color:${T.ink};color:${T.ink};background:${T.inkFog}}
.s-inp{background:${T.s3};border:1px solid ${T.border};border-radius:6px;color:${T.text};font-size:12.5px;padding:7px 10px;outline:none;width:100%}
.s-inp:focus{border-color:${T.border2}}

/* POSTING STATES */
.pr{display:flex;align-items:center;gap:8px;flex:1}
.pd{width:7px;height:7px;border-radius:50%;background:${T.ink};animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
.pt{font-size:13px;color:${T.textSub}}
.sr{display:flex;align-items:center;gap:8px;flex:1}
.si{width:20px;height:20px;border-radius:50%;background:${T.ink};display:flex;align-items:center;justify-content:center;font-size:11px;color:${T.bg};font-weight:800}
.st2{font-size:13px;color:${T.textSub};font-weight:600}
.er2{font-size:13px;color:${T.red};font-weight:500;flex:1}

/* EMPTY */
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:56px 0}
.e-icon{font-size:26px;opacity:0.18;margin-bottom:4px}
.e-t{font-size:14px;font-weight:600;color:${T.textSub}}.e-s{font-size:13px;color:${T.textDim};font-weight:400;line-height:1.6}

/* TOAST */
.toast{position:fixed;bottom:26px;right:22px;z-index:300;background:${T.s3};border:1px solid ${T.border2};border-radius:8px;padding:10px 15px;font-size:13px;color:${T.text};font-weight:500;box-shadow:0 12px 40px rgba(0,0,0,0.5);animation:tIn 0.18s cubic-bezier(0.34,1.2,0.64,1);display:flex;align-items:center;gap:8px;max-width:320px}
@keyframes tIn{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}
.t-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
/* ─── STORY DESIGNER SCENE GRAPH ─── */
.s-modal{width:900px;max-width:96vw}
.s-layout{display:flex;flex:1;overflow:hidden;min-height:0}
.s-bar{width:268px;flex-shrink:0;border-right:1px solid #E5E7EB;overflow-y:auto;display:flex;flex-direction:column;background:#FFFFFF}
.inspector-group{padding:13px 15px;border-bottom:1px solid #E5E7EB}
.inspector-group:last-child{border-bottom:none}
.inspector-group-title{font-family:'Inter',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:${T.textDim};margin-bottom:10px;opacity:.65}
.s-canvas-area{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:20px 24px;gap:14px;background:#DDDFE3;overflow:auto}
.canvas-wrap{position:relative;border-radius:16px;box-shadow:0 40px 100px rgba(0,0,0,0.32),0 0 0 1px rgba(0,0,0,0.08);flex-shrink:0}
.canvas{width:232px;height:412px;border-radius:16px;position:relative;overflow:hidden;background:#080A0E;flex-shrink:0;cursor:crosshair}
.canvas-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
.canvas-ov{position:absolute;inset:0;pointer-events:none}
.element-wrap{position:absolute;cursor:move;user-select:none}
.element-wrap:hover .el-outline{opacity:1}
.el-outline{position:absolute;inset:-2px;border:1px dashed rgba(0,165,114,0.45);border-radius:2px;pointer-events:none;opacity:0;transition:opacity 0.1s}
.element-selected .el-outline{opacity:1;border-color:#111318;border-style:solid}
.handle{position:absolute;width:8px;height:8px;background:#FFFFFF;border:1.5px solid #111318;border-radius:50%;z-index:20;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
.handle-nw{top:-4px;left:-4px;cursor:nwse-resize}
.handle-ne{top:-4px;right:-4px;cursor:nesw-resize}
.handle-sw{bottom:-4px;left:-4px;cursor:nesw-resize}
.handle-se{bottom:-4px;right:-4px;cursor:nwse-resize}
.s-slider{-webkit-appearance:none;width:100%;height:4px;border-radius:2px;background:#EFF0F2;outline:none;cursor:pointer;margin:4px 0 10px}
.s-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#111318;cursor:pointer;border:2px solid #FFFFFF;box-shadow:0 1px 4px rgba(0,122,85,0.4)}
.layers-stack{display:flex;flex-direction:column;gap:2px;max-height:130px;overflow-y:auto}
.layer-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;cursor:pointer;font-size:12px;font-weight:500;color:#555D6E;transition:background 0.08s;border:1px solid transparent}
.layer-item:hover{background:#F9FAFB;color:#0D0F12}
.layer-item.active{background:${T.s3};border-color:${T.border2};color:${T.ink};font-weight:600}
.layer-icon{font-size:11px;width:18px;text-align:center;flex-shrink:0;font-family:'JetBrains Mono',monospace;font-weight:700}
.layer-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px}
.layer-del{background:transparent;border:none;color:#9AA0AE;cursor:pointer;font-size:13px;padding:1px 3px;border-radius:3px;line-height:1;opacity:0;transition:opacity 0.1s}
.layer-item:hover .layer-del{opacity:1}
.layer-item:hover .layer-del:hover{color:#D93025}
.color-swatches{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.color-swatch{width:22px;height:22px;border-radius:5px;cursor:pointer;border:2px solid transparent;transition:transform 0.1s,border-color 0.1s;flex-shrink:0}
.color-swatch:hover{transform:scale(1.18)}
.color-swatch.sel{border-color:#111318;box-shadow:0 0 0 1px #FFFFFF inset}
.font-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
.font-btn{background:#F0F1F3;border:1px solid #E5E7EB;border-radius:5px;padding:5px 8px;font-size:11px;font-weight:600;cursor:pointer;color:#555D6E;transition:all 0.1s;text-align:center}
.font-btn.sel{background:${T.s3};border-color:${T.border2};color:${T.ink};font-weight:700}
.ai-copilot{background:${T.s2};border:1px solid ${T.border};border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;animation:fIn 0.15s}
.ai-copilot-title{font-size:11.5px;font-weight:600;color:${T.textSub};display:flex;align-items:center;gap:6px;font-family:'Inter',sans-serif}
.ai-suggestion{background:#FFFFFF;border:1px solid #E5E7EB;border-radius:6px;padding:9px 10px;font-size:11.5px;color:#555D6E;line-height:1.5;cursor:pointer;transition:border-color 0.1s}
.ai-suggestion:hover{border-color:${T.border2};color:${T.text}}
.ai-suggestion b{color:${T.text};font-weight:600}
.del-btn{background:transparent;border:1px solid #E5E7EB;border-radius:5px;padding:4px 10px;font-size:11.5px;font-weight:600;color:#D93025;cursor:pointer;transition:all 0.1s;display:flex;align-items:center;gap:4px}
.del-btn:hover{background:rgba(217,48,37,0.06);border-color:#D93025}

/* ─── STAGE WELL ─── */
.row-container{display:contents}
.row-container.is-open .t-row{background:#FFFFFF;border-bottom:1px solid transparent;position:relative;z-index:4}
.row-container.is-open .t-row::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:#E5E7EB}

.stage-reveal-wrapper{display:grid;grid-template-rows:0fr;transition:grid-template-rows 320ms cubic-bezier(0.4,0,0.2,1);overflow:hidden;background:#F9FAFB;border-bottom:1px solid transparent}
.stage-reveal-wrapper.open{grid-template-rows:1fr;border-bottom:1px solid #E5E7EB}
.stage-content-well{min-height:0;display:flex;gap:0;box-shadow:inset 0 3px 12px rgba(0,0,0,0.04)}

/* Three columns */
.stage-col{padding:22px 24px;border-right:1px solid #E5E7EB;display:flex;flex-direction:column;gap:14px}
.stage-col:last-child{border-right:none}
.stage-col-media{width:200px;flex-shrink:0}
.stage-col-write{flex:1;min-width:0}
.stage-col-gov{width:210px;flex-shrink:0}

.stage-col-label{font-family:'Inter',sans-serif;font-size:10px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:${T.textDim};margin-bottom:4px;opacity:.7}

/* Media thumb */
.stage-thumb{width:100%;aspect-ratio:9/16;border-radius:10px;background:#0D0F12;position:relative;overflow:hidden;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.18);flex-shrink:0;display:flex;align-items:center;justify-content:center;max-height:180px}
.stage-thumb img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.stage-thumb-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.18s;backdrop-filter:saturate(1.2)}
.stage-thumb:hover .stage-thumb-overlay{opacity:1}
.stage-thumb-btn{background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.3);border-radius:7px;padding:7px 14px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;backdrop-filter:blur(8px)}
.stage-post-placeholder{width:100%;border-radius:8px;border:1.5px dashed #D1D5DB;min-height:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:all 0.12s;background:transparent}
.stage-post-placeholder:hover{border-color:${T.ink};background:rgba(0,122,85,0.04)}
.stage-post-placeholder input{display:none}

/* Caption editor in stage */
.stage-txa{background:#FFFFFF;border:1px solid ${T.border};border-radius:7px;color:${T.text};font-size:13.5px;padding:12px 14px;outline:none;width:100%;resize:none;min-height:100px;line-height:1.65;transition:border-color 0.1s;flex:1;font-family:'Inter',sans-serif;font-weight:400}
.stage-txa:focus{border-color:#D1D5DB;box-shadow:0 0 0 3px rgba(0,122,85,0.06)}
.stage-txa::placeholder{color:#9AA0AE}
.stage-char{font-family:'JetBrains Mono',monospace;font-size:10px;color:#9AA0AE}
.stage-char.warn{color:#D97706}.stage-char.over{color:#D93025}

/* AI panel in stage */
.stage-ai{background:${T.s2};border:1px solid ${T.border};border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.stage-ai-header{display:flex;align-items:center;justify-content:space-between}
.stage-ai-title{font-size:11px;font-weight:600;color:${T.textSub};display:flex;align-items:center;gap:5px;font-family:'Inter',sans-serif}
.stage-ai-result{background:${T.surface};border:1px solid ${T.border};border-radius:6px;padding:10px 12px;font-size:13px;color:${T.textSub};line-height:1.65;white-space:pre-wrap;max-height:110px;overflow-y:auto}
.stage-ai-typing::after{content:'▋';animation:blink 0.8s infinite;color:${T.textDim}}

/* Governance column */
.readiness-list{display:flex;flex-direction:column;gap:6px}
.readiness-item{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;background:#FFFFFF;border:1px solid #E5E7EB}
.readiness-icon{font-size:13px;flex-shrink:0;width:18px;text-align:center}
.readiness-label{font-size:12.5px;color:${T.textSub};flex:1;font-weight:400}
.readiness-ok{font-family:'Inter',sans-serif;font-size:11px;font-weight:600}
.readiness-ok.pass{color:#111318}.readiness-ok.fail{color:#D93025}.readiness-ok.warn{color:#D97706}

.quick-status{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px}
.qs-btn{padding:5px 12px;border-radius:99px;font-size:11px;font-weight:500;cursor:pointer;border:1px solid ${T.border};background:transparent;color:${T.textSub};transition:all 0.1s;white-space:nowrap;letter-spacing:.05px}
.qs-btn:hover{border-color:#D1D5DB;color:#0D0F12;background:#F9FAFB}
.qs-btn.active{border-color:currentColor}

/* Expand trigger */
.expand-toggle{display:inline-flex;align-items:center;gap:5px;padding:0 13px;height:28px;border-radius:6px;border:1px solid;font-size:11.5px;font-weight:500;cursor:pointer;transition:all 0.12s;font-family:'Inter',sans-serif;letter-spacing:.01em;white-space:nowrap}
.expand-toggle:not(.open){background:${T.surface};border-color:${T.border};color:${T.textSub}}
.expand-toggle:not(.open):hover{background:${T.s3};border-color:${T.border2};color:${T.text}}
.expand-toggle.open{background:${T.ink};border-color:${T.ink};color:#F7F8FA}
.expand-toggle.open:hover{background:#2E2C28;border-color:#2E2C28}

/* ─── VIDEO / RICH MEDIA ─── */
.video-el{position:relative;display:block}
.video-el video{display:block;border-radius:4px;pointer-events:none}
.video-badge{position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.65);color:#fff;font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;padding:2px 5px;border-radius:3px;letter-spacing:.8px;pointer-events:none}
.mute-toggle{position:absolute;bottom:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.55);border:none;color:#fff;font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;transition:background .1s}
.mute-toggle:hover{background:rgba(0,0,0,0.8)}
.s-toggle-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.s-toggle{width:28px;height:16px;border-radius:99px;position:relative;cursor:pointer;transition:background .15s;flex-shrink:0}
.s-toggle-knob{position:absolute;width:12px;height:12px;border-radius:50%;background:#fff;top:2px;transition:left .15s;box-shadow:0 1px 3px rgba(0,0,0,.2)}

/* ─── TEMPLATE SYSTEM ─── */
.tmpl-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:6px}
.tmpl-card{position:relative;border-radius:7px;overflow:hidden;cursor:pointer;border:1.5px solid #E5E7EB;transition:transform .15s cubic-bezier(.34,1.3,.64,1),border-color .12s;background:#080A0E;aspect-ratio:9/16}
.tmpl-card:hover{transform:scale(1.04);border-color:#111318}
.tmpl-card.default-tmpl{border-color:#111318;box-shadow:0 0 0 2px #fff,0 0 0 3.5px #111318}
.tmpl-card-preview{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.tmpl-card-el{position:absolute;font-family:'Bricolage Grotesque',sans-serif;line-height:1.2;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tmpl-heart{position:absolute;top:4px;right:4px;width:18px;height:18px;background:rgba(0,0,0,.55);border:none;color:#fff;font-size:10px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;transition:background .1s}
.tmpl-heart:hover{background:rgba(0,0,0,.8)}
.tmpl-heart.is-default{background:#111318;color:#fff}
.tmpl-name{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.7));padding:10px 5px 4px;font-size:8.5px;color:rgba(255,255,255,.8);font-family:'JetBrains Mono',monospace;text-align:center;letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.save-tmpl-btn{display:flex;align-items:center;gap:6px;background:transparent;border:1px dashed #D1D5DB;border-radius:6px;padding:6px 10px;font-size:11.5px;color:#555D6E;cursor:pointer;width:100%;transition:all .1s;margin-top:6px;justify-content:center}
.save-tmpl-btn:hover{border-color:#111318;color:#111318;background:rgba(0,122,85,.04)}

/* ─── STORY THUMBNAIL (stage well) ─── */
.story-thumb-container{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer}
.story-thumb-preview{width:100%;max-height:178px;border-radius:10px;background:#080A0E;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.2),0 0 0 1px rgba(0,0,0,.06);aspect-ratio:9/16}
.story-thumb-preview video{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.story-thumb-overlay{position:absolute;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s;backdrop-filter:saturate(1.2) blur(2px)}
.story-thumb-container:hover .story-thumb-overlay{opacity:1}
.story-thumb-btn{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);border-radius:7px;padding:6px 12px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;backdrop-filter:blur(8px)}
.thumb-el{position:absolute;font-family:'Bricolage Grotesque',sans-serif;line-height:1.2;overflow:hidden;pointer-events:none}

/* ─── FONT SECTION HEADER ─── */
.font-section-header{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#9AA0AE;margin:6px 0 4px;display:flex;align-items:center;gap:5px}
.font-verified{color:#111318;font-size:9px}

/* ─── YEAR VIEW ─── */
.year-kpi{display:flex;gap:0;border-bottom:1px solid #E5E7EB;background:#FFFFFF;flex-shrink:0}
.year-kpi-item{flex:1;padding:14px 20px;border-right:1px solid #E5E7EB;display:flex;flex-direction:column;gap:3px}
.year-kpi-item:last-child{border-right:none}
.year-kpi-val{font-size:28px;font-weight:700;line-height:1;font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-1.2px}
.year-kpi-label{font-size:11px;color:${T.textDim};font-weight:400;font-family:'Inter',sans-serif;letter-spacing:.1px;margin-top:2px}
.year-kpi-bar{height:3px;border-radius:99px;background:#EFF0F2;margin-top:6px;overflow:hidden}
.year-kpi-bar-fill{height:100%;border-radius:99px;transition:width .4s cubic-bezier(.4,0,.2,1)}

.month-group{display:contents}
.month-anchor-header{position:sticky;top:0;z-index:8;background:rgba(244,245,247,0.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(0,0,0,0.05);padding:10px 18px 9px;display:flex;align-items:baseline;gap:10px;will-change:backdrop-filter}
.month-anchor-label{font-family:'Bricolage Grotesque',sans-serif;font-size:13px;font-weight:700;letter-spacing:-.2px;color:${T.text}}
.month-anchor-count{font-family:'Inter',sans-serif;font-size:11.5px;color:${T.textDim};font-weight:400}
.month-sparkline{display:flex;gap:2px;align-items:flex-end;height:16px;margin-left:auto}
.month-spark-bar{width:5px;border-radius:1px;min-height:2px;background:#D1D5DB;transition:background .1s}
.month-spark-bar.ig{background:#BE185D33}
.month-spark-bar.li{background:#0A66C233}
.month-spark-bar.fill{opacity:1}
.month-empty{padding:22px 22px 20px;display:flex;align-items:center;gap:12px}
.month-empty-text{font-size:12.5px;color:#9AA0AE;font-style:italic}
.month-empty-add{background:transparent;border:1px dashed #D1D5DB;border-radius:6px;padding:4px 11px;font-size:11.5px;color:#9AA0AE;cursor:pointer;transition:all .1s;font-weight:500;white-space:nowrap}
.month-empty-add:hover{border-color:#111318;color:#111318;background:rgba(0,122,85,.04)}

/* Year segmented toggle in sidebar */
.time-toggle{display:flex;background:#EFF0F2;border-radius:7px;padding:3px;gap:2px;margin-bottom:10px}
.time-toggle-btn{flex:1;padding:4px 6px;border:none;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;background:transparent;color:#9AA0AE;transition:all .15s;font-family:'Bricolage Grotesque',sans-serif}
.time-toggle-btn.on{background:#FFFFFF;color:#0D0F12;box-shadow:0 1px 3px rgba(0,0,0,.08)}

/* Mini-map */
.minimap{position:fixed;right:8px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:3px;z-index:50;padding:6px 4px;background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:8px;border:1px solid #E5E7EB;box-shadow:0 2px 10px rgba(0,0,0,.06)}
.minimap-item{width:22px;height:22px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:8.5px;font-weight:700;color:#9AA0AE;cursor:pointer;transition:all .12s;border:1px solid transparent;text-transform:uppercase}
.minimap-item:hover{background:#F0F1F3;color:#555D6E}
.minimap-item.has-posts{color:#555D6E}
.minimap-item.current-month{background:rgba(0,122,85,.08);color:#111318;border-color:rgba(0,122,85,.2)}
.minimap-item.active-scroll{background:#111318;color:#fff;border-color:#111318}

.stage-reveal-wrapper{will-change:grid-template-rows}

`;

// ─── DATETIME PICKER ──────────────────────────────────────────────
function DateTimePicker({ isoValue, onChange, onClose, anchorRef }) {
  const pt = nowPT();
  const initDate = isoValue ? (() => {
    const d = new Date(isoValue);
    const s = d.toLocaleString("en-US", { timeZone:"America/Los_Angeles", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false });
    const [datePart, timePart] = s.split(", ");
    const [m, dd, yyyy] = datePart.split("/");
    const [hh, mm] = timePart.split(":");
    return { year:parseInt(yyyy), month:parseInt(m)-1, day:parseInt(dd), hour:parseInt(hh)===24?0:parseInt(hh), minute:parseInt(mm) };
  })() : { year:pt.getFullYear(), month:pt.getMonth(), day:pt.getDate(), hour:9, minute:0 };

  const [viewYear,  setViewYear]  = useState(initDate.year);
  const [viewMonth, setViewMonth] = useState(initDate.month);
  const [selDay,    setSelDay]    = useState(initDate.day);
  const [selYear,   setSelYear]   = useState(initDate.year);
  const [selMonth,  setSelMonth]  = useState(initDate.month);
  const [timeVal,   setTimeVal]   = useState(`${String(initDate.hour).padStart(2,"0")}:${String(initDate.minute).padStart(2,"0")}`);

  const popRef = useRef(null);

  // Position below anchor
  const [pos, setPos] = useState({ top:0, left:0 });
  useEffect(() => {
    if (!anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popW = 240, popH = 320;
    let top = rect.bottom + 6;
    let left = rect.left;
    if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
    if (top + popH > window.innerHeight - 12) top = rect.top - popH - 6;
    setPos({ top, left });
  }, []);

  // Click outside close
  useEffect(() => {
    const h = (e) => { if (popRef.current && !popRef.current.contains(e.target) && !anchorRef?.current?.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", h), 10);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const todayPT     = nowPT();

  const apply = () => {
    const [h, m] = timeVal.split(":").map(Number);
    const iso = ptPickerToISO(selYear, selMonth, selDay, h, m);
    onChange(iso);
    onClose();
  };

  const pickDay = (d) => { setSelDay(d); setSelYear(viewYear); setSelMonth(viewMonth); };

  const prevMonth = () => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else{setViewMonth(m=>m-1);} };
  const nextMonth = () => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else{setViewMonth(m=>m+1);} };

  const cells = [];
  const dtPrevDays = new Date(viewYear, viewMonth, 0).getDate();
  for(let i=0;i<firstDay;i++) cells.push({ d: dtPrevDays - firstDay + 1 + i, type:'prev' });
  for(let d=1;d<=daysInMonth;d++) cells.push({ d, type:'curr' });
  const dtTotal = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  for(let nd=1; cells.length < dtTotal; nd++) cells.push({ d: nd, type:'next' });

  const isSel = (d) => d && d===selDay && viewMonth===selMonth && viewYear===selYear;
  const isToday = (d) => d && todayPT.getDate()===d && todayPT.getMonth()===viewMonth && todayPT.getFullYear()===viewYear;

  return (
    <div ref={popRef} className="dt-popup" style={{ position:"fixed", top:pos.top, left:pos.left }}>
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <span className="cal-nav-label">{MONTHS_SHORT[viewMonth]} {viewYear}</span>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>
      <div className="cal-wd-row">
        {WD_SHORT.map((w,i)=><div key={i} className="cal-wd-cell">{w}</div>)}
      </div>
      <div className="cal-days">
        {cells.map((d,i)=>(
          <button key={i}
            className={`cal-day-btn ${!d?"empty":""} ${isSel(d)?"sel":""} ${isToday(d)&&!isSel(d)?"today":""}`}
            onClick={()=>d&&pickDay(d)}>
            {d||""}
          </button>
        ))}
      </div>
      <div className="cal-divider"/>
      <div className="time-row">
        <span className="time-lbl">Time</span>
        <input type="time" className="time-inp" value={timeVal} onChange={e=>setTimeVal(e.target.value)}/>
        <span className="tz-badge">PT</span>
      </div>
      <button className="dt-apply" onClick={apply}>Apply</button>
    </div>
  );
}

// ─── DATETIME CELL ────────────────────────────────────────────────
function DateTimeCell({ isoValue, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const disp = isoValue ? toPTDisplay(isoValue) : null;

  return (
    <div style={{position:"relative"}} ref={ref}>
      <div className="dt-cell" onClick={()=>setOpen(v=>!v)}>
        {disp ? <>
          <div className="dt-date">{disp.month}/{disp.day}</div>
          <div className="dt-time">{disp.hour}:{disp.minute} {disp.ampm} PT</div>
        </> : <div className="dt-empty">Set date</div>}
      </div>
      {open && <DateTimePicker isoValue={isoValue} onChange={onChange} onClose={()=>setOpen(false)} anchorRef={ref}/>}
    </div>
  );
}

// ─── AI CAPTION WRITER ────────────────────────────────────────────
function AIWriter({ platform, note, onAccept }) {
  const [prompt, setPrompt] = useState(note || "");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setResult("");
    const tone = platform === "linkedin"
      ? "professional, thoughtful, industry-authority tone. No emojis."
      : "bold, creative, energetic. Studio personality — confident but not corporate. Use 2-3 relevant hashtags.";
    const limit = platform === "linkedin" ? "Keep under 1200 characters." : "Keep under 300 characters.";
    const sys = `You are a social media copywriter for Ranger & Fox, a premium motion graphics studio in Rochester, MI with LA presence. Brand voice: confident, creative, a little enigmatic — "sexy indifference". Write in ${tone} ${limit} Output only the caption text, nothing else.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:sys, messages:[{role:"user",content:`Write a caption for: ${prompt}`}] }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      let i = 0;
      const interval = setInterval(() => {
        i += 3; setResult(text.slice(0,i));
        if(i>=text.length){setResult(text);clearInterval(interval);setLoading(false);}
      }, 18);
    } catch(e) { setResult("Couldn't connect to AI."); setLoading(false); }
  };

  return (
    <div className="ai-panel">
      <div className="ai-header"><span className="ai-title">AI Caption Writer</span></div>
      <div style={{display:"flex",gap:8}}>
        <input className="inp" style={{flex:1,fontSize:12.5}} value={prompt} onChange={e=>setPrompt(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&generate()} placeholder="Describe what you're posting…"/>
        <button className="btn btn-ai" style={{padding:"7px 12px",fontSize:12,flexShrink:0}}
          onClick={generate} disabled={loading||!prompt.trim()}>{loading?"Writing…":"Generate"}</button>
      </div>
      {(result||loading)&&<div className={`ai-result ${loading&&!result?"ai-typing":""}`}>{result||" "}</div>}
      {result&&!loading&&<div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button className="btn btn-ghost" style={{padding:"5px 11px",fontSize:12}} onClick={generate}>Regenerate</button>
        <button className="btn btn-ai" style={{padding:"5px 11px",fontSize:12}} onClick={()=>onAccept(result)}>Use this ↑</button>
      </div>}
    </div>
  );
}

// ─── CAPTION EDITOR (modal) ───────────────────────────────────────
function CaptionEditor({ value, onChange, platform, note }) {
  const [mq, setMq] = useState(null); const [res, setRes] = useState([]);
  const [showAI, setShowAI] = useState(false);
  const ref = useRef(null);
  const max = platform==="linkedin"?3000:2200;
  const over = value.length>max, warn = value.length>max*0.88;
  const onCh = (e) => {
    const v=e.target.value; onChange(v);
    const b=v.slice(0,e.target.selectionStart), m=b.match(/@(\w*)$/);
    if(m){setMq(m[1]);setRes(MENTIONS.filter(x=>x.name.toLowerCase().includes(m[1].toLowerCase())||x.handle.includes(m[1].toLowerCase())).slice(0,5));}
    else setMq(null);
  };
  const pick=(item)=>{const el=ref.current,c=el.selectionStart;const before=value.slice(0,c).replace(/@\w*$/,`@${item.handle} `);onChange(before+value.slice(c));setMq(null);setTimeout(()=>{el.focus();el.setSelectionRange(before.length,before.length);},0);};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span className="lbl">Caption</span>
        <button className="btn btn-ai" style={{padding:"4px 10px",fontSize:11}} onClick={()=>setShowAI(v=>!v)}>{showAI?"Hide AI":"Write with AI"}</button>
      </div>
      {showAI&&<AIWriter platform={platform} note={note} onAccept={(t)=>{onChange(t);setShowAI(false);}}/>}
      <div className="mw">
        <textarea ref={ref} className="txa" value={value} onChange={onCh} placeholder="Write your caption… use @ to tag"/>
        <div className="char-row"><span className={`char ${over?"over":warn?"warn":""}`}>{value.length}/{max}</span></div>
        {mq!==null&&res.length>0&&<div className="md">{res.map(m=><div key={m.id} className="mi" onClick={()=>pick(m)}><div className="ma">{m.name[0]}</div><div><div className="mn">{m.name}</div><div className="mh">@{m.handle}</div></div></div>)}</div>}
      </div>
    </div>
  );
}

// ─── COMPOSER MODAL ───────────────────────────────────────────────
function Composer({ row, onClose, onPosted, postNow }) {
  const [plat,    setPlat]    = useState(row?.platform==="ig_story"?"ig_post":row?.platform||"ig_post");
  const [caption, setCaption] = useState(row?.caption||"");
  const [file,    setFile]    = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [drag,    setDrag]    = useState(false);
  const [st,      setSt]      = useState(postNow?"posting":"idle");
  const [errMsg,  setErrMsg]  = useState("");
  const fRef = useRef(null);
  const p = PLATFORMS[plat];

  const schedDisp = row?.scheduledAt ? toPTDisplay(row.scheduledAt) : null;

  const handleFile = (f) => { if(!f)return; setFile(f); if(f.type.startsWith("image/"))setFileUrl(URL.createObjectURL(f)); };

  const doPost = useCallback(async () => {
    setSt("posting"); setErrMsg("");
    try {
      if(API_URL.includes("YOUR-APP")){await new Promise(r=>setTimeout(r,1800));setSt("done");onPosted?.();return;}
      const res = await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform:plat,caption,mediaUrl:fileUrl})});
      const data = await res.json();
      if(!data.success) throw new Error(data.error||"Unknown error");
      setSt("done"); onPosted?.();
    } catch(err){ setSt("error"); setErrMsg(err.message); }
  }, [plat, caption, fileUrl]);

  // If postNow, fire immediately on mount
  useEffect(() => { if(postNow) doPost(); }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="m-head">
          <div>
            <div className="m-title">{st==="done"?"Published ✓":postNow?"Posting now…":"Compose & Publish"}</div>
            <div className="m-sub">{row?.note}{schedDisp?` · Scheduled ${schedDisp.month}/${schedDisp.day} at ${schedDisp.hour}:${schedDisp.minute} ${schedDisp.ampm} PT`:""}</div>
          </div>
          <button className="m-x" onClick={onClose}>×</button>
        </div>
        <div className="m-body">
          {!postNow && <>
            <div className="field">
              <div className="lbl">Platform</div>
              <div className="plat-tabs">
                {Object.entries(PLATFORMS).filter(([k])=>k!=="ig_story").map(([k,pl])=>(
                  <button key={k} className="plat-tab" style={plat===k?{background:pl.bg,borderColor:pl.color,color:pl.color}:{}} onClick={()=>setPlat(k)}>{pl.label}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <div className="lbl">Media</div>
              {file ? (
                <div><div className="fp"><span style={{fontSize:17}}>{file.type.startsWith("image")?"img":"vid"}</span><span className="fn">{file.name}</span><button className="frm" onClick={()=>{setFile(null);setFileUrl(null);}}>✕</button></div>{fileUrl&&<img src={fileUrl} className="ip" alt=""/>}</div>
              ) : (
                <div className={`upload ${drag?"drag":""}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0])}} onClick={()=>fRef.current?.click()}>
                  <input ref={fRef} type="file" accept="image/*,video/*,image/gif" onChange={e=>handleFile(e.target.files?.[0])}/>
                  <div style={{fontSize:22,opacity:0.35,marginBottom:7}}>↑</div>
                  <div style={{fontSize:13,color:T.textSub}}>Drop file or click to browse</div>
                  <div style={{fontSize:11,color:T.textDim,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>JPG · PNG · GIF · MP4 · MOV</div>
                </div>
              )}
            </div>
            <CaptionEditor value={caption} onChange={setCaption} platform={plat} note={row?.note}/>
          </>}
          {postNow && st==="posting" && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:"32px 0"}}>
              <div className="pd" style={{width:12,height:12}}/>
              <div style={{fontSize:14,color:T.textSub}}>Publishing to {p.label}…</div>
            </div>
          )}
        </div>
        <div className="m-foot">
          {st==="posting"&&!postNow&&<div className="pr"><div className="pd"/><span className="pt">Publishing to {p.label}…</span></div>}
          {st==="done"&&<div className="sr"><div className="si">✓</div><span className="st2">Live on {p.label}</span></div>}
          {st==="error"&&<span className="er2">✕ {errMsg}</span>}
          {st!=="done"&&!postNow&&<button className="btn btn-ghost" onClick={onClose}>Cancel</button>}
          {st==="done"?<button className="btn btn-ghost" onClick={onClose}>Close</button>
            :!postNow&&<button className="btn btn-primary" onClick={doPost} disabled={st==="posting"}>
              {st==="posting"?"Working…":"Publish Now"}
            </button>}
          {st==="error"&&<button className="btn btn-primary" onClick={doPost}>Retry</button>}
        </div>
      </div>
    </div>
  );
}

// ─── STORY DESIGNER ───────────────────────────────────────────────
// ─── CANVAS ELEMENT ──────────────────────────────────────────────
const BRAND_COLORS = ["#111318","#7C3AED","#F59E0B","#0A66C2","#BE185D","#FFFFFF","#F7F8FA","#10B981","#E5E7EB"];
const FONTS = ["Bricolage Grotesque","JetBrains Mono"];

function CanvasElement({ data, isSelected, onSelect, onUpdate, onDelete }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);

  const handleDrag = (e) => {
    if (data.locked) return;
    e.preventDefault(); e.stopPropagation();
    onSelect();
    const sx = e.clientX - data.x, sy = e.clientY - data.y;
    const onMove = (mv) => onUpdate({ x: mv.clientX - sx, y: mv.clientY - sy });
    const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // BG layer (locked image or video)
  if (data.locked) {
    const isVid = data.mediaType === 'video';
    return (
      <>
        {data.url && !isVid && <img src={data.url} className="canvas-img" alt="" draggable="false"/>}
        {data.url && isVid && (
          <video ref={videoRef} src={data.url} className="canvas-img"
            autoPlay loop muted={muted} playsInline draggable={false}
            style={{objectFit:'cover'}}/>
        )}
        {data.url && <div className="canvas-ov" style={{background:"linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.05) 50%,rgba(0,0,0,0.3) 100%)"}}/>}
        {data.url && isVid && (
          <button className="mute-toggle" style={{zIndex:60}} onClick={e=>{e.stopPropagation();setMuted(v=>!v);}}>
            {muted ? 'Mute' : 'Unmute'}
          </button>
        )}
      </>
    );
  }

  const isVideo = data.mediaType === 'video';
  const scale   = data.scale || 1;

  return (
    <div
      className={"element-wrap " + (isSelected ? "element-selected" : "")}
      style={{ left: data.x, top: data.y, zIndex: isSelected ? 10 : 2 }}
      onMouseDown={handleDrag}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="el-outline"/>
      {data.type === 'text' ? (
        <div style={{
          fontSize: data.fontSize, color: data.color,
          fontFamily: `'${data.fontFamily}', sans-serif`,
          letterSpacing: data.letterSpacing || 0,
          fontWeight: data.fontWeight || 600,
          lineHeight: 1.25, whiteSpace: 'pre-wrap', maxWidth: 190,
          textShadow: data.shadow ? '0 2px 12px rgba(0,0,0,0.8)' : undefined,
          textRendering: 'optimizeLegibility', pointerEvents: 'none',
        }}>
          {data.content}
        </div>
      ) : isVideo ? (
        <div className="video-el" style={{transform:`scale(${scale})`,transformOrigin:'top left'}}>
          <video ref={videoRef} src={data.url}
            style={{width:100,height:100,objectFit:'cover',borderRadius:4,display:'block'}}
            autoPlay={data.autoPlay!==false} loop={data.loop!==false}
            muted={data.muted!==false} playsInline draggable={false}/>
          <div className="video-badge">{data.trimLabel||'VID'}</div>
          <button className="mute-toggle" onClick={e=>{e.stopPropagation();onUpdate({muted:!data.muted});}}>
            {data.muted!==false?'Mute':'Sound'}
          </button>
        </div>
      ) : (
        <img src={data.url} alt="" draggable="false"
          style={{transform:`scale(${scale})`,transformOrigin:'top left',display:'block',maxWidth:120,maxHeight:120,borderRadius:4,pointerEvents:'none'}}/>
      )}
      {isSelected && (
        <>
          <div className="handle handle-nw"/>
          <div className="handle handle-ne"/>
          <div className="handle handle-sw"/>
          <div className="handle handle-se"/>
        </>
      )}
    </div>
  );
}

// ─── STORY THUMBNAIL ─────────────────────────────────────────────
const SCALE = 232 / 1080; // canvas preview scale factor

function StoryThumbnail({ elements, onClick }) {
  const bgEl  = elements.find(e => e.locked);
  const isVid = bgEl?.mediaType === 'video';
  const videoRef = useRef(null);

  const handleEnter = () => { if (videoRef.current) videoRef.current.play().catch(()=>{}); };
  const handleLeave = () => { if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; } };

  return (
    <div className="story-thumb-container" onClick={onClick} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <div className="story-thumb-preview">
        {bgEl?.url && !isVid && <img src={bgEl.url} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} alt=""/>}
        {bgEl?.url && isVid  && <video ref={videoRef} src={bgEl.url} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} loop muted playsInline/>}
        {bgEl?.url && <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.75) 0%,rgba(0,0,0,0) 45%,rgba(0,0,0,.28) 100%)',pointerEvents:'none'}}/>}
        {elements.filter(e => !e.locked && e.type === 'text').map(el => (
          <div key={el.id} className="thumb-el" style={{
            left: el.x * SCALE, top: el.y * SCALE,
            fontSize: (el.fontSize || 14) * SCALE,
            color: el.color || '#fff',
            fontFamily: `'${el.fontFamily || 'Bricolage Grotesque'}', sans-serif`,
            fontWeight: el.fontWeight || 600,
            letterSpacing: (el.letterSpacing || 0) * SCALE,
            textShadow: el.shadow ? '0 1px 4px rgba(0,0,0,.8)' : undefined,
            maxWidth: 190 * SCALE,
          }}>{el.content}</div>
        ))}
        {!bgEl?.url && <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:18,opacity:.2,color:'#fff'}}></span>
        </div>}
        <div style={{position:'absolute',bottom:6,right:6,fontFamily:"'JetBrains Mono',monospace",fontSize:5.5,color:'rgba(255,255,255,.2)',letterSpacing:2,textTransform:'uppercase',pointerEvents:'none'}}>R&F</div>
        <div className="story-thumb-overlay">
          <button className="story-thumb-btn">Open Designer</button>
        </div>
      </div>
    </div>
  );
}

// ─── STORY DESIGNER (SCENE GRAPH ENGINE) ─────────────────────────
const BRAND_FONTS = [
  { name:"Bricolage Grotesque", label:"Bricolage",  group:"brand" },
  { name:"JetBrains Mono",      label:"Mono",       group:"brand" },
];
const SYS_FONTS   = [
  { name:"Georgia",      label:"Georgia",      group:"system" },
  { name:"Arial",        label:"Arial",        group:"system" },
];
const ALL_FONTS = [...BRAND_FONTS, ...SYS_FONTS];

// Module-level template store (persists across opens in the session)
let _savedTemplates = [];
let _defaultTmplId  = null;

function StoryDesigner({ row, onClose }) {
  const makeDefault = () => [
    { id:"bg",  type:"image", url:null, x:0, y:0, scale:1, locked:true, mediaType:'image' },
    { id:uid(), type:"text",  content:"RANGER & FOX",          x:20, y:22,  fontSize:8.5, fontFamily:"JetBrains Mono",     color:T.ink, letterSpacing:3,    fontWeight:600, shadow:false },
    { id:uid(), type:"text",  content:row?.note||"Headline",   x:20, y:155, fontSize:24,  fontFamily:"Bricolage Grotesque",color:"#FFFFFF", letterSpacing:-0.5, fontWeight:700, shadow:true  },
    { id:uid(), type:"text",  content:"Supporting detail",      x:20, y:205, fontSize:12,  fontFamily:"Bricolage Grotesque",color:"rgba(255,255,255,0.6)", letterSpacing:0, fontWeight:400, shadow:false },
  ];

  const [elements,    setElements]    = useState(() => {
    // If a default template exists, clone it (update headline with note)
    if (_defaultTmplId) {
      const t = _savedTemplates.find(t => t.id === _defaultTmplId);
      if (t) {
        const els = t.elements.map(e => ({ ...e, id: e.id === 'bg' ? 'bg' : uid() }));
        const headlineEl = els.find(e => e.type === 'text' && e.fontSize >= 20);
        if (headlineEl && row?.note) headlineEl.content = row.note;
        return els;
      }
    }
    return makeDefault();
  });

  const [selectedId,  setSelectedId]  = useState(null);
  const [postState,   setPostState]   = useState("idle");
  const [showCopilot, setShowCopilot] = useState(false);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiTips,      setAiTips]      = useState([]);
  const [templates,   setTemplates]   = useState(_savedTemplates);
  const [defaultId,   setDefaultId]   = useState(_defaultTmplId);
  const [tmplName,    setTmplName]    = useState("");
  const [showTmplSave,setShowTmplSave]= useState(false);
  const bgFileRef  = useRef(null);
  const imgFileRef = useRef(null);
  const vidFileRef = useRef(null);

  const selected  = elements.find(el => el.id === selectedId);
  const updateEl  = (id, patch) => setElements(els => els.map(e => e.id === id ? { ...e, ...patch } : e));
  const deleteEl  = (id) => { setElements(els => els.filter(e => e.id !== id)); setSelectedId(null); };

  const addText = () => {
    const el = { id:uid(), type:"text", content:"New text", x:40, y:180, fontSize:18, fontFamily:"Bricolage Grotesque", color:"#FFFFFF", letterSpacing:0, fontWeight:600, shadow:false };
    setElements(els => [...els, el]); setSelectedId(el.id);
  };

  const addMedia = (file) => {
    if (!file) return;
    const url  = URL.createObjectURL(file);
    const isV  = file.type.startsWith("video/") || file.type === "image/gif";
    const el   = { id:uid(), type:"image", url, x:56, y:140, scale:1, locked:false, mediaType: isV ? 'video' : 'image', loop:true, muted:true, autoPlay:true, trimLabel: file.name.split('.').pop().toUpperCase() };
    setElements(els => [...els, el]); setSelectedId(el.id);
  };

  const setBg = (file) => {
    if (!file) return;
    const url  = URL.createObjectURL(file);
    const isV  = file.type.startsWith("video/") || file.type === "image/gif";
    updateEl("bg", { url, mediaType: isV ? 'video' : 'image' });
  };

  // Save template
  const saveTemplate = () => {
    if (!tmplName.trim()) return;
    const tmpl = {
      id: uid(),
      name: tmplName.trim(),
      elements: elements.map(e => ({ ...e, url: e.locked ? null : e.url })), // strip bg URL
    };
    _savedTemplates = [..._savedTemplates, tmpl];
    setTemplates(_savedTemplates);
    setTmplName(""); setShowTmplSave(false);
  };

  const setDefault = (id) => {
    _defaultTmplId = id === defaultId ? null : id;
    setDefaultId(_defaultTmplId);
  };

  const loadTemplate = (tmpl) => {
    const els = tmpl.elements.map(e => ({ ...e, id: e.id === 'bg' ? 'bg' : uid() }));
    setElements(els); setSelectedId(null);
  };

  const runAICopilot = async () => {
    setAiLoading(true); setAiTips([]);
    const boardCtx = elements.filter(e => !e.locked).map(e => ({
      type: e.type, content: e.type==='text'?e.content:'Media',
      position: { x:Math.round(e.x), y:Math.round(e.y) },
      fontSize: e.fontSize, color: e.color,
    }));
    const sys = `You are a senior motion graphics art director at Ranger & Fox, a premium LA/Detroit motion studio. Review this 232x412px Instagram Story canvas and give exactly 3 short actionable layout tips. JSON array only: ["tip1","tip2","tip3"]. No preamble.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,system:sys,messages:[{role:"user",content:`Board: ${JSON.stringify(boardCtx)}`}]})});
      const data = await res.json();
      const text = data.content?.[0]?.text || "[]";
      const m = text.match(/\[[\s\S]*?\]/);
      setAiTips(m ? JSON.parse(m[0]) : ["Keep text above y=340 (safe zone).","Use high-contrast headline color.","Anchor R&F logo to a corner for brand safety."]);
    } catch { setAiTips(["Keep text above y=340 (safe zone).","Use high-contrast headline color.","Anchor R&F logo to a corner for brand safety."]); }
    setAiLoading(false);
  };

  const doPost = async () => { setPostState("posting"); await new Promise(r=>setTimeout(r,2000)); setPostState("done"); };

  useEffect(() => {
    const h = (e) => {
      if ((e.key==='Backspace'||e.key==='Delete') && selectedId && selected && !selected.locked && document.activeElement.tagName!=='INPUT' && document.activeElement.tagName!=='TEXTAREA') deleteEl(selectedId);
      if (e.key==='Escape') setSelectedId(null);
    };
    window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h);
  }, [selectedId,selected]);

  const layersRev = [...elements].reverse();

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal s-modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"94vh"}}>
        <div className="m-head" style={{flexShrink:0}}>
          <div><div className="m-title">Story Designer</div><div className="m-sub">{row?.note}</div></div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {postState==="posting"&&<div className="pr" style={{marginRight:4}}><div className="pd"/><span className="pt">Posting…</span></div>}
            {postState==="done"&&<div className="sr" style={{marginRight:4}}><div className="si">✓</div><span className="st2">Story live</span></div>}
            <button className="btn btn-ai" style={{padding:"5px 11px",fontSize:12}}
              onClick={()=>{setShowCopilot(v=>!v);if(!showCopilot&&aiTips.length===0)runAICopilot();}}>
              {showCopilot?"Hide AI":"AI Refine"}
            </button>
            {postState!=="done"&&<button className="btn btn-ghost" style={{padding:"5px 12px",fontSize:12}} onClick={onClose}>Discard</button>}
            {postState==="done"
              ?<button className="btn btn-ghost" style={{padding:"5px 12px",fontSize:12}} onClick={onClose}>Close</button>
              :<button className="btn btn-primary" style={{padding:"5px 14px",fontSize:12}} onClick={doPost} disabled={postState==="posting"}>Publish Story</button>}
            <button className="m-x" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="s-layout">
          {/* ── PROPERTY INSPECTOR ── */}
          <aside className="s-bar">

            {/* Canvas actions */}
            <div className="inspector-group">
              <div className="inspector-group-title">Canvas</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px",justifyContent:"flex-start"}} onClick={addText}>+ Add Text</button>
                <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px",justifyContent:"flex-start"}} onClick={()=>imgFileRef.current?.click()}>+ Image / GIF</button>
                <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px",justifyContent:"flex-start"}} onClick={()=>vidFileRef.current?.click()}>+ Video Layer</button>
                <input ref={imgFileRef} type="file" accept="image/*,image/gif" style={{display:"none"}} onChange={e=>addMedia(e.target.files?.[0])}/>
                <input ref={vidFileRef} type="file" accept="video/*,image/gif"  style={{display:"none"}} onChange={e=>addMedia(e.target.files?.[0])}/>
                <button className="btn btn-ghost" style={{flex:1,fontSize:12,padding:"6px 10px",justifyContent:"flex-start"}} onClick={()=>bgFileRef.current?.click()}>
                  {elements.find(e=>e.id==="bg")?.url?"Replace Background":"Set Background"}
                </button>
                <input ref={bgFileRef} type="file" accept="image/*,video/*,image/gif" style={{display:"none"}} onChange={e=>setBg(e.target.files?.[0])}/>
              </div>
            </div>

            {/* Element properties */}
            {selected && !selected.locked ? (
              <div className="inspector-group">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div className="inspector-group-title" style={{margin:0}}>
                    {selected.type==='text'?'Text':selected.mediaType==='video'?'Video':'Image'} Properties
                  </div>
                  <button className="del-btn" onClick={()=>deleteEl(selectedId)}>✕ Delete</button>
                </div>

                {selected.type==='text' && (
                  <>
                    <div className="lbl" style={{marginBottom:4}}>Content</div>
                    <textarea className="s-inp" style={{width:"100%",resize:"none",minHeight:60,marginBottom:10,fontSize:12.5}}
                      value={selected.content} onChange={e=>updateEl(selectedId,{content:e.target.value})}/>

                    <div className="lbl" style={{marginBottom:4}}>Font</div>
                    <div className="font-section-header"><span className="font-verified">✓</span> Brand Fonts</div>
                    <div className="font-row">
                      {BRAND_FONTS.map(f=>(
                        <button key={f.name} className={"font-btn "+(selected.fontFamily===f.name?"sel":"")}
                          style={{fontFamily:`'${f.name}',sans-serif`}}
                          onClick={()=>updateEl(selectedId,{fontFamily:f.name})}>{f.label}</button>
                      ))}
                    </div>
                    <div className="font-section-header">System Fonts</div>
                    <div className="font-row">
                      {SYS_FONTS.map(f=>(
                        <button key={f.name} className={"font-btn "+(selected.fontFamily===f.name?"sel":"")}
                          style={{fontFamily:`'${f.name}',sans-serif`}}
                          onClick={()=>updateEl(selectedId,{fontFamily:f.name})}>{f.label}</button>
                      ))}
                    </div>

                    <div className="lbl" style={{marginBottom:2}}>Size — {selected.fontSize}px</div>
                    <input type="range" className="s-slider" min={7} max={72} value={selected.fontSize}
                      onChange={e=>updateEl(selectedId,{fontSize:parseInt(e.target.value)})}/>

                    <div className="lbl" style={{marginBottom:2}}>Letter Spacing — {selected.letterSpacing||0}</div>
                    <input type="range" className="s-slider" min={-2} max={10} step={0.5} value={selected.letterSpacing||0}
                      onChange={e=>updateEl(selectedId,{letterSpacing:parseFloat(e.target.value)})}/>

                    <div className="lbl" style={{marginBottom:6}}>Weight</div>
                    <div className="font-row" style={{marginBottom:8}}>
                      {[{l:"Regular",v:400},{l:"Bold",v:700},{l:"Black",v:800}].map(w=>(
                        <button key={w.v} className={"font-btn "+(selected.fontWeight===w.v?"sel":"")}
                          style={{fontWeight:w.v}} onClick={()=>updateEl(selectedId,{fontWeight:w.v})}>{w.l}</button>
                      ))}
                    </div>

                    <div className="s-toggle-row">
                      <div className="lbl" style={{margin:0}}>Text Shadow</div>
                      <div className="s-toggle" style={{background:selected.shadow?"#111318":"#D1D5DB"}}
                        onClick={()=>updateEl(selectedId,{shadow:!selected.shadow})}>
                        <div className="s-toggle-knob" style={{left:selected.shadow?14:2}}/>
                      </div>
                    </div>

                    <div className="lbl" style={{marginBottom:4}}>Color</div>
                    <div className="color-swatches">
                      {BRAND_COLORS.map(c=>(
                        <div key={c} className={"color-swatch "+(selected.color===c?"sel":"")}
                          style={{background:c,border:c==="#FFFFFF"?"2px solid #E5E7EB":undefined}}
                          onClick={()=>updateEl(selectedId,{color:c})}/>
                      ))}
                    </div>
                  </>
                )}

                {selected.type==='image' && selected.mediaType==='video' && (
                  <>
                    <div className="lbl" style={{marginBottom:2}}>Scale — {(selected.scale||1).toFixed(2)}x</div>
                    <input type="range" className="s-slider" min={0.2} max={3} step={0.05} value={selected.scale||1}
                      onChange={e=>updateEl(selectedId,{scale:parseFloat(e.target.value)})}/>

                    <div className="inspector-group-title" style={{marginTop:8}}>Video Controls</div>

                    <div className="s-toggle-row">
                      <div className="lbl" style={{margin:0}}>Loop</div>
                      <div className="s-toggle" style={{background:selected.loop!==false?"#111318":"#D1D5DB"}}
                        onClick={()=>updateEl(selectedId,{loop:!(selected.loop!==false)})}>
                        <div className="s-toggle-knob" style={{left:selected.loop!==false?14:2}}/>
                      </div>
                    </div>

                    <div className="s-toggle-row">
                      <div className="lbl" style={{margin:0}}>Mute</div>
                      <div className="s-toggle" style={{background:selected.muted!==false?"#111318":"#D1D5DB"}}
                        onClick={()=>updateEl(selectedId,{muted:!(selected.muted!==false)})}>
                        <div className="s-toggle-knob" style={{left:selected.muted!==false?14:2}}/>
                      </div>
                    </div>

                    <div className="lbl" style={{marginBottom:2,marginTop:4}}>Volume — {Math.round((selected.volume||0)*100)}%</div>
                    <input type="range" className="s-slider" min={0} max={1} step={0.05} value={selected.volume||0}
                      onChange={e=>updateEl(selectedId,{volume:parseFloat(e.target.value),muted:parseFloat(e.target.value)===0})}/>

                    <div style={{marginTop:4}}>
                      <div className="lbl" style={{marginBottom:4}}>Trim (placeholder)</div>
                      <div style={{height:20,background:"#EFF0F2",borderRadius:4,position:"relative",overflow:"hidden"}}>
                        <div style={{position:"absolute",left:"10%",right:"20%",top:0,bottom:0,background:"rgba(0,122,85,.25)",borderLeft:"2px solid #111318",borderRight:"2px solid #111318",borderRadius:3}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:9,color:"#9AA0AE",fontFamily:"'JetBrains Mono',monospace"}}>
                        <span>0:00</span><span style={{color:T.ink}}>Selected range</span><span>0:15</span>
                      </div>
                    </div>
                  </>
                )}

                {selected.type==='image' && selected.mediaType!=='video' && !selected.locked && (
                  <>
                    <div className="lbl" style={{marginBottom:2}}>Scale — {(selected.scale||1).toFixed(2)}x</div>
                    <input type="range" className="s-slider" min={0.2} max={3} step={0.05} value={selected.scale||1}
                      onChange={e=>updateEl(selectedId,{scale:parseFloat(e.target.value)})}/>
                    <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px",width:"100%",marginTop:4}}
                      onClick={()=>imgFileRef.current?.click()}>Replace Image</button>
                  </>
                )}
              </div>
            ) : (
              <div className="inspector-group">
                <div className="inspector-group-title">Properties</div>
                <div style={{fontSize:12,color:"#9AA0AE",padding:"8px 0"}}>
                  {selectedId?"Background layer is locked.":"Click an element to edit it."}
                </div>
              </div>
            )}

            {/* AI Copilot */}
            {showCopilot && (
              <div className="inspector-group">
                <div className="inspector-group-title">AI Design Copilot</div>
                <div className="ai-copilot">
                  <div className="ai-copilot-title">
                    
                    <span>{aiLoading?"Analyzing…":"Layout Suggestions"}</span>
                    {!aiLoading&&<button style={{marginLeft:"auto",background:"transparent",border:"none",color:"#7C3AED",cursor:"pointer",fontSize:11,fontWeight:600,padding:0}} onClick={runAICopilot}>↻</button>}
                  </div>
                  {aiLoading&&<div style={{height:4,background:"#EDE9FE",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:"60%",background:"#7C3AED",borderRadius:99}}/></div>}
                  {aiTips.map((tip,i)=><div key={i} className="ai-suggestion"><b>{i+1}.</b> {tip}</div>)}
                </div>
              </div>
            )}

            {/* Template Gallery */}
            <div className="inspector-group">
              <div className="inspector-group-title">Templates</div>
              {templates.length > 0 && (
                <div className="tmpl-gallery">
                  {templates.map(tmpl => (
                    <div key={tmpl.id} className={"tmpl-card "+(defaultId===tmpl.id?"default-tmpl":"")}
                      onClick={()=>loadTemplate(tmpl)} title={tmpl.name}>
                      <div className="tmpl-card-preview">
                        {tmpl.elements.filter(e=>!e.locked&&e.type==='text').slice(0,3).map((el,i)=>(
                          <div key={i} className="tmpl-card-el" style={{
                            left:el.x*.22, top:el.y*.22,
                            fontSize:(el.fontSize||14)*.22,
                            color:el.color||'#fff',
                            fontFamily:`'${el.fontFamily||'Bricolage Grotesque'}',sans-serif`,
                            fontWeight:el.fontWeight||600,
                            letterSpacing:(el.letterSpacing||0)*.22,
                          }}>{el.content}</div>
                        ))}
                      </div>
                      <div className="tmpl-name">{tmpl.name}</div>
                      <button className={"tmpl-heart "+(defaultId===tmpl.id?"is-default":"")}
                        onClick={e=>{e.stopPropagation();setDefault(tmpl.id);}}
                        title={defaultId===tmpl.id?"Remove default":"Set as default"}>
                        {defaultId===tmpl.id?"Default":"Set default"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {showTmplSave ? (
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <input className="s-inp" style={{flex:1,fontSize:11.5}} value={tmplName} onChange={e=>setTmplName(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&saveTemplate()} placeholder="Template name…" autoFocus/>
                  <button className="btn btn-primary" style={{padding:"5px 10px",fontSize:11}} onClick={saveTemplate}>Save</button>
                  <button className="btn btn-ghost" style={{padding:"5px 8px",fontSize:11}} onClick={()=>setShowTmplSave(false)}>✕</button>
                </div>
              ) : (
                <button className="save-tmpl-btn" onClick={()=>setShowTmplSave(true)}>
                  + Save current as template
                </button>
              )}
            </div>

            {/* Layers */}
            <div className="inspector-group" style={{marginTop:"auto",borderTop:"1px solid #E5E7EB"}}>
              <div className="inspector-group-title">Layers</div>
              <div className="layers-stack">
                {layersRev.map(el=>(
                  <div key={el.id} className={"layer-item "+(selectedId===el.id?"active":"")} onClick={()=>setSelectedId(el.id)}>
                    <span className="layer-icon" style={{color:selectedId===el.id?"#111318":"#9AA0AE"}}>
                      {el.type==='text'?'T':el.locked?'⊞':el.mediaType==='video'?'▶':'img'}
                    </span>
                    <span className="layer-label">{el.type==='text'?el.content?.slice(0,22):el.locked?'Background':el.mediaType==='video'?'Video':'Image'}</span>
                    {!el.locked&&<button className="layer-del" onClick={e=>{e.stopPropagation();deleteEl(el.id);}}>✕</button>}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ── CANVAS AREA ── */}
          <div className="s-canvas-area">
            <div style={{fontSize:9,color:"#9AA0AE",fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.2,textTransform:"uppercase",alignSelf:"flex-start"}}>
              1080 × 1920 · 9:16 · Preview
            </div>
            <div className="canvas-wrap">
              <div className="canvas" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedId(null);}}>
                {elements.filter(e=>e.locked).map(el=>(
                  <CanvasElement key={el.id} data={el} isSelected={selectedId===el.id}
                    onSelect={()=>setSelectedId(el.id)} onUpdate={p=>updateEl(el.id,p)} onDelete={()=>deleteEl(el.id)}/>
                ))}
                <div className="canvas-ov" style={{background:"linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0) 45%,rgba(0,0,0,0.28) 100%)"}}/>
                {elements.filter(e=>!e.locked).map(el=>(
                  <CanvasElement key={el.id} data={el} isSelected={selectedId===el.id}
                    onSelect={()=>setSelectedId(el.id)} onUpdate={p=>updateEl(el.id,p)} onDelete={()=>deleteEl(el.id)}/>
                ))}
                <div style={{position:"absolute",bottom:14,right:14,fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:"rgba(255,255,255,0.2)",letterSpacing:2.5,textTransform:"uppercase",pointerEvents:"none",zIndex:50}}>R&F</div>
              </div>
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}

// ─── YEARLY KPI SUMMARY ──────────────────────────────────────────
function YearlyKPISummary({ rows, year }) {
  const yr = rows.filter(r => r.scheduledAt && new Date(r.scheduledAt).getFullYear() === year);
  const total     = yr.length;
  const posted    = yr.filter(r => r.status==='posted').length;
  const scheduled = yr.filter(r => r.status==='scheduled'||r.status==='approved').length;
  const igCount   = yr.filter(r => r.platform.startsWith('ig')).length;
  const liCount   = yr.filter(r => r.platform==='linkedin').length;
  const pct = (v) => total > 0 ? Math.round((v/total)*100) : 0;

  const stats = [
    { val:total,     label:"Yearly Total",      color:T.text,   fill:100 },
    { val:posted,    label:"Successfully Posted",color:T.ink,   fill:pct(posted) },
    { val:scheduled, label:"Approved / Sched",  color:T.blue,   fill:pct(scheduled) },
    { val:igCount,   label:"Instagram",          color:T.pink,   fill:pct(igCount) },
    { val:liCount,   label:"LinkedIn",           color:T.blue,   fill:pct(liCount) },
  ];

  return (
    <div className="year-kpi">
      {stats.map((s,i) => (
        <div key={i} className="year-kpi-item">
          <div className="year-kpi-val" style={{color:s.color}}>{s.val}</div>
          <div className="year-kpi-label">{s.label}</div>
          <div className="year-kpi-bar">
            <div className="year-kpi-bar-fill" style={{width:`${s.fill}%`,background:s.color}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MONTH MINI-MAP ───────────────────────────────────────────────
const MONTH_INITIALS = ['J','F','M','A','M','J','J','A','S','O','N','D'];

function MonthMiniMap({ rows, year, currentMonth, onJump }) {
  const counts = MONTH_INITIALS.map((_, i) =>
    rows.filter(r => {
      if (!r.scheduledAt) return false;
      const d = new Date(r.scheduledAt);
      return d.getFullYear()===year && d.getMonth()===i;
    }).length
  );
  return (
    <div className="minimap">
      {MONTH_INITIALS.map((init, i) => (
        <div key={i}
          className={`minimap-item ${counts[i]>0?'has-posts':''} ${currentMonth===i?'current-month':''}`}
          onClick={() => onJump(i)}
          title={MONTHS_FULL[i] + ' — ' + counts[i] + ' posts'}
        >
          {init}
        </div>
      ))}
    </div>
  );
}

// ─── ANALYTICS ───────────────────────────────────────────────────
function Analytics({ rows }) {
  const maxBar = Math.max(...MOCK_ANALYTICS.posts.map(p=>p.ig+p.li));
  const maxReach = Math.max(...MOCK_ANALYTICS.posts.map(p=>p.reach));
  const maxTime = Math.max(...MOCK_ANALYTICS.topTimes.map(t=>t.score));
  return (
    <div className="analytics-area">
      <div className="analytics-grid">
        <div className="an-card"><div className="an-title">Avg Reach / Post</div><div className="an-big" style={{color:T.mint}}>2,840</div><div className="an-sub">↑ 18% vs last month</div></div>
        <div className="an-card"><div className="an-title">Avg Engagement</div><div className="an-big" style={{color:T.orange}}>4.8%</div><div className="an-sub">IG Stories leading at 7.8%</div></div>
        <div className="an-card"><div className="an-title">Posts Published</div><div className="an-big" style={{color:T.blue}}>{rows.filter(r=>r.status==="posted").length||12}</div><div className="an-sub">Across IG + LinkedIn</div></div>
        <div className="an-card wide">
          <div className="an-title">Post Volume — Last 6 Months</div>
          <div className="chart-bars">{MOCK_ANALYTICS.posts.map((p,i)=>(
            <div key={i} className="chart-bar-wrap">
              <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:1,flex:1,width:"100%"}}>
                <div className="chart-bar" style={{height:`${(p.li/maxBar)*100}%`,background:T.blue,minHeight:3}}/>
                <div className="chart-bar" style={{height:`${(p.ig/maxBar)*100}%`,background:T.pink,minHeight:3}}/>
              </div>
              <div className="chart-bar-label">{p.label}</div>
            </div>
          ))}</div>
          <div style={{display:"flex",gap:14,marginTop:10}}>{[{c:T.pink,l:"Instagram"},{c:T.blue,l:"LinkedIn"}].map(x=><div key={x.l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:T.textSub}}><div style={{width:8,height:8,borderRadius:2,background:x.c}}/>{x.l}</div>)}</div>
        </div>
        <div className="an-card"><div className="an-title">Best Times to Post (PT)</div>{MOCK_ANALYTICS.topTimes.map(t=><div key={t.time} className="bar-row"><span className="bar-label">{t.time}</span><div className="bar-track"><div className="bar-fill" style={{width:`${t.score}%`,background:t.score===maxTime?T.mint:T.border2}}/></div><span className="bar-val">{t.score}</span></div>)}</div>
        <div className="an-card">
          <div className="an-title">Engagement by Platform</div>
          {Object.entries(MOCK_ANALYTICS.engagement).map(([k,v])=>{const p=PLATFORMS[k];return(<div key={k} className="bar-row"><span className="bar-label">{p.short}</span><div className="bar-track"><div className="bar-fill" style={{width:`${(v/10)*100}%`,background:p.color}}/></div><span className="bar-val">{v}%</span></div>);})}
          <div style={{height:10}}/><div className="an-title">Reach by Platform</div>
          {Object.entries(MOCK_ANALYTICS.reach).map(([k,v])=>{const p=PLATFORMS[k];return(<div key={k} className="bar-row"><span className="bar-label">{p.short}</span><div className="bar-track"><div className="bar-fill" style={{width:`${(v/3000)*100}%`,background:p.color}}/></div><span className="bar-val" style={{fontSize:10}}>{v}</span></div>);})}
        </div>
        <div className="an-card wide"><div className="an-title">Reach Trend</div><div className="chart-bars" style={{height:72}}>{MOCK_ANALYTICS.posts.map((p,i)=><div key={i} className="chart-bar-wrap"><div className="chart-bar" style={{height:`${(p.reach/maxReach)*100}%`,background:`linear-gradient(to top,${T.mint}44,${T.mint})`,minHeight:4}}/><div className="chart-bar-label">{p.label}</div></div>)}</div></div>
        <div className="an-card full"><div className="an-title">Recent Post Performance</div>{rows.slice(0,5).map(r=>{const p=PLATFORMS[r.platform];const eng=(Math.random()*6+1).toFixed(1);return(<div key={r.id} className="perf-row"><span className="perf-note">{r.note||"Untitled"}</span><span className="perf-plat" style={{background:p.bg,color:p.color}}>{p.short}</span><span className="perf-reach">{Math.floor(Math.random()*2000+500).toLocaleString()}</span><span className="perf-eng" style={{color:parseFloat(eng)>4?T.mint:T.textSub}}>{eng}%</span></div>);})}</div>
      </div>
    </div>
  );
}

// ─── CALENDAR VIEW ────────────────────────────────────────────────
function CalendarView({ rows, month: initMonth, year: initYear, onCompose, onStory, onAddDay, onEdit }) {
  const [calMonth, setCalMonth] = useState(initMonth);
  const [calYear,  setCalYear]  = useState(initYear);
  const [editRow,  setEditRow]  = useState(null); // row being edited in popup

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
    return parseInt(new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",day:"numeric"}).format(d));
  };

  const cells = [];
  // Prefix: last days of prev month
  const prevDays = new Date(calYear, calMonth, 0).getDate();
  for(let i=0;i<firstDay;i++) cells.push({ d: prevDays - firstDay + 1 + i, type:'prev' });
  // Current month
  for(let d=1;d<=days;d++) cells.push({ d, type:'curr' });
  // Suffix: first days of next month to fill to 42 cells (6 rows)
  const total = Math.ceil((firstDay + days) / 7) * 7;
  for(let d=1; cells.length < total; d++) cells.push({ d, type:'next' });

  return (
    <div className="cal-area">
      {/* Month nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,padding:"0 2px"}}>
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <span style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontWeight:700,fontSize:15,letterSpacing:"-.3px",color:T.text}}>
          {MONTHS_FULL[calMonth]} {calYear}
        </span>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>
      <div className="cal-header">{WEEKDAYS.map(w=><div key={w} className="cal-wd">{w}</div>)}</div>
      <div className="cal-grid">
        {cells.map((cell,i)=>{
          const { d, type } = cell;
          const isCurr = type==='curr';
          const isOther = type==='prev' || type==='next';
          return (
          <div key={i} className={`cal-cell ${isOther?"other":""} ${isCurr&&isToday(d)?"today":""}`}>
            <div className="cal-dn" style={{color: isOther ? '#C9CDD5' : undefined}}>{d}</div>
            {isCurr && <>
              <div className="cal-posts">
                {rows.filter(r=>rowDay(r)===d).map(r=>{
                  const p=PLATFORMS[r.platform];
                  return (
                    <div key={r.id} className="cal-post" style={{background:p.bg,color:p.color}}
                      onClick={e=>{e.stopPropagation();setEditRow(r);}}>
                      <span style={{width:4,height:4,borderRadius:"50%",background:p.color,flexShrink:0,display:"inline-block"}}/>
                      {r.note||p.short}
                    </div>
                  );
                })}
              </div>
              <div className="cal-add"><button className="cal-add-btn" onClick={()=>onAddDay(d)}>+ Add</button></div>
            </>}
          </div>
          );
        })}
      </div>

      {/* Edit popup */}
      {editRow && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setEditRow(null)}>
          <div style={{background:"#fff",borderRadius:14,width:480,maxWidth:"92vw",boxShadow:"0 24px 80px rgba(0,0,0,0.18)",overflow:"hidden"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{padding:"16px 20px 14px",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontWeight:700,fontSize:15,letterSpacing:"-.2px",color:T.text}}>{editRow.note||"Untitled post"}</div>
                <div style={{fontSize:11,color:"#9AA0AE",fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{PLATFORMS[editRow.platform]?.label} · {STATUSES[editRow.status]?.label}</div>
              </div>
              <button onClick={()=>setEditRow(null)} style={{background:"transparent",border:"none",fontSize:18,cursor:"pointer",color:"#9AA0AE",padding:"2px 6px"}}>×</button>
            </div>
            <div style={{padding:"16px 20px 20px",display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <div style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:"#9AA0AE",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Caption</div>
                <textarea style={{width:"100%",background:"#F9FAFB",border:"1px solid #E5E7EB",borderRadius:7,color:"#0D0F12",fontSize:13,padding:"9px 11px",outline:"none",resize:"none",minHeight:90,lineHeight:1.55}}
                  value={editRow.caption||""} placeholder="Write caption…"
                  onChange={e=>setEditRow(r=>({...r,caption:e.target.value}))}/>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {Object.entries(PLATFORMS).map(([k,pl])=>(
                  <button key={k} onClick={()=>setEditRow(r=>({...r,platform:k}))}
                    style={{padding:"5px 11px",borderRadius:99,fontSize:11,fontWeight:600,cursor:"pointer",
                      border:"1.5px solid",borderColor:editRow.platform===k?pl.color:"#E5E7EB",
                      background:editRow.platform===k?pl.bg:"transparent",color:editRow.platform===k?pl.color:"#9AA0AE"}}>
                    {pl.label}
                  </button>
                ))}
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",paddingTop:4,borderTop:"1px solid #E5E7EB"}}>
                <button style={{background:"transparent",border:"1px solid #E5E7EB",borderRadius:6,padding:"6px 13px",fontSize:12,fontWeight:600,cursor:"pointer",color:"#D93025"}}
                  onClick={()=>setEditRow(null)}>Cancel</button>
                <div style={{display:"flex",gap:8}}>
                  {editRow.platform==="ig_story"&&<button style={{background:"#080A0E",border:"none",borderRadius:6,padding:"6px 13px",fontSize:12,fontWeight:600,cursor:"pointer",color:T.ink}}
                    onClick={()=>{onStory(editRow);setEditRow(null);}}>Open Designer</button>}
                  <button style={{background:"#111318",border:"none",borderRadius:6,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",color:"#fff"}}
                    onClick={()=>{onEdit(editRow);setEditRow(null);}}>Save & Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ASSET LIBRARY ────────────────────────────────────────────────
function AssetLibrary({ onClose, onSelect }) {
  const [assets, setAssets] = useState([
    {id:uid(),name:"RF Logo White",emoji:"RF",url:null},
    {id:uid(),name:"Mint BG Texture",emoji:"BG",url:null},
    {id:uid(),name:"Studio B-Roll",emoji:"vid",url:null},
    {id:uid(),name:"Team Photo",emoji:"CAM",url:null},
  ]);
  const fRef = useRef(null);
  const upload = (files) => Array.from(files).forEach(f=>{const url=f.type.startsWith("image/")?URL.createObjectURL(f):null;setAssets(a=>[...a,{id:uid(),name:f.name,type:f.type.startsWith("image/")?"image":"video",url,emoji:f.type.startsWith("image/")?"img":"vid"}]);});
  return (
    <div className="asset-drawer">
      <div className="asset-head"><div className="asset-title">Asset Library</div><button className="m-x" onClick={onClose}>×</button></div>
      <div className="asset-body">
        <div className="asset-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files);}} onClick={()=>fRef.current?.click()}>
          <input ref={fRef} type="file" accept="image/*,video/*,image/gif" multiple style={{display:"none"}} onChange={e=>upload(e.target.files)}/>
          <div style={{fontSize:20,opacity:0.4,marginBottom:6}}>↑</div><div style={{fontSize:12,color:T.textSub}}>Upload brand assets</div>
          <div style={{fontSize:10,color:T.textDim,marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>Images · Videos · GIFs</div>
        </div>
        <span className="s-lbl" style={{marginTop:4,display:"block"}}>Brand Assets</span>
        <div className="asset-grid">
          {assets.map(a=><div key={a.id} className="asset-item" onClick={()=>onSelect?.(a)} title={a.name}>{a.url?<img src={a.url} className="asset-thumb" alt={a.name}/>:<div className="asset-empty-thumb">{a.emoji}</div>}<div className="asset-name">{a.name}</div></div>)}
        </div>
      </div>
    </div>
  );
}

// ─── ROW ─────────────────────────────────────────────────────────
function StageAIWriter({ platform, note, caption, onAccept }) {
  const [prompt, setPrompt] = useState(caption || note || "");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setResult("");
    const tone = platform === "linkedin"
      ? "professional, thought-leader tone. No emojis. Under 1200 chars."
      : "bold, studio-confident. Relevant hashtags. Under 300 chars.";
    const sys = `You are a copywriter for Ranger & Fox, a premium motion graphics studio. Brand voice: confident, creative — "sexy indifference". Write in ${tone} Output only the caption, nothing else.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:800, system:sys,
          messages:[{role:"user",content:`Caption for: ${prompt}`}] }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      let i = 0;
      const iv = setInterval(() => {
        i += 4; setResult(text.slice(0,i));
        if (i >= text.length) { setResult(text); clearInterval(iv); setLoading(false); }
      }, 16);
    } catch(e) { setResult("Couldn't reach AI."); setLoading(false); }
  };

  return (
    <div className="stage-ai">
      <div className="stage-ai-header">
        <div className="stage-ai-title"><span>AI Caption</span></div>
        <button style={{background:"transparent",border:"none",color:T.textSub,fontSize:11,fontWeight:700,cursor:"pointer",padding:0}}
          onClick={generate} disabled={loading}>{loading ? "Writing…" : "Generate"}</button>
      </div>
      <input style={{background:"#fff",border:"1px solid #EEF2FF",borderRadius:6,fontSize:12,padding:"6px 9px",outline:"none",color:"#0D0F12",width:"100%"}}
        value={prompt} onChange={e=>setPrompt(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&generate()} placeholder="Describe the post…"/>
      {(result||loading) && (
        <div className={`stage-ai-result ${loading&&!result?"stage-ai-typing":""}`}>{result||" "}</div>
      )}
      {result && !loading && (
        <button style={{background:T.s3,border:"1px solid "+T.border2,borderRadius:5,padding:"4px 10px",fontSize:11,fontWeight:700,color:T.textSub,cursor:"pointer",alignSelf:"flex-end"}}
          onClick={() => onAccept(result)}>Use this ↑</button>
      )}
    </div>
  );
}

function Row({ row, sel, onSel, onChange, onDel, onCompose, onStory, onPostNow, dragHandlers, showComments, onToggleComments, onAddComment, currentUser }) {
  const p = PLATFORMS[row.platform], s = STATUSES[row.status];
  const nextP = () => { const ks=Object.keys(PLATFORMS); onChange({platform:ks[(ks.indexOf(row.platform)+1)%ks.length]}); };
  const nextS = () => onChange({status:s.next});
  const nextAssignee = () => {
    const all=[{id:null},...TEAM]; const cur=all.findIndex(t=>t.id===row.assignee);
    onChange({assignee:all[(cur+1)%all.length].id});
  };
  const assignee = row.assignee ? TEAM.find(t=>t.id===row.assignee) : null;
  const [commentText, setCommentText] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [mediaFile,  setMediaFile]  = useState(null);
  const [mediaUrl,   setMediaUrl]   = useState(null);
  const [storyElements, setStoryElements] = useState([
    { id:"bg",  type:"image", url:null, x:0, y:0, scale:1, locked:true, mediaType:'image' },
    { id:"rf1", type:"text",  content:"RANGER & FOX", x:20, y:22,  fontSize:8.5, fontFamily:"JetBrains Mono",     color:T.ink, letterSpacing:3,    fontWeight:600, shadow:false },
    { id:"rf2", type:"text",  content:row.note||"Headline",          x:20, y:155, fontSize:24, fontFamily:"Bricolage Grotesque", color:"#FFFFFF", letterSpacing:-0.5, fontWeight:700, shadow:true  },
    { id:"rf3", type:"text",  content:"Supporting detail",            x:20, y:205, fontSize:12, fontFamily:"Bricolage Grotesque", color:"rgba(255,255,255,0.6)", letterSpacing:0, fontWeight:400, shadow:false },
  ]);
  const mediaRef = useRef(null);

  const submitComment = () => { if(!commentText.trim()) return; onAddComment({id:uid(),author:currentUser,text:commentText,ts:"just now"}); setCommentText(""); };
  const max    = row.platform==="linkedin"?3000:2200;
  const capLen = (row.caption||"").length;
  const over   = capLen>max, warn = capLen>max*0.88;

  const handleMedia = (f) => {
    if (!f) return;
    setMediaFile(f);
    if (f.type.startsWith("image/") || f.type.startsWith("video/")) {
      setMediaUrl(URL.createObjectURL(f));
    }
  };

  // Readiness checks
  const checks = [
    { label:"Caption",      pass: capLen>0 && !over,      warn: warn, msg: over?"Over limit":capLen===0?"Missing":warn?"Near limit":"OK" },
    { label:"Media",        pass: !!mediaUrl,              warn: false, msg: mediaUrl?"Attached":"Optional" },
    { label:"Scheduled",    pass: !!row.scheduledAt,       warn: false, msg: row.scheduledAt?"Set":"Not set" },
    { label:"Assignee",     pass: !!row.assignee,          warn: false, msg: row.assignee?TEAM.find(t=>t.id===row.assignee)?.name:"Unassigned" },
    { label:"Status",       pass: row.status==="approved"||row.status==="scheduled", warn: row.status==="needs_review", msg: STATUSES[row.status]?.label },
  ];

  return (
    <div className={"row-container " + (isExpanded?"is-open":"")}>
      <div className={`t-row ${sel?"sel":""} ${dragHandlers.isDragging?"dragging":""} ${dragHandlers.isDragOver?"drag-over":""}`}
        draggable onDragStart={dragHandlers.onDragStart} onDragOver={dragHandlers.onDragOver}
        onDrop={dragHandlers.onDrop} onDragEnd={dragHandlers.onDragEnd}>
        <div style={{display:"flex",alignItems:"center"}}><input type="checkbox" className="cb" checked={sel} onChange={e=>onSel(e.target.checked)}/></div>
        <div className="drag-handle" style={{letterSpacing:"-1px",fontSize:"10px",opacity:0.4}}>· ·<br/>· ·</div>

        <DateTimeCell isoValue={row.scheduledAt} onChange={v=>onChange({scheduledAt:v})}/>

        <div style={{minWidth:0}}><input className="note-in" value={row.note} placeholder="Post title…" onChange={e=>onChange({note:e.target.value})} title={row.note}/></div>

        <div><button className="plat-pill" style={{background:p.bg,color:p.color}} onClick={nextP}><span className="pill-dot" style={{background:p.color}}/>{p.short}</button></div>
        <div><button className="status-pill" onClick={nextS} title={`Next: ${STATUSES[s.next]?.label}`}><span className="s-dot" style={{background:s.dot}}/>{s.label}</button></div>

        <div>
          <button className="assignee-pill" onClick={nextAssignee} style={{color:T.textDim,fontStyle:"italic"}}>
            {assignee ? <><div className="av" style={{width:18,height:18,background:assignee.color+"22",color:assignee.color,fontSize:8,borderRadius:4}}>{assignee.initials}</div><span style={{fontSize:11}}>{assignee.name.split(" ")[0]}</span></> : <span style={{fontSize:11,color:T.textDim}}>Assign</span>}
          </button>
        </div>

        <div className="ra">
          {row.comments?.length > 0 && (
            <span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:T.purple,fontWeight:700,padding:"2px 6px",background:T.s3,borderRadius:10,border:"1px solid "+T.border,color:T.textDim,fontSize:9.5}}>{row.comments.length}</span>
          )}
          <button className={"expand-toggle "+(isExpanded?"open":"")}
            onClick={e=>{e.stopPropagation();setIsExpanded(v=>!v);}}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{transition:"transform 0.22s ease",transform:isExpanded?"rotate(180deg)":"rotate(0deg)"}}>
              <path d="M1.5 3.5L5.5 7.5L9.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>{isExpanded ? "Close" : "Open"}</span>
          </button>
          <button className="ib d" title="Delete" onClick={onDel}>✕</button>
        </div>
      </div>

      {/* ── STAGE WELL ── */}
      <div className={"stage-reveal-wrapper "+(isExpanded?"open":"")}>
        <div className="stage-content-well">

          {/* COL 1 — Visual Asset */}
          <div className="stage-col stage-col-media">
            <div className="stage-col-label">Platform & Media</div>
            {/* Platform switcher */}
            <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
              {Object.entries(PLATFORMS).map(([k,pl])=>(
                <button key={k}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:7,border:"1.5px solid",
                    borderColor:row.platform===k?pl.color+"55":"#E5E7EB",
                    background:row.platform===k?pl.bg:"transparent",
                    color:row.platform===k?pl.color:"#9AA0AE",
                    cursor:"pointer",fontSize:12,fontWeight:600,transition:"all .1s",textAlign:"left"}}
                  onClick={()=>onChange({platform:k})}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:pl.color,flexShrink:0}}/>
                  {pl.label}
                </button>
              ))}
            </div>
            <div className="stage-col-label">Media</div>
            {row.platform==="ig_story" ? (
              <StoryThumbnail elements={storyElements} onClick={onStory}/>
            ) : (
              <div>
                {mediaUrl ? (
                  <div style={{position:"relative",borderRadius:8,overflow:"hidden",border:"1px solid #E5E7EB"}}>
                    <img src={mediaUrl} alt="" style={{width:"100%",display:"block",maxHeight:140,objectFit:"cover"}}/>
                    <button style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.5)",border:"none",borderRadius:5,color:"#fff",padding:"3px 7px",fontSize:11,cursor:"pointer"}} onClick={()=>{setMediaFile(null);setMediaUrl(null);}}>✕</button>
                  </div>
                ) : (
                  <>
                    <input ref={mediaRef} type="file" accept="image/*,video/*,image/gif" style={{display:"none"}}
                      onChange={e=>{const f=e.target.files?.[0]; if(f){setMediaFile(f);const isImg=f.type.startsWith("image/");const isVid=f.type.startsWith("video/");if(isImg||isVid)setMediaUrl(URL.createObjectURL(f));} e.target.value="";}}/>
                    <div className="stage-post-placeholder" onClick={()=>mediaRef.current?.click()}>
                      <span style={{fontSize:22,opacity:0.22}}>↑</span>
                      <span style={{fontSize:11.5,color:"#9AA0AE",fontWeight:500}}>Attach media</span>
                      <span style={{fontSize:10,color:"#D1D5DB",fontFamily:"'JetBrains Mono',monospace"}}>JPG · PNG · GIF · MP4</span>
                    </div>
                  </>
                )}
              </div>
            )}
            <button className="btn btn-primary" style={{fontSize:12,padding:"7px 12px",width:"100%",marginTop:"auto"}}
              onClick={() => { onPostNow(); setIsExpanded(false); }}>
              Post Now
            </button>
          </div>

          {/* COL 2 — Writing + AI */}
          <div className="stage-col stage-col-write">
            <div className="stage-col-label">Caption — {p.label}</div>
            <textarea className="stage-txa"
              value={row.caption||""}
              placeholder={`Write your ${p.label} caption… type naturally`}
              onChange={e=>onChange({caption:e.target.value})}
              rows={5}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:-6}}>
              <span className={`stage-char ${over?"over":warn?"warn":""}`}>{capLen} / {max}</span>
            </div>
            <StageAIWriter platform={row.platform} note={row.note} caption={row.caption}
              onAccept={t=>onChange({caption:t})}/>
          </div>

          {/* COL 3 — Governance */}
          <div className="stage-col stage-col-gov">
            <div className="stage-col-label">Post Readiness</div>
            <div className="readiness-list">
              {checks.map(c=>(
                <div key={c.label} className="readiness-item">
                  <span className="readiness-icon">{c.pass?"✓":c.warn?"!":"–"}</span>
                  <span className="readiness-label">{c.label}</span>
                  <span className={"readiness-ok "+(c.pass?"pass":c.warn?"warn":"fail")}>{c.msg}</span>
                </div>
              ))}
            </div>

            <div style={{marginTop:4}}>
              <div className="stage-col-label" style={{marginBottom:6}}>Quick Status</div>
              <div className="quick-status">
                {Object.entries(STATUSES).map(([k,st])=>(
                  <button key={k} className={"qs-btn "+(row.status===k?"active":"")}
                    style={row.status===k?{color:st.dot,borderColor:st.dot,background:st.dot+"11"}:{}}
                    onClick={()=>onChange({status:k})}>
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comments inline */}
            <div style={{marginTop:6}}>
              <div className="stage-col-label" style={{marginBottom:6}}>Comments {row.comments?.length>0&&`(${row.comments.length})`}</div>
              {(row.comments||[]).slice(-2).map(c=>{
                const m=TEAM.find(t=>t.id===c.author)||{initials:"?",color:T.textDim,name:"Unknown"};
                return (
                  <div key={c.id} style={{display:"flex",gap:7,alignItems:"flex-start",marginBottom:6}}>
                    <div style={{width:20,height:20,borderRadius:5,background:m.color+"22",color:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8.5,fontWeight:700,flexShrink:0}}>{m.initials}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10.5,fontWeight:700,color:T.text,marginBottom:1}}>{m.name} <span style={{color:T.textDim,fontWeight:400,fontFamily:"'JetBrains Mono',monospace",fontSize:9}}>{c.ts}</span></div>
                      <div style={{fontSize:11.5,color:T.textSub,lineHeight:1.4}}>{c.text}</div>
                    </div>
                  </div>
                );
              })}
              <div style={{display:"flex",gap:6,marginTop:4}}>
                <input className="comment-input" style={{fontSize:11.5,padding:"5px 9px"}} placeholder="Comment…" value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitComment()}/>
                <button className="btn btn-ghost" style={{padding:"4px 10px",fontSize:11,flexShrink:0}} onClick={submitComment}>Send</button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Comment thread (legacy — only shown when opened from comment button) */}
      {showComments && (
        <div className="thread" style={{gridColumn:"1/-1"}}>
          {(row.comments||[]).length===0&&<div style={{fontSize:12,color:T.textDim}}>No comments yet</div>}
          {(row.comments||[]).map(c=>{const m=TEAM.find(t=>t.id===c.author)||{initials:"?",color:T.textDim,name:"Unknown"};return(
            <div key={c.id} className="comment">
              <div className="comment-av" style={{background:m.color+"22",color:m.color}}>{m.initials}</div>
              <div><div className="comment-meta"><span className="comment-name">{m.name}</span><span className="comment-ts">{c.ts}</span></div><div className="comment-text">{c.text}</div></div>
            </div>
          );})}
          <div className="comment-input-row">
            <input className="comment-input" placeholder="Add a comment…" value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitComment()}/>
            <button className="btn btn-ghost" style={{padding:"5px 12px",fontSize:12}} onClick={submitComment}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── TOAST ───────────────────────────────────────────────────────
function Toast({ msg, color, onDone }) {
  useEffect(()=>{const t=setTimeout(onDone,3200);return()=>clearTimeout(t);},[]);
  return <div className="toast"><div className="t-dot" style={{background:color||T.mint}}/>{msg}</div>;
}

// ─── APP ─────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const [month, setMonth]         = useState(now.getMonth());
  const [year]                    = useState(now.getFullYear());
  const [rows, setRows]           = useState(SEED());
  const [sel, setSel]             = useState(new Set());
  const [view, setView]           = useState("list");
  const [timeScale, setTimeScale] = useState("month"); // "month" | "year"
  const [composer, setComposer]   = useState(null);
  const [story, setStory]         = useState(null);
  const [showAssets, setAssets]   = useState(false);
  const [openComments, setOC]     = useState(new Set());
  const [toast, setToast]         = useState(null);
  const dragIdx = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const monthRefs = useRef({});
  const currentUser = "stephen";

  const showToast = (msg, color) => setToast({msg, color, id:uid()});

  const allSorted = [...rows].sort((a,b) => {
    const da = a.scheduledAt ? new Date(a.scheduledAt) : new Date(0);
    const db = b.scheduledAt ? new Date(b.scheduledAt) : new Date(0);
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

  const add = (targetMonth=month, day=1) => {
    const iso = makeISO(day, 9, 0, targetMonth);
    setRows(r=>[...r,{id:uid(),scheduledAt:iso,note:"",caption:"",platform:"ig_post",status:"idea",assignee:null,comments:[],order:r.length}]);
  };
  const update    = (id,p)  => setRows(r=>r.map(x=>x.id===id?{...x,...p}:x));
  const remove    = (id)    => { setRows(r=>r.filter(x=>x.id!==id)); setSel(s=>{const n=new Set(s);n.delete(id);return n;}); };
  const toggleSel = (id,v)  => setSel(s=>{const n=new Set(s);v?n.add(id):n.delete(id);return n;});
  const toggleAll = (v)     => setSel(v?new Set(sorted.map(r=>r.id)):new Set());
  const bulkDel   = ()      => { const c=sel.size; setRows(r=>r.filter(x=>!sel.has(x.id))); setSel(new Set()); showToast(`${c} post${c>1?"s":""} removed`,T.red); };
  const toggleOC  = (id)    => setOC(s=>{const n=new Set(s);s.has(id)?n.delete(id):n.add(id);return n;});
  const addComment= (rowId,c) => update(rowId,{comments:[...(rows.find(r=>r.id===rowId)?.comments||[]),c]});

  const jumpToMonth = (mi) => {
    if (timeScale === "year") {
      const el = monthRefs.current[mi];
      if (el) el.scrollIntoView({ behavior:"smooth", block:"start" });
    } else {
      setMonth(mi);
    }
  };

  const makeDrag = (row,idx) => ({
    isDragging: draggingId===row.id,
    isDragOver: dragOverId===row.id,
    onDragStart:(e)=>{dragIdx.current=idx;setDraggingId(row.id);e.dataTransfer.effectAllowed="move";},
    onDragOver:(e)=>{e.preventDefault();if(dragOverId!==row.id)setDragOverId(row.id);},
    onDrop:(e)=>{e.preventDefault();const from=dragIdx.current;if(from===null||from===idx)return;setRows(r=>{const s=[...r].sort((a,b)=>new Date(a.scheduledAt)-new Date(b.scheduledAt));const[m]=s.splice(from,1);s.splice(idx,0,m);return s;});setDragOverId(null);dragIdx.current=null;},
    onDragEnd:()=>{setDraggingId(null);setDragOverId(null);dragIdx.current=null;},
  });

  const renderRow = (row, idx) => (
    <Row key={row.id} row={row} sel={sel.has(row.id)} currentUser={currentUser}
      onSel={v=>toggleSel(row.id,v)}
      onChange={p=>update(row.id,p)}
      onDel={()=>{remove(row.id);showToast("Post removed",T.red);}}
      onCompose={()=>setComposer({row,postNow:false})}
      onStory={()=>setStory(row)}
      onPostNow={()=>setComposer({row,postNow:true})}
      dragHandlers={makeDrag(row,idx)}
      showComments={openComments.has(row.id)}
      onToggleComments={()=>toggleOC(row.id)}
      onAddComment={c=>addComment(row.id,c)}
    />
  );

  const igC    = rows.filter(r=>r.platform!=="linkedin").length;
  const liC    = rows.filter(r=>r.platform==="linkedin").length;
  const readyC = rows.filter(r=>r.status==="approved"||r.status==="scheduled").length;
  const reviewC= rows.filter(r=>r.status==="needs_review").length;

  // Month sparkline data (post counts per month, scaled)
  const monthCounts = MONTHS_FULL.map((_, mi) =>
    allSorted.filter(r => r.scheduledAt && new Date(r.scheduledAt).getMonth()===mi && new Date(r.scheduledAt).getFullYear()===year).length
  );
  const maxMonthCount = Math.max(...monthCounts, 1);

  return (
    <div className="app">
      <style>{G}</style>

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
          {[{label:"Instagram",on:true},{label:"LinkedIn",on:false}].map(c=>(
            <div key={c.label} className="conn-row">
              <div className={"conn-dot "+(c.on?"on":"off")}/><span className="conn-name">{c.label}</span>
              <span className={"conn-st "+(c.on?"on":"off")}>{c.on?"Live":"Setup"}</span>
            </div>
          ))}
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
          <div className="view-toggle">
            {[["list","List"],["calendar","Cal"],["analytics","Stats"]].map(([v,l])=>(
              <button key={v} className={"vt-btn "+(view===v?"on":"")} onClick={()=>setView(v)}>{l}</button>
            ))}
          </div>
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setAssets(v=>!v)}>
            {showAssets?"Assets ✕":"Assets"}
          </button>
          <button className="btn btn-ghost" onClick={()=>add(month)}>+ Add</button>
          <button className="btn btn-primary">Connect LinkedIn →</button>
        </div>

        {/* STATS — YTD in year view, monthly in month view */}
        {view==="list" && timeScale==="year"
          ? <YearlyKPISummary rows={rows} year={year}/>
          : (
            <div className="stats">
              {[
                {val:sorted.length, key:"Total posts"},
                {val:igC,           key:"Instagram"},
                {val:liC,           key:"LinkedIn"},
                {val:reviewC,       key:"Needs review"},
                {val:readyC,        key:"Approved / sched"},
              ].map((s,i)=>(
                <div key={i} className="stat">
                  <div className="stat-val">{s.val}</div>
                  <div className="stat-key">{s.key}</div>
                </div>
              ))}
            </div>
          )
        }

        {/* LIST VIEW */}
        {view==="list"&&(
          <div className="t-area">
            <div className="t-head">
              <div className="th"><input type="checkbox" className="cb" checked={sel.size===sorted.length&&sorted.length>0} onChange={e=>toggleAll(e.target.checked)}/></div>
              <div className="th"/>
              <div className="th">Date / Time PT</div>
              <div className="th">Title</div>
              <div className="th">Platform</div>
              <div className="th">Status</div>
              <div className="th">Assignee</div>
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

        {view==="calendar"&&<CalendarView rows={rows} month={month} year={year}
          onCompose={r=>setComposer({row:r,postNow:false})} onStory={r=>setStory(r)}
          onEdit={r=>update(r.id,{caption:r.caption,platform:r.platform})}
          onAddDay={d=>{add(month,d);showToast(`Added post for ${MONTHS_FULL[month]} ${d}`,T.mint);}}/>}

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
      {story&&<StoryDesigner row={story} onClose={()=>setStory(null)}/>}
      {toast&&<Toast key={toast.id} msg={toast.msg} color={toast.color} onDone={()=>setToast(null)}/>}
    </div>
  );
}
