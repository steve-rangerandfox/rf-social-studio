# Testing and validation

Use the cheapest test that can disprove the current hypothesis, then run the full relevant gate once the change is complete.

## Canonical release gate

`npm run release:check` is the one canonical release signal. It chains every
tier fail-fast (plain `&&`, no exit-masking) in this order:

1. `npm run lint` — static contract.
2. `npm run test:node` — validation, server, persistence, deployment-contract, route-smoke.
3. `npm run test:unit` — Vitest (jsdom).
4. `npm run build` — production bundle.
5. `npm run test:browser` — real chromium (Playwright).

Green means the complete critical signal passed. Red is a real, actionable
failure and the failing tier names the mechanism. CI (`.github/workflows/ci.yml`)
runs this same command on Node 20 after `npx playwright install --with-deps
chromium`, so local and CI behavior match. Run it on **Node 20.x** (the
`engines`-pinned version): on Node 24 + Windows `vite build` produces correct
output but its esbuild service can keep the process from exiting — a known
environment quirk, not a build failure.

The focused commands stay available for iterating: `test:validation`,
`test:server`, `test:node`, `test:unit`, `test:browser`, `lint`, `build`.

## What each tier proves — and does not

- `npm run lint`: static lint rules only.
- `npm run build`: the app bundles successfully. Does **not** prove any surface mounts.
- `npm run test:node`: server/validation/persistence behavior, the deployment
  contract (`api/` ↔ `vercel.json` ↔ `src/server/app.js` routes), and that the
  deployed production entrypoints boot and respond (route-smoke). Runs in jsdom-free Node.
- `npm run test:unit`: explicitly mounted or invoked Vitest behavior (jsdom).
  Does **not** prove a real browser renders it.
- `npm run test:browser`: real-browser mount + interaction (see below).
- `npm test`: Node and Vitest suites only (no lint/build/browser).

Passing lint, build, and unrelated unit tests does **not** prove that a major React surface mounts or that a browser interaction works. That is the browser tier's job.

## Production-entrypoint route-smoke (`tests/route-smoke.test.js`)

Proves the exact artifact Vercel deploys responds through the real cold-start
path (`api/<route>.js` → `createApiHandler()` → `loadServerEnv()` →
`handleApiRequest`) — distinct from the deployment contract (wiring only, no
invoke) and `server.test.js` (behavior via `app.js` with an explicit env
override). It imports the real `api/*.js` default exports and asserts
representative responses (health 200; auth-gated routes 401), with no secrets,
no network, and no data mutation. When external auth config is **absent** the
route returns an explicit `503 "not configured"` — an asserted result, never an
unexplained failure. This is the pattern for optional credentials/integrations
generally: absence must produce a specific, asserted status, not a skip.

## Change workflow

1. Reproduce the issue or gather concrete evidence.
2. State the violated invariant in one sentence.
3. Search for analogous surfaces and shared code paths.
4. Add or update the smallest durable regression test.
5. Implement the smallest complete fix.
6. Run the targeted test while iterating.
7. Run `npm run lint`, `npm test`, and `npm run build` before completion unless the change is documentation-only.
8. Report commands and results precisely. Do not claim browser or production verification that was not performed.

## Test selection

### Studio or React surface

- mount the real component with the minimum required providers;
- test the actual event sequence for pointer and text bugs;
- include a scoped-boundary test when failure isolation changes.

### Publishing or API

- test payload/media-type mapping;
- test container creation, readiness polling, and publish ordering;
- test both designed-frame and raw-media paths when shared resolution changes;
- verify the `/api` production entrypoint exists. This deployment contract is enforced automatically by `tests/deployment-contract.test.js` in the `test:node` gate, in both directions: (A) every `/api` route registered in `src/server/app.js` must have a matching `api/<route>.js` entrypoint, so local and production route availability cannot silently diverge; and (B) every `api/` entrypoint must be configured in `vercel.json`, export a callable handler, and meet route-specific memory/`maxDuration` policy. Adding a route to `src/server/app.js` therefore requires adding both its `api/<route>.js` bridge and its `vercel.json` functions entry, or the gate fails route-specifically.

### Persistence or synchronization

- test local/server merge behavior;
- test stale version/conflict handling;
- test offline queue and retry behavior when affected;
- avoid timing-dependent sleeps where deterministic state control is possible.

### Browser-only behavior — the real-browser tier

`npm run test:browser` (Playwright, headless chromium, one browser — no
screenshot suite, no device matrix, no live credentials) is the durable home
for mechanisms jsdom cannot reproduce. It boots `vite.harness.config.js`, which
serves `browser-harness/*.html` and aliases `@clerk/react` to a deterministic
hooks-only mock so the auth-gated surfaces mount signed-in with no network.
Dummy `VITE_SUPABASE_*` keys are injected so import-time client construction
does not throw; the harness has no backend, so persistence degrades to local
state (an intentionally tested condition).

Two entrypoints mount the **real** surfaces:

- `browser-harness/studio-main.jsx` → `<App/>` (`StudioProvider` + `StudioShell`).
- `browser-harness/designer-main.jsx` → `<StoryDesigner row={fixture}/>` via its supported prop entrypoint.

Covered mechanisms (in `browser-tests/`), each with an **explicit readiness
condition** and no arbitrary sleeps:

| Scenario | Ready condition | Proves |
| --- | --- | --- |
| Studio shell mount | `.app main.main` visible | shell mounts, no uncaught page error |
| Designer mount | `.canvas[aria-label="Story canvas"]` + fixture element visible | designer mounts, no uncaught page error |
| Text commit + click-out | edit → type → click empty canvas | committed text survives (keystroke-commit invariant) |
| Pointer drag | real pointerdown+move+up | element's committed `style.top` changed (real events, not state mutation) |
| Muted video readiness | polled media state | `muted` **property** true, `readyState >= 2`, `currentTime` advancing |

Fixtures live in `browser-harness/`: `fixture-row.js` (text + video element
schemas matching `StoryDesigner`), and `fixtures/tiny.mp4` (a 1.6 KB,
ffmpeg-generated, repository-controlled clip). Keep fixtures small, durable, and
offline — never depend on external media.

**When a new browser test is justified:** only for a demonstrated production
failure mechanism that build/lint/unit tests cannot catch — a surface that
crashes on mount, or a real pointer/focus/media interaction whose behavior
jsdom cannot reproduce. Do not port assertions already covered by a Vitest
test into the browser tier, and do not add screenshots, a browser matrix, or
live-credential flows. Do not redesign the designer, pointer, focus, or video
pipeline to make testing convenient; correct a product defect only when the
browser test proves it is mission-critical.

**Diagnosing a browser failure without broad exploration:** the failure message
names the surface or mechanism. Traces are retained on failure under
`test-results/` (`npx playwright show-trace <zip>`). To reproduce interactively,
run `npx vite --config vite.harness.config.js` and open
`http://localhost:4321/studio.html` or `/designer.html`. A mount failure is
almost always an uncaught error at import/render — check the harness page's
console; an element-not-found is usually a surface that did not reach its ready
condition, not a flaky wait.

## Regression search checklist

Before declaring a fix complete, search by primitive rather than by screen name. Useful terms include:

- `<video`, `autoplay`, `muted`, `poster`, `playsInline`;
- `contentEditable`, `onInput`, `onBlur`;
- `onPointerDown`, `onPointerUp`, `onClick`, `shiftKey`;
- `mediaType`, `media_publish`, `carouselFrameUrls`;
- route names in both server routing and `/api` files.

A bug reported on one screen may be a shared invariant failure across several surfaces.

## Completion report

Every coding task should end with:

- root cause;
- invariant established;
- files changed;
- tests added or updated;
- exact validation commands and outcomes;
- anything still unverified, especially deployed Meta behavior or real-browser behavior.
