import React, { useState, useRef, useEffect, useCallback } from "react";

import { SaveStatusBadge } from "../../components/SaveStatusBadge.jsx";
import {
  disconnectInstagram,
  exchangeInstagramCode,
  fetchInstagramFeed,
  generateCaption,
  generateStoryTips,
  getInstagramAuthorizeUrl,
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
  makeISO,
  makeDefaultElements,
  MENTIONS,
  MOCK_ANALYTICS,
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
  WEEKDAYS,
} from "./shared.js";

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
.t-head{display:grid;grid-template-columns:32px 20px 100px minmax(180px,1fr) 96px 116px 148px 114px 48px;padding:0 32px 0 20px;height:36px;border-bottom:1px solid ${T.border};background:${T.surface};position:sticky;top:0;z-index:10;align-items:center}
.th{font-family:'Inter',sans-serif;font-size:10px;font-weight:500;letter-spacing:.03em;color:${T.textDim}}
.th.r{text-align:right}
.t-row{display:grid;grid-template-columns:32px 20px 100px minmax(180px,1fr) 96px 116px 148px 114px 48px;padding:0 32px 0 20px;min-height:60px;border-bottom:1px solid ${T.border};align-items:center;transition:background 0.08s;position:relative}
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
.modal{background:${T.surface};border:1px solid ${T.border};border-radius:14px;width:560px;max-width:94vw;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.03);animation:mIn 0.2s cubic-bezier(0.34,1.2,0.64,1);transition:width 0.25s ease,height 0.25s ease}
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
.s-modal{width:960px;max-width:96vw;height:90vh}
.s-layout{display:flex;flex:1;overflow:hidden;min-height:0}
.s-bar{width:268px;flex-shrink:0;border-right:1px solid #E5E7EB;overflow-y:auto;display:flex;flex-direction:column;background:#FFFFFF}
.inspector-group{padding:13px 15px;border-bottom:1px solid #E5E7EB}
.inspector-group:last-child{border-bottom:none}
.inspector-group-title{font-family:'Inter',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:${T.textDim};margin-bottom:10px;opacity:.65}
.s-canvas-area{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:16px 24px;gap:12px;background:#DDDFE3;overflow:auto}
.canvas-zoom-bar{display:flex;align-items:center;gap:8px;align-self:flex-start;background:rgba(0,0,0,0.35);border-radius:6px;padding:4px 8px;backdrop-filter:blur(8px)}
.zoom-btn{background:transparent;border:none;color:rgba(255,255,255,0.8);font-size:15px;cursor:pointer;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:background 0.1s;line-height:1;font-weight:300}
.zoom-btn:hover{background:rgba(255,255,255,0.15)}
.zoom-label{font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,0.6);letter-spacing:.5px;min-width:32px;text-align:center}
.canvas-wrap{position:relative;border-radius:16px;box-shadow:0 40px 100px rgba(0,0,0,0.32),0 0 0 1px rgba(0,0,0,0.08);flex-shrink:0;transition:transform 0.2s cubic-bezier(0.4,0,0.2,1)}
.canvas{width:290px;height:515px;border-radius:16px;position:relative;overflow:hidden;background:#080A0E;flex-shrink:0;cursor:crosshair}
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

/* ─── CONNECTION PANEL ─── */
.conn-row{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px;cursor:pointer;transition:background .1s}
.conn-row:hover{background:${T.s3}}
.conn-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.conn-dot.on{background:${T.ink}}.conn-dot.off{background:${T.border2}}
.conn-name{font-size:13px;color:${T.textSub};font-weight:450}
.conn-st{font-size:10px;margin-left:auto;font-family:'JetBrains Mono',monospace}
.conn-st.on{color:${T.textSub};font-weight:600}.conn-st.off{color:${T.textDim}}
.cp-modal{width:400px}
.cp-account-row{display:flex;align-items:center;gap:14px;padding:16px;background:${T.s2};border-radius:9px;border:1px solid ${T.border};margin-bottom:4px}
.cp-avatar{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#fff;flex-shrink:0}
.cp-handle{font-size:14px;font-weight:700;color:${T.text};letter-spacing:-.1px}
.cp-meta{font-size:12px;color:${T.textDim};margin-top:2px}
.cp-stat-row{display:flex;gap:16px;margin-top:10px}
.cp-stat{display:flex;flex-direction:column;align-items:center;background:${T.surface};border:1px solid ${T.border};border-radius:7px;padding:8px 14px;flex:1}
.cp-stat-val{font-size:16px;font-weight:700;font-family:'Bricolage Grotesque',sans-serif;line-height:1;color:${T.text}}
.cp-stat-key{font-size:10px;color:${T.textDim};margin-top:3px;font-weight:400}
.cp-step{display:flex;align-items:flex-start;gap:10px;padding:8px 0}
.cp-step-num{width:20px;height:20px;border-radius:50%;background:${T.s3};border:1px solid ${T.border};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${T.textSub};flex-shrink:0;margin-top:1px}
.cp-step-text{font-size:13px;color:${T.textSub};line-height:1.5}
.cp-status-row{display:flex;align-items:center;gap:8px;padding:10px 14px;background:${T.s2};border-radius:7px;border:1px solid ${T.border};margin-bottom:4px}
.cp-status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.cp-status-text{font-size:13px;font-weight:500;flex:1}
.cp-status-ts{font-size:10px;color:${T.textDim};font-family:'JetBrains Mono',monospace}
.cp-input{background:${T.s2};border:1px solid ${T.border};border-radius:7px;padding:8px 11px;font-size:13px;color:${T.text};outline:none;width:100%;transition:border-color .1s;font-family:inherit}
.cp-input:focus{border-color:${T.border2}}
.cp-token-bar{height:4px;border-radius:99px;background:${T.s3};overflow:hidden;margin-top:4px}
.cp-ig-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 16px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s;background:linear-gradient(90deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff}
.cp-ig-btn:hover{opacity:.88}.cp-ig-btn:disabled{opacity:.5;cursor:not-allowed}
.cp-setup-note{font-size:11px;color:${T.textDim};line-height:1.6;padding:6px 0 0}
.cp-setup-note code{font-family:'JetBrains Mono',monospace;background:${T.s3};padding:1px 5px;border-radius:3px;font-size:10px;word-break:break-all}
.cp-section-title{font-size:10px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:${T.textDim};margin-bottom:6px}

/* ─── SETTINGS MODAL ─── */
.settings-modal{width:520px}
.settings-tabs{display:flex;border-bottom:1px solid ${T.border};margin:-18px -20px 16px;padding:0 20px}
.settings-tab{padding:10px 14px;font-size:12.5px;font-weight:500;color:${T.textDim};cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .12s;background:none;border-left:none;border-right:none;border-top:none}
.settings-tab:hover{color:${T.text}}
.settings-tab.on{color:${T.text};font-weight:600;border-bottom-color:${T.ink}}
.settings-field-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid ${T.border}}
.settings-field-row:last-child{border-bottom:none}
.settings-field-label{font-size:13px;color:${T.text};font-weight:500}
.settings-field-sub{font-size:11.5px;color:${T.textDim};margin-top:2px}
.settings-toggle{width:32px;height:18px;border-radius:99px;position:relative;cursor:pointer;transition:background .15s;flex-shrink:0;border:none}
.settings-toggle-knob{position:absolute;width:14px;height:14px;border-radius:50%;background:#fff;top:2px;transition:left .15s;box-shadow:0 1px 3px rgba(0,0,0,.2)}

/* ─── SIDEBAR SETTINGS BTN ─── */
.s-settings-btn{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;cursor:pointer;font-size:13px;color:${T.textDim};transition:all .1s;background:none;border:none;width:100%;text-align:left}
.s-settings-btn:hover{background:${T.s3};color:${T.text}}

/* ─── IG GRID VIEW ─── */
.ig-grid-area{flex:1;overflow-y:auto;padding:28px 24px 40px;display:flex;flex-direction:column;align-items:center;gap:0}
.ig-profile-wrap{width:100%;max-width:618px;display:flex;flex-direction:column}
.ig-profile-header{display:flex;align-items:center;gap:28px;padding:8px 0 22px;border-bottom:1px solid ${T.border};margin-bottom:0}
.ig-profile-avatar{width:68px;height:68px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;flex-shrink:0;background:linear-gradient(135deg,#BE185D,#7C3AED)}
.ig-profile-meta{flex:1}
.ig-profile-handle{font-family:'Bricolage Grotesque',sans-serif;font-size:15px;font-weight:700;color:${T.text};letter-spacing:-.2px;margin-bottom:2px}
.ig-profile-bio{font-size:12px;color:${T.textDim};line-height:1.4}
.ig-profile-stats{display:flex;gap:22px;margin-top:10px}
.ig-profile-stat{display:flex;flex-direction:column;align-items:center;gap:1px}
.ig-profile-stat-val{font-size:14px;font-weight:700;color:${T.text};font-family:'Bricolage Grotesque',sans-serif;line-height:1}
.ig-profile-stat-key{font-size:10px;color:${T.textDim};font-weight:400}
.ig-section-label{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${T.textDim};padding:10px 3px 8px;display:flex;align-items:center;gap:8px}
.ig-section-label::after{content:'';flex:1;height:1px;background:${T.border}}
.ig-grid-frame{border:1px solid ${T.border};border-radius:10px;overflow:hidden;width:100%}
.ig-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:${T.border}}
.ig-cell{aspect-ratio:1;position:relative;overflow:hidden;cursor:pointer;background:#080A0E;transition:filter .15s,opacity .15s}
.ig-cell.is-queued{filter:brightness(0.82)}
.ig-cell:hover{filter:brightness(1.1);opacity:.92}
.ig-cell-overlay{position:absolute;inset:0;background:rgba(0,0,0,0);display:flex;align-items:center;justify-content:center;transition:background .18s;z-index:4}
.ig-cell:hover .ig-cell-overlay{background:rgba(0,0,0,0.38)}
.ig-cell-hover-label{color:#fff;font-size:10px;font-weight:700;font-family:'JetBrains Mono',monospace;letter-spacing:.5px;opacity:0;transition:opacity .15s;pointer-events:none}
.ig-cell:hover .ig-cell-hover-label{opacity:1}
.ig-cell-info{position:absolute;bottom:0;left:0;right:0;padding:16px 7px 7px;background:linear-gradient(transparent,rgba(0,0,0,0.85));pointer-events:none;z-index:3}
.ig-cell-title{font-size:8.5px;font-weight:600;color:rgba(255,255,255,0.92);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'JetBrains Mono',monospace;letter-spacing:.2px}
.ig-cell-date{font-size:7px;color:rgba(255,255,255,0.42);margin-top:1px;font-family:'JetBrains Mono',monospace}
.ig-cell-badge{position:absolute;top:6px;right:6px;font-size:7px;font-weight:700;padding:2px 5px;border-radius:3px;letter-spacing:.6px;font-family:'JetBrains Mono',monospace;z-index:3}
.ig-cell-badge.queued{background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.9);backdrop-filter:blur(4px)}
.ig-cell-status{position:absolute;top:6px;left:6px;width:6px;height:6px;border-radius:50%;z-index:3}
.ig-cell-empty{aspect-ratio:1;background:${T.s2}}
.ig-cell-story-ring{position:absolute;inset:2px;border:1.5px solid rgba(255,255,255,0.28);border-radius:3px;pointer-events:none;z-index:3}
.ig-queued-divider{grid-column:1/-1;background:rgba(255,255,255,0.04);border-top:1.5px dashed rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;padding:6px 0;gap:6px}
.ig-queued-divider-label{font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:600;letter-spacing:1.2px;color:rgba(255,255,255,0.35);text-transform:uppercase}

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
    try {
      const data = await generateCaption({ platform, prompt });
      const text = data.caption || "";
      let i = 0;
      const interval = setInterval(() => {
        i += 3; setResult(text.slice(0,i));
        if(i>=text.length){setResult(text);clearInterval(interval);setLoading(false);}
      }, 18);
    } catch(e) { setResult(e.message || "Couldn't connect to AI."); setLoading(false); }
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
  const publishApiUrl = import.meta.env.VITE_PUBLISH_API_URL || "";
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
      if (!publishApiUrl) {
        throw new Error("Publishing is not configured yet. Add VITE_PUBLISH_API_URL when the server-side publish endpoint is ready.");
      }
      const res = await fetch(publishApiUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform:plat,caption,mediaUrl:fileUrl})});
      const data = await res.json();
      if(!data.success) throw new Error(data.error||"Unknown error");
      setSt("done"); onPosted?.();
    } catch(err){ setSt("error"); setErrMsg(err.message); }
  }, [caption, fileUrl, plat, publishApiUrl]);

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

function CanvasElement({ data, isSelected, onSelect, onUpdate }) {
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

  const handleResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const startX   = e.clientX, startY = e.clientY;
    const startVal = data.type === 'text' ? (data.fontSize || 14) : (data.scale || 1);
    const onMove = (mv) => {
      const delta = (mv.clientX - startX + mv.clientY - startY) / 2;
      if (data.type === 'text') {
        onUpdate({ fontSize: Math.max(6, Math.min(96, startVal + delta * 0.35)) });
      } else {
        onUpdate({ scale: Math.max(0.1, Math.min(8, startVal + delta * 0.012)) });
      }
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // BG layer (locked image or video)
  if (data.locked) {
    const isVid = data.mediaType === 'video';
    return (
      <>
        {data.url && data.mediaType !== 'video' && <img src={data.url} className="canvas-img" alt="" draggable="false"/>}
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
          <div className="handle handle-nw" onMouseDown={handleResize}/>
          <div className="handle handle-ne" onMouseDown={handleResize}/>
          <div className="handle handle-sw" onMouseDown={handleResize}/>
          <div className="handle handle-se" onMouseDown={handleResize}/>
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
        {bgEl?.url && bgEl.mediaType !== 'video' && <img src={bgEl.url} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} alt=""/>}
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

function StoryDesigner({ row, onClose, onSave }) {
  const makeDefault = () => [
    { id:"bg",  type:"image", url:null, x:0, y:0, scale:1, locked:true, mediaType:'image' },
    { id:uid(), type:"text",  content:"RANGER & FOX",          x:20, y:22,  fontSize:8.5, fontFamily:"JetBrains Mono",     color:T.ink, letterSpacing:3,    fontWeight:600, shadow:false },
    { id:uid(), type:"text",  content:row?.note||"Headline",   x:20, y:155, fontSize:24,  fontFamily:"Bricolage Grotesque",color:"#FFFFFF", letterSpacing:-0.5, fontWeight:700, shadow:true  },
    { id:uid(), type:"text",  content:"Supporting detail",      x:20, y:205, fontSize:12,  fontFamily:"Bricolage Grotesque",color:"rgba(255,255,255,0.6)", letterSpacing:0, fontWeight:400, shadow:false },
  ];

  const [elements,    setElements]    = useState(() => {
    // Use previously saved elements for this row
    if (row?.storyElements) return row.storyElements;
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

  // Auto-save elements to parent row whenever they change
  useEffect(() => { if (onSave) onSave(elements); }, [elements]);

  const [selectedId,  setSelectedId]  = useState(null);
  const [zoom,        setZoom]        = useState(1.0);
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
    const url    = URL.createObjectURL(file);
    const isGif  = file.type === "image/gif";
    const isVid  = !isGif && file.type.startsWith("video/");
    const mType  = isGif ? 'gif' : isVid ? 'video' : 'image';
    const el     = { id:uid(), type:"image", url, x:56, y:140, scale:1, locked:false, mediaType: mType, loop:true, muted:true, autoPlay:true, trimLabel: file.name.split('.').pop().toUpperCase() };
    setElements(els => [...els, el]); setSelectedId(el.id);
  };

  const setBg = (file) => {
    if (!file) return;
    const url    = URL.createObjectURL(file);
    const isGif  = file.type === "image/gif";
    const isVid  = !isGif && file.type.startsWith("video/");
    updateEl("bg", { url, mediaType: isGif ? 'gif' : isVid ? 'video' : 'image' });
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
    try {
      const data = await generateStoryTips(boardCtx);
      setAiTips(data.tips?.length ? data.tips : ["Keep text above y=340 (safe zone).","Use high-contrast headline color.","Anchor R&F logo to a corner for brand safety."]);
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
      <div className="modal s-modal" onClick={e=>e.stopPropagation()}>
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
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%"}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.45)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.2,textTransform:"uppercase"}}>
                1080 × 1920 · 9:16
              </div>
              <div className="canvas-zoom-bar">
                <button className="zoom-btn" onClick={()=>setZoom(z=>Math.max(0.4,parseFloat((z-0.1).toFixed(1))))} title="Zoom out">−</button>
                <span className="zoom-label">{Math.round(zoom*100)}%</span>
                <button className="zoom-btn" onClick={()=>setZoom(z=>Math.min(2.0,parseFloat((z+0.1).toFixed(1))))} title="Zoom in">+</button>
                <button className="zoom-btn" style={{fontSize:9,letterSpacing:.3,width:"auto",padding:"0 4px"}} onClick={()=>setZoom(1.0)} title="Reset zoom">1:1</button>
              </div>
            </div>
            <div className="canvas-wrap" style={{transform:`scale(${zoom})`,transformOrigin:"top center"}}>
              <div className="canvas" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedId(null);}}>
                {elements.filter(e=>e.locked).map(el=>(
                  <CanvasElement key={el.id} data={el} isSelected={selectedId===el.id}
                    onSelect={()=>setSelectedId(el.id)} onUpdate={p=>updateEl(el.id,p)}/>
                ))}
                <div className="canvas-ov" style={{background:"linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0) 45%,rgba(0,0,0,0.28) 100%)"}}/>
                {elements.filter(e=>!e.locked).map(el=>(
                  <CanvasElement key={el.id} data={el} isSelected={selectedId===el.id}
                    onSelect={()=>setSelectedId(el.id)} onUpdate={p=>updateEl(el.id,p)}/>
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
function CalendarView({ rows, month: initMonth, year: initYear, onStory, onAddDay, onEdit }) {
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

// ─── CONNECTION PANEL ────────────────────────────────────────────
const IG_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;

function IGOAuthPanel({ igConfig, igMedia, onSave, onMediaSync, onDisconnect }) {
  const [connecting, setConnecting] = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [error,      setError]      = useState('');

  const isConnected = !!igConfig?.username;
  const redirectUri = window.location.origin;

  const startOAuth = async () => {
    setError(''); setConnecting(true);
    let safeRedirectUri;
    try {
      safeRedirectUri = new URL(redirectUri).origin;
    } catch {
      setError('Invalid page origin — cannot start OAuth flow.'); setConnecting(false); return;
    }

    let authorizeUrl;
    try {
      const data = await getInstagramAuthorizeUrl(safeRedirectUri);
      authorizeUrl = data.authorizeUrl;
    } catch (e) {
      setError(e.message || 'Instagram OAuth could not start.');
      setConnecting(false);
      return;
    }

    const popup = window.open(authorizeUrl, 'ig_oauth', 'width=620,height=720,scrollbars=yes,resizable=yes');
    if (!popup) { setError('Popup blocked — allow popups for this page and try again.'); setConnecting(false); return; }
    const timer = setInterval(() => {
      try {
        if (!popup || popup.closed) { clearInterval(timer); setConnecting(false); return; }
        const pu = popup.location.href;
        if (pu.startsWith(safeRedirectUri)) {
          const params = new URL(pu).searchParams;
          const code = params.get('code'), err = params.get('error'), state = params.get('state');
          popup.close(); clearInterval(timer);
          if (err) { setError('Denied: ' + (params.get('error_description') || err)); setConnecting(false); return; }
          if (code && state) handleCode(code, safeRedirectUri, state);
        }
      } catch { /* still on instagram.com — keep polling */ }
    }, 500);
  };

  const handleCode = async (code, safeRedirectUri, state) => {
    try {
      const tokenData = await exchangeInstagramCode({ code, redirectUri: safeRedirectUri, state });
      onSave(tokenData.account);
      const feed = await fetchInstagramFeed();
      onMediaSync(feed);
    } catch(e) {
      setError(e.message || 'Connection failed. Is the API server running? (npm run dev:api)');
    }
    setConnecting(false);
  };

  const syncMedia = async () => {
    setSyncing(true); setError('');
    try { onMediaSync(await fetchInstagramFeed()); }
    catch(e) { setError(e.message || 'Sync failed — token may have expired.'); }
    setSyncing(false);
  };

  const daysLeft   = igConfig?.expiresAt ? Math.round((igConfig.expiresAt - Date.now()) / 86400000) : 0;
  const mediaCount = igMedia?.data?.length || 0;
  const syncedAt   = igMedia?._syncedAt ? new Date(igMedia._syncedAt).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : null;

  if (isConnected) {
    return (
      <>
        <div className="cp-status-row">
          <div className="cp-status-dot" style={{background:'#10B981'}}/>
          <span className="cp-status-text">Connected</span>
          <span className="cp-status-ts">{syncedAt ? `Synced ${syncedAt}` : `${mediaCount} posts loaded`}</span>
        </div>
        <div className="cp-account-row">
          <div className="cp-avatar" style={{background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)'}}>
            {igConfig.username?.[0]?.toUpperCase() || 'I'}
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
              {daysLeft > 0 ? `${daysLeft}d remaining` : 'expired — reconnect'}
            </span>
          </div>
          <div className="cp-token-bar">
            <div style={{height:'100%',width:`${Math.max(2,Math.min(100,(daysLeft/60)*100))}%`,background: daysLeft < 10 ? T.amber : '#10B981',borderRadius:99,transition:'width .3s'}}/>
          </div>
        </div>

        <div style={{padding:"6px 0 0"}}>
          <div className="cp-section-title">Permissions</div>
          {['Read profile & media','Access media URLs & thumbnails','Read media metadata'].map(p => (
            <div key={p} style={{display:'flex',alignItems:'center',gap:7,fontSize:12.5,color:T.textSub,padding:'3px 0'}}>
              <span style={{color:'#10B981',fontWeight:700,fontSize:11}}>✓</span>{p}
            </div>
          ))}
        </div>

        {error && <div style={{fontSize:11.5,color:T.red,padding:"6px 0 0"}}>{error}</div>}

        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button className="btn btn-ghost" style={{flex:1,padding:"7px 0",fontSize:12}} onClick={syncMedia} disabled={syncing}>
            {syncing ? 'Syncing…' : `↻ Sync Posts (${mediaCount})`}
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
          {connecting ? 'Waiting for Instagram…' : 'Not connected'}
        </span>
      </div>
      <div style={{fontSize:13,color:T.textSub,lineHeight:1.6,padding:"8px 0 14px"}}>
        Sign in with your Instagram account to sync your real grid and publish posts directly from Social Studio.
      </div>
      {error && <div style={{fontSize:11.5,color:T.red,padding:"0 0 10px"}}>{error}</div>}
      <button className="cp-ig-btn" onClick={startOAuth} disabled={connecting}>
        {connecting
          ? 'Waiting for Instagram…'
          : <>{IG_ICON} Sign in with Instagram</>
        }
      </button>
      <p className="cp-setup-note" style={{marginTop:10}}>
        A popup will open on Instagram's website — sign in and approve access. You'll be redirected back automatically.
      </p>
    </>
  );
}

function ConnectionPanel({ platform, connected, onConnect, onDisconnect, onClose, igConfig, igMedia, onIGSave, onIGMediaSync }) {
  const isIG = platform === 'instagram';
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
            <div className="m-title">{isIG ? 'Instagram' : 'LinkedIn'}</div>
            <div className="m-sub">{isIG ? (igConfig?.username ? `@${igConfig.username}` : 'Not connected') : (connected ? '@rangerandfox · Company Page' : 'Not connected')}</div>
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
                <div className="cp-status-dot" style={{background: connected ? '#10B981' : T.border2}}/>
                <span className="cp-status-text" style={{color: connected ? T.text : T.textDim}}>
                  {simulating ? (connected ? 'Disconnecting…' : 'Connecting…') : connected ? 'Connected' : 'Not connected'}
                </span>
                {connected && <span className="cp-status-ts">Last sync: Today</span>}
              </div>
              {connected ? (
                <>
                  <div className="cp-account-row">
                    <div className="cp-avatar" style={{background:`linear-gradient(135deg,${T.blue},#0A66C2)`}}>RF</div>
                    <div><div className="cp-handle">@rangerandfox</div><div className="cp-meta">LinkedIn Company Page</div></div>
                  </div>
                  <div className="cp-stat-row">
                    {[["2,140","Followers"],["89","Posts"],["4.1%","Eng."]].map(([v,k])=>(
                      <div key={k} className="cp-stat"><span className="cp-stat-val">{v}</span><span className="cp-stat-key">{k}</span></div>))}
                  </div>
                </>
              ) : (
                <div style={{fontSize:13,color:T.textSub,lineHeight:1.6,padding:"6px 0 8px"}}>
                  Connect your LinkedIn Company Page to publish posts directly from Social Studio.
                  {[`Click "Connect with LinkedIn" below`,"Sign in and authorize Social Studio"].map((s,i) => (
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
                  {simulating ? 'Disconnecting…' : 'Disconnect'}
                </button>
              : <button className="btn btn-primary" style={{padding:"6px 14px",fontSize:12,background:T.blue}} disabled={simulating} onClick={()=>simulate(onConnect)}>
                  {simulating ? 'Connecting…' : 'Connect with LinkedIn →'}
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

// ─── SETTINGS MODAL ──────────────────────────────────────────────
const SETTINGS_TABS = ["General","Team","Notifications","Integrations"];

function SettingsModal({ onClose }) {
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

          {tab==="General"&&(
            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              <div className="field"><div className="lbl">Studio Name</div><input className="inp" defaultValue="Ranger & Fox"/></div>
              <div className="field" style={{marginTop:12}}><div className="lbl">Default Platform</div>
                <div className="plat-tabs" style={{marginTop:0}}>
                  {Object.entries(PLATFORMS).map(([k,pl])=>(
                    <button key={k} className="plat-tab" style={{fontSize:11.5}}>{pl.label}</button>
                  ))}
                </div>
              </div>
              <div className="settings-field-row" style={{marginTop:12}}>
                <div><div className="settings-field-label">Timezone</div><div className="settings-field-sub">All times shown in Pacific</div></div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:T.textSub,background:T.s3,padding:"4px 9px",borderRadius:5,border:`1px solid ${T.border}`}}>PT (UTC−8)</div>
              </div>
            </div>
          )}

          {tab==="Team"&&(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {TEAM.map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:T.s2,borderRadius:8,border:`1px solid ${T.border}`}}>
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
            <div>
              <ToggleRow label="Needs Review" sub="Alert when a post enters review" k="review"/>
              <ToggleRow label="New Comment" sub="Alert on post comments" k="comment"/>
              <ToggleRow label="Scheduled" sub="Confirm when a post is scheduled" k="scheduled"/>
              <ToggleRow label="Post Published" sub="Confirm when a post goes live" k="posted"/>
            </div>
          )}

          {tab==="Integrations"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[
                {name:"Slack",sub:"Post activity to a Slack channel",on:false,color:"#611f69"},
                {name:"Zapier",sub:"Automate post workflows",on:false,color:"#FF4A00"},
                {name:"Google Drive",sub:"Import assets from Drive",on:false,color:"#4285F4"},
              ].map(i=>(
                <div key={i.name} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 13px",background:T.s2,borderRadius:8,border:`1px solid ${T.border}`}}>
                  <div style={{width:32,height:32,borderRadius:7,background:i.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:i.color,flexShrink:0}}>{i.name[0]}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{i.name}</div><div style={{fontSize:11,color:T.textDim,marginTop:1}}>{i.sub}</div></div>
                  <button className="btn btn-ghost" style={{fontSize:11,padding:"4px 11px"}}>Connect</button>
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

// ─── IG GRID VIEW ────────────────────────────────────────────────
// Mock existing published posts — represents what's already live on @rangerandfox
function pastISO(daysAgo, hour = 10) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0); return d.toISOString();
}
// thumbnailUrl: paste your actual hosted image URL for each post (jpg/png/webp from your CDN, S3, website, etc.)
// Leave as null to show a gradient placeholder. Real Instagram media requires the Instagram Graph API.
const EXISTING_IG_POSTS = [
  { id:'ex1',  note:'Moonvalley x R&F pipeline reveal',     platform:'ig_post',  scheduledAt:pastISO(3),  _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#e65c00,#f9d423)" },
  { id:'ex2',  note:'Motion tip #12 — Fabric transitions',  platform:'ig_story', scheduledAt:pastISO(5),  _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#0575e6,#021b79)" },
  { id:'ex3',  note:'Clio Awards shortlist ★',              platform:'ig_post',  scheduledAt:pastISO(8),  _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#1a1a2e,#a8c0d6)" },
  { id:'ex4',  note:'Microsoft Fabric — studio B-roll',     platform:'ig_post',  scheduledAt:pastISO(12), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#000000,#e0e0e0)" },
  { id:'ex5',  note:'Behind the scenes — Adobe collab',     platform:'ig_story', scheduledAt:pastISO(14), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#8B0000,#DAA520)" },
  { id:'ex6',  note:'Team spotlight — Jared R.',            platform:'ig_post',  scheduledAt:pastISO(18), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#0a1628,#1a3a6c)" },
  { id:'ex7',  note:'Motion tip #11 — Depth & parallax',   platform:'ig_story', scheduledAt:pastISO(21), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#1565C0,#e3f2fd)" },
  { id:'ex8',  note:'Stash Magazine feature',               platform:'ig_post',  scheduledAt:pastISO(24), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#FF6D00,#FF0000)" },
  { id:'ex9',  note:'New client: Moonvalley',               platform:'ig_post',  scheduledAt:pastISO(27), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#4a00e0,#8e2de2)" },
  { id:'ex10', note:'Studio open house recap',              platform:'ig_story', scheduledAt:pastISO(30), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#005c97,#363795)" },
  { id:'ex11', note:'Clio reel — making-of',                platform:'ig_post',  scheduledAt:pastISO(34), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#0f0c29,#302b63,#24243e)" },
  { id:'ex12', note:'Motion tip #10 — Camera moves',        platform:'ig_post',  scheduledAt:pastISO(38), _existing:true, thumbnailUrl:null, bg:"linear-gradient(145deg,#134e5e,#71b280)" },
];

// Fallback gradient palette for queued posts with no bg image yet
const CELL_GRADIENTS = [
  "linear-gradient(145deg,#0f0c29,#302b63)",
  "linear-gradient(145deg,#1a0533,#7c3aed)",
  "linear-gradient(145deg,#0c1445,#1a2a6c)",
  "linear-gradient(145deg,#0a0a0a,#1c1c1c)",
  "linear-gradient(145deg,#200122,#6f0000)",
  "linear-gradient(145deg,#0f2027,#2c5364)",
];

// Scale factor for fitting a 290px-wide canvas into ~204px cell
const MINI_SCALE = 0.703;

function IGCell({ post, index, onOpen, isQueued }) {
  const isStory = post.platform === 'ig_story';
  const statusDot = STATUSES[post.status]?.dot || T.border2;
  const storyEls = isStory ? (post.storyElements || makeDefaultElements(post.note)) : null;
  const bgEl = storyEls?.find(e => e.locked);
  // Real thumbnail URL takes priority; fall back to per-post bg gradient or indexed gradient
  const fallbackBg = post.bg || CELL_GRADIENTS[index % CELL_GRADIENTS.length];

  return (
    <div
      className={"ig-cell" + (isQueued ? " is-queued" : "")}
      onClick={() => onOpen(post)}
      title={post.note}
    >
      {/* Real thumbnail image (existing posts with thumbnailUrl set) */}
      {post.thumbnailUrl && (
        <img src={post.thumbnailUrl} alt={post.note}
          style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none'}}/>
      )}

      {/* Story cell: mini canvas render (when no real thumbnail) */}
      {isStory && !post.thumbnailUrl && (
        <div style={{position:'absolute',inset:0,overflow:'hidden',background:'#080A0E'}}>
          <div style={{
            position:'absolute',top:0,left:0,
            width:290,height:515,
            transform:`scale(${MINI_SCALE})`,
            transformOrigin:'top left',
          }}>
            {!bgEl?.url && <div style={{position:'absolute',inset:0,background:fallbackBg}}/>}
            {bgEl?.url && bgEl.mediaType !== 'video' && <img src={bgEl.url} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} alt=""/>}
            {bgEl?.url && <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0) 45%,rgba(0,0,0,0.25) 100%)'}}/>}
            {storyEls.filter(e => !e.locked && e.type === 'text').map(el => (
              <div key={el.id} style={{
                position:'absolute',
                left:el.x,top:el.y,
                fontSize:el.fontSize,
                color:el.color,
                fontFamily:`'${el.fontFamily}',sans-serif`,
                fontWeight:el.fontWeight||600,
                letterSpacing:el.letterSpacing||0,
                lineHeight:1.25,
                whiteSpace:'pre-wrap',
                maxWidth:200,
                textShadow:el.shadow?'0 2px 12px rgba(0,0,0,0.8)':undefined,
                pointerEvents:'none',
              }}>{el.content}</div>
            ))}
            <div style={{position:'absolute',bottom:10,right:10,fontFamily:"'JetBrains Mono',monospace",fontSize:5,color:'rgba(255,255,255,0.18)',letterSpacing:2,textTransform:'uppercase'}}>R&F</div>
          </div>
        </div>
      )}

      {/* Post cell: styled brand card (when no real thumbnail) */}
      {!isStory && !post.thumbnailUrl && (
        <div style={{
          position:'absolute',inset:0,
          background:fallbackBg,
          display:'flex',flexDirection:'column',
          padding:'11px 10px 9px',
        }}>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(0,0,0,0.25) 0%,rgba(0,0,0,0) 40%,rgba(0,0,0,0.7) 100%)'}}/>
          <div style={{position:'relative',zIndex:1,marginTop:'auto'}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:6,fontWeight:600,color:'rgba(255,255,255,0.45)',letterSpacing:2,textTransform:'uppercase',marginBottom:4}}>RANGER & FOX</div>
            <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:12,fontWeight:700,color:'#FFFFFF',lineHeight:1.2,letterSpacing:-0.3}}>{post.note || "Untitled"}</div>
          </div>
        </div>
      )}

      {/* Overlay for posts with a real thumbnail */}
      {post.thumbnailUrl && (
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0) 50%)',pointerEvents:'none',zIndex:1}}/>
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

function IGGridView({ rows, onOpen, igMedia, igAccount }) {
  // Convert real Instagram API response to our post shape
  const existingPosts = igMedia?.data?.length
    ? igMedia.data.map(m => ({
        id: m.id,
        note: m.caption?.split('\n')[0]?.slice(0, 80) || 'Instagram post',
        platform: 'ig_post',
        scheduledAt: m.timestamp,
        _existing: true,
        thumbnailUrl: m.media_type === 'VIDEO' ? (m.thumbnail_url || null) : (m.media_url || null),
        permalink: m.permalink,
      }))
    : EXISTING_IG_POSTS;

  // Queued: future-dated IG posts not yet posted
  const queued = [...rows]
    .filter(r => r.platform.startsWith('ig') && r.status !== 'posted')
    .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));

  // Combine existing (past) + queued (future), newest first (Instagram order)
  const allPosts = [...existingPosts, ...queued]
    .sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0));

  // Find the divider index — first queued post position in sorted list
  const firstQueuedIndex = allPosts.findIndex(p => !p._existing);

  // Pad to multiple of 3
  const padded = [...allPosts];
  while (padded.length % 3 !== 0) padded.push(null);

  const totalPosts = existingPosts.length + queued.length;
  const queuedCount = queued.length;

  return (
    <div className="ig-grid-area">
      <div className="ig-profile-wrap">

        {/* Profile header */}
        <div className="ig-profile-header">
          <div className="ig-profile-avatar">RF</div>
          <div className="ig-profile-meta">
            <div className="ig-profile-handle">{igAccount?.username || "rangerandfox"}</div>
            <div className="ig-profile-bio">Motion graphics studio · Rochester, MI + LA<br/>Award-winning work for the world's best brands.</div>
            <div className="ig-profile-stats">
              {[
                { val: igAccount?.mediaCount || totalPosts, key: "posts" },
                { val: "4,281",    key: "followers" },
                { val: "312",      key: "following" },
              ].map(s => (
                <div key={s.key} className="ig-profile-stat">
                  <span className="ig-profile-stat-val">{s.val}</span>
                  <span className="ig-profile-stat-key">{s.key}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,alignSelf:"flex-start",paddingTop:4}}>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:T.textSub}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:T.ink,flexShrink:0}}/>
              Connected
            </div>
            <div style={{display:"flex",gap:8,marginTop:2}}>
              {[["POST",PLATFORMS.ig_post.color],["STORY",PLATFORMS.ig_story.color]].map(([l,c])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:T.textDim}}>
                  <div style={{width:6,height:6,borderRadius:1,background:c}}/>
                  {l}
                </div>
              ))}
              <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:T.textDim}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"rgba(255,255,255,0.25)",border:`1px solid ${T.border2}`}}/>
                QUEUED
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
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
    try {
      const data = await generateCaption({ platform, prompt: `${prompt}. ${tone}` });
      const text = data.caption || "";
      let i = 0;
      const iv = setInterval(() => {
        i += 4; setResult(text.slice(0,i));
        if (i >= text.length) { setResult(text); clearInterval(iv); setLoading(false); }
      }, 16);
    } catch(e) { setResult(e.message || "Couldn't reach AI."); setLoading(false); }
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

function Row({ row, sel, onSel, onChange, onDel, onStory, onPostNow, dragHandlers, showComments, onAddComment, currentUser }) {
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
  const [, setMediaFile]  = useState(null);
  const [mediaUrl,   setMediaUrl]   = useState(null);
  const storyElements = row.storyElements || makeDefaultElements(row.note);
  const mediaRef = useRef(null);

  const submitComment = () => { if(!commentText.trim()) return; onAddComment({id:uid(),author:currentUser,text:commentText,ts:"just now"}); setCommentText(""); };
  const max    = row.platform==="linkedin"?3000:2200;
  const capLen = (row.caption||"").length;
  const over   = capLen>max, warn = capLen>max*0.88;

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

        <div>
          <button className={"expand-toggle "+(isExpanded?"open":"")}
            onClick={e=>{e.stopPropagation();setIsExpanded(v=>!v);}}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{transition:"transform 0.22s ease",transform:isExpanded?"rotate(180deg)":"rotate(0deg)"}}>
              <path d="M1.5 3.5L5.5 7.5L9.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>{isExpanded ? "Close" : "Open"}</span>
          </button>
        </div>

        <div><button className="plat-pill" style={{background:p.bg,color:p.color}} onClick={nextP}><span className="pill-dot" style={{background:p.color}}/>{p.short}</button></div>
        <div><button className="status-pill" onClick={nextS} title={`Next: ${STATUSES[s.next]?.label}`}><span className="s-dot" style={{background:s.dot}}/>{s.label}</button></div>

        <div>
          <button className="assignee-pill" onClick={nextAssignee} style={{color:T.textDim,fontStyle:"italic"}}>
            {assignee ? <><div className="av" style={{width:18,height:18,background:assignee.color+"22",color:assignee.color,fontSize:8,borderRadius:4}}>{assignee.initials}</div><span style={{fontSize:11}}>{assignee.name.split(" ")[0]}</span></> : <span style={{fontSize:11,color:T.textDim}}>Assign</span>}
          </button>
        </div>

        <div className="ra">
          {row.comments?.length > 0 && (
            <span style={{fontSize:9.5,fontFamily:"'JetBrains Mono',monospace",padding:"2px 6px",background:T.s3,borderRadius:10,border:"1px solid "+T.border,color:T.textDim}}>{row.comments.length}</span>
          )}
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

// ─── TOKEN EXPIRY BANNER ──────────────────────────────────────────
// Shows a dismissible warning when the Instagram access token is within
// 10 days of expiry or already expired.
function TokenExpiryBanner({ igConfig, onRefresh, onDismiss }) {
  if (!igConfig?.expiresAt) return null;
  const daysLeft = Math.round((igConfig.expiresAt - Date.now()) / 86400000);
  if (daysLeft > 10) return null; // not yet critical

  const expired = daysLeft <= 0;
  const bg      = expired ? T.red : T.amber;
  const msg     = expired
    ? 'Your Instagram access token has expired. Reconnect to continue syncing.'
    : `Instagram token expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Refresh now to avoid disruption.`;

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, zIndex:400,
      background: bg, color:'#fff',
      padding:'8px 20px', fontSize:12.5, fontWeight:500,
      display:'flex', alignItems:'center', gap:12,
      fontFamily:"'Inter',sans-serif",
    }}>
      <span style={{flex:1}}>{msg}</span>
      {!expired && (
        <button onClick={onRefresh} style={{
          background:'rgba(255,255,255,0.22)', border:'1px solid rgba(255,255,255,0.4)',
          borderRadius:5, padding:'4px 12px', color:'#fff', fontSize:12, fontWeight:700,
          cursor:'pointer',
        }}>Refresh Token</button>
      )}
      <button onClick={onDismiss} style={{
        background:'transparent', border:'none', color:'rgba(255,255,255,0.7)',
        fontSize:16, cursor:'pointer', lineHeight:1, padding:'2px 4px',
      }}>×</button>
    </div>
  );
}

// ─── UNDO DELETE TOAST ────────────────────────────────────────────
// Soft-delete: rows are held in a pending-delete buffer for 5 seconds.
// If the user clicks Undo, the row is restored.
function UndoDeleteToast({ count, onUndo, onDone }) {
  const [secs, setSecs] = useState(5);
  useEffect(() => {
    const interval = setInterval(() => setSecs(s => {
      if (s <= 1) { clearInterval(interval); onDone(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="toast" style={{display:'flex',alignItems:'center',gap:10}}>
      <div className="t-dot" style={{background:T.red}}/>
      <span>{count} post{count !== 1 ? 's' : ''} deleted ({secs}s)</span>
      <button onClick={onUndo} style={{
        background:T.s3, border:`1px solid ${T.border2}`, borderRadius:5,
        padding:'3px 10px', fontSize:11.5, fontWeight:700, cursor:'pointer', color:T.text, marginLeft:4,
      }}>Undo</button>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const [month, setMonth]         = useState(now.getMonth());
  const [year]                    = useState(now.getFullYear());
  const [studioDoc, setStudioDoc] = useState(loadStudioDocument);
  const [sel, setSel]             = useState(new Set());
  const [view, setView]           = useState("list");
  const [timeScale, setTimeScale] = useState("month"); // "month" | "year"
  const [composer, setComposer]   = useState(null);
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
  const showToast = useCallback((msg, color) => setToast({msg, color, id:uid()}), []);
  const dragIdx = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const monthRefs = useRef({});
  const currentUser = "stephen";

  const rows = studioDoc.rows.filter((row) => !row.deletedAt);
  const igConfig = studioDoc.instagram?.account || null;
  const igMedia = studioDoc.instagram?.media || null;

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
      const saved = persistStudioDocument({
        ...studioDoc,
        lastSavedAt: savedAt,
      });

      if (!saved) {
        setSaveState({
          status: "error",
          error: "Browser storage is full. Your latest changes are not safely persisted yet.",
          lastSavedAt: saveState.lastSavedAt,
        });
        return;
      }

      setSaveState({
        status: "saved",
        lastSavedAt: savedAt,
        error: null,
      });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [studioDoc]);

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
  }, [igConfig, updateDocument]);

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
  }, [igConfig, showToast, updateDocument]);

  const allSorted = [...rows].sort((a,b) => {
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

  const add = (targetMonth=month, day=1) => {
    const iso = makeISO(day, 9, 0, targetMonth);
    updateDocument(
      (current) => ({
        ...current,
        rows: [...current.rows, createNewRow({ scheduledAt: iso }, currentUser, current.rows.length)],
      }),
      () => createAuditEntry("post.created", currentUser, "Created a new post draft", { scheduledAt: iso }),
    );
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
    onDrop:(e)=>{
      e.preventDefault();
      const from=dragIdx.current;
      if(from===null||from===idx)return;
      const reordered = [...sorted];
      const [moved] = reordered.splice(from,1);
      reordered.splice(idx,0,moved);
      const orderMap = new Map(reordered.map((item, order) => [item.id, order]));
      updateDocument(
        (current) => ({
          ...current,
          rows: current.rows.map((item) => (orderMap.has(item.id) ? applyRowPatch(item, { order: orderMap.get(item.id) }, currentUser) : item)),
        }),
        () => createAuditEntry("post.reordered", currentUser, "Reordered posts in the current view", { from, to: idx }),
      );
      setDragOverId(null);
      dragIdx.current=null;
    },
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
              <div className="th"/>
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

        {view==="grid"&&<IGGridView rows={rows} igMedia={igMedia} igAccount={igConfig}
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
    </div>
  );
}
