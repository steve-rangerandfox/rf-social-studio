import { describe, it, expect } from "vitest";

import { categorizeError } from "../persistence.js";

describe("categorizeError", () => {
  it("treats network/timeout errors as transient + retryable (503)", () => {
    for (const msg of [
      "Database query timed out",
      "fetch failed",
      "socket hang up",
      "ECONNRESET while reading response",
      "Network error",
      "request timed out",
    ]) {
      const result = categorizeError({ message: msg });
      expect(result).toEqual({ category: "transient", statusCode: 503, retryable: true });
    }
  });

  it("treats PGRST301 / JWT / apikey errors as auth (401, non-retryable)", () => {
    expect(categorizeError({ code: "PGRST301", message: "" })).toMatchObject({
      category: "auth",
      statusCode: 401,
      retryable: false,
    });
    expect(categorizeError({ message: "JWT expired" })).toMatchObject({
      category: "auth",
      statusCode: 401,
    });
    expect(categorizeError({ message: "Invalid API Key" })).toMatchObject({
      category: "auth",
      statusCode: 401,
    });
  });

  it("treats 42501 and RLS phrases as rls (403, non-retryable)", () => {
    expect(categorizeError({ code: "42501", message: "" })).toMatchObject({
      category: "rls",
      statusCode: 403,
      retryable: false,
    });
    expect(categorizeError({ message: "row-level security violation" })).toMatchObject({
      category: "rls",
      statusCode: 403,
    });
  });

  it("treats 2350x unique/constraint codes as constraint (400, non-retryable)", () => {
    for (const code of ["23505", "23503", "23502", "23514"]) {
      expect(categorizeError({ code, message: "" })).toMatchObject({
        category: "constraint",
        statusCode: 400,
        retryable: false,
      });
    }
  });

  it("falls back to unknown (500, non-retryable) for anything else", () => {
    expect(categorizeError({ code: "PGRST999", message: "something weird" })).toMatchObject({
      category: "unknown",
      statusCode: 500,
      retryable: false,
    });
    expect(categorizeError({})).toMatchObject({
      category: "unknown",
      statusCode: 500,
      retryable: false,
    });
  });

  it("prefers the earliest-matching category when flags overlap", () => {
    // An error with both 'timeout' wording and an auth code is network-y —
    // transient classification wins because retry has a real chance to
    // succeed whereas auth-classification would loop.
    const result = categorizeError({ code: "PGRST301", message: "timed out" });
    expect(result.category).toBe("transient");
    expect(result.retryable).toBe(true);
  });
});
