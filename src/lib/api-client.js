let currentApiUserId = "";
let currentApiTokenProvider = null;

export function setApiUserId(userId, tokenProvider) {
  currentApiUserId = String(userId || "");
  currentApiTokenProvider = typeof tokenProvider === "function" ? tokenProvider : null;
}

const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;

async function requestJson(url, options = {}, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = MAX_RETRIES } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, attempt - 1), 8000)));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const token = currentApiTokenProvider ? await currentApiTokenProvider().catch(() => "") : "";
      const headers = {
        "Content-Type": "application/json",
        ...(currentApiUserId ? { "X-RF-User-Id": currentApiUserId } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      };

      const response = await fetch(url, {
        credentials: "include",
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.ok) {
        return await response.json().catch(() => ({}));
      }

      // Rate limited — honor Retry-After header and don't count as a failed attempt
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
        await new Promise(r => setTimeout(r, delayMs));
        lastError = new Error("Rate limited");
        lastError.status = 429;
        lastError.retryable = true;
        attempt--; // Don't count this as a failed attempt
        continue;
      }

      // Non-retryable errors
      if (!RETRYABLE_STATUSES.has(response.status)) {
        const body = await response.json().catch(() => ({ error: response.statusText }));
        const error = new Error(body.error || `Request failed (${response.status})`);
        error.status = response.status;
        error.retryable = false;
        error.body = body;
        throw error;
      }

      // Retryable error — try again
      lastError = new Error(`Server error (${response.status})`);
      lastError.status = response.status;
      lastError.retryable = true;
    } catch (err) {
      clearTimeout(timer);

      if (err.retryable === false) throw err; // Don't retry non-retryable

      if (err.name === "AbortError") {
        lastError = new Error("Request timed out");
        lastError.retryable = true;
      } else if (!err.status) {
        // Network error
        lastError = new Error("Network error");
        lastError.retryable = true;
      } else {
        lastError = err;
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error("Request failed after retries");
}

export function generateCaption({ platform, prompt }) {
  return requestJson("/api/captions", {
    method: "POST",
    body: JSON.stringify({
      intent: "caption",
      platform,
      prompt,
    }),
  }, { timeoutMs: 30000 });
}

export function generateStoryTips(board) {
  return requestJson("/api/captions", {
    method: "POST",
    body: JSON.stringify({
      intent: "story_tips",
      board,
    }),
  }, { timeoutMs: 30000 });
}

// OAuth start — no longer takes a redirectUri (server uses canonical env.fbRedirectUri)
export function getInstagramAuthorizeUrl() {
  return requestJson("/api/ig-oauth", { method: "GET" });
}

// Exchange code for FB token + return pending pages list
export function exchangeInstagramCode({ code, state }) {
  return requestJson("/api/ig-oauth", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });
}

// NEW: User selects which Page/IG account to use after OAuth
export function selectInstagramPage(pageId) {
  return requestJson("/api/ig-select-page", {
    method: "POST",
    body: JSON.stringify({ pageId }),
  });
}

// Disconnect (unchanged)
export function disconnectInstagram() {
  return requestJson("/api/ig-oauth", {
    method: "DELETE",
  }).catch(() => null);
}

export function fetchInstagramFeed(cursor = null) {
  const url = cursor
    ? `/api/ig-posts?cursor=${encodeURIComponent(cursor)}`
    : "/api/ig-posts";
  return requestJson(url);
}

export function fetchStudioDocument() {
  return requestJson("/api/studio-document", {
    method: "GET",
  }).then((data) => ({
    document: data.document,
    updatedAt: data.updatedAt,
    version: data.version ?? null,
  }));
}

export function saveStudioDocument(document, version = null) {
  const payload = { document };
  if (version !== null) {
    payload.version = version;
  }
  return requestJson("/api/studio-document", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
