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

  return {
    nodeEnv: source.NODE_ENV || "development",
    allowedOrigins,
    sessionSecret: source.SESSION_SECRET || "",
    igAppId: source.IG_APP_ID || "",
    igAppSecret: source.IG_APP_SECRET || "",
    supabaseUrl: source.SUPABASE_URL || source.VITE_SUPABASE_URL || "",
    supabaseServiceRoleKey: source.SUPABASE_SERVICE_ROLE_KEY || "",
    anthropicApiKey: source.ANTHROPIC_API_KEY || "",
    anthropicModel: source.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
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
