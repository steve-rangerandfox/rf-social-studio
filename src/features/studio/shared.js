export const T = {
  bg: "#F7F8FA",
  surface: "#FFFFFF",
  s2: "#FAFBFC",
  s3: "#F0F1F4",
  border: "#E5E7EB",
  border2: "#D1D5DB",
  ink: "#111318",
  inkFog: "rgba(17,19,24,0.05)",
  mint: "#111318",
  mintDim: "#0A0B0F",
  mintFog: "rgba(17,19,24,0.05)",
  text: "#111318",
  textSub: "#4B5563",
  textDim: "#9CA3AF",
  red: "#DC2626",
  amber: "#D97706",
  blue: "#2563EB",
  pink: "#DB2777",
  orange: "#EA580C",
  purple: "#7C3AED",
};

export const PLATFORMS = {
  ig_post: { label: "IG Post", short: "IG Post", color: "#BE185D", bg: "rgba(190,24,93,0.07)" },
  ig_story: { label: "IG Story", short: "IG Story", color: "#9333EA", bg: "rgba(147,51,234,0.07)" },
  linkedin: { label: "LinkedIn", short: "LI", color: "#0A66C2", bg: "rgba(10,102,194,0.07)" },
};

export const STATUSES = {
  idea: { label: "Idea", dot: "#9CA3AF", next: "draft" },
  draft: { label: "Draft", dot: "#6B7280", next: "needs_review" },
  needs_review: { label: "Needs Review", dot: "#F59E0B", next: "approved" },
  approved: { label: "Approved", dot: "#10B981", next: "scheduled" },
  scheduled: { label: "Scheduled", dot: "#3B82F6", next: "posted" },
  posted: { label: "Posted", dot: "#111318", next: "idea" },
};

export const TEAM = [
  { id: "stephen", name: "Stephen", initials: "SC", color: "#0369A1" },
  { id: "allyson", name: "Allyson", initials: "AL", color: "#BE185D" },
  { id: "jared", name: "Jared", initials: "JR", color: "#7C3AED" },
];

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
      comments: [{ id: uid(), author: "allyson", text: "Love the concept — can we add a Reels cut too?", ts: "2h ago" }],
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
