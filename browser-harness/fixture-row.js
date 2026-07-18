// Deterministic story fixture for the designer harness. Shapes match the real
// element schema produced by StoryDesigner.addText / addMedia:
//   • text  → { type:"text", content, ... }
//   • video → { type:"image", mediaType:"video", url, muted, autoPlay, ... }
// The video points at the repository-controlled fixture resolved through Vite's
// asset pipeline (import.meta.url) so readiness is deterministic and offline —
// no publicDir wiring, no external media.

export const TEXT_ELEMENT_ID = "harness-text-1";
export const VIDEO_ELEMENT_ID = "harness-video-1";
export const TEXT_ORIGINAL = "Original text";

// Resolved to a Vite-served asset URL for browser-harness/fixtures/tiny.mp4.
export const VIDEO_URL = new URL("./fixtures/tiny.mp4", import.meta.url).href;

export const fixtureRow = {
  id: "harness-row-1",
  title: "Harness Story",
  platform: "instagram",
  status: "draft",
  storyElements: [
    {
      id: TEXT_ELEMENT_ID,
      type: "text",
      content: TEXT_ORIGINAL,
      x: 60,
      y: 160,
      fontSize: 32,
      fontFamily: "Bricolage Grotesque",
      color: "#FFFFFF",
      letterSpacing: 0,
      fontWeight: 700,
      shadow: false,
    },
    {
      id: VIDEO_ELEMENT_ID,
      type: "image",
      url: VIDEO_URL,
      x: 60,
      y: 360,
      scale: 1,
      width: 160,
      height: 284,
      locked: false,
      mediaType: "video",
      loop: true,
      muted: true,
      autoPlay: true,
      trimLabel: "MP4",
    },
  ],
};
