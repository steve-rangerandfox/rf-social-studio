// POST /api/captions — AI caption / story-tips generation. Delegates
// to src/server/ai.js which wraps the Anthropic Messages API.

import { generateCaption, generateCaptionVariants, generateStoryTips, learnBrandFromUrl } from "../ai.js";
import { ensureEnv } from "../env.js";
import { errorJson, json, readJsonBody } from "../http.js";
import { createLogger, sanitizeLogValue } from "../log.js";
import { validateCaptionRequest } from "../validate.js";

const logger = createLogger("rf-social-studio-api");

export async function handleCaptionRequest(req, res, env, reqId) {
  const envCheck = ensureEnv(env, ["anthropicApiKey"]);
  if (!envCheck.ok) {
    return errorJson(res, 503, "SERVER_ERROR", "AI caption service is not configured", { missing: envCheck.missing });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return errorJson(res, error.code || 400, "VALIDATION_ERROR", error.message);
  }

  const captionValidation = validateCaptionRequest(body);
  if (!captionValidation.valid) {
    return errorJson(res, 400, "VALIDATION_ERROR", captionValidation.errors.join("; "), { errors: captionValidation.errors });
  }

  const intent = body.intent || "caption";

  try {
    if (intent === "story_tips") {
      const tips = await generateStoryTips(env, body.board);
      return json(res, 200, { tips });
    }

    const brandProfile = body.brandProfile && typeof body.brandProfile === "object" ? body.brandProfile : null;

    if (intent === "variants") {
      const platforms = Array.isArray(body.platforms) ? body.platforms : [];
      const variants = await generateCaptionVariants(env, {
        sourceNote: typeof body.sourceNote === "string" ? body.sourceNote : "",
        sourceCaption: typeof body.sourceCaption === "string" ? body.sourceCaption : "",
        platforms,
        brandProfile,
      });
      return json(res, 200, { variants });
    }

    if (intent === "learn_brand") {
      const profile = await learnBrandFromUrl(env, { url: typeof body.url === "string" ? body.url : "" });
      return json(res, 200, { profile });
    }

    const platform = typeof body.platform === "string" ? body.platform : "ig_post";
    const prompt = body.prompt.trim();

    const caption = await generateCaption(env, { platform, prompt, brandProfile });
    return json(res, 200, { caption });
  } catch (error) {
    logger("error", reqId, "caption_generation_failed", {
      error: sanitizeLogValue(error.message),
      intent,
    });
    const code = /timeout|abort/i.test(error.message) ? "AI_TIMEOUT" : "AI_ERROR";
    const status = code === "AI_TIMEOUT" ? 504 : 502;
    return errorJson(res, status, code, "Caption generation failed");
  }
}
