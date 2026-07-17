import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

// ---------------------------------------------------------------------------
// Deployment-contract gate.
//
// Relay's production API surface is defined by two deployment artifacts, each
// its own semantic owner:
//
//   • the api/ filesystem      — the Vercel serverless entrypoints that are
//                                 actually deployed and dispatched (the
//                                 production route inventory);
//   • vercel.json > functions  — the per-route deployment configuration
//                                 (memory / maxDuration).
//
// This gate verifies those artifacts are mutually complete, that each
// entrypoint exports a callable handler, and that route-specific deployment
// policy is met.
//
// It deliberately does NOT invoke handleApiRequest or otherwise re-derive
// server routing behavior: route behavior is covered by tests/server.test.js.
// This test verifies deployment wiring only.
//
// It proves TWO directions:
//   A. Completeness — every /api route registered in src/server/app.js
//      projects to a production api/ entrypoint (local and production route
//      availability cannot silently diverge; a route cannot pass solely
//      because it works through the local server router).
//   B. Internal integrity — the deployment artifacts (api/ ↔ vercel.json) are
//      mutually complete, callable, and policy-compliant.
//
// /api/health note: designated production-facing by the product owner. It is
// served by the shared handler (inline liveness) and deployed via api/health.js
// + a vercel.json entry, so it is a first-class production route under this
// contract like every other. There is intentionally no LOCAL_ONLY_ROUTES
// exception set.
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// Route-specific deployment policy. Only routes whose production behavior needs
// more than Vercel's defaults are listed. Values are MINIMUMS, not exact
// matches, so tightening a limit never fails the gate.
const ROUTE_POLICY = {
  // Background worker: Inngest step execution + function discovery.
  "api/inngest.js": { minMemory: 512, minMaxDuration: 300 },
  // Video container create + readiness polling + publish.
  "api/ig-publish.js": { minMaxDuration: 90 },
};

// --- artifact readers -------------------------------------------------------

// Collect every deployed entrypoint, normalized to the same repo-relative
// posix path Vercel uses as a functions key (e.g. "api/billing/webhook.js").
function collectEntrypoints(absDir) {
  const out = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectEntrypoints(abs));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(path.relative(repoRoot, abs).split(path.sep).join("/"));
    }
  }
  return out;
}

const entrypoints = collectEntrypoints(path.join(repoRoot, "api")).sort();

const functionConfig =
  JSON.parse(fs.readFileSync(path.join(repoRoot, "vercel.json"), "utf8"))
    .functions || {};
const configuredFiles = Object.keys(functionConfig).sort();

// --- local route inventory: compatibility adapter ---------------------------
//
// src/server/app.js registers routes imperatively (a chain of
// `if (url.pathname === "/api/x")` / `if (url.pathname.startsWith("/api/y"))`
// branches). There is no exported route registry to derive from, and building
// one would be a routing redesign. Until such a registry exists, this narrow
// adapter extracts the literal /api registrations by matching ONLY those two
// idioms anchored on `url.pathname`. It intentionally ignores:
//   • `route:` telemetry labels (endTimer({ route: "/api/..." })) — not owners;
//   • `req.url.startsWith("/api/")` (the OPTIONS/CORS guard) — not a route.
// If the routing idiom changes, extraction under-counts and the completeness
// check fails loudly rather than passing silently — a safe failure mode.
function extractLocalApiRoutes(source) {
  const routes = new Set();
  const re = /url\.pathname(?:\s*===\s*|\.startsWith\(\s*)"(\/api\/[^"]+)"/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    routes.add(match[1]);
  }
  return [...routes].sort();
}

// A local route "/api/foo" (or "/api/foo/bar") is deployed by the Vercel
// entrypoint file "api/foo.js" ("api/foo/bar.js"). Same mapping Vercel uses.
function routeToEntrypoint(route) {
  return `${route.replace(/^\//, "")}.js`;
}

function localRoutesMissingEntrypoint(localRoutes, entrypointFiles) {
  const set = new Set(entrypointFiles);
  return localRoutes.filter((route) => !set.has(routeToEntrypoint(route)));
}

const appSource = fs.readFileSync(
  path.join(repoRoot, "src", "server", "app.js"),
  "utf8",
);
const localRoutes = extractLocalApiRoutes(appSource);

// --- pure contract rules (data in, violations out) --------------------------

// Existence: deployment configuration must exist for every entrypoint.
function entrypointsMissingConfig(files, configured) {
  const set = new Set(configured);
  return files.filter((file) => !set.has(file));
}

// Existence: every configured route must resolve to a real entrypoint file.
function configWithoutEntrypoint(configured, files) {
  const set = new Set(files);
  return configured.filter((file) => !set.has(file));
}

// Existence: an entrypoint's default export must be a callable handler.
function isCallableHandler(mod) {
  return typeof mod?.default === "function";
}

// Policy: memory + maxDuration must be present, and route-specific minima met.
function policyViolations(config, policy) {
  const problems = [];
  for (const [file, cfg] of Object.entries(config)) {
    if (typeof cfg.memory !== "number") {
      problems.push(`${file}: missing "memory" in vercel.json functions`);
    }
    if (typeof cfg.maxDuration !== "number") {
      problems.push(`${file}: missing "maxDuration" in vercel.json functions`);
    }
    const rule = policy[file];
    if (rule?.minMemory != null && !(cfg.memory >= rule.minMemory)) {
      problems.push(`${file}: memory ${cfg.memory} < required minimum ${rule.minMemory}`);
    }
    if (rule?.minMaxDuration != null && !(cfg.maxDuration >= rule.minMaxDuration)) {
      problems.push(`${file}: maxDuration ${cfg.maxDuration} < required minimum ${rule.minMaxDuration}`);
    }
  }
  // A policy route with no config at all is also a violation.
  for (const file of Object.keys(policy)) {
    if (!config[file]) {
      problems.push(`${file}: route-specific policy defined but no vercel.json entry`);
    }
  }
  return problems;
}

// --- positive coverage: current production artifacts satisfy the contract ---

test("deployment: entrypoint and config inventories are non-empty", () => {
  // Guards against a broken glob / parse silently passing the symmetry checks.
  assert.ok(entrypoints.length > 0, "no api/ entrypoints were found");
  assert.ok(configuredFiles.length > 0, "no vercel.json functions entries were found");
});

test("deployment: the app.js route extractor covers both registration idioms", () => {
  // Guards the compatibility adapter: if either idiom stops being matched the
  // completeness check below would silently under-count. Anchor on the two
  // idioms actually present, and prove telemetry labels / the CORS guard are
  // NOT matched.
  const sample = [
    'if (url.pathname === "/api/alpha") {',
    'if (url.pathname.startsWith("/api/beta")) {',
    'endTimer({ reqId, route: "/api/should-not-match" });',
    'if (req.method === "OPTIONS" && req.url.startsWith("/api/")) {',
  ].join("\n");
  assert.deepEqual(extractLocalApiRoutes(sample), ["/api/alpha", "/api/beta"]);

  // And against the real file, both idioms are present (=== and startsWith).
  assert.ok(localRoutes.length > 0, "extractor found no /api routes in app.js");
  assert.ok(
    localRoutes.includes("/api/inngest"),
    "extractor must cover startsWith(...) routes (e.g. /api/inngest)",
  );
  assert.ok(
    localRoutes.includes("/api/studio-document"),
    "extractor must cover === pathname routes (e.g. /api/studio-document)",
  );
});

test("deployment[completeness]: every local /api route in app.js has a production entrypoint", () => {
  const missing = localRoutesMissingEntrypoint(localRoutes, entrypoints);
  const detail = missing
    .map((route) => `${route} → expected ${routeToEntrypoint(route)}`)
    .join(", ");
  assert.deepEqual(
    missing,
    [],
    `local routes registered in src/server/app.js with no api/ entrypoint: ${detail}`,
  );
});

test("deployment[existence]: every api/ entrypoint has a vercel.json functions entry", () => {
  const missing = entrypointsMissingConfig(entrypoints, configuredFiles);
  assert.deepEqual(
    missing,
    [],
    `api/ entrypoints missing deployment configuration in vercel.json: ${missing.join(", ")}`,
  );
});

test("deployment[existence]: every vercel.json functions entry maps to an existing api/ file", () => {
  const stale = configWithoutEntrypoint(configuredFiles, entrypoints);
  assert.deepEqual(
    stale,
    [],
    `vercel.json functions entries without a matching api/ entrypoint: ${stale.join(", ")}`,
  );
});

test("deployment[existence]: every api/ entrypoint exports a callable handler", async () => {
  const broken = [];
  for (const file of entrypoints) {
    const mod = await import(pathToFileURL(path.join(repoRoot, file)).href);
    if (!isCallableHandler(mod)) {
      broken.push(file);
    }
  }
  assert.deepEqual(
    broken,
    [],
    `api/ entrypoints without a callable default export: ${broken.join(", ")}`,
  );
});

test("deployment[policy]: route-specific deployment policy is satisfied", () => {
  const problems = policyViolations(functionConfig, ROUTE_POLICY);
  assert.deepEqual(problems, [], `deployment policy violations:\n${problems.join("\n")}`);
});

// --- negative proofs: each required element, when removed/corrupted, fails ---

test("deployment[negative]: a local route with no production entrypoint is detected", () => {
  // Simulates adding a route to app.js (via extraction) while forgetting its
  // api/ bridge — the primary local↔production divergence the gate must catch.
  const missing = localRoutesMissingEntrypoint(
    ["/api/foo", "/api/bar"],
    ["api/foo.js"], // bar registered locally but never deployed
  );
  assert.deepEqual(missing, ["/api/bar"]);
});

test("deployment[negative]: removing a required production entrypoint fails the gate", () => {
  // The real local inventory projected against api/ with health removed —
  // proves deletion of a required entrypoint is detected route-specifically.
  const withoutHealth = entrypoints.filter((f) => f !== "api/health.js");
  const missing = localRoutesMissingEntrypoint(localRoutes, withoutHealth);
  assert.deepEqual(missing, ["/api/health"]);
});

test("deployment[negative]: an entrypoint with no deployment config is detected", () => {
  const missing = entrypointsMissingConfig(
    ["api/foo.js", "api/bar.js"],
    ["api/foo.js"], // bar.js deployed but unconfigured
  );
  assert.deepEqual(missing, ["api/bar.js"]);
});

test("deployment[negative]: stale config with no entrypoint file is detected", () => {
  const stale = configWithoutEntrypoint(
    ["api/foo.js", "api/ghost.js"], // ghost.js configured but deleted
    ["api/foo.js"],
  );
  assert.deepEqual(stale, ["api/ghost.js"]);
});

test("deployment[negative]: a non-callable entrypoint export is detected", () => {
  assert.equal(isCallableHandler({ default: () => {} }), true);
  assert.equal(isCallableHandler({ default: 42 }), false);
  assert.equal(isCallableHandler({}), false);
});

test("deployment[negative]: missing runtime config and sub-minimum limits are detected", () => {
  const problems = policyViolations(
    {
      "api/inngest.js": { memory: 256, maxDuration: 60 }, // both below minima
      "api/ig-publish.js": { memory: 256 }, // missing maxDuration entirely
    },
    ROUTE_POLICY,
  );
  assert.ok(problems.some((p) => p.startsWith("api/inngest.js:") && p.includes("memory")));
  assert.ok(problems.some((p) => p.startsWith("api/inngest.js:") && p.includes("maxDuration")));
  assert.ok(problems.some((p) => p.startsWith("api/ig-publish.js:") && p.includes("maxDuration")));
});

test("deployment[negative]: a policy route absent from vercel.json is detected", () => {
  const problems = policyViolations({}, ROUTE_POLICY);
  assert.ok(problems.some((p) => p.includes("api/inngest.js") && p.includes("no vercel.json entry")));
  assert.ok(problems.some((p) => p.includes("api/ig-publish.js") && p.includes("no vercel.json entry")));
});
