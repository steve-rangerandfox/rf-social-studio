import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth, useUser } from "@clerk/react";

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

// ─── STYLES ───────────────────────────────────────────────────────
const G = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=JetBrains+Mono:wght@400;500&display=swap');
@font-face{font-family:'Oakes Grotesk';src:url('/fonts/OakesGrotesk-Light.otf') format('opentype');font-weight:300;font-style:normal;font-display:swap}
@font-face{font-family:'Oakes Grotesk';src:url('/fonts/OakesGrotesk-Regular.otf') format('opentype');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Oakes Grotesk';src:url('/fonts/OakesGrotesk-Semi-Bold.otf') format('opentype');font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:'Oakes Grotesk';src:url('/fonts/OakesGrotesk-Bold.otf') format('opentype');font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:'Plaak Ney';src:url('/fonts/Plaak - 56-Ney-Heavy-205TF.otf') format('opentype');font-weight:900;font-style:normal;font-display:swap}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:${T.bg};color:${T.text};font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;font-feature-settings:'cv02','cv03','cv04','cv11';line-height:1.5}
body{letter-spacing:-0.01em;background:
radial-gradient(circle at 12% 8%, rgba(255,180,120,0.18), transparent 18%),
radial-gradient(circle at 82% 16%, rgba(110,170,255,0.12), transparent 16%),
linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0) 24%),
${T.bg}}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(94,88,79,0.18);border-radius:99px}
input,textarea,select,button{font-family:inherit}
.app{display:flex;height:100vh;overflow:hidden;position:relative;background:
linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0) 20%),
${T.bg}}

/* SIDEBAR */
.sidebar{width:248px;flex-shrink:0;border-right:1px solid rgba(24,23,20,0.1);display:flex;flex-direction:column;background:rgba(254,252,248,0.86);backdrop-filter:blur(20px);overflow-y:auto}
.s-logo{padding:30px 22px 24px;border-bottom:1px solid rgba(24,23,20,0.1);display:flex;align-items:center;gap:12px;flex-shrink:0}
.logo-mark{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#111111 0%,#6d5c55 46%,#8dc5ff 100%);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${T.surface};flex-shrink:0;box-shadow:0 10px 24px rgba(24,23,20,0.14)}
.logo-name{font-size:14px;font-weight:600;color:${T.text};letter-spacing:-0.02em}
.logo-sub{font-size:11px;color:${T.textDim};font-weight:500;letter-spacing:0.02em}
.s-sect{padding:22px 14px 10px}
.s-lbl{font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${T.textDim};padding:0 10px;margin-bottom:10px;font-family:'JetBrains Mono',monospace;display:block}
.m-item{display:flex;align-items:center;justify-content:space-between;padding:9px 10px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:500;color:${T.textSub};transition:background 0.12s,color 0.12s;margin-bottom:2px;position:relative;user-select:none;line-height:1.4}
.m-item:hover{background:rgba(24,23,20,0.06);color:${T.text}}.m-item.on{background:rgba(24,23,20,0.09);color:${T.ink};font-weight:600}
.m-item.on::before{display:none}
.m-ct{font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.textDim};font-weight:500}
.m-item.on .m-ct{color:${T.textDim};opacity:0.8}
.s-div{height:1px;background:rgba(24,23,20,0.12);margin:12px 12px}
.s-team{padding:0 10px 8px}
.team-row{display:flex;align-items:center;gap:8px;padding:8px 8px;border-radius:10px}
.av{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;flex-shrink:0}
.team-name{font-size:13px;color:${T.textSub};font-weight:500}
.online-dot{width:5px;height:5px;border-radius:50%;margin-left:auto;flex-shrink:0}
.s-bottom{margin-top:auto;padding:14px 10px 16px;border-top:1px solid rgba(24,23,20,0.12);flex-shrink:0}
.conn-row{display:flex;align-items:center;gap:8px;padding:9px 8px;border-radius:10px}
.conn-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.conn-dot.on{background:${T.ink}}.conn-dot.off{background:${T.border2}}
.conn-name{font-size:13px;color:${T.textSub};font-weight:500}
.conn-st{font-size:10px;margin-left:auto;font-family:'JetBrains Mono',monospace}
.conn-st.on{color:${T.textSub};font-weight:600}.conn-st.off{color:${T.textDim}}

/* MAIN */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.topbar{height:86px;border-bottom:1px solid rgba(24,23,20,0.1);display:flex;align-items:center;padding:0 30px;gap:14px;background:rgba(254,252,248,0.82);backdrop-filter:blur(16px);flex-shrink:0}
.tb-month{font-size:28px;font-weight:600;color:${T.text};letter-spacing:-0.05em;font-family:'Bricolage Grotesque',sans-serif;line-height:0.95}
.tb-year{font-size:28px;font-weight:400;color:${T.textDim};margin-left:4px;font-family:'Bricolage Grotesque',sans-serif;line-height:0.95}
.tb-space{flex:1}
.view-toggle{display:flex;gap:2px;padding:3px;border-radius:999px;background:rgba(24,23,20,0.08)}
.vt-btn{padding:7px 13px;font-size:12px;font-weight:500;cursor:pointer;border:none;background:transparent;color:${T.textDim};transition:all 0.12s;display:flex;align-items:center;gap:5px;white-space:nowrap;letter-spacing:.01em;border-radius:999px}
.vt-btn:hover{color:${T.text};background:rgba(24,23,20,0.06)}.vt-btn.on{background:${T.surface};color:${T.text};font-weight:600;box-shadow:0 1px 0 rgba(24,23,20,0.06)}

/* STATS */
.stats{display:flex;border-bottom:1px solid rgba(24,23,20,0.08);flex-shrink:0;background:transparent;padding:10px 18px 14px;gap:10px}
.stat{flex:1;padding:18px 18px 16px;border-right:none;background:linear-gradient(180deg,rgba(255,255,255,0.8),rgba(252,250,245,0.94));border-radius:18px;position:relative;overflow:hidden}
.stat:last-child{border-right:none}
.stat.clickable{border:1px solid rgba(24,23,20,0.1);cursor:pointer;transition:transform 0.12s,background 0.12s,border-color 0.12s,box-shadow 0.12s}
.stat.clickable:hover{background:${T.surface};border-color:rgba(24,23,20,0.16);transform:translateY(-1px);box-shadow:0 16px 36px rgba(24,23,20,0.08)}
.stat.clickable:active{transform:translateY(0)}
.stat::before{content:'';position:absolute;left:14px;right:14px;top:0;height:3px;border-radius:999px;background:linear-gradient(90deg, rgba(229,106,11,0.72), rgba(140,205,255,0.7), rgba(226,133,255,0.52))}
.stat-val{font-size:24px;font-weight:600;letter-spacing:-0.05em;font-family:'Bricolage Grotesque',sans-serif;line-height:1;color:${T.text}}
.stat-key{font-size:11px;color:${T.textDim};font-weight:500;margin-top:8px;letter-spacing:.05em;text-transform:uppercase}
button.stat{font:inherit;text-align:left}

/* TABLE */
.t-area{flex:1;overflow-y:auto;scrollbar-gutter:stable;padding:12px 18px 22px}
.t-head{display:grid;grid-template-columns:32px 20px 140px minmax(240px,1fr) 56px 44px 136px 44px;padding:0 18px;height:48px;background:linear-gradient(180deg, rgba(245,240,232,0.98), rgba(243,238,229,0.98));position:sticky;top:0;z-index:10;align-items:center;backdrop-filter:blur(16px);border-bottom:1px solid rgba(24,23,20,0.08);box-shadow:0 10px 24px rgba(24,23,20,0.04)}
.th{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;letter-spacing:.12em;color:${T.textDim};text-transform:uppercase}
.th.r{text-align:right}
.t-row{display:grid;grid-template-columns:32px 20px 140px minmax(240px,1fr) 56px 44px 136px 44px;padding:0 18px;min-height:78px;align-items:center;transition:background 0.12s,border-color 0.12s,box-shadow 0.12s,transform 0.12s;position:relative;background:linear-gradient(180deg,rgba(255,255,255,0.72),rgba(252,250,245,0.96));border:1px solid rgba(24,23,20,0.1);border-radius:18px;margin-bottom:10px;cursor:pointer}
.t-row:hover{background:${T.surface};border-color:rgba(24,23,20,0.14)}.t-row.sel{background:${T.surface};border-color:rgba(24,23,20,0.2)}
.t-row.dragging{opacity:0.3}.t-row.drag-over::before{content:'';position:absolute;top:-5px;left:18px;right:18px;height:1px;background:${T.ink};border-radius:99px}
.t-row .ra{display:flex;gap:6px;justify-content:flex-end;align-items:center}
.drag-handle{color:rgba(94,88,79,0.38);cursor:grab;font-size:14px;display:flex;align-items:center;padding:0 2px;user-select:none}
.drag-handle:hover{color:${T.textSub}}.drag-handle:active{cursor:grabbing}

/* DATETIME CELL */
.dt-cell{display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 8px;border-radius:14px;transition:background 0.12s,border-color 0.12s,transform 0.12s;border:1px solid transparent;min-width:0}
.dt-cell:hover{background:rgba(24,23,20,0.04);border-color:rgba(24,23,20,0.10)}
.dt-badge{width:48px;min-width:48px;height:52px;border-radius:16px;background:linear-gradient(180deg,rgba(24,23,20,0.06),rgba(24,23,20,0.02));border:1px solid rgba(24,23,20,0.12);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.45)}
.dt-badge-month{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:500;color:${T.textDim};line-height:1;letter-spacing:.12em;text-transform:uppercase}
.dt-badge-day{margin-top:6px;font-family:'Bricolage Grotesque',sans-serif;font-size:24px;font-weight:600;color:${T.text};line-height:.9;letter-spacing:-.05em}
.dt-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
.dt-date{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;color:${T.textDim};line-height:1.2;letter-spacing:.12em;text-transform:uppercase}
.dt-time{font-family:'Inter',sans-serif;font-size:13px;color:${T.text};line-height:1.35;font-weight:600;letter-spacing:-.01em;white-space:nowrap}
.dt-zone{font-family:'JetBrains Mono',monospace;font-size:9px;color:${T.textDim};letter-spacing:.12em;text-transform:uppercase}
.dt-empty{display:flex;flex-direction:column;gap:4px}
.dt-empty-title{font-family:'Inter',sans-serif;font-size:12px;font-weight:600;color:${T.textSub};line-height:1.2}
.dt-empty-sub{font-family:'JetBrains Mono',monospace;font-size:9px;color:${T.textDim};letter-spacing:.12em;text-transform:uppercase}

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
.comment-input{flex:1;background:#FFFDF9;border:1px solid rgba(24,23,20,0.12);border-radius:12px;color:${T.text};font-size:12.5px;padding:10px 12px;outline:none}
.comment-input:focus{border-color:rgba(24,23,20,0.22);box-shadow:0 0 0 3px rgba(24,23,20,0.05)}
.comment-input::placeholder{color:#7E776C}

/* INPUTS */
.cb{width:14px;height:14px;border-radius:3px;cursor:pointer;appearance:none;border:1px solid ${T.border2};background:transparent;position:relative;flex-shrink:0;transition:all 0.1s}
.cb:checked{background:${T.ink};border-color:${T.ink}}
.cb:checked::after{content:'';position:absolute;left:3.5px;top:1.5px;width:5px;height:8px;border:2px solid #F7F8FA;border-left:none;border-top:none;transform:rotate(40deg)}
.note-in{width:100%;background:transparent;border:none;color:${T.text};font-size:13px;font-weight:400;padding:4px 0;border-radius:4px;outline:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.01em;font-family:"Inter",sans-serif}
.note-in:focus{background:${T.s3};outline:none;border-radius:4px;padding:4px 6px}
.note-in::placeholder{color:${T.textDim}}
.note-display{width:100%;background:transparent;border:none;color:${T.text};font-size:13px;font-weight:500;padding:4px 0;border-radius:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.01em;font-family:"Inter",sans-serif}
.note-display:hover{color:${T.ink}}

/* PILLS */
.plat-pill{display:inline-flex;align-items:center;justify-content:center;padding:6px;border-radius:999px;cursor:pointer;border:none;outline:none;transition:background .12s,color .12s}
.plat-pill:hover{background:rgba(24,23,20,0.06)}
.pill-dot{width:4px;height:4px;border-radius:50%;flex-shrink:0;opacity:.75}
.status-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 0;border-radius:0;font-size:12px;font-weight:500;cursor:pointer;border:none;background:transparent;color:${T.textSub};transition:color .1s;white-space:nowrap;letter-spacing:0}
.status-pill:hover{color:${T.text}}
.s-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-right:1px}
.assignee-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 0;border-radius:0;font-size:12px;font-weight:500;cursor:pointer;border:none;background:transparent;color:${T.textSub};transition:color .1s}
.assignee-pill:hover{color:${T.text}}

.ib{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:1px solid transparent;background:transparent;border-radius:5px;cursor:pointer;color:${T.textDim};font-size:13px;transition:all 0.1s}

.ib:hover{border-color:rgba(24,23,20,0.06);background:rgba(24,23,20,0.04);color:${T.text}}
.ib.p:hover{border-color:${T.border2};color:${T.text};background:${T.s3}}
.ib.d{opacity:0;transition:opacity .12s;color:${T.textDim}}.ib.d:hover{border-color:${T.red};color:${T.red};background:rgba(255,77,77,0.08)}.t-row:hover .ib.d{opacity:1}
.ib.c:hover{border-color:${T.purple};color:${T.purple};background:rgba(167,139,250,0.08)}
.ib.n:hover{border-color:${T.orange};color:${T.orange};background:rgba(247,119,55,0.08)}

.add-row{padding:10px 18px 0;height:auto;display:flex;align-items:center;border-bottom:none}
.add-btn{display:flex;align-items:center;gap:5px;background:transparent;border:none;color:${T.textDim};font-size:12.5px;font-weight:500;cursor:pointer;padding:8px 10px;border-radius:999px;transition:color 0.1s,background 0.1s}
.add-btn:hover{color:${T.textSub}}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 15px;border-radius:999px;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:all 0.12s;letter-spacing:.01em}
.btn-ghost{background:linear-gradient(180deg,rgba(255,255,255,0.9),rgba(247,241,232,0.94));color:${T.text};border:1px solid rgba(24,23,20,0.12);box-shadow:0 8px 24px rgba(24,23,20,0.05);font-weight:700}
.btn-ghost:hover{color:${T.ink};background:linear-gradient(180deg,rgba(255,255,255,1),rgba(244,237,226,0.98));border-color:rgba(24,23,20,0.2);transform:translateY(-1px)}
.btn-primary{background:${T.posterGrad};background-size:140% 140%;color:${T.ink};font-weight:800;border:1px solid rgba(24,23,20,0.16);box-shadow:0 14px 30px rgba(229,106,11,0.18),inset 0 1px 0 rgba(255,255,255,0.45);text-shadow:0 1px 0 rgba(255,255,255,0.18)}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 18px 36px rgba(229,106,11,0.22),inset 0 1px 0 rgba(255,255,255,0.52)}
.btn-ai{background:linear-gradient(135deg,rgba(255,122,0,0.16),rgba(240,178,77,0.22));color:#7A3200;border:1px solid rgba(229,106,11,0.32);font-weight:800;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4)}
.btn-ai:hover{background:linear-gradient(135deg,rgba(255,122,0,0.24),rgba(240,178,77,0.28));color:#5D2400;border-color:rgba(229,106,11,0.44);transform:translateY(-1px)}
.btn-now{background:linear-gradient(135deg,${T.orangeBright},${T.gold});color:${T.ink};border:1px solid rgba(24,23,20,0.16);font-weight:800;box-shadow:0 12px 28px rgba(229,106,11,0.24),inset 0 1px 0 rgba(255,255,255,0.38)}
.btn-now:hover{transform:translateY(-1px);box-shadow:0 16px 34px rgba(229,106,11,0.28),inset 0 1px 0 rgba(255,255,255,0.46)}
.btn-danger{background:rgba(220,38,38,0.06);color:${T.red};border:1px solid rgba(220,38,38,0.12)}
.btn-danger:hover{background:rgba(220,38,38,0.1)}
.btn:disabled{opacity:0.38;cursor:not-allowed}

/* BULK BAR */
.bulk{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:rgba(251,250,246,0.92);border:1px solid rgba(24,23,20,0.06);border-radius:999px;padding:10px 14px;display:flex;align-items:center;gap:10px;box-shadow:0 18px 50px rgba(24,23,20,0.08);z-index:50;animation:bIn 0.18s cubic-bezier(0.34,1.56,0.64,1);backdrop-filter:blur(12px)}
@keyframes bIn{from{transform:translateX(-50%) translateY(8px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
.bulk-lbl{font-size:13.5px;color:${T.textSub};font-weight:400}.bulk-lbl b{color:${T.text};font-weight:600}

/* CALENDAR VIEW */
.cal-area{flex:1;overflow-y:auto;padding:28px 30px 34px}
.cal-header{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px}
.cal-wd{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:${T.textDim};text-align:center;padding-bottom:14px}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:${T.border}}
.cal-cell{background:${T.surface};min-height:152px;padding:12px;position:relative;transition:background 0.08s;border-radius:12px}
.cal-cell.other{background:rgba(251,250,246,0.45);border-color:${T.border}}.cal-cell.today{background:${T.s2}}
.cal-cell:hover{background:${T.s2}}
.cal-dn{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;color:${T.textDim};margin-bottom:10px}
.cal-cell.today .cal-dn{color:${T.ink};font-weight:700}
.cal-posts{display:flex;flex-direction:column;gap:3px}
.cal-post{padding:7px 8px;border-radius:10px;font-size:11px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;overflow:hidden;margin-bottom:2px;background:rgba(24,23,20,0.04)}
.cal-post:hover{background:rgba(24,23,20,0.06)}
.cal-add{position:absolute;bottom:5px;right:5px;opacity:0;transition:opacity 0.1s}
.cal-cell:hover .cal-add{opacity:1}
.cal-add-btn{width:20px;height:20px;border-radius:4px;background:${T.s3};border:1px solid ${T.border2};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;color:${T.textDim};transition:all 0.1s}
.cal-add-btn:hover{border-color:${T.border2};color:${T.text}}

/* ANALYTICS */
.analytics-area{flex:1;overflow-y:auto;padding:28px;display:flex;flex-direction:column;gap:20px}
.analytics-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.an-card{background:rgba(251,250,246,0.72);border:1px solid rgba(24,23,20,0.06);border-radius:18px;padding:20px}
.an-card.wide{grid-column:span 2}.an-card.full{grid-column:1/-1}
.an-title{display:inline-flex;align-items:center;gap:8px;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${T.textSub};font-family:'JetBrains Mono',monospace;margin-bottom:16px}
.an-title::after{content:'';width:38px;height:2px;border-radius:999px;background:${T.posterGrad};box-shadow:0 0 18px rgba(255,122,0,0.18)}
.an-big{font-size:42px;font-weight:800;letter-spacing:-0.07em;margin-bottom:7px;font-family:'Bricolage Grotesque',sans-serif;line-height:.96;color:${T.ink}}
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
.asset-drawer{position:fixed;right:0;top:0;bottom:0;width:380px;background:rgba(251,250,246,0.9);border-left:1px solid rgba(24,23,20,0.06);z-index:80;display:flex;flex-direction:column;animation:drawerIn 0.2s cubic-bezier(0.34,1.1,0.64,1);backdrop-filter:blur(18px)}
@keyframes drawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
.asset-head{padding:22px 20px 16px;border-bottom:1px solid rgba(24,23,20,0.06);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.asset-title{font-size:16px;font-weight:600;font-family:'Bricolage Grotesque',sans-serif}
.asset-body{flex:1;overflow-y:auto;padding:18px}
.asset-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}
.asset-item{aspect-ratio:1;border-radius:14px;border:1px solid rgba(24,23,20,0.06);overflow:hidden;cursor:pointer;position:relative;background:${T.s2};transition:all 0.12s}
.asset-item:hover{border-color:rgba(24,23,20,0.1);transform:translateY(-1px)}
.asset-thumb{width:100%;height:100%;object-fit:cover}
.asset-empty-thumb{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px;opacity:0.4}
.asset-name{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(24,23,20,0.78));font-size:9px;padding:12px 8px 6px;color:rgba(255,255,255,0.88);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'JetBrains Mono',monospace;letter-spacing:.04em}
.asset-upload{border:1.5px dashed rgba(24,23,20,0.14);border-radius:16px;padding:28px 20px;text-align:center;cursor:pointer;transition:all 0.12s;margin-bottom:4px;background:rgba(251,250,246,0.7)}
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
.add-post-modal{width:460px;max-width:94vw}
.add-post-intro{padding:14px 16px;border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,0.92),rgba(245,238,226,0.86));border:1px solid rgba(24,23,20,0.08);display:flex;flex-direction:column;gap:6px}
.add-post-kicker{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${T.textDim}}
.add-post-row{display:grid;grid-template-columns:1fr 160px;gap:12px}
.add-post-help{font-size:12px;line-height:1.55;color:${T.textDim}}
.add-post-preview{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:14px;background:rgba(24,23,20,0.03);border:1px solid rgba(24,23,20,0.06)}
.add-post-preview-title{font-size:13px;font-weight:600;color:${T.text}}
.add-post-preview-meta{font-size:10.5px;color:${T.textDim};font-family:'JetBrains Mono',monospace;letter-spacing:.08em;text-transform:uppercase;margin-top:4px}

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
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:72px 0}
.e-icon{font-size:22px;opacity:0.18;margin-bottom:2px}
.e-t{font-size:16px;font-weight:600;color:${T.text}}.e-s{font-size:13px;color:${T.textDim};font-weight:400;line-height:1.6;max-width:320px;text-align:center}

/* TOAST */
.toast{position:fixed;bottom:26px;right:22px;z-index:300;background:rgba(251,250,246,0.94);border:1px solid rgba(24,23,20,0.08);border-radius:14px;padding:12px 16px;font-size:13px;color:${T.text};font-weight:500;box-shadow:0 20px 50px rgba(24,23,20,0.08);animation:tIn 0.18s cubic-bezier(0.34,1.2,0.64,1);display:flex;align-items:center;gap:8px;max-width:360px;backdrop-filter:blur(12px)}
@keyframes tIn{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}
.t-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
/* ─── STORY DESIGNER SCENE GRAPH ─── */
.s-modal{width:960px;max-width:96vw;height:90vh}
.s-layout{display:flex;flex:1;overflow:hidden;min-height:0}
.s-bar{width:268px;flex-shrink:0;border-right:1px solid ${T.border};overflow-y:auto;display:flex;flex-direction:column;background:${T.surface}}
.inspector-group{padding:13px 15px;border-bottom:1px solid ${T.border}}
.inspector-group:last-child{border-bottom:none}
.inspector-group-title{font-family:'Inter',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:${T.textDim};margin-bottom:10px;opacity:.75}
.s-canvas-area{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:18px 24px;gap:14px;background:linear-gradient(180deg,${T.bg},${T.s2});overflow:auto}
.canvas-zoom-bar{display:flex;align-items:center;gap:8px;align-self:flex-start;background:rgba(251,250,246,0.85);border:1px solid ${T.border};border-radius:999px;padding:4px 10px}
.zoom-btn{background:transparent;border:none;color:${T.textSub};font-size:14px;cursor:pointer;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background 0.1s;line-height:1;font-weight:400}
.zoom-btn:hover{background:${T.s3};color:${T.text}}
.zoom-label{font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.textDim};letter-spacing:.5px;min-width:32px;text-align:center}
.canvas-wrap{position:relative;border-radius:18px;box-shadow:0 24px 80px rgba(24,23,20,0.2),0 0 0 1px rgba(24,23,20,0.08);flex-shrink:0;transition:transform 0.2s cubic-bezier(0.4,0,0.2,1)}
.canvas{width:290px;height:515px;border-radius:18px;position:relative;overflow:hidden;background:#080A0E;flex-shrink:0;cursor:crosshair}
.canvas-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
.canvas-ov{position:absolute;inset:0;pointer-events:none}
.element-wrap{position:absolute;cursor:move;user-select:none;transform-origin:top left}
.element-wrap:hover .el-outline{opacity:1}
.el-outline{position:absolute;inset:-2px;border:1px dashed rgba(0,165,114,0.45);border-radius:2px;pointer-events:none;opacity:0;transition:opacity 0.1s}
.element-selected .el-outline{opacity:1;border-color:${T.ink};border-style:solid}
.handle{position:absolute;width:8px;height:8px;background:${T.surface};border:1.5px solid ${T.ink};border-radius:50%;z-index:20;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
.handle-nw{top:-4px;left:-4px;cursor:nwse-resize}
.handle-ne{top:-4px;right:-4px;cursor:nesw-resize}
.handle-sw{bottom:-4px;left:-4px;cursor:nesw-resize}
.handle-se{bottom:-4px;right:-4px;cursor:nwse-resize}
.s-slider{-webkit-appearance:none;width:100%;height:4px;border-radius:2px;background:${T.s3};outline:none;cursor:pointer;margin:4px 0 10px}
.s-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:${T.ink};cursor:pointer;border:2px solid ${T.surface};box-shadow:0 1px 4px rgba(24,23,20,0.25)}
.layers-stack{display:flex;flex-direction:column;gap:2px;max-height:130px;overflow-y:auto}
.layer-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:500;color:${T.textSub};transition:background 0.08s;border:1px solid transparent}
.layer-item:hover{background:${T.s2};color:${T.text}}
.layer-item.active{background:${T.s3};border-color:${T.border2};color:${T.ink};font-weight:600}
.layer-icon{font-size:11px;width:18px;text-align:center;flex-shrink:0;font-family:'JetBrains Mono',monospace;font-weight:700}
.layer-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px}
.layer-del{background:transparent;border:none;color:${T.textDim};cursor:pointer;font-size:13px;padding:1px 3px;border-radius:3px;line-height:1;opacity:0;transition:opacity 0.1s}
.layer-item:hover .layer-del{opacity:1}
.layer-item:hover .layer-del:hover{color:#D93025}
.color-swatches{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.color-swatch{width:22px;height:22px;border-radius:5px;cursor:pointer;border:2px solid transparent;transition:transform 0.1s,border-color 0.1s;flex-shrink:0}
.color-swatch:hover{transform:scale(1.18)}
.color-swatch.sel{border-color:${T.ink};box-shadow:0 0 0 1px ${T.surface} inset}
.font-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
.font-btn{background:${T.s2};border:1px solid ${T.border};border-radius:6px;padding:5px 8px;font-size:11px;font-weight:600;cursor:pointer;color:${T.textSub};transition:all 0.1s;text-align:center}
.font-btn.sel{background:${T.s3};border-color:${T.border2};color:${T.ink};font-weight:700}
.ai-copilot{background:${T.s2};border:1px solid ${T.border};border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;animation:fIn 0.15s}
.ai-copilot-title{font-size:11.5px;font-weight:600;color:${T.textSub};display:flex;align-items:center;gap:6px;font-family:'Inter',sans-serif}
.ai-suggestion{background:${T.surface};border:1px solid ${T.border};border-radius:8px;padding:9px 10px;font-size:11.5px;color:${T.textSub};line-height:1.5;cursor:pointer;transition:border-color 0.1s}
.ai-suggestion:hover{border-color:${T.border2};color:${T.text}}
.ai-suggestion b{color:${T.text};font-weight:600}
.del-btn{background:transparent;border:1px solid ${T.border};border-radius:6px;padding:4px 10px;font-size:11.5px;font-weight:600;color:#D93025;cursor:pointer;transition:all 0.1s;display:flex;align-items:center;gap:4px}
.del-btn:hover{background:rgba(217,48,37,0.06);border-color:#D93025}

/* ─── STAGE WELL ─── */
.row-container{display:contents}
.row-container.is-open .t-row{background:#FFFFFF;border-bottom:1px solid transparent;position:relative;z-index:4}
.row-container.is-open .t-row::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:#E5E7EB}

.stage-reveal-wrapper{display:grid;grid-template-rows:0fr;transition:grid-template-rows 320ms cubic-bezier(0.4,0,0.2,1);overflow:hidden;background:transparent;border-bottom:1px solid transparent}
.stage-reveal-wrapper.open{grid-template-rows:1fr;border-bottom:none}
.stage-content-well{min-height:0;padding:10px 18px 14px;width:100%}
.stage-reveal-wrapper:not(.open) .stage-content-well{padding:0;height:0}
.stage-stack{display:flex;flex-direction:column;gap:14px;background:linear-gradient(180deg,rgba(255,255,255,0.96),rgba(254,252,248,0.92));border:1px solid rgba(24,23,20,0.12);border-radius:22px;padding:20px;box-shadow:0 18px 46px rgba(24,23,20,0.06),inset 0 1px 0 rgba(255,255,255,0.7);position:relative;overflow:hidden}
.stage-stack::before{content:'';position:absolute;inset:0 0 auto 0;height:96px;background:${T.posterGradSoft};opacity:.48;pointer-events:none}
.stage-summary{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid rgba(24,23,20,0.1)}
.stage-summary-title{font-size:28px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-0.06em;color:${T.ink};line-height:.96;min-width:0}
.stage-summary-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:${T.textSub};font-family:'JetBrains Mono',monospace;letter-spacing:.05em;text-transform:uppercase;margin-top:10px}
.stage-summary-meta span{padding:4px 8px;border-radius:999px;background:rgba(255,255,255,0.62);border:1px solid rgba(24,23,20,0.08);backdrop-filter:blur(8px)}
.stage-summary-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.stage-section{padding:18px;background:linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.56));border:1px solid rgba(24,23,20,0.1);border-radius:18px;display:flex;flex-direction:column;gap:14px;min-width:0;min-height:100%;box-shadow:inset 0 1px 0 rgba(255,255,255,0.64)}
.stage-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:stretch}
.stage-dual{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:stretch}
.stage-single{display:block}
.stage-col{padding:0;border-right:none;display:flex;flex-direction:column;gap:12px}
.stage-col-media,.stage-col-write,.stage-col-gov{width:auto;min-width:0}
.stage-col-label{display:flex;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${T.text};margin-bottom:4px}
.stage-col-label::after{content:'';flex:1;height:2px;border-radius:999px;background:${T.posterGrad};opacity:.7}

/* Media thumb */
.stage-thumb{width:100%;aspect-ratio:9/16;border-radius:18px;background:#E8E1D7;position:relative;overflow:hidden;cursor:pointer;box-shadow:none;flex-shrink:0;display:flex;align-items:center;justify-content:center;max-height:220px}
.stage-thumb img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.stage-thumb-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.18s;backdrop-filter:saturate(1.2)}
.stage-thumb:hover .stage-thumb-overlay{opacity:1}
.stage-thumb-btn{background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.3);border-radius:7px;padding:7px 14px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;backdrop-filter:blur(8px)}
.stage-post-placeholder{width:100%;border-radius:18px;border:1.5px dashed rgba(24,23,20,0.18);min-height:168px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:all 0.12s;background:rgba(245,240,232,0.72)}
.stage-post-placeholder:hover{border-color:${T.ink};background:rgba(24,23,20,0.045)}
.stage-post-placeholder input{display:none}

/* Caption editor in stage */
.stage-txa{background:#FFFDF9;border:1px solid rgba(24,23,20,0.12);border-radius:16px;color:${T.text};font-size:14px;padding:16px;outline:none;width:100%;resize:none;min-height:200px;line-height:1.72;transition:border-color 0.1s,box-shadow 0.1s;flex:1;font-family:'Inter',sans-serif;font-weight:500}
.stage-txa:focus{border-color:rgba(24,23,20,0.22);box-shadow:0 0 0 3px rgba(24,23,20,0.06)}
.stage-txa::placeholder{color:#7E776C}
.stage-char{font-family:'JetBrains Mono',monospace;font-size:10px;color:#7E776C}
.stage-char.warn{color:#D97706}.stage-char.over{color:#D93025}

/* Multi-image grid */
.media-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.media-grid-item{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#E8E1D7}
.media-grid-item img{width:100%;height:100%;object-fit:cover}
.media-grid-item .media-rm{position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.55);border:none;color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.12s;line-height:1}
.media-grid-item:hover .media-rm{opacity:1}
.media-add-btn{aspect-ratio:1;border-radius:10px;border:1.5px dashed rgba(24,23,20,0.18);background:rgba(245,240,232,0.72);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;transition:all 0.12s;font-size:18px;color:${T.textDim}}
.media-add-btn:hover{border-color:${T.ink};background:rgba(24,23,20,0.045)}

/* LinkedIn Preview */
.li-card{background:#FFFFFF;font-family:-apple-system,system-ui,sans-serif}
.li-header{display:flex;align-items:center;gap:10px;padding:14px 16px 0}
.li-avatar{width:44px;height:44px;border-radius:50%;background:#111318;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;letter-spacing:1px;flex-shrink:0;font-family:'JetBrains Mono',monospace}
.li-header-info{display:flex;flex-direction:column;gap:0}
.li-name{font-size:14px;font-weight:600;color:#000}
.li-meta{font-size:12px;color:#666}
.li-caption{padding:10px 16px;font-size:14px;color:#191919;line-height:1.45;white-space:pre-wrap;word-break:break-word}
.li-more{background:none;border:none;color:#666;font-size:14px;cursor:pointer;padding:0;margin-left:4px;font-weight:600}
.li-more:hover{color:#0A66C2;text-decoration:underline}
.li-images{display:grid;gap:2px;max-height:400px;overflow:hidden}
.li-images-1{grid-template-columns:1fr}
.li-images-1 .li-img-cell{max-height:400px}
.li-images-2{grid-template-columns:1fr 1fr}
.li-images-3{grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr}
.li-images-3 .li-img-0{grid-row:1/3}
.li-images-4{grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr 1fr}
.li-images-4 .li-img-0{grid-row:1/4}
.li-images-5{grid-template-columns:1fr 1fr;grid-template-rows:2fr 1fr 1fr}
.li-images-5 .li-img-0{grid-column:1/3;grid-row:1/2}
.li-img-cell{position:relative;overflow:hidden;min-height:0}
.li-img-cell img{width:100%;height:100%;object-fit:cover;display:block}
.li-img-more{position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:700}
.li-engagement{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid #E8E8E8}
.li-reactions{display:flex;align-items:center;gap:2px}
.li-react-icon{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;border:1.5px solid #fff}
.li-react-count{font-size:12px;color:#666;margin-left:4px}
.li-stats{font-size:12px;color:#666}
.li-actions{display:flex;justify-content:space-around;padding:4px 8px}
.li-action-btn{background:none;border:none;padding:10px 8px;font-size:13px;font-weight:600;color:#666;cursor:default;border-radius:4px;transition:background 0.1s}

/* AI panel in stage */
.stage-ai{background:rgba(24,23,20,0.04);border:1px solid rgba(24,23,20,0.08);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px}
.stage-ai-header{display:flex;align-items:center;justify-content:space-between}
.stage-ai-title{font-size:11px;font-weight:600;color:${T.text};display:flex;align-items:center;gap:5px;font-family:'Inter',sans-serif}
.stage-ai-result{background:${T.surface};border:1px solid rgba(24,23,20,0.1);border-radius:10px;padding:10px 12px;font-size:13px;color:${T.text};line-height:1.65;white-space:pre-wrap;max-height:110px;overflow-y:auto}
.stage-ai-typing::after{content:'▋';animation:blink 0.8s infinite;color:${T.textDim}}

/* Governance column */
.readiness-list{display:flex;flex-direction:column;gap:8px}
.readiness-strip{display:flex;flex-wrap:wrap;gap:8px}
.readiness-chip{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,241,232,0.96));border:1px solid rgba(24,23,20,0.12);box-shadow:0 6px 18px rgba(24,23,20,0.03);white-space:nowrap}
.readiness-chip.pass{border-color:rgba(24,23,20,0.12)}
.readiness-chip.warn{border-color:rgba(229,106,11,0.26);background:linear-gradient(180deg,rgba(255,248,241,0.98),rgba(255,243,228,0.98))}
.readiness-chip.fail{border-color:rgba(220,38,38,0.18);background:linear-gradient(180deg,rgba(255,250,250,0.98),rgba(255,241,241,0.98))}
.readiness-item{display:flex;align-items:center;gap:10px;padding:12px 13px;border-radius:14px;background:#FFFDF9;border:1px solid rgba(24,23,20,0.1)}
.readiness-icon{font-size:13px;flex-shrink:0;width:18px;text-align:center;color:${T.text}}
.readiness-label{font-size:12.5px;color:${T.text};flex:1;font-weight:500}
.readiness-ok{font-family:'Inter',sans-serif;font-size:11px;font-weight:700}
.readiness-ok.pass{color:#111318}.readiness-ok.fail{color:#D93025}.readiness-ok.warn{color:${T.orange}}

.quick-status{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.qs-btn{padding:8px 13px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid rgba(24,23,20,0.12);background:linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,241,232,0.9));color:${T.textSub};transition:all 0.1s;white-space:nowrap;letter-spacing:.04em;box-shadow:0 6px 18px rgba(24,23,20,0.03)}
.qs-btn:hover{border-color:rgba(24,23,20,0.22);color:#0D0F12;background:linear-gradient(180deg,rgba(255,255,255,1),rgba(243,236,225,0.96));transform:translateY(-1px)}
.qs-btn.active{border-color:currentColor;box-shadow:0 0 0 2px rgba(229,106,11,0.08),0 10px 24px rgba(229,106,11,0.12);font-weight:800}
.stage-governance{display:flex;flex-direction:column;gap:16px}
.stage-select{position:relative}
.stage-select-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-radius:16px;border:1px solid rgba(24,23,20,0.12);background:linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,241,232,0.96));color:${T.text};font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgba(24,23,20,0.04)}
.stage-select-trigger:hover{border-color:rgba(24,23,20,0.18)}
.stage-select-copy{display:flex;align-items:center;gap:8px;min-width:0}
.stage-select-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${T.textDim}}
.stage-select-value{display:flex;align-items:center;gap:8px;color:${T.text};min-width:0}
.stage-select-caret{width:8px;height:8px;border-right:1.5px solid ${T.textDim};border-bottom:1.5px solid ${T.textDim};transform:rotate(45deg) translateY(-2px);flex-shrink:0}
.stage-select-menu{position:absolute;top:calc(100% + 8px);left:0;right:0;padding:8px;background:rgba(251,250,246,0.98);border:1px solid rgba(24,23,20,0.08);border-radius:16px;box-shadow:0 18px 50px rgba(24,23,20,0.12);backdrop-filter:blur(16px);z-index:30}
.stage-select-option{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px;border:none;background:transparent;border-radius:10px;color:${T.textSub};font-size:12px;font-weight:600;text-align:left;cursor:pointer}
.stage-select-option:hover{background:rgba(24,23,20,0.04);color:${T.text}}
.stage-select-option.on{background:rgba(24,23,20,0.06);color:${T.text}}
.stage-mini-stack{display:flex;flex-direction:column;gap:8px}
.stage-mini-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border-radius:14px;background:#FFFDF9;border:1px solid rgba(24,23,20,0.1)}
.stage-mini-key{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${T.textDim}}
.stage-mini-val{font-size:12px;font-weight:700;color:${T.text}}

/* Expand trigger */
.row-menu{position:relative}
.row-menu-trigger{width:32px;height:32px;border-radius:50%;border:1px solid rgba(24,23,20,0.08);background:rgba(255,255,255,0.72);display:flex;align-items:center;justify-content:center;color:${T.textSub};cursor:pointer;transition:background 0.12s,border-color 0.12s,color 0.12s}
.row-menu-trigger:hover{background:rgba(24,23,20,0.05);border-color:rgba(24,23,20,0.14);color:${T.text}}
.row-menu-dots{display:flex;flex-direction:column;gap:3px}
.row-menu-dots span{width:3px;height:3px;border-radius:50%;background:currentColor}
.row-menu-popover{position:absolute;top:calc(100% + 8px);right:0;min-width:140px;padding:8px;background:rgba(251,250,246,0.98);border:1px solid rgba(24,23,20,0.08);border-radius:14px;box-shadow:0 18px 50px rgba(24,23,20,0.12);z-index:100}
.row-menu-option{width:100%;padding:9px 10px;border:none;background:transparent;border-radius:10px;color:${T.textSub};font-size:12px;font-weight:500;text-align:left;cursor:pointer}
.row-menu-option:hover{background:rgba(24,23,20,0.04);color:${T.text}}

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
.font-section-header{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${T.textDim};margin:6px 0 4px;display:flex;align-items:center;gap:5px}
.font-verified{color:${T.text};font-size:9px}

/* ─── YEAR VIEW ─── */
.year-kpi{display:flex;gap:0;border-bottom:1px solid #E5E7EB;background:#FFFFFF;flex-shrink:0}
.year-kpi-item{flex:1;padding:14px 20px;border-right:1px solid #E5E7EB;display:flex;flex-direction:column;gap:3px}
.year-kpi-item:last-child{border-right:none}
.year-kpi-val{font-size:28px;font-weight:700;line-height:1;font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-1.2px}
.year-kpi-label{font-size:11px;color:${T.textDim};font-weight:400;font-family:'Inter',sans-serif;letter-spacing:.1px;margin-top:2px}
.year-kpi-bar{height:3px;border-radius:99px;background:#EFF0F2;margin-top:6px;overflow:hidden}
.year-kpi-bar-fill{height:100%;border-radius:99px;transition:width .4s cubic-bezier(.4,0,.2,1)}

.month-group{display:contents}
.month-anchor-header{position:sticky;top:0;z-index:8;background:linear-gradient(135deg,#e8834a 0%,#7b68ee 50%,#4a90d9 100%);border-bottom:none;padding:14px 18px 12px;display:flex;align-items:baseline;gap:10px;border-radius:14px;margin-bottom:8px;box-shadow:0 6px 24px rgba(124,92,200,0.14)}
.month-anchor-label{font-family:'Bricolage Grotesque',sans-serif;font-size:15px;font-weight:700;letter-spacing:-.2px;color:#fff}
.month-anchor-count{font-family:'Inter',sans-serif;font-size:11.5px;color:rgba(255,255,255,0.75);font-weight:500}
.month-sparkline{display:flex;gap:2px;align-items:flex-end;height:16px;margin-left:auto}
.month-spark-bar{width:5px;border-radius:1px;min-height:2px;background:rgba(255,255,255,0.35);transition:background .1s}
.month-spark-bar.ig{background:rgba(255,255,255,0.7)}
.month-spark-bar.li{background:rgba(255,255,255,0.5)}
.month-spark-bar.fill{opacity:1}
.month-empty{padding:24px 22px 20px;display:flex;align-items:center;gap:12px}
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
.settings-tabs{display:flex;align-items:flex-end;border-bottom:1px solid ${T.border};margin:-6px -20px 16px;padding:0 20px;overflow-x:auto;overflow-y:visible}
.settings-tab{padding:12px 14px 11px;font-size:12.5px;line-height:1.2;font-weight:500;color:${T.textDim};cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .12s;background:none;border-left:none;border-right:none;border-top:none;white-space:nowrap}
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
.ig-grid-area{flex:1;overflow-y:auto;padding:32px 26px 42px;display:flex;flex-direction:column;align-items:center;gap:0}
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
.ig-grid-frame{border:1px solid rgba(24,23,20,0.06);border-radius:20px;overflow:hidden;width:100%;background:rgba(251,250,246,0.8)}
.ig-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;background:transparent;padding:6px}
.ig-cell{aspect-ratio:1;position:relative;overflow:hidden;cursor:pointer;background:#DED7CC;border-radius:12px;transition:filter .15s,opacity .15s,transform .15s}
.ig-cell.is-queued{filter:brightness(0.82)}
.ig-cell:hover{filter:brightness(1.04);opacity:.98;transform:translateY(-1px)}
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
.ig-cell-empty{aspect-ratio:1;background:${T.s2};border-radius:12px}
.ig-cell-story-ring{position:absolute;inset:2px;border:1.5px solid rgba(255,255,255,0.28);border-radius:3px;pointer-events:none;z-index:3}
.ig-queued-divider{grid-column:1/-1;background:rgba(255,255,255,0.04);border-top:1.5px dashed rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;padding:6px 0;gap:6px}
.ig-queued-divider-label{font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:600;letter-spacing:1.2px;color:rgba(255,255,255,0.35);text-transform:uppercase}

/* ─── OPERATIONS FILTERS ─── */
.ops-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 18px 14px;border-bottom:1px solid rgba(24,23,20,0.08)}
.ops-search{min-width:240px;flex:1;background:rgba(252,250,245,0.92);border:1px solid rgba(24,23,20,0.12);border-radius:999px;color:${T.text};padding:10px 14px;font-size:13px;outline:none}
.ops-search::placeholder{color:${T.textDim}}
.ops-group{display:flex;align-items:center;gap:8px}
.ops-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${T.textDim}}
.ops-menu{position:relative}
.ops-trigger{display:inline-flex;align-items:center;justify-content:space-between;gap:10px;min-width:148px;padding:9px 12px;border-radius:999px;border:1px solid rgba(24,23,20,0.12);background:rgba(252,250,245,0.92);color:${T.text};font-size:12px;font-weight:500;cursor:pointer;transition:border-color 0.12s,background 0.12s,transform 0.12s}
.ops-trigger:hover{background:${T.surface};border-color:rgba(24,23,20,0.18)}
.ops-trigger.open{border-color:rgba(24,23,20,0.22);background:${T.surface}}
.ops-trigger-caret{width:7px;height:7px;border-right:1.5px solid ${T.textDim};border-bottom:1.5px solid ${T.textDim};transform:rotate(45deg) translateY(-1px);flex-shrink:0}
.ops-popover{position:absolute;top:calc(100% + 8px);left:0;min-width:100%;padding:8px;background:rgba(251,250,246,0.96);border:1px solid rgba(24,23,20,0.08);border-radius:16px;box-shadow:0 18px 50px rgba(24,23,20,0.12);backdrop-filter:blur(16px);z-index:40}
.ops-option{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border:none;background:transparent;border-radius:10px;color:${T.textSub};font-size:12px;font-weight:500;cursor:pointer;text-align:left}
.ops-option:hover{background:rgba(24,23,20,0.04);color:${T.text}}
.ops-option.on{background:rgba(24,23,20,0.06);color:${T.text};font-weight:600}
.ops-option-mark{font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.textDim};letter-spacing:.08em}
.ops-chip{padding:8px 11px;border-radius:999px;border:1px solid rgba(24,23,20,0.06);background:rgba(251,250,246,0.72);color:${T.textSub};font-size:11.5px;font-weight:500;cursor:pointer;transition:all 0.12s}
.ops-chip:hover{background:rgba(24,23,20,0.05);color:${T.text}}
.ops-chip.on{background:${T.ink};border-color:${T.ink};color:${T.surface}}
.ops-chip.subtle{background:transparent}
.ops-clear{background:transparent;border:none;color:${T.textDim};font-size:11.5px;font-weight:600;cursor:pointer}
.ops-count{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${T.textDim}}

/* ─── CALENDAR OVERRIDES ─── */
.cal-area{padding:22px 24px 28px}
.cal-shell{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;align-items:start}
.cal-main{min-width:0}
.cal-topline{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.cal-title{font-family:'Bricolage Grotesque',sans-serif;font-size:34px;font-weight:800;letter-spacing:-0.07em;color:${T.ink};line-height:.95;max-width:11ch}
.cal-subtitle{font-size:12.5px;color:${T.textDim};margin-top:4px;line-height:1.55}
.cal-grid{gap:8px;background:transparent}
.cal-cell{min-height:164px;padding:12px;background:rgba(251,250,246,0.82);border:1px solid rgba(24,23,20,0.05);border-radius:18px}
.cal-cell.selected{border-color:rgba(24,23,20,0.14);background:${T.surface}}
.cal-cell-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.cal-count{min-width:22px;height:22px;border-radius:999px;padding:0 7px;display:flex;align-items:center;justify-content:center;background:rgba(24,23,20,0.05);font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.textDim}}
.cal-post{border:1px solid transparent}
.cal-post.is-selected{border-color:rgba(24,23,20,0.14);background:${T.surface}}
.cal-more{font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.textDim};padding:4px 2px 0}
.cal-panel{background:rgba(251,250,246,0.84);border:1px solid rgba(24,23,20,0.06);border-radius:22px;padding:18px;display:flex;flex-direction:column;gap:14px;position:sticky;top:18px;max-height:calc(100vh - 130px);overflow-y:auto}
.cal-panel-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.cal-panel-day{font-family:'Bricolage Grotesque',sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.05em;color:${T.ink};line-height:.96}
.cal-panel-sub{font-size:12.5px;color:${T.textDim};line-height:1.55}
.cal-panel-section{display:flex;flex-direction:column;gap:10px;padding-top:4px}
.cal-panel-empty{padding:14px;border-radius:16px;background:rgba(24,23,20,0.03);font-size:12.5px;color:${T.textDim};line-height:1.55}
.cal-panel-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;border-radius:16px;border:1px solid rgba(24,23,20,0.05);background:rgba(255,255,255,0.44);cursor:pointer;text-align:left}
.cal-panel-item.on{border-color:rgba(24,23,20,0.14);background:${T.surface}}
.cal-panel-item-title{font-size:13px;font-weight:600;color:${T.text};line-height:1.4}
.cal-panel-item-meta{font-size:10.5px;color:${T.textDim};font-family:'JetBrains Mono',monospace;margin-top:3px;text-transform:uppercase;letter-spacing:.08em}
.cal-panel-item-time{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:${T.textSub};white-space:nowrap}
.cal-editor{display:flex;flex-direction:column;gap:10px}
.cal-chip-row{display:flex;flex-wrap:wrap;gap:6px}
.cal-panel-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.textDim};text-transform:uppercase;letter-spacing:.08em}

/* ─── ANALYTICS OVERRIDES ─── */
.analytics-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.an-card{padding:22px}
.an-inline-stats{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.an-inline-stat{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border-radius:12px;background:rgba(24,23,20,0.03);min-width:120px;font-size:11.5px;color:${T.textSub}}
.an-inline-stat strong{font-size:12px;color:${T.text};font-weight:600}
.an-list{display:flex;flex-direction:column;gap:8px}
.an-list-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(24,23,20,0.06)}
.an-list-row:last-child{border-bottom:none;padding-bottom:0}
.an-list-meta{font-size:10.5px;color:${T.textDim};font-family:'JetBrains Mono',monospace;margin-top:4px;text-transform:uppercase;letter-spacing:.08em}
.an-list-trailing{display:flex;align-items:center;gap:10px;flex-shrink:0}
.an-status-text{font-size:11px;color:${T.textSub}}
.an-empty-note{font-size:12.5px;color:${T.textDim};line-height:1.55}

/* ─── ASSET LIBRARY OVERRIDES ─── */
.asset-head-sub{font-size:11px;color:${T.textDim};margin-top:4px}
.asset-toolbar{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.asset-search{width:100%;background:rgba(255,255,255,0.7);border:1px solid rgba(24,23,20,0.06);border-radius:999px;color:${T.text};padding:10px 14px;font-size:13px;outline:none}
.asset-tabs{display:flex;flex-wrap:wrap;gap:6px}
.asset-tab{padding:6px 10px;border-radius:999px;border:1px solid rgba(24,23,20,0.06);background:transparent;color:${T.textDim};font-size:11px;font-weight:600;cursor:pointer}
.asset-tab.on{background:${T.ink};border-color:${T.ink};color:${T.surface}}
.asset-focus{display:flex;flex-direction:column;gap:12px;padding:12px;border-radius:18px;background:rgba(255,255,255,0.55);border:1px solid rgba(24,23,20,0.06);margin-bottom:12px}
.asset-focus-preview{border-radius:14px;overflow:hidden;background:${T.s2};aspect-ratio:16/10}
.asset-focus-body{display:flex;flex-direction:column;gap:10px}
.asset-focus-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.asset-focus-title{font-size:14px;font-weight:600;color:${T.text}}
.asset-focus-meta{font-size:10.5px;color:${T.textDim};font-family:'JetBrains Mono',monospace;margin-top:4px;text-transform:uppercase;letter-spacing:.08em}
.asset-star{padding:6px 10px;border-radius:999px;border:1px solid rgba(24,23,20,0.06);background:transparent;color:${T.textDim};font-size:11px;font-weight:600;cursor:pointer}
.asset-star.on{background:rgba(24,23,20,0.05);color:${T.text}}
.asset-item{aspect-ratio:0.94}
.asset-item.on{border-color:rgba(24,23,20,0.14);background:${T.surface}}
.asset-fav{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:999px;border:none;background:rgba(24,23,20,0.12);color:#fff;cursor:pointer;z-index:2}
.asset-fav.on{background:rgba(24,23,20,0.74)}
.asset-name{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;font-size:9px}
.asset-name span:last-child{opacity:0.7;text-transform:uppercase}

/* ─── CONNECTION / SETTINGS / GRID POLISH ─── */
.cp-modal{width:430px}
.cp-detail-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}
.cp-detail-card{padding:12px 13px;border-radius:14px;background:rgba(24,23,20,0.03);border:1px solid rgba(24,23,20,0.06)}
.cp-detail-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${T.textDim};margin-bottom:6px}
.cp-detail-value{font-size:12.5px;line-height:1.55;color:${T.textSub}}
.settings-note{margin:0 0 14px;padding:12px 14px;border-radius:14px;background:rgba(24,23,20,0.03);border:1px solid rgba(24,23,20,0.05);font-size:12.5px;color:${T.textSub};line-height:1.55}
.settings-card{background:rgba(251,250,246,0.72);border:1px solid rgba(24,23,20,0.06);border-radius:16px;padding:14px}
.settings-card-title{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${T.textDim};margin-bottom:10px}
.ig-profile-header{align-items:flex-start;gap:22px;padding:0 0 22px}
.ig-profile-avatar{background:${T.ink};color:${T.surface};box-shadow:inset 0 0 0 1px rgba(255,255,255,0.06)}
.ig-profile-kicker{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${T.textDim};margin-bottom:6px}
.ig-profile-bio{max-width:420px}
.ig-profile-stats{gap:16px;flex-wrap:wrap}
.ig-profile-stat{align-items:flex-start}
.ig-profile-rail{display:flex;flex-direction:column;gap:10px;min-width:190px}
.ig-rail-card{padding:12px 13px;border-radius:16px;background:rgba(251,250,246,0.72);border:1px solid rgba(24,23,20,0.06)}
.ig-rail-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${T.textDim};margin-bottom:8px}
.ig-rail-value{font-size:14px;font-weight:600;color:${T.text};line-height:1.35}
.ig-rail-sub{font-size:11.5px;color:${T.textDim};line-height:1.55;margin-top:4px}
.ig-grid-frame{border-radius:24px;background:rgba(251,250,246,0.88)}
.ig-cell-empty{background:rgba(24,23,20,0.03);border:1px solid rgba(24,23,20,0.04)}

/* ─── STAGE WELL RESPONSIVE / DETAIL ─── */
.stage-summary-actions .btn{white-space:nowrap}
.stage-section .cal-panel-empty{background:rgba(255,253,249,0.85);border:1px dashed rgba(24,23,20,0.14);border-radius:14px;color:${T.textSub}}

@media (max-width: 1200px){
  .cal-shell{grid-template-columns:1fr}
  .cal-panel{position:static;max-height:none}
  .stage-grid{grid-template-columns:1fr}
  .ig-profile-header{flex-direction:column}
  .ig-profile-rail{width:100%;min-width:0}
}

@media (max-width: 900px){
  .stage-dual{grid-template-columns:1fr}
  .sidebar{display:none}
  .topbar{padding:0 16px;height:auto;min-height:72px;flex-wrap:wrap;align-content:center;padding-top:12px;padding-bottom:12px}
  .stats,.ops-toolbar,.t-area,.analytics-area,.ig-grid-area,.cal-area{padding-left:14px;padding-right:14px}
  .t-head,.t-row{grid-template-columns:28px 16px 96px minmax(168px,1fr) 48px 40px 120px 96px 36px;padding:0 12px}
  .ops-group{width:100%}
  .ops-menu{flex:1}
  .ops-trigger{width:100%;min-width:0}
  .settings-tabs{overflow:auto}
  .cp-modal,.settings-modal{width:min(94vw,430px)}
  .add-post-row{grid-template-columns:1fr}
}

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
  }, [anchorRef]);

  // Click outside close
  useEffect(() => {
    const h = (e) => { if (popRef.current && !popRef.current.contains(e.target) && !anchorRef?.current?.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", h), 10);
    return () => document.removeEventListener("mousedown", h);
  }, [anchorRef, onClose]);

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

  return createPortal(
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
        {cells.map((cell,i)=>(
          <button key={i}
            className={`cal-day-btn ${!cell?.d?"empty":""} ${cell?.type !== "curr" ? "empty" : ""} ${isSel(cell?.d)?"sel":""} ${isToday(cell?.d)&&!isSel(cell?.d)?"today":""}`}
            onClick={()=>cell?.type === "curr" && pickDay(cell.d)}>
            {cell?.type === "curr" ? cell.d : ""}
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
    </div>,
    document.body
  );
}

// ─── DATETIME CELL ────────────────────────────────────────────────
function DateTimeCell({ isoValue, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const disp = isoValue ? toPTDisplay(isoValue) : null;
  const weekday = isoValue
    ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" }).format(new Date(isoValue))
    : null;
  const monthLabel = disp ? MONTHS_SHORT[Math.max(0, Number(disp.month) - 1)] : null;

  return (
    <div style={{position:"relative"}} ref={ref}>
      <div className="dt-cell" onClick={()=>setOpen(v=>!v)}>
        {disp ? <>
          <div className="dt-badge">
            <div className="dt-badge-month">{monthLabel}</div>
            <div className="dt-badge-day">{disp.day}</div>
          </div>
          <div className="dt-copy">
            <div className="dt-date">{weekday}</div>
            <div className="dt-time">{disp.hour}:{disp.minute} {disp.ampm}</div>
            <div className="dt-zone">Pacific Time</div>
          </div>
        </> : <div className="dt-empty"><div className="dt-empty-title">Set schedule</div><div className="dt-empty-sub">Date and time</div></div>}
      </div>
      {open && <DateTimePicker isoValue={isoValue} onChange={onChange} onClose={()=>setOpen(false)} anchorRef={ref}/>}
    </div>
  );
}

function FilterMenu({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="ops-group">
      <span className="ops-label">{label}</span>
      <div className="ops-menu" ref={ref}>
        <button className={`ops-trigger ${open ? "open" : ""}`} onClick={() => setOpen((current) => !current)}>
          <span>{active?.label}</span>
          <span className="ops-trigger-caret" />
        </button>
        {open && (
          <div className="ops-popover">
            {options.map((option) => (
              <button
                key={option.value}
                className={`ops-option ${value === option.value ? "on" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                <span className="ops-option-mark">{value === option.value ? "Set" : ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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

// ─── LINKEDIN PREVIEW ─────────────────────────────────────────────
function LinkedInPreview({ caption, mediaUrls, onClose }) {
  const truncLen = 150;
  const [expanded, setExpanded] = useState(false);
  const needsTrunc = caption && caption.length > truncLen;
  const displayCaption = expanded || !needsTrunc ? caption : caption.slice(0, truncLen) + "…";
  const imgCount = mediaUrls.length;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{width:520,maxWidth:"94vw"}} onClick={e=>e.stopPropagation()}>
        <div className="m-head">
          <div className="m-title">LinkedIn Preview</div>
          <button className="m-x" onClick={onClose}>×</button>
        </div>
        <div className="m-body" style={{padding:0}}>
          <div className="li-card">
            {/* Header */}
            <div className="li-header">
              <div className="li-avatar">RF</div>
              <div className="li-header-info">
                <div className="li-name">Ranger & Fox</div>
                <div className="li-meta">4,218 followers · 1h</div>
              </div>
            </div>
            {/* Caption */}
            {caption && (
              <div className="li-caption">
                {displayCaption.split("\n").map((line,i) => <span key={i}>{i>0&&<br/>}{line}</span>)}
                {needsTrunc && !expanded && (
                  <button className="li-more" onClick={e=>{e.stopPropagation();setExpanded(true);}}>see more</button>
                )}
              </div>
            )}
            {/* Images */}
            {imgCount > 0 && (
              <div className={`li-images li-images-${Math.min(imgCount, 5)}`}>
                {mediaUrls.slice(0, 5).map((url, i) => (
                  <div key={i} className={`li-img-cell li-img-${i}`}>
                    <img src={url} alt="" />
                    {i === 4 && imgCount > 5 && (
                      <div className="li-img-more">+{imgCount - 5}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Engagement bar */}
            <div className="li-engagement">
              <div className="li-reactions">
                <span className="li-react-icon" style={{background:"#0A66C2"}}>👍</span>
                <span className="li-react-icon" style={{background:"#DF704D",marginLeft:-4}}>❤️</span>
                <span className="li-react-count">24</span>
              </div>
              <span className="li-stats">3 comments · 2 reposts</span>
            </div>
            <div className="li-actions">
              <button className="li-action-btn">👍 Like</button>
              <button className="li-action-btn">💬 Comment</button>
              <button className="li-action-btn">↻ Repost</button>
              <button className="li-action-btn">✉ Send</button>
            </div>
          </div>
        </div>
        <div className="m-foot">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
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

function AddPostModal({ initialDate, onClose, onCreate }) {
  const titleRef = useRef(null);
  const safeDate = initialDate || nowPT();
  const [title, setTitle] = useState("");
  const [dateValue, setDateValue] = useState(() => {
    const y = safeDate.getFullYear();
    const m = String(safeDate.getMonth() + 1).padStart(2, "0");
    const d = String(safeDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [timeValue, setTimeValue] = useState("09:00");

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const canCreate = title.trim() && dateValue && timeValue;
  const previewDate = dateValue && timeValue ? new Date(`${dateValue}T${timeValue}:00`) : null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canCreate) return;
    onCreate({
      title: title.trim(),
      dateValue,
      timeValue,
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal add-post-modal" onClick={(event) => event.stopPropagation()}>
        <div className="m-head">
          <div>
            <div className="m-title">Add post</div>
            <div className="m-sub">Give the draft a title, then choose when it should land on the calendar.</div>
          </div>
          <button className="m-x" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="m-body">
            <div className="add-post-intro">
              <div className="add-post-kicker">New draft</div>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>Starts as an Instagram post idea</div>
              <div className="add-post-help">You can still change the channel, status, and caption once the row opens.</div>
            </div>
            <div className="field">
              <div className="lbl">Title</div>
              <input
                ref={titleRef}
                className="inp"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Monthly metrics + studio recap"
              />
            </div>
            <div className="add-post-row">
              <div className="field">
                <div className="lbl">Date</div>
                <input className="inp" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
              </div>
              <div className="field">
                <div className="lbl">Time PT</div>
                <input className="inp" type="time" value={timeValue} onChange={(event) => setTimeValue(event.target.value)} />
              </div>
            </div>
            <div className="add-post-preview">
              <div>
                <div className="add-post-preview-title">{title.trim() || "Untitled post"}</div>
                <div className="add-post-preview-meta">
                  {previewDate
                    ? `${previewDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${timeValue} PT`
                    : "Choose a date and time"}
                </div>
              </div>
              <div className="plat-pill" style={{background:"rgba(24,23,20,0.05)",color:T.text}}>
                <span className="pill-dot" style={{background:T.orangeBright}} />
                Instagram Post
              </div>
            </div>
          </div>
          <div className="m-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!canCreate}>Create post</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── COMPOSER MODAL ───────────────────────────────────────────────
function Composer({ row, onClose, onPosted, postNow }) {
  const publishApiUrl = import.meta.env.VITE_PUBLISH_API_URL || "";
  const [plat,    setPlat]    = useState(row?.platform==="ig_story"?"ig_post":row?.platform||"ig_post");
  const [caption, setCaption] = useState(row?.caption||"");
  const [files,   setFiles]   = useState([]);
  const [fileUrls,setFileUrls]= useState([]);
  const [drag,    setDrag]    = useState(false);
  const [st,      setSt]      = useState(postNow?"posting":"idle");
  const [errMsg,  setErrMsg]  = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const fRef = useRef(null);
  const p = PLATFORMS[plat];
  const isLI = plat === "linkedin";
  const maxFiles = isLI ? 9 : 1;

  const schedDisp = row?.scheduledAt ? toPTDisplay(row.scheduledAt) : null;

  const addFiles = (newFiles) => {
    if (!newFiles || newFiles.length === 0) return;
    const incoming = Array.from(newFiles);
    if (!isLI) {
      // Single file for IG
      const f = incoming[0];
      setFiles([f]);
      setFileUrls(f.type.startsWith("image/") ? [URL.createObjectURL(f)] : []);
      return;
    }
    const remaining = maxFiles - files.length;
    const toAdd = incoming.slice(0, remaining);
    setFiles(prev => [...prev, ...toAdd]);
    setFileUrls(prev => [...prev, ...toAdd.filter(f => f.type.startsWith("image/")).map(f => URL.createObjectURL(f))]);
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setFileUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const doPost = useCallback(async () => {
    setSt("posting"); setErrMsg("");
    try {
      if (!publishApiUrl) {
        throw new Error("Publishing is not configured yet. Add VITE_PUBLISH_API_URL when the server-side publish endpoint is ready.");
      }
      const res = await fetch(publishApiUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform:plat,caption,mediaUrls:fileUrls})});
      const data = await res.json();
      if(!data.success) throw new Error(data.error||"Unknown error");
      setSt("done"); onPosted?.();
    } catch(err){ setSt("error"); setErrMsg(err.message); }
  }, [caption, fileUrls, onPosted, plat, publishApiUrl]);

  // If postNow, fire immediately on mount
  useEffect(() => { if(postNow) doPost(); }, [doPost, postNow]);

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
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div className="lbl">Media{isLI && files.length > 0 ? ` (${files.length}/${maxFiles})` : ""}</div>
                {isLI && fileUrls.length > 0 && (
                  <button className="btn btn-ghost" style={{padding:"3px 10px",fontSize:11}} onClick={()=>setShowPreview(true)}>Preview</button>
                )}
              </div>
              {files.length > 0 ? (
                isLI ? (
                  <div className="media-grid">
                    {fileUrls.map((url, i) => (
                      <div key={i} className="media-grid-item">
                        <img src={url} alt="" />
                        <button className="media-rm" onClick={() => removeFile(i)}>✕</button>
                      </div>
                    ))}
                    {files.length < maxFiles && (
                      <div className="media-add-btn" onClick={() => fRef.current?.click()}>
                        <span>+</span>
                        <span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>Add</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div><div className="fp"><span style={{fontSize:17}}>{files[0].type.startsWith("image")?"img":"vid"}</span><span className="fn">{files[0].name}</span><button className="frm" onClick={()=>{setFiles([]);setFileUrls([]);}}>✕</button></div>{fileUrls[0]&&<img src={fileUrls[0]} className="ip" alt=""/>}</div>
                )
              ) : (
                <div className={`upload ${drag?"drag":""}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files)}} onClick={()=>fRef.current?.click()}>
                  <input ref={fRef} type="file" accept="image/*,video/*,image/gif" multiple={isLI} onChange={e=>{addFiles(e.target.files);e.target.value="";}}/>
                  <div style={{fontSize:22,opacity:0.35,marginBottom:7}}>↑</div>
                  <div style={{fontSize:13,color:T.textSub}}>Drop {isLI ? "files" : "file"} or click to browse</div>
                  <div style={{fontSize:11,color:T.textDim,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>{isLI ? "Up to 9 images · JPG · PNG" : "JPG · PNG · GIF · MP4 · MOV"}</div>
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
      {showPreview && <LinkedInPreview caption={caption} mediaUrls={fileUrls} onClose={()=>setShowPreview(false)} />}
    </div>
  );
}

// ─── STORY DESIGNER ───────────────────────────────────────────────
// ─── CANVAS ELEMENT ──────────────────────────────────────────────
const BRAND_COLORS = ["#111318","#7C3AED","#F59E0B","#0A66C2","#BE185D","#FFFFFF","#F7F8FA","#10B981","#E5E7EB"];
const FONTS = ["Bricolage Grotesque","JetBrains Mono"];

function fitMediaBox(width, height, maxWidth = 260, maxHeight = 460) {
  if (!width || !height) {
    return { width: 140, height: 140 };
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(48, Math.round(width * scale)),
    height: Math.max(48, Math.round(height * scale)),
  };
}

function CanvasElement({ data, isSelected, onSelect, onUpdate }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const isVideo = data.mediaType === 'video';
  const mediaScale = data.scale || 1;
  const mediaWidth = data.width || 140;
  const mediaHeight = data.height || 140;
  const wrapperStyle = {
    left: data.x,
    top: data.y,
    zIndex: isSelected ? 10 : 2,
    ...(data.type === "image"
      ? {
          width: mediaWidth,
          height: mediaHeight,
          transform: `scale(${mediaScale})`,
        }
      : null),
  };

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

  return (
    <div
      className={"element-wrap " + (isSelected ? "element-selected" : "")}
      style={wrapperStyle}
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
        <div className="video-el">
          <video ref={videoRef} src={data.url}
            style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:4,display:'block'}}
            autoPlay={data.autoPlay!==false} loop={data.loop!==false}
            muted={data.muted!==false} playsInline draggable={false}
            onLoadedMetadata={(e)=>{
              const fitted = fitMediaBox(e.currentTarget.videoWidth, e.currentTarget.videoHeight);
              if (fitted.width !== data.width || fitted.height !== data.height) onUpdate(fitted);
            }}/>
          <div className="video-badge">{data.trimLabel||'VID'}</div>
          <button className="mute-toggle" onClick={e=>{e.stopPropagation();onUpdate({muted:!data.muted});}}>
            {data.muted!==false?'Mute':'Sound'}
          </button>
        </div>
      ) : (
        <img src={data.url} alt="" draggable="false"
          style={{display:'block',width:'100%',height:'100%',borderRadius:4,pointerEvents:'none'}}
          onLoad={(e)=>{
            const fitted = fitMediaBox(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
            if (fitted.width !== data.width || fitted.height !== data.height) onUpdate(fitted);
          }}/>
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
  { name:"Oakes Grotesk",       label:"Oakes",      group:"brand" },
  { name:"Plaak Ney",           label:"Plaak",      group:"brand" },
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
  useEffect(() => { if (onSave) onSave(elements); }, [elements, onSave]);

  const [selectedId,  setSelectedId]  = useState(null);
  const [zoom,        setZoom]        = useState(1.5);
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
    const makeEl = (w, h) => {
      const el = {
        id:uid(),
        type:"image",
        url,
        x:56,
        y:140,
        scale:1,
        width: w,
        height: h,
        locked:false,
        mediaType: mType,
        loop:true,
        muted:true,
        autoPlay:true,
        trimLabel: file.name.split('.').pop().toUpperCase(),
      };
      setElements(els => [...els, el]); setSelectedId(el.id);
    };
    if (!isVid) {
      const img = new Image();
      img.onload = () => { const fitted = fitMediaBox(img.naturalWidth, img.naturalHeight); makeEl(fitted.width, fitted.height); };
      img.src = url;
    } else {
      makeEl(160, 90);
    }
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
                      <div className="s-toggle" style={{background:selected.shadow?T.ink:T.border2}}
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
                      <div className="s-toggle" style={{background:selected.loop!==false?T.ink:T.border2}}
                        onClick={()=>updateEl(selectedId,{loop:!(selected.loop!==false)})}>
                        <div className="s-toggle-knob" style={{left:selected.loop!==false?14:2}}/>
                      </div>
                    </div>

                    <div className="s-toggle-row">
                      <div className="lbl" style={{margin:0}}>Mute</div>
                      <div className="s-toggle" style={{background:selected.muted!==false?T.ink:T.border2}}
                        onClick={()=>updateEl(selectedId,{muted:!(selected.muted!==false)})}>
                        <div className="s-toggle-knob" style={{left:selected.muted!==false?14:2}}/>
                      </div>
                    </div>

                    <div className="lbl" style={{marginBottom:2,marginTop:4}}>Volume — {Math.round((selected.volume||0)*100)}%</div>
                    <input type="range" className="s-slider" min={0} max={1} step={0.05} value={selected.volume||0}
                      onChange={e=>updateEl(selectedId,{volume:parseFloat(e.target.value),muted:parseFloat(e.target.value)===0})}/>

                    <div style={{marginTop:4}}>
                      <div className="lbl" style={{marginBottom:4}}>Trim (placeholder)</div>
                      <div style={{height:20,background:T.s3,borderRadius:6,position:"relative",overflow:"hidden",border:`1px solid ${T.border}`}}>
                        <div style={{position:"absolute",left:"10%",right:"20%",top:0,bottom:0,background:"rgba(24,23,20,0.12)",borderLeft:`2px solid ${T.ink}`,borderRight:`2px solid ${T.ink}`,borderRadius:3}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:9,color:T.textDim,fontFamily:"'JetBrains Mono',monospace"}}>
                        <span>0:00</span><span style={{color:T.text}}>Selected range</span><span>0:15</span>
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
                <button className="zoom-btn" style={{fontSize:9,letterSpacing:.3,width:"auto",padding:"0 4px"}} onClick={()=>setZoom(1.5)} title="Reset zoom">150%</button>
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

// ─── PLATFORM ICON ────────────────────────────────────────────────
function PlatformIcon({ platform, size = 16 }) {
  if (platform === "linkedin") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{display:"block"}}>
        <rect width="24" height="24" rx="4" fill="#0A66C2"/>
        <path d="M7.5 10v7h-2v-7h2zm-1-3.2a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zM9.5 10h1.9v1h.03c.27-.5 1-1.1 2.07-1.1 2.2 0 2.6 1.45 2.6 3.34V17h-2v-3.4c0-.8-.01-1.85-1.13-1.85-1.13 0-1.3.88-1.3 1.8V17h-2v-7z" fill="#fff"/>
      </svg>
    );
  }
  // Instagram (ig_post, ig_story)
  const id = "ig-grad-" + size;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{display:"block"}}>
      <defs>
        <radialGradient id={id} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497"/>
          <stop offset="5%" stopColor="#fdf497"/>
          <stop offset="45%" stopColor="#fd5949"/>
          <stop offset="60%" stopColor="#d6249f"/>
          <stop offset="90%" stopColor="#285AEB"/>
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill={`url(#${id})`}/>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="#fff" strokeWidth="1.5" fill="none"/>
      <circle cx="12" cy="12" r="3.8" stroke="#fff" strokeWidth="1.5" fill="none"/>
      <circle cx="17" cy="7" r="1.1" fill="#fff"/>
    </svg>
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
        <div className="stage-ai-title"><span>Caption assist</span></div>
        <button style={{background:"transparent",border:"none",color:T.textSub,fontSize:11,fontWeight:700,cursor:"pointer",padding:0}}
          onClick={generate} disabled={loading}>{loading ? "Drafting…" : "Generate"}</button>
      </div>
      <input style={{background:"rgba(255,255,255,0.72)",border:`1px solid ${T.border}`,borderRadius:10,fontSize:12,padding:"9px 11px",outline:"none",color:T.text,width:"100%"}}
        value={prompt} onChange={e=>setPrompt(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&generate()} placeholder="Describe the angle you want…"/>
      {(result||loading) && (
        <div className={`stage-ai-result ${loading&&!result?"stage-ai-typing":""}`}>{result||" "}</div>
      )}
      {result && !loading && (
        <button style={{background:T.s3,border:`1px solid ${T.border2}`,borderRadius:999,padding:"7px 11px",fontSize:11,fontWeight:700,color:T.textSub,cursor:"pointer",alignSelf:"flex-end"}}
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [mediaUrls,  setMediaUrls]  = useState([]);
  const [showLIPreview, setShowLIPreview] = useState(false);
  const storyElements = row.storyElements || makeDefaultElements(row.note);
  const mediaRef = useRef(null);
  const isLI = row.platform === "linkedin";
  const maxFiles = isLI ? 9 : 1;
  const titleInputRef = useRef(null);
  const menuRef = useRef(null);
  const approvalRef = useRef(null);

  const submitComment = () => { if(!commentText.trim()) return; onAddComment({id:uid(),author:currentUser,text:commentText,ts:"just now"}); setCommentText(""); };
  const max    = row.platform==="linkedin"?3000:2200;
  const capLen = (row.caption||"").length;
  const over   = capLen>max, warn = capLen>max*0.88;
  const checks = getReadinessChecks(row, mediaUrls.length > 0);
  const readyCount = checks.filter((check) => check.pass).length;
  const updatedLabel = formatRelativeStamp(row.updatedAt);
  useEffect(() => {
    if (!isEditingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isApprovalOpen) return undefined;
    const handlePointerDown = (event) => {
      if (approvalRef.current && !approvalRef.current.contains(event.target)) {
        setIsApprovalOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isApprovalOpen]);

  return (
    <>
    <div className={"row-container " + (isExpanded?"is-open":"")}>
      <div className={`t-row ${sel?"sel":""} ${dragHandlers.isDragging?"dragging":""} ${dragHandlers.isDragOver?"drag-over":""}`}
        style={isMenuOpen ? {zIndex:20} : undefined}
        onMouseEnter={dragHandlers.onMouseEnter}
        onClick={() => { if (!isEditingTitle) setIsExpanded((current) => !current); }}>
        <div style={{display:"flex",alignItems:"center"}} onClick={(e)=>e.stopPropagation()}><input type="checkbox" className="cb" checked={sel} onChange={e=>onSel(e.target.checked)}/></div>
        <div
          className="drag-handle"
          style={{letterSpacing:"-1px",fontSize:"10px",opacity:0.4}}
          onMouseDown={dragHandlers.onMouseDown}
          onClick={(e)=>e.stopPropagation()}
        >
          · ·<br/>· ·
        </div>

        <div onClick={(e)=>e.stopPropagation()}>
          <DateTimeCell isoValue={row.scheduledAt} onChange={v=>onChange({scheduledAt:v})}/>
        </div>

        <div style={{minWidth:0}} onClick={isEditingTitle ? (e)=>e.stopPropagation() : undefined}>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              className="note-in"
              value={row.note}
              placeholder="Post title…"
              onChange={e=>onChange({note:e.target.value})}
              onBlur={()=>setIsEditingTitle(false)}
              onKeyDown={(e)=>{ if (e.key === "Enter") setIsEditingTitle(false); if (e.key === "Escape") setIsEditingTitle(false); }}
              title={row.note}
            />
          ) : (
            <div className="note-display" title={row.note || "Untitled post"}>
              {row.note || "Untitled post"}
            </div>
          )}
        </div>

        <div className="row-menu" ref={menuRef} onClick={(e)=>e.stopPropagation()}>
          <button className="row-menu-trigger" onClick={() => setIsMenuOpen((current) => !current)}>
            <span className="row-menu-dots"><span/><span/><span/></span>
          </button>
          {isMenuOpen && (
            <div className="row-menu-popover">
              <button className="row-menu-option" onClick={() => { setIsMenuOpen(false); setIsEditingTitle(true); }}>
                Edit title
              </button>
            </div>
          )}
        </div>

        <div onClick={(e)=>e.stopPropagation()}><button className="plat-pill" onClick={nextP} title={p.label}><PlatformIcon platform={row.platform} size={18}/></button></div>
        <div onClick={(e)=>e.stopPropagation()}><button className="status-pill" onClick={nextS} title={`Next: ${STATUSES[s.next]?.label}`}><span className="s-dot" style={{background:s.dot}}/>{s.label}</button></div>

        <div className="ra" onClick={(e)=>e.stopPropagation()}>
          {row.comments?.length > 0 && (
            <span style={{fontSize:9.5,fontFamily:"'JetBrains Mono',monospace",padding:"2px 6px",background:T.s3,borderRadius:10,border:"1px solid "+T.border,color:T.textDim}}>{row.comments.length}</span>
          )}
          <button className="ib d" title="Delete" onClick={onDel}>✕</button>
        </div>
      </div>

      {/* ── STAGE WELL ── */}
      <div className={"stage-reveal-wrapper "+(isExpanded?"open":"")}>
        <div className="stage-content-well">
          <div className="stage-stack">
            <div className="stage-summary">
              <div>
                <div className="stage-summary-title">{row.note || "Untitled post"}</div>
                <div className="stage-summary-meta">
                  <span>{p.label}</span>
                  <span>{STATUSES[row.status]?.label}</span>
                  <span>{readyCount}/{checks.length} ready</span>
                  <span>Updated {updatedLabel}</span>
                </div>
              </div>
              <div className="stage-summary-actions">
                <button className="btn btn-ghost" style={{padding:"8px 12px"}} onClick={() => setShowAI((current) => !current)}>
                  {showAI ? "Hide assist" : "Caption assist"}
                </button>
                <button className="btn btn-primary" style={{padding:"8px 12px"}} onClick={() => { onPostNow(); setIsExpanded(false); }}>
                  Post now
                </button>
              </div>
            </div>

            <div className="stage-grid">
              <section className="stage-section">
                <div className="stage-col-label">Media & Placement</div>
                <div className="quick-status">
                  {Object.entries(PLATFORMS).map(([key, platform]) => (
                    <button
                      key={key}
                      className={"qs-btn " + (row.platform===key?"active":"")}
                      style={row.platform===key?{color:platform.color,borderColor:platform.color,background:platform.bg}:{}}
                      onClick={()=>onChange({platform:key})}
                    >
                      {platform.label}
                    </button>
                  ))}
                </div>
                {row.platform==="ig_story" ? (
                  <StoryThumbnail elements={storyElements} onClick={onStory}/>
                ) : (
                  <div>
                    <input ref={mediaRef} type="file" accept="image/*,video/*,image/gif" multiple={isLI} style={{display:"none"}}
                      onChange={e=>{
                        const picked = Array.from(e.target.files || []);
                        if (!picked.length) return;
                        if (isLI) {
                          const remaining = maxFiles - mediaUrls.length;
                          const urls = picked.slice(0, remaining).filter(f => f.type.startsWith("image/")).map(f => URL.createObjectURL(f));
                          setMediaUrls(prev => [...prev, ...urls]);
                        } else {
                          const f = picked[0];
                          if (f.type.startsWith("image/") || f.type.startsWith("video/")) setMediaUrls([URL.createObjectURL(f)]);
                        }
                        e.target.value = "";
                      }}/>
                    {mediaUrls.length > 0 ? (
                      isLI ? (
                        <div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.textDim}}>{mediaUrls.length}/{maxFiles} images</span>
                            <button className="btn btn-ghost" style={{padding:"3px 10px",fontSize:11}} onClick={()=>setShowLIPreview(true)}>Preview</button>
                          </div>
                          <div className="media-grid">
                            {mediaUrls.map((url, i) => (
                              <div key={i} className="media-grid-item">
                                <img src={url} alt="" />
                                <button className="media-rm" onClick={() => setMediaUrls(prev => prev.filter((_, j) => j !== i))}>✕</button>
                              </div>
                            ))}
                            {mediaUrls.length < maxFiles && (
                              <div className="media-add-btn" onClick={() => mediaRef.current?.click()}>
                                <span>+</span>
                                <span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>Add</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="stage-thumb">
                          <img src={mediaUrls[0]} alt="" />
                          <div className="stage-thumb-overlay">
                            <button className="stage-thumb-btn" onClick={() => setMediaUrls([])}>Remove</button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="stage-post-placeholder" onClick={()=>mediaRef.current?.click()}>
                        <span style={{fontSize:22,opacity:0.22}}>↑</span>
                        <span style={{fontSize:11.5,color:T.textSub,fontWeight:500}}>Attach media</span>
                        <span style={{fontSize:10,color:T.textDim,fontFamily:"'JetBrains Mono',monospace"}}>{isLI ? "Up to 9 images · JPG · PNG" : "JPG · PNG · GIF · MP4"}</span>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="stage-section">
                <div className="stage-col-label">Caption</div>
                <textarea className="stage-txa"
                  value={row.caption||""}
                  placeholder={`Write your ${p.label} caption in a calm, ready-to-publish draft`}
                  onChange={e=>onChange({caption:e.target.value})}
                  rows={5}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:-4}}>
                  <span className={`stage-char ${over?"over":warn?"warn":""}`}>{capLen} / {max}</span>
                  <span className="stage-char">{row.caption ? "Draft in progress" : "Start with the core message"}</span>
                </div>
                {showAI && (
                  <StageAIWriter platform={row.platform} note={row.note} caption={row.caption}
                    onAccept={t=>onChange({caption:t})}/>
                )}
              </section>
            </div>

            <div className="stage-dual">
              <section className="stage-section">
                <div className="stage-col-label">Comments</div>
                {(row.comments||[]).slice(-3).map(c=>{
                  const m=TEAM.find(t=>t.id===c.author)||{initials:"?",color:T.textDim,name:"Unknown"};
                  return (
                    <div key={c.id} style={{display:"flex",gap:9,alignItems:"flex-start",marginBottom:2}}>
                      <div style={{width:22,height:22,borderRadius:7,background:m.color+"22",color:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8.5,fontWeight:700,flexShrink:0}}>{m.initials}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:600,color:T.text,marginBottom:2}}>{m.name} <span style={{color:T.textDim,fontWeight:400,fontFamily:"'JetBrains Mono',monospace",fontSize:9}}>{c.ts}</span></div>
                        <div style={{fontSize:12.5,color:T.textSub,lineHeight:1.55}}>{c.text}</div>
                      </div>
                    </div>
                  );
                })}
                {(row.comments||[]).length===0 && <div className="cal-panel-empty" style={{padding:"10px 0 0"}}>No comments yet. Keep approvals and notes here.</div>}
                <div style={{display:"flex",gap:8,marginTop:"auto"}}>
                  <input className="comment-input" style={{fontSize:12,padding:"9px 11px"}} placeholder="Add a comment…" value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitComment()}/>
                  <button className="btn btn-ghost" style={{padding:"8px 12px",fontSize:11.5,flexShrink:0}} onClick={submitComment}>Send</button>
                </div>
              </section>

              <section className="stage-section">
                <div className="stage-col-label">Approval</div>
                <div className="stage-governance">
                  <div className="stage-select" ref={approvalRef}>
                    <button className="stage-select-trigger" onClick={() => setIsApprovalOpen((current) => !current)}>
                      <span className="stage-select-copy">
                        <span className="stage-select-label">State</span>
                        <span className="stage-select-value">
                          <span className="s-dot" style={{background:s.dot, marginRight:0}} />
                          {s.label}
                        </span>
                      </span>
                      <span className="stage-select-caret" />
                    </button>
                    {isApprovalOpen && (
                      <div className="stage-select-menu">
                        {Object.entries(STATUSES).map(([k, st]) => (
                          <button
                            key={k}
                            className={"stage-select-option " + (row.status === k ? "on" : "")}
                            onClick={() => {
                              onChange({ status: k });
                              setIsApprovalOpen(false);
                            }}
                          >
                            <span style={{display:"inline-flex",alignItems:"center",gap:8}}>
                              <span className="s-dot" style={{background:st.dot, marginRight:0}} />
                              {st.label}
                            </span>
                            {row.status === k ? <span className="ops-option-mark">Current</span> : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="stage-mini-stack">
                    <div className="stage-mini-row" onClick={nextAssignee} style={{cursor:"pointer"}}>
                      <span className="stage-mini-key">Owner</span>
                      <span className="stage-mini-val" style={{display:"inline-flex",alignItems:"center",gap:6}}>
                        {assignee ? <><div className="av" style={{width:16,height:16,background:assignee.color+"22",color:assignee.color,fontSize:7,borderRadius:4,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{assignee.initials}</div>{assignee.name}</> : "Unassigned"}
                      </span>
                    </div>
                    <div className="stage-mini-row">
                      <span className="stage-mini-key">Updated</span>
                      <span className="stage-mini-val">{updatedLabel}</span>
                    </div>
                    <div className="stage-mini-row">
                      <span className="stage-mini-key">Readiness</span>
                      <span className="stage-mini-val">{readyCount}/{checks.length} ready</span>
                    </div>
                  </div>
                </div>
              </section>
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
    {showLIPreview && <LinkedInPreview caption={row.caption} mediaUrls={mediaUrls} onClose={()=>setShowLIPreview(false)} />}
    </>
  );
}
// ─── TOAST ───────────────────────────────────────────────────────
function Toast({ msg, color, onDone }) {
  useEffect(()=>{const t=setTimeout(onDone,3200);return()=>clearTimeout(t);},[onDone]);
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
  }, [onDone]);
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
  const { userId, getToken } = useAuth();
  const { user } = useUser();
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
  const [view, setView]           = useState("list");
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

  const createPostDraft = ({ title, dateValue, timeValue }) => {
    const [targetYear, targetMonth, day] = dateValue.split("-").map(Number);
    const [hour, minute] = timeValue.split(":").map(Number);
    const iso = ptPickerToISO(targetYear, targetMonth - 1, day, hour, minute);
    updateDocument(
      (current) => ({
        ...current,
        rows: [...current.rows, createNewRow({ scheduledAt: iso, note: title }, currentUser, current.rows.length)],
      }),
      () => createAuditEntry("post.created", currentUser, "Created a new post draft", { scheduledAt: iso, title }),
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
      onPostNow={()=>setComposer({row,postNow:true})}
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
              <div style={{margin:"0 0 14px",padding:"28px 28px 24px",borderRadius:20,background:"linear-gradient(135deg,#e8834a 0%,#7b68ee 50%,#4a90d9 100%)",border:"none",boxShadow:"0 8px 32px rgba(124,92,200,0.18)"}}>
                <div style={{fontSize:36,fontWeight:700,color:"#fff",letterSpacing:"-0.03em",lineHeight:1}}>{MONTHS_FULL[month]}</div>
                <div style={{fontSize:14,fontWeight:500,color:"rgba(255,255,255,0.75)",marginTop:6,letterSpacing:"0.02em"}}>{year}</div>
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
    </div>
  );
}
