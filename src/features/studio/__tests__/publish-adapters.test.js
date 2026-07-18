import { describe, it, expect } from "vitest";

import {
  operationToApiClientPayload,
  apiPayloadToOperation,
  metaPostArgs,
  metaCarouselArgs,
} from "../../../lib/publish-adapters.js";

const H = "https://cdn.example.com";
const TOK = { igUserId: "iguid", userToken: "tok" };

const OPS = {
  IMAGE: { mediaType: "IMAGE", imageUrl: `${H}/i.jpg`, caption: "c" },
  VIDEO: { mediaType: "VIDEO", videoUrl: `${H}/v.mp4`, caption: "c" },
  REELS: { mediaType: "REELS", videoUrl: `${H}/r.mp4`, caption: "c" },
  STORY_IMAGE: { mediaType: "STORIES", imageUrl: `${H}/s.jpg`, caption: "" },
  STORY_VIDEO: { mediaType: "STORIES", videoUrl: `${H}/s.mp4`, caption: "" },
  CAROUSEL: { mediaType: "CAROUSEL", imageUrls: [`${H}/1.jpg`, `${H}/2.jpg`], caption: "c" },
};

// The immediate path (op → wire → app.js) and scheduled path (op → meta) must
// converge on identical meta.js arguments. Both paths now use the SAME shared
// adapter functions — no hand-mirrored logic — so this proves convergence
// through the real production mapping, and app.js is proven to call it in
// src/server/__tests__/ig-publish-dispatch.test.js.
describe("shared adapters — both paths converge on identical meta.js arguments", () => {
  for (const [name, op] of Object.entries(OPS)) {
    it(`${name}: immediate wire→op→meta === scheduled op→meta`, () => {
      const immediateOp = apiPayloadToOperation(operationToApiClientPayload(op, "row1"));
      const immediate = op.mediaType === "CAROUSEL" ? metaCarouselArgs(immediateOp, TOK) : metaPostArgs(immediateOp, TOK);
      const scheduled = op.mediaType === "CAROUSEL" ? metaCarouselArgs(op, TOK) : metaPostArgs(op, TOK);
      expect(immediate).toEqual(scheduled);
    });
  }

  it("image story maps to imageUrl (no videoUrl) via apiPayloadToOperation", () => {
    const op = apiPayloadToOperation(operationToApiClientPayload(OPS.STORY_IMAGE, "r"));
    expect(op).toEqual({ mediaType: "STORIES", imageUrl: `${H}/s.jpg`, caption: "" });
    const args = metaPostArgs(op, TOK);
    expect(args.imageUrl).toBe(`${H}/s.jpg`);
    expect(args.videoUrl).toBeUndefined();
  });

  it("video story maps to videoUrl (no imageUrl) via apiPayloadToOperation", () => {
    const op = apiPayloadToOperation(operationToApiClientPayload(OPS.STORY_VIDEO, "r"));
    expect(op).toEqual({ mediaType: "STORIES", videoUrl: `${H}/s.mp4`, caption: "" });
    const args = metaPostArgs(op, TOK);
    expect(args.videoUrl).toBe(`${H}/s.mp4`);
    expect(args.imageUrl).toBeUndefined();
  });
});
