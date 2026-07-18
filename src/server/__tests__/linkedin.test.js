import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../http.js", () => ({ fetchWithTimeout: vi.fn() }));

import { fetchWithTimeout } from "../http.js";
import { publishLinkedInText } from "../linkedin.js";

function okJson(payload, headers = {}) {
  return { ok: true, json: async () => payload, headers: { get: (k) => headers[k] ?? null } };
}

function sentText() {
  const body = JSON.parse(fetchWithTimeout.mock.calls[0][1].body);
  return body.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text;
}

describe("publishLinkedInText — text normalization (shared owner)", () => {
  beforeEach(() => fetchWithTimeout.mockReset());

  it("trims text so immediate (pre-trimmed) and scheduled (raw) match", async () => {
    fetchWithTimeout.mockResolvedValue(okJson({ id: "urn:1" }));
    await publishLinkedInText({ accessToken: "a", personUrn: "urn:li:person:x", text: "  hello world  " });
    const immediateEquivalent = sentText();

    fetchWithTimeout.mockClear();
    fetchWithTimeout.mockResolvedValue(okJson({ id: "urn:1" }));
    await publishLinkedInText({ accessToken: "a", personUrn: "urn:li:person:x", text: "hello world" });
    const alreadyTrimmed = sentText();

    expect(immediateEquivalent).toBe("hello world");
    expect(immediateEquivalent).toBe(alreadyTrimmed);
  });

  it("tolerates null/undefined text", async () => {
    fetchWithTimeout.mockResolvedValue(okJson({ id: "urn:1" }));
    await publishLinkedInText({ accessToken: "a", personUrn: "urn:li:person:x", text: undefined });
    expect(sentText()).toBe("");
  });
});
