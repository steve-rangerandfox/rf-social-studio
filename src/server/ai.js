import { fetchWithTimeout } from "./http.js";

function buildCaptionPrompt({ platform, prompt }) {
  const tone =
    platform === "linkedin"
      ? "professional, thoughtful, authoritative, and clear. No emojis."
      : "bold, creative, premium, and calm-confident. Use 2-3 relevant hashtags at most.";
  const limit = platform === "linkedin" ? "Keep it under 1200 characters." : "Keep it under 300 characters.";

  return {
    system:
      "You are the senior social copywriter for Ranger & Fox, a premium motion graphics studio. " +
      `Write in a ${tone} ${limit} Return only the finished caption text.`,
    user: `Draft a caption for this post concept: ${prompt}`,
    maxTokens: platform === "linkedin" ? 900 : 500,
  };
}

function buildStoryTipsPrompt(board) {
  return {
    system:
      "You are a senior motion design director reviewing an Instagram Story layout. " +
      'Return exactly 3 short, actionable layout tips as JSON: {"tips":["tip 1","tip 2","tip 3"]}.',
    user: `Canvas summary: ${JSON.stringify(board)}`,
    maxTokens: 300,
  };
}

async function callAnthropic(env, { system, user, maxTokens }) {
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.anthropicModel,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || "AI request failed");
  }

  return body.content?.[0]?.text || "";
}

export async function generateCaption(env, { platform, prompt }) {
  const text = await callAnthropic(env, buildCaptionPrompt({ platform, prompt }));
  return text.trim();
}

export async function generateStoryTips(env, board) {
  const text = await callAnthropic(env, buildStoryTipsPrompt(board));

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.tips)) {
      return parsed.tips.slice(0, 3);
    }
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 3);
        }
      } catch {
        return [];
      }
    }
  }

  return [];
}
