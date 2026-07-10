import { describe, it, expect } from "vitest";
import { seedPages } from "../designer-seed.js";

// seedPages decides what canvases the designer opens with. The repeat
// bug being pinned: the designer auto-saves storyPages on every open,
// so a post whose gallery grew AFTER a designer visit must still get
// one new canvas per un-placed image (merge, not all-or-nothing).

const makeDefault = () => [{ id: "d1", type: "text", content: "Headline" }];
const bgPage = (url) => [{ id: "bg", type: "image", url, x: 0, y: 0, scale: 1, locked: true, mediaType: "image" }];
const emptyDefaultPage = () => [
  { id: "bg", type: "image", url: null, locked: true },
  { id: "t1", type: "text", content: "Headline" },
];

describe("seedPages", () => {
  it("seeds one canvas per gallery item as a MOVABLE element over a plain background", () => {
    const row = { mediaItems: [{ url: "a.png", kind: "image" }, { url: "b.png", kind: "image" }] };
    const pages = seedPages(row, makeDefault);
    expect(pages).toHaveLength(2);
    // Locked bg stays a plain fill; the image is a regular unlocked
    // element the user can drag / scale (the "can't move my uploads" ask).
    expect(pages[0].elements[0]).toMatchObject({ id: "bg", locked: true, url: null });
    expect(pages[0].elements[1]).toMatchObject({ url: "a.png", locked: false, type: "image" });
    expect(pages[1].elements[1]).toMatchObject({ url: "b.png", locked: false });
  });

  it("marks video gallery items as video elements", () => {
    const pages = seedPages({ mediaItems: [{ url: "v.mp4", kind: "video" }] }, makeDefault);
    expect(pages[0].elements[1].mediaType).toBe("video");
  });

  it("falls back to the default template with no gallery and no saved pages", () => {
    const pages = seedPages({}, makeDefault);
    expect(pages).toHaveLength(1);
    expect(pages[0].elements).toEqual(makeDefault());
  });

  it("reseeds from the gallery when saved pages are a stale default (no real media)", () => {
    const row = {
      storyPages: [emptyDefaultPage()],
      mediaItems: [{ url: "a.png", kind: "image" }],
    };
    const pages = seedPages(row, makeDefault);
    expect(pages).toHaveLength(1);
    expect(pages[0].elements[1].url).toBe("a.png");
  });

  it("keeps saved pages that contain real media", () => {
    const row = { storyPages: [bgPage("a.png")], mediaItems: [{ url: "a.png", kind: "image" }] };
    const pages = seedPages(row, makeDefault);
    expect(pages).toHaveLength(1);
    expect(pages[0].elements[0].url).toBe("a.png");
  });

  it("APPENDS one canvas per gallery item not already placed on a saved page", () => {
    // The battling bug: designer visited (pages saved with a.png), then
    // two more images uploaded — they must arrive as new canvases.
    const row = {
      storyPages: [bgPage("a.png")],
      mediaItems: [
        { url: "a.png", kind: "image" },
        { url: "b.png", kind: "image" },
        { url: "c.png", kind: "image" },
      ],
    };
    const pages = seedPages(row, makeDefault);
    expect(pages).toHaveLength(3);
    expect(pages[0].elements[0].url).toBe("a.png"); // saved page kept verbatim
    expect(pages[1].elements[1].url).toBe("b.png"); // appended, movable
    expect(pages[2].elements[1].url).toBe("c.png");
  });

  it("counts an image placed as a free element (not bg) as placed", () => {
    const row = {
      storyPages: [[
        { id: "bg", type: "image", url: null, locked: true },
        { id: "x", type: "image", url: "a.png" },
      ]],
      mediaItems: [{ url: "a.png", kind: "image" }],
    };
    const pages = seedPages(row, makeDefault);
    expect(pages).toHaveLength(1); // nothing to append
  });

  it("gives every page a unique id", () => {
    const row = { mediaItems: [{ url: "a.png" }, { url: "b.png" }] };
    const pages = seedPages(row, makeDefault);
    expect(pages[0].id).not.toBe(pages[1].id);
  });

  it("ignores gallery entries without a url", () => {
    const pages = seedPages({ mediaItems: [{ url: null }, { url: "a.png" }] }, makeDefault);
    expect(pages).toHaveLength(1);
    expect(pages[0].elements[1].url).toBe("a.png");
  });
});
