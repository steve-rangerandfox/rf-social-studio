const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3001",
];

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function loadServerEnv(source = process.env) {
  const allowedOrigins = new Set(
    splitCsv(source.ALLOWED_ORIGINS).length
      ? splitCsv(source.ALLOWED_ORIGINS)
      : DEFAULT_ALLOWED_ORIGINS,
  );

  // Instagram API with Instagram Login credentials.
  // FB_APP_ID/FB_APP_SECRET hold the Instagram App ID and Secret from the
  // "Instagram API with Instagram Login" product in Meta's app dashboard
  // (NOT the main Meta App credentials — use the ones under that product config).
  // Legacy IG_APP_ID/IG_APP_SECRET are accepted as fallbacks.
  const fbAppId = source.FB_APP_ID || source.IG_APP_ID || "";
  const fbAppSecret = source.FB_APP_SECRET || source.IG_APP_SECRET || "";
  // FB_REDIRECT_URI / IG_REDIRECT_URI both map to the same canonical redirect URL.
  const fbRedirectUri = source.FB_REDIRECT_URI || source.IG_REDIRECT_URI || "";

  return {
    nodeEnv: source.NODE_ENV || "development",
    allowedOrigins,
    clerkJwtKey: source.CLERK_JWT_KEY || "",
    clerkIssuer: source.CLERK_ISSUER || "",
    sessionSecret: source.SESSION_SECRET || "",
    fbAppId,
    fbAppSecret,
    fbRedirectUri,
    // Backwards-compatible aliases (still referenced by some legacy code paths)
    igAppId: fbAppId,
    igAppSecret: fbAppSecret,
    supabaseUrl: source.SUPABASE_URL || source.VITE_SUPABASE_URL || "",
    supabaseServiceRoleKey: source.SUPABASE_SERVICE_ROLE_KEY || "",
    // LinkedIn publishing — uses LinkedIn's "Share on LinkedIn" + UGC
    // Posts product. Create an app at linkedin.com/developers/apps.
    liAppId: source.LINKEDIN_CLIENT_ID || "",
    liAppSecret: source.LINKEDIN_CLIENT_SECRET || "",
    liRedirectUri: source.LINKEDIN_REDIRECT_URI || "",
    anthropicApiKey: source.ANTHROPIC_API_KEY || "",
    anthropicModel: source.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    // Upstash Redis — rate limiting (cross-instance, required in production)
    upstashRedisRestUrl: source.UPSTASH_REDIS_REST_URL || "",
    upstashRedisRestToken: source.UPSTASH_REDIS_REST_TOKEN || "",
    // Inngest — scheduled publishing background worker
    inngestEventKey: source.INNGEST_EVENT_KEY || "",
    inngestSigningKey: source.INNGEST_SIGNING_KEY || "",
    // Stripe — Buffer-style three-tier billing (free / essentials / team).
    // STRIPE_PRICE_* hold the price IDs for each paid tier; the public
    // /pricing page and Settings → Billing tab present these as the
    // canonical upgrade paths.
    stripeSecretKey: source.STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: source.STRIPE_WEBHOOK_SECRET || "",
    stripePriceEssentials: source.STRIPE_PRICE_ESSENTIALS || "",
    stripePriceTeam: source.STRIPE_PRICE_TEAM || "",
    // Used to build the success_url / cancel_url / portal return_url
    // when the request itself doesn't carry an Origin we trust.
    appBaseUrl: source.APP_BASE_URL || "",
    port: Number.parseInt(source.PORT || "3001", 10),
  };
}

export function ensureEnv(env, requiredKeys) {
  const missing = requiredKeys.filter((key) => !env[key]);
  return {
    ok: missing.length === 0,
    missing,
  };
}

export function isAllowedOrigin(env, origin) {
  if (!origin) {
    return false;
  }

  return env.allowedOrigins.has(origin.toLowerCase());
}

export function isProduction(env) {
  return env.nodeEnv === "production";
}
