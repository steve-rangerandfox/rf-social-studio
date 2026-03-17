let currentApiUserId = "";
let currentApiTokenProvider = null;

export function setApiUserId(userId, tokenProvider) {
  currentApiUserId = String(userId || "");
  currentApiTokenProvider = typeof tokenProvider === "function" ? tokenProvider : null;
}

async function requestJson(url, options = {}) {
  const token = currentApiTokenProvider ? await currentApiTokenProvider().catch(() => "") : "";
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(currentApiUserId ? { "X-RF-User-Id": currentApiUserId } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export function generateCaption({ platform, prompt }) {
  return requestJson("/api/captions", {
    method: "POST",
    body: JSON.stringify({
      intent: "caption",
      platform,
      prompt,
    }),
  });
}

export function generateStoryTips(board) {
  return requestJson("/api/captions", {
    method: "POST",
    body: JSON.stringify({
      intent: "story_tips",
      board,
    }),
  });
}

export function getInstagramAuthorizeUrl(redirectUri) {
  return requestJson(`/api/ig-oauth?redirectUri=${encodeURIComponent(redirectUri)}`, {
    method: "GET",
  });
}

export function exchangeInstagramCode({ code, redirectUri, state }) {
  return requestJson("/api/ig-oauth", {
    method: "POST",
    body: JSON.stringify({ code, redirectUri, state }),
  });
}

export function disconnectInstagram() {
  return requestJson("/api/ig-oauth", {
    method: "DELETE",
  }).catch(() => null);
}

export function fetchInstagramFeed() {
  return requestJson("/api/ig-posts", {
    method: "GET",
  });
}

export function fetchStudioDocument() {
  return requestJson("/api/studio-document", {
    method: "GET",
  });
}

export function saveStudioDocument(document) {
  return requestJson("/api/studio-document", {
    method: "PUT",
    body: JSON.stringify({ document }),
  });
}
