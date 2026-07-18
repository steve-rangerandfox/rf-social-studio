// Shared deterministic Instagram publishing limits (Meta-enforced).
//
// Neutral, browser-and-node-safe: pure literals, no imports, no side effects.
// Both the canonical publishing policy (browser + Inngest) and the server
// transport validation must import the SAME values from here so a limit is
// defined exactly once. The browser policy must not import src/server/config.js
// (server layer); src/server/config.js re-exports these for server consumers.

export const IG_PUBLISH_MEDIA_TYPES = ["IMAGE", "VIDEO", "REELS", "STORIES", "CAROUSEL"];
export const IG_PUBLISH_MAX_CAPTION = 2200; // IG Graph API hard limit
export const IG_CAROUSEL_MIN_ITEMS = 2; // Meta-enforced minimum carousel children
export const IG_CAROUSEL_MAX_ITEMS = 10; // Meta-enforced maximum carousel children
