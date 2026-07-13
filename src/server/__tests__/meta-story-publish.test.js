import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the low-level HTTP helper so we can capture the container-create call
// and drive the two-step publish flow without real network access.
vi.mock("../http.js", () => ({ fetchWithTimeout: vi.fn() }));

import { fetchWithTimeout } from "../http.js";
import { publishInstagramPost, publishInstagramCarousel } from "../meta.js";

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
      igUserId: "ig1",
      userToken: "tok",
      imageUrl: "https://cdn.example/story-frame-1.png",
      mediaType: "STORIES",
      caption: "",
    });

    expect(res).toEqual({ mediaId: "media-1" });
    // Exactly two calls: create + publish. A status poll would add a third.
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2);

    // Facebook-Login path: target graph.facebook.com/{ig-business-id}, NOT
    // graph.instagram.com/me — publishing runs through the Page-linked IG
    // business account node.
    const createUrl = fetchWithTimeout.mock.calls[0][0];
    expect(createUrl).toContain("graph.facebook.com");
    expect(createUrl).toContain("/ig1/media");

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
      igUserId: "ig1",
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
      publishInstagramPost({ igUserId: "ig1", userToken: "tok", mediaType: "STORIES" }),
    ).rejects.toThrow(/imageUrl or videoUrl required/);
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });
});

describe("publishInstagramCarousel", () => {
  beforeEach(() => {
    fetchWithTimeout.mockReset();
  });

  it("creates a child container per image, a CAROUSEL parent, then publishes", async () => {
    fetchWithTimeout
      .mockResolvedValueOnce(okJson({ id: "child-1" }))
      .mockResolvedValueOnce(okJson({ id: "child-2" }))
      .mockResolvedValueOnce(okJson({ id: "child-3" }))
      .mockResolvedValueOnce(okJson({ id: "parent-1" })) // parent container
      .mockResolvedValueOnce(okJson({ id: "media-9" })); // publish

    const res = await publishInstagramCarousel({
      igUserId: "ig1",
      userToken: "tok",
      imageUrls: ["https://cdn.example/s1.jpg", "https://cdn.example/s2.jpg", "https://cdn.example/s3.jpg"],
      caption: "Three notes",
    });

    expect(res).toEqual({ mediaId: "media-9" });
    expect(fetchWithTimeout).toHaveBeenCalledTimes(5);
    expect(fetchWithTimeout.mock.calls[0][0]).toContain("graph.facebook.com");
    expect(fetchWithTimeout.mock.calls[0][0]).toContain("/ig1/media");

    // Children flagged as carousel items, in order.
    const child1 = bodyParams(fetchWithTimeout.mock.calls[0]);
    expect(child1.image_url).toBe("https://cdn.example/s1.jpg");
    expect(child1.is_carousel_item).toBe("true");

    // Parent references every child id and carries the caption.
    const parent = bodyParams(fetchWithTimeout.mock.calls[3]);
    expect(parent.media_type).toBe("CAROUSEL");
    expect(parent.children).toBe("child-1,child-2,child-3");
    expect(parent.caption).toBe("Three notes");

    // Publish targets the parent container.
    const publish = bodyParams(fetchWithTimeout.mock.calls[4]);
    expect(publish.creation_id).toBe("parent-1");
  });

  it("rejects fewer than 2 or more than 10 images without any network call", async () => {
    await expect(
      publishInstagramCarousel({ userToken: "tok", imageUrls: ["only-one.jpg"] }),
    ).rejects.toThrow(/between 2 and 10/);
    await expect(
      publishInstagramCarousel({ userToken: "tok", imageUrls: Array.from({ length: 11 }, (_, i) => `s${i}.jpg`) }),
    ).rejects.toThrow(/between 2 and 10/);
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });
});
