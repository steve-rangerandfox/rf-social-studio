export function redactMeta(meta = {}) {
  return JSON.parse(
    JSON.stringify(meta, (key, value) => {
      if (/secret|token|authorization|cookie|password/i.test(key)) {
        return "[REDACTED]";
      }
      return value;
    }),
  );
}

export function sanitizeLogValue(value) {
  if (typeof value !== "string") {
    return String(value ?? "");
  }

  return value.replace(/[\r\n\t]/g, " ").slice(0, 240);
}

export function createLogger(scope = "rf-social-studio") {
  return function log(level, reqId, message, meta = {}) {
    const payload = {
      ts: new Date().toISOString(),
      scope,
      level,
      reqId,
      message,
      ...redactMeta(meta),
    };

    const line = JSON.stringify(payload);
    if (level === "error" || level === "warn") {
      process.stderr.write(`${line}\n`);
      return;
    }

    process.stdout.write(`${line}\n`);
  };
}
