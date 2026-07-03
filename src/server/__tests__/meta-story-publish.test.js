import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the low-level HTTP helper so we can capture the container-create call
// and drive the two-step publish flow without real network access.
vi.mock("../http.js", () => ({ fetchWithTimeout: vi.fn() }));

import { fetchWithTimeout } from "../http.js";
import { publishInstagramPost } from "../meta.js";

// Parse the URLSearchParams body of a captured fetch call into a plain object.
function bodyParams(call) {
  const body = call[1].body;
  return Object.fromEntries(new URLSearchParams(body.toString()));
}

function okJson(payload) {
  return { ok: true, json: async () => payload };
}

describe("publishInstagramPost — story frames", () => {
  beforeEach(() => {
    fetchWithTimeout.mockReset();
  });

  it("publishes an image story via image_url and does NOT poll for processing", async () => {
    // create container → publish container (no status poll for image stories)
    fetchWithTimeout
      .mockResolvedValueOnce(okJson({ id: "container-1" }))
      .mockResolvedValueOnce(okJson({ id: "media-1" }));

    const res = await publishInstagramPost({
      userToken: "tok",
      imageUrl: "https://cdn.example/story-frame-1.png",
      mediaType: "STORIES",
      caption: "",
    });

    expect(res).toEqual({ mediaId: "media-1" });
    // Exactly two calls: create + publish. A status poll would add a third.
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2);

    const create = bodyParams(fetchWithTimeout.mock.calls[0]);
    expect(create.media_type).toBe("STORIES");
    expect(create.image_url).toBe("https://cdn.example/story-frame-1.png");
    expect(create.video_url).toBeUndefined();
  });

  it("still supports a video story via video_url", async () => {
    fetchWithTimeout
      .mockResolvedValueOnce(okJson({ id: "container-2" }))       // create
      .mockResolvedValueOnce(okJson({ status_code: "FINISHED" })) // poll
      .mockResolvedValueOnce(okJson({ id: "media-2" }));          // publish

    const res = await publishInstagramPost({
      userToken: "tok",
      videoUrl: "https://cdn.example/story.mp4",
      mediaType: "STORIES",
    });

    expect(res).toEqual({ mediaId: "media-2" });
    const create = bodyParams(fetchWithTimeout.mock.calls[0]);
    expect(create.media_type).toBe("STORIES");
    expect(create.video_url).toBe("https://cdn.example/story.mp4");
    expect(create.image_url).toBeUndefined();
  });

  it("throws when a story has neither an image nor a video URL", async () => {
    await expect(
      publishInstagramPost({ userToken: "tok", mediaType: "STORIES" }),
    ).rejects.toThrow(/imageUrl or videoUrl required/);
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });
});
