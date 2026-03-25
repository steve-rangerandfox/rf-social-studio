export const T = {
  bg: "#F3EEE5",
  surface: "#FEFCF8",
  s2: "#F7F1E8",
  s3: "#ECE1D3",
  border: "#D8CABA",
  border2: "#BAAA96",
  ink: "#181714",
  inkFog: "rgba(24,23,20,0.05)",
  mint: "#181714",
  mintDim: "#11100E",
  mintFog: "rgba(24,23,20,0.05)",
  text: "#181714",
  textSub: "#4E473E",
  textDim: "#746B5E",
  red: "#DC2626",
  amber: "#C96A12",
  blue: "#3F5963",
  pink: "#6D5C55",
  orange: "#E56A0B",
  orangeBright: "#FF7A00",
  gold: "#F0B24D",
  lilac: "#D99BFF",
  cyan: "#82C7FF",
  purple: "#5E554E",
  posterGrad: "linear-gradient(135deg, #FF7A00 0%, #F0B24D 24%, #D99BFF 58%, #82C7FF 100%)",
  posterGradSoft: "linear-gradient(135deg, rgba(255,122,0,0.18) 0%, rgba(240,178,77,0.14) 24%, rgba(217,155,255,0.12) 58%, rgba(130,199,255,0.16) 100%)",
};

export const PLATFORMS = {
  ig_post: { label: "Instagram Post", short: "IG Post", color: "#49433B", bg: "rgba(73,67,59,0.07)" },
  ig_story: { label: "Instagram Story", short: "Story", color: "#6E655D", bg: "rgba(110,101,93,0.07)" },
  ig_reel: { label: "Instagram Reel", short: "Reel", color: "#49433B", bg: "rgba(73,67,59,0.07)" },
  tiktok: { label: "TikTok", short: "TikTok", color: "#1A1A2E", bg: "rgba(26,26,46,0.07)" },
  facebook: { label: "Facebook", short: "Facebook", color: "#1877F2", bg: "rgba(24,119,242,0.07)" },
  linkedin: { label: "LinkedIn", short: "LinkedIn", color: "#4B5F66", bg: "rgba(75,95,102,0.08)" },
};

export const STATUSES = {
  idea: { label: "Idea", dot: "#B5ADA0", next: "draft" },
  draft: { label: "Draft", dot: "#93897C", next: "needs_review" },
  needs_review: { label: "Needs Review", dot: "#E56A0B", next: "approved" },
  approved: { label: "Approved", dot: "#5E6659", next: "scheduled" },
  scheduled: { label: "Scheduled", dot: "#66727A", next: "posted" },
  posted: { label: "Posted", dot: "#181714", next: "idea" },
};

export const DEFAULT_TEAM = [
  { id: "stephen", name: "Stephen", initials: "SC", color: "#0369A1", role: "Creative Director" },
  { id: "allyson", name: "Allyson", initials: "AL", color: "#BE185D", role: "Content Lead" },
  { id: "jared", name: "Jared", initials: "JR", color: "#7C3AED", role: "Designer" },
];

const TEAM_STORAGE_KEY = "rf_studio_team";

export function loadTeam() {
  try {
    const stored = JSON.parse(localStorage.getItem(TEAM_STORAGE_KEY) || "null");
    if (Array.isArray(stored) && stored.length > 0) return stored;
  } catch {}
  return DEFAULT_TEAM;
}

export function saveTeam(team) {
  try {
    localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(team));
    return true;
  } catch { return false; }
}

export function createTeamMember({ name, role = "" }) {
  const initials = name.split(" ").map(w => w[0]?.toUpperCase() || "").join("").slice(0, 2);
  const colors = ["#0369A1", "#BE185D", "#7C3AED", "#059669", "#D97706", "#DC2626"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return { id: name.toLowerCase().replace(/\s+/g, "_"), name, initials, color, role };
}

// Keep backward compatibility - TEAM is still exported
export const TEAM = loadTeam();

export const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WD_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

export const MENTIONS = [
  { id: 1, name: "Microsoft", handle: "microsoft" },
  { id: 2, name: "Adobe", handle: "adobe" },
  { id: 3, name: "Moonvalley", handle: "moonvalley" },
  { id: 4, name: "Clio Awards", handle: "clioawards" },
  { id: 5, name: "Stash Magazine", handle: "stashmedia" },
];

export const MOCK_ANALYTICS = {
  posts: [
    { label: "Jan", ig: 12, li: 4, reach: 2100 },
    { label: "Feb", ig: 9, li: 6, reach: 1800 },
    { label: "Mar", ig: 14, li: 5, reach: 2900 },
    { label: "Apr", ig: 11, li: 8, reach: 2400 },
    { label: "May", ig: 16, li: 7, reach: 3600 },
    { label: "Jun", ig: 13, li: 9, reach: 3100 },
  ],
  topTimes: [
    { time: "9am", score: 88 },
    { time: "11am", score: 72 },
    { time: "3pm", score: 94 },
    { time: "6pm", score: 81 },
    { time: "8pm", score: 67 },
  ],
  engagement: { ig_post: 4.2, ig_story: 7.8, linkedin: 3.1 },
  reach: { ig_post: 1840, ig_story: 2200, linkedin: 980 },
};

export const TEMPLATES = {
  announce: {
    name: "Announcement",
    bg: "#080A0E",
    layers: [
      { type: "label", text: "RANGER & FOX", x: 20, y: 24, sz: 8.5, color: T.ink, ls: 3 },
      { type: "rule", x: 20, y: 44, ww: 32, color: T.mint },
      { type: "head", key: "headline", x: 20, y: 155, sz: 25, color: "#fff" },
      { type: "body", key: "sub", x: 20, y: 203, sz: 12, color: "#aaa" },
    ],
  },
  showcase: {
    name: "Work Showcase",
    bg: "#080A0E",
    layers: [
      { type: "label", text: "NOW SHOWING", x: 20, y: 24, sz: 8, color: "#C9F5E5", ls: 4 },
      { type: "head", key: "headline", x: 20, y: 305, sz: 21, color: "#fff" },
      { type: "body", key: "sub", x: 20, y: 342, sz: 11, color: "#999" },
    ],
  },
  tip: {
    name: "Weekly Tip",
    bg: "#050D08",
    layers: [
      { type: "label", text: "MOTION TIP", x: 20, y: 24, sz: 8, color: T.ink, ls: 4 },
      { type: "num", key: "num", x: 20, y: 95, sz: 54, color: T.mint },
      { type: "head", key: "headline", x: 20, y: 178, sz: 21, color: "#fff" },
      { type: "body", key: "sub", x: 20, y: 215, sz: 12, color: "#bbb" },
    ],
  },
};

export const MAX_NOTE_LENGTH = 280;
export const MAX_CAPTION_LG = 3000;
export const MAX_CAPTION_IG = 2200;

export function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 11);
}

export function formatRelativeStamp(isoString) {
  if (!isoString) {
    return "Not saved yet";
  }

  const stamp = new Date(isoString);
  const diffMs = Date.now() - stamp.getTime();
  const diffMins = Math.max(0, Math.round(diffMs / 60000));

  if (diffMins < 1) {
    return "Just now";
  }

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return stamp.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getReadinessChecks(row, mediaAttached = false) {
  const max = row.platform === "linkedin" ? 3000 : 2200;
  const capLen = (row.caption || "").length;
  const over = capLen > max;
  const warn = capLen > max * 0.88;

  return [
    { label: "Caption", pass: capLen > 0 && !over, warn, msg: over ? "Over limit" : capLen === 0 ? "Missing" : warn ? "Near limit" : "Ready" },
    { label: "Media", pass: !!mediaAttached || row.platform === "linkedin", warn: !mediaAttached && row.platform !== "linkedin", msg: mediaAttached ? "Attached" : row.platform === "linkedin" ? "Optional" : "Needs asset" },
    { label: "Scheduled", pass: !!row.scheduledAt, warn: false, msg: row.scheduledAt ? "Set" : "Missing" },
    { label: "Owner", pass: !!row.assignee, warn: false, msg: row.assignee ? TEAM.find((teamMember) => teamMember.id === row.assignee)?.name || "Assigned" : "Unassigned" },
    { label: "Approval", pass: row.status === "approved" || row.status === "scheduled" || row.status === "posted", warn: row.status === "needs_review", msg: STATUSES[row.status]?.label || "Unknown" },
  ];
}

export function isRowNeedingAttention(row, mediaAttached = false) {
  const checks = getReadinessChecks(row, mediaAttached);
  return checks.some((check) => !check.pass || check.warn);
}

export function clampNote(value) {
  return typeof value === "string" ? value.slice(0, MAX_NOTE_LENGTH) : "";
}

export function clampCaption(value, platform) {
  const max = platform === "linkedin" ? MAX_CAPTION_LG : MAX_CAPTION_IG;
  return typeof value === "string" ? value.slice(0, max) : "";
}

export function makeDefaultElements(note) {
  return [
    { id: "bg", type: "image", url: null, x: 0, y: 0, scale: 1, locked: true, mediaType: "image" },
    {
      id: "rf1",
      type: "text",
      content: "RANGER & FOX",
      x: 20,
      y: 22,
      fontSize: 8.5,
      fontFamily: "JetBrains Mono",
      color: "rgba(255,255,255,0.55)",
      letterSpacing: 3,
      fontWeight: 600,
      shadow: false,
    },
    {
      id: "rf2",
      type: "text",
      content: note || "Headline",
      x: 20,
      y: 155,
      fontSize: 24,
      fontFamily: "Bricolage Grotesque",
      color: "#FFFFFF",
      letterSpacing: -0.5,
      fontWeight: 700,
      shadow: true,
    },
    {
      id: "rf3",
      type: "text",
      content: "Supporting detail",
      x: 20,
      y: 205,
      fontSize: 12,
      fontFamily: "Bricolage Grotesque",
      color: "rgba(255,255,255,0.55)",
      letterSpacing: 0,
      fontWeight: 400,
      shadow: false,
    },
  ];
}

export function nowPT() {
  const date = new Date();
  const ptString = date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  return new Date(ptString);
}

export function toPTDisplay(isoString) {
  if (!isoString) {
    return null;
  }

  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    ampm: getPart("dayPeriod"),
  };
}

export function ptPickerToISO(year, month, day, hour24, minute) {
  const ptString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  return new Date(`${ptString}-08:00`).toISOString();
}

export const currentYear = new Date().getFullYear();
export const currentMonth = new Date().getMonth();

export function makeISO(day, hour24, minute, targetMonth = currentMonth) {
  return ptPickerToISO(currentYear, targetMonth, day, hour24, minute);
}

export function createSeedRows() {
  return [
    {
      id: uid(),
      scheduledAt: makeISO(4, 9, 0),
      note: "AI workflow reveal — Weavy pipeline",
      caption: "",
      platform: "ig_post",
      status: "approved",
      assignee: "stephen",
      comments: [],
      storyElements: null,
      order: 0,
    },
    {
      id: uid(),
      scheduledAt: makeISO(8, 11, 0),
      note: "Weekly motion tip — ep. 12",
      caption: "",
      platform: "ig_story",
      status: "needs_review",
      assignee: "allyson",
      comments: [{ id: uid(), author: "allyson", text: "Love the concept — can we add a Reels cut too?", ts: new Date(Date.now() - 2 * 3600000).toISOString() }],
      storyElements: null,
      order: 1,
    },
    {
      id: uid(),
      scheduledAt: makeISO(14, 10, 0),
      note: "Clio nomination announcement",
      caption: "",
      platform: "linkedin",
      status: "draft",
      assignee: "jared",
      comments: [],
      storyElements: null,
      order: 2,
    },
    {
      id: uid(),
      scheduledAt: makeISO(19, 9, 0),
      note: "Behind-the-scenes: Microsoft Fabric reel",
      caption: "",
      platform: "ig_post",
      status: "idea",
      assignee: null,
      comments: [],
      storyElements: null,
      order: 3,
    },
    {
      id: uid(),
      scheduledAt: makeISO(23, 14, 0),
      note: "Team spotlight",
      caption: "",
      platform: "ig_story",
      status: "idea",
      assignee: null,
      comments: [],
      storyElements: null,
      order: 4,
    },
    {
      id: uid(),
      scheduledAt: makeISO(28, 14, 0),
      note: "Monthly metrics + studio recap",
      caption: "",
      platform: "linkedin",
      status: "draft",
      assignee: "stephen",
      comments: [],
      storyElements: null,
      order: 5,
    },
  ];
}
