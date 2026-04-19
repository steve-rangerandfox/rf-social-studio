// POST /api/captions — AI caption / story-tips generation. Delegates
// to src/server/ai.js which wraps the Anthropic Messages API.

import {
  generateCaption,
  generateCaptionVariants,
  generateMonthlyStrategy,
  generateStoryTips,
  learnBrandFromUrl,
} from "../ai.js";
import { ensureEnv } from "../env.js";
import { can, minPlanForFeature } from "../entitlements.js";
import { errorJson, json, readJsonBody } from "../http.js";
import { createLogger, sanitizeLogValue } from "../log.js";
import { loadSubscription } from "../subscription-store.js";
import { validateCaptionRequest } from "../validate.js";

const logger = createLogger("rf-social-studio-api");

// Maps each caption-handler intent to the entitlement feature that gates
// it. Free tier gets none; essentials gets caption / variants /
// learn_brand; team also unlocks strategy.
const INTENT_FEATURE = {
  caption: "aiCaptions",
  story_tips: "aiCaptions",
  variants: "aiVariants",
  learn_brand: "learnFromUrl",
  strategy: "aiStrategy",
};

export async function handleCaptionRequest(req, res, env, reqId, auth) {
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

  // Plan gate — load the subscription and reject before we burn an
  // Anthropic call if the user's tier doesn't include this feature.
  // Free tier hits this every time; paid tiers pass through.
  const feature = INTENT_FEATURE[intent];
  if (feature && auth?.userId) {
    const subscription = await loadSubscription(env, auth.userId).catch(() => null);
    if (!can(subscription, feature)) {
      const required = minPlanForFeature(feature);
      return errorJson(res, 402, "PLAN_UPGRADE_REQUIRED",
        `${intent.replace("_", " ")} requires the ${required?.label || "Essentials"} plan`,
        { feature, requiredPlan: required?.id || null },
      );
    }
  }

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

    if (intent === "strategy") {
      const briefs = await generateMonthlyStrategy(env, {
        brandProfile,
        year: Number(body.year),
        month: Number(body.month),
        postsPerWeek: Number(body.postsPerWeek) || 3,
        platforms: Array.isArray(body.platforms) ? body.platforms : [],
        existingRows: Array.isArray(body.existingRows) ? body.existingRows : [],
      });
      return json(res, 200, { briefs });
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
