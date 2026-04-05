const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const minLevel = LOG_LEVELS[process.env.LOG_LEVEL || "info"] ?? 1;

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

function write(level, data) {
  if (LOG_LEVELS[level] < minLevel) return;
  const entry = {
    level,
    ts: new Date().toISOString(),
    ...redactMeta(data),
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const log = {
  debug: (msg, data = {}) => write("debug", { msg, ...data }),
  info: (msg, data = {}) => write("info", { msg, ...data }),
  warn: (msg, data = {}) => write("warn", { msg, ...data }),
  error: (msg, data = {}) => write("error", { msg, ...data }),

  startTimer: (label) => {
    const start = performance.now();
    return (extraData = {}) => {
      const durationMs = Math.round(performance.now() - start);
      write("info", { msg: label, durationMs, ...extraData });
    };
  },

  // Request-scoped logger
  forRequest: (reqId, userId) => ({
    debug: (msg, data = {}) => write("debug", { msg, reqId, userId, ...data }),
    info: (msg, data = {}) => write("info", { msg, reqId, userId, ...data }),
    warn: (msg, data = {}) => write("warn", { msg, reqId, userId, ...data }),
    error: (msg, data = {}) => write("error", { msg, reqId, userId, ...data }),
    startTimer: (label) => {
      const start = performance.now();
      return (extra = {}) => {
        const durationMs = Math.round(performance.now() - start);
        const lvl = durationMs > 200 ? "warn" : "info";
        write(lvl, { msg: label, reqId, userId, durationMs, ...extra });
      };
    },
  }),
};

/**
 * Backwards-compatible wrapper: createLogger returns a function with the old
 * (level, reqId, message, meta) signature so existing call-sites keep working.
 */
export function createLogger(_scope) {
  return function legacyLog(level, reqId, message, meta = {}) {
    write(level, { msg: message, reqId, ...meta });
  };
}
