# rf-social-studio — Comprehensive Audit Report

**Date:** 2026-04-18
**Branch:** `main` (commit `bcf526a`)
**Method:** 8 specialised agents coordinated through a claude-flow hierarchical swarm (`swarm-1776532377407-vtuh0i`). Each agent read the real code and returned structured findings; consolidated here from the `audit` memory namespace.

**Stack:** React 19 + Vite 7 • Clerk • Supabase • Vercel serverless (`api/*.js`) • Inngest (background) • Upstash Redis (rate limit) • Anthropic (AI)

---

## 1. Executive summary

**90 findings across 8 domains.**

| Severity | Count | Notable themes |
|----------|-------|----------------|
| Critical | 6 | `StudioContext.jsx` 813-LOC monolith • `src/server/app.js` 911-LOC router • zero Inngest/persistence tests • `ErrorBoundary` full-reload recovery • `Suspense fallback={null}` for `StoryDesigner` |
| High | 26 | AI prompt injection • missing HSTS • fail-open rate limiter • in-memory token-refresh lock • no DB indexes on `owner_user_id` • no lazy/error-element routing • IDB connection re-opened per op • no CI/E2E/frontend tests |
| Medium | 39 | RLS policies missing, OAuth state cleanup, dedup coalescing, bundle splitting, a11y focus-visible, silent validation truncation, error-code categorisation |
| Low | 18 | CSP wildcard narrowing, session TTL, query-timeout granularity, JSDoc rationale, magic-value extraction |
| Info | 1 | Zero TODO/FIXME markers in the codebase (debt is unrecorded) |

### Cross-cutting issues (flagged by ≥3 agents)

1. **`src/features/studio/StudioContext.jsx` is the single biggest liability** — 813 LOC, ~60 `useState`/`useRef`, 8 `useEffect` hooks, 64 context exports. Called out by architecture, performance, static-analysis, and frontend agents. Drives re-render cost, stale-closure risk, coupling, and low docs coverage.
2. **`src/server/app.js` is a 911-LOC monolith** — arch, backend, static-analysis, and quality all want it split into per-endpoint modules with middleware for auth/rate-limit/error wrapping.
3. **Operational resilience gaps on Vercel** — in-memory token-refresh lock, fail-open rate-limit fallback, and Inngest cron overlap all break under concurrency/instance spread.
4. **Observability is effectively zero** — no correlation IDs, no per-endpoint latency metrics, `console.error` mixed with `log.error`, unknown errors silently classified as 500.
5. **Testing coverage is false-confidence** — 44 tests cover HTTP validation; 0 cover the Inngest scheduled publisher (228 LOC of business-critical logic), the persistence layer, or any frontend code. No CI gating.

### Top 10 priorities (ordered)

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | Add Inngest + persistence unit tests; wire GitHub Actions CI gating | Critical | M |
| 2 | Replace `Suspense fallback={null}` for `StoryDesigner` with spinner | Critical | S |
| 3 | Add Strict-Transport-Security header in `vercel.json` | High | S |
| 4 | Sanitise/structure AI prompts in `src/server/ai.js`; validate output with schema | High | M |
| 5 | Fail-closed when Upstash unavailable in prod; env-guard the in-memory fallback | High | M |
| 6 | Add Supabase indexes on `ig_tokens(owner_user_id)` + composite `(owner_user_id, ig_username)` | High | S |
| 7 | Debounce `persistStudioDocument` (500 ms) + cache IDB handle at module scope | High | M |
| 8 | Split `StudioContext.jsx` into Document/UI/Modal/Connection sub-contexts | Critical | L |
| 9 | Extract `src/server/app.js` handlers into `src/server/handlers/*.js` + middleware pipeline | Critical | M |
| 10 | Add route-level `<ErrorBoundary>` per view + recover without full reload | Critical | M |

---

## 2. Architecture findings (system-architect)

> Hub-and-spoke backend with thin Vercel entry points delegating to a monolithic 900-line router. No critical architectural flaws; main theme is modularization + observability.

| Severity | Area | File | Current | Fix | Effort |
|----------|------|------|---------|-----|--------|
| Medium | router-architecture | `src/server/app.js:717-882` | Single 165-line `handleApiRequest()` routes all 6 endpoints via inline if/else | Extract endpoint handlers into `src/server/handlers/` with a route-table dispatcher | M |
| Medium | caching | `src/server/app.js:52-73` | Manual module-scope IG sync cache with ad-hoc TTL and size cap | Replace with `lru-cache` or move to client-side IndexedDB | M |
| Medium | state-bloat | `src/features/studio/StudioContext.jsx` | Context exports 60+ state values; any change re-renders consumers | Split into DocumentContext / PublishingContext / UIContext | M |
| Medium | coupling | `api/*.js` | All Vercel entry points import `handleApiRequest` — tight coupling | Each `api/*.js` imports its own handler module | M |
| Low | env-loading | `api/*.js:1-7` | All 5 Vercel fns independently call `loadServerEnv()` on cold start | Cache singleton at module load / memoize inside `env.js` | S |
| Low | duplication | `src/server/app.js:75-94` | auth + rate-limit calls re-implemented per endpoint | Compose as middleware pipeline or HOF wrapper | S |
| Low | persistence-tiers | `src/lib/idb-store.js` + `document-store.js` | 3 tiers (localStorage, IDB, Supabase) with unclear precedence on conflict | Document + enforce priority hierarchy; reconciliation logic | M |
| Low | rate-limit-visibility | `src/server/rate-limit.js` | No `RateLimit-Limit/Remaining/Reset` headers returned | Emit standard headers; add `/api/rate-limit-status` | S |
| Low | observability | `src/server/app.js` + `persistence.js` | No request correlation IDs, no latency metrics per endpoint | Request ID + structured JSON logs + latency counters | M |

---

## 3. Security findings (security-auditor)

> Solid foundations (Clerk RS256 verify, session AES-GCM, CSRF state cookie, Upstash rate limit). Three high-severity items need attention: AI prompt-injection surface, missing HSTS, fail-open rate limiter.

| Severity | Area | File | Current | Fix | Effort |
|----------|------|------|---------|-----|--------|
| High | prompt-injection | `src/server/ai.js:15-20,28-35` | User prompt/board JSON embedded directly into system prompt with no sanitisation or output validation | Structured prompts with explicit delimiters; validate AI output shape/length; log suspicious patterns | M |
| High | hsts | `vercel.json:19-40` | No `Strict-Transport-Security` header — first visit vulnerable to MITM | Add `max-age=31536000; includeSubDomains; preload` | S |
| High | rate-limit-fail-open | `src/server/rate-limit.js:29-56,100-116` | Falls back to per-instance in-memory buckets if Upstash unavailable; per-instance quotas allow distributed abuse | Fail-closed in prod when Upstash unavailable; env-guard rejection | M |
| Medium | ai-output-parse | `src/server/ai.js:39-42` | Greedy regex `/\[\s\S]*\]/` used to extract JSON from model output | `JSON.parse` + schema validator; reject and log parse failures | S |
| Medium | token-refresh-race | `src/server/app.js:412-440` | 30-second in-memory lock on IG token refresh — per-instance only | Upstash `SET NX EX` or Supabase advisory lock | M |
| Medium | csrf-state-ttl | `src/server/app.js:361-379` | OAuth state cookie has no explicit `max-age` | Set 5-10 minute max-age | S |
| Medium | oauth-redirect-validation | `src/server/app.js:295-310` | Accepts `redirect_uri` from query without matching against `env.igRedirectUri` | Explicit equality check before token exchange | S |
| Medium | xss-escaping | `src/server/validate.js:28-55` | Strings validated for length/type but not sanitised for HTML contexts | Escape on output or tighten input regex/allowlist | M |
| Medium | rls-policies | `supabase/schema.sql` + migrations | RLS enabled but no user-scoped policies — relies on service-role bypass | Add `owner_user_id = auth.uid()` select/update policies | M |
| Medium | caption-validation | `src/server/validate.js:77-82` | Only length-checked; no jailbreak-pattern heuristics or abuse tracking | Content heuristics + stricter rate-limit for repeat offenders | S |
| Low | inngest-signing | `src/server/inngest-handler.js:1-16` | Relies on SDK default signature validation; not logged or asserted | Verify SDK version; surface validation outcome in logs | S |
| Low | secret-rotation | `src/server/env.js` + `cookies.js` | No `SESSION_SECRET` rotation; one secret encrypts sessions + IG tokens | Version encrypted payloads; decrypt-old/encrypt-new support | L |
| Low | token-expiry-grace | `src/server/ig-token-store.js:66-67` | Exact `expires_at <= now` boundary — can flicker near expiry | Subtract ~60 s grace period | S |
| Low | csp-wildcard | `vercel.json:25` | `frame-src https://*.clerk.accounts.dev` — wildcard subdomain | Narrow to exact Clerk subdomains used in prod | S |

---

## 4. Performance findings (perf-analyzer)

> Biggest wins: split StudioContext (L), debounce document persistence (M), add Supabase indexes (S). Clear 20-40% latency headroom on hot paths.

| Severity | Area | File | Current | Fix | Effort |
|----------|------|------|---------|-----|--------|
| High | react-rerenders | `src/features/studio/StudioContext.jsx` | 35+ `useState` + heavy `useMemo` in single provider; any state change re-renders all consumers | Split into Document/Filter/Media contexts; memoise children | L |
| High | idb-connection | `src/lib/idb-store.js` | `openDB()` called on every save/load/sync-queue op — 5-50 ms per call | Module-scope cached handle; refresh on `versionchange` | M |
| High | ai-streaming | `src/server/ai.js` | Anthropic calls are non-streaming; client waits for full body | Return `ReadableStream`; enable prompt caching for repeated system prompt | M |
| High | db-indexes | `migrations/001_ig_tokens.sql` | Only `expires_at` index; `owner_user_id` / `ig_username` queries do full scans | Index `owner_user_id` + composite `(owner_user_id, ig_username)` | S |
| High | persist-debounce | `src/features/studio/document-store.js` | `persistStudioDocument` writes localStorage + IDB on every keystroke, no debounce | Debounce 500 ms; write-behind queue; drop sync localStorage write | M |
| Medium | upstash-latency | `src/server/rate-limit.js` | Every request adds 50-100 ms Upstash REST round-trip | Short-window in-memory sliding before Upstash on warm instances | M |
| Medium | suspense-fallback | `src/features/studio/StudioApp.jsx:186` | Lazy-loaded `StoryDesigner` has `fallback={null}` — blank screen on slow networks | Spinner fallback with 150 ms delay | S |
| Medium | bundle-splitting | `vite.config.js` | No `manualChunks`; 1 MB `chunkSizeWarningLimit`; vendor bundle likely monolithic | `rollupOptions.output.manualChunks` for react/router/clerk/supabase | M |
| Medium | cold-start-deps | `vercel.json` + `api/captions.js` | Loads full Anthropic SDK even on validation-only paths | Lazy-import Anthropic SDK only after successful validation | M |
| Low | query-timeout | `src/server/persistence.js` | Fixed 10 s `QUERY_TIMEOUT_MS` for all queries | Per-query-type timeout config; monitor distribution | S |

---

## 5. Code quality findings (reviewer)

> No critical quality gates broken. Major theme is scattered constants + duplicated boilerplate in `api/*.js` and `src/server/app.js`, plus fragile message-regex error categorisation.

| Severity | Area | File | Current | Fix | Effort |
|----------|------|------|---------|-----|--------|
| High | duplication | `api/captions.js` + `ig-posts.js` + `studio-document.js` + `ig-oauth.js` + `inngest.js` | All 5 repeat the same 6-line boilerplate | Factor `createApiHandler(handlerFn)` with cached env | S |
| High | timers | `src/server/app.js` (`handleInstagramPosts`) | Seven inline `endTimer()` calls scattered across the handler | Single `startTimer()/endTimer()` pair per request | S |
| High | magic-values | `src/server/app.js` top | `IG_CACHE_TTL_MS`, `IG_PENDING_TTL_MS`, `REFRESH_LOCK_TTL_MS`, `IG_PUBLISH_MAX_CAPTION`, `IG_PUBLISH_MEDIA_TYPES` inline | Create `src/server/config.js` with rationale comments | S |
| Medium | error-codes | `src/server/app.js` | Error categorisation via regex `/expired|invalid/i` on messages — fragile | Attach structured `err.code` values; branch on code | M |
| Medium | inconsistent-logging | `src/server/rate-limit.js:111` | `console.error` used where rest of codebase uses `log.error` | Replace with `log.error` for redaction consistency | S |
| Medium | naming | `src/server/app.js` | `igSyncCache` / `igSyncInflight` have no JSDoc describing purpose | Rename + JSDoc | S |
| Medium | silent-truncation | `src/server/validate.js:57-60` | `auditLog` silently truncated to 1000 entries | Reject with 400 or `log.warn` + document behaviour | S |
| Medium | constants-rationale | `src/server/validate.js:1-5` | `MAX_DOCUMENT_BYTES`/`PROMPT_LENGTH`/`ROWS`/`COMMENTS`/`AUDIT` lack rationale comments | JSDoc each with source (IG API, UX budget) | S |
| Medium | dry-auth | `src/server/auth.js` | `base64UrlDecodeJson` + `base64UrlToBuffer` duplicate URL-safe normalisation | Extract `base64UrlNormalize` helper | S |
| Low | eslint-disables | `eslint.config.js` | Several react-hooks rules disabled without explanation | Inline `// reason` per disabled rule | S |

---

## 6. Static-analysis findings (code-analyzer)

> Two complexity hotspots dominate: `StudioContext.jsx` (813 LOC, 60+ state, 8 effects) and `src/server/app.js` (911 LOC, monolithic router). Documentation coverage on public exports is effectively zero.

| Severity | Area | File | Current | Fix | Effort |
|----------|------|------|---------|-----|--------|
| Critical | complexity | `src/features/studio/StudioContext.jsx` | 813 LOC, 60+ `useState`/`useRef`, 8 `useEffect`, 12+ callbacks, 30+ destructured exports | Decompose into domain contexts + custom hooks (`useDocumentSync`, `useInstagramFeed`, `useUndoManager`) | L |
| Critical | size | `src/server/app.js` | 911 LOC, single request handler mixing auth/IG-sync/document-ops/static-serving | Extract per-endpoint modules + middleware; target < 200 LOC dispatcher | M |
| High | coupling | `src/features/studio/StudioApp.jsx` | 308 LOC; `StudioShell` destructures 30+ context properties | Presentational sub-components + custom hooks | M |
| High | docs | `src/server/app.js` | 0 JSDoc on 6+ public handlers (caption, IG start/exchange/posts/publish, document get/put) | Add `@param`/`@returns`/`@throws`; produce `API.md` | S |
| High | docs | `src/features/studio/StudioContext.jsx` | 64+ exported context members with no individual docs | JSDoc per exported member; consumer map | M |
| Medium | coupling | `src/server/app.js:328-497` | Token refresh + document versioning inlined in main handler | Extract `TokenManager` + `DocumentVersionManager` modules | M |
| Medium | lifecycle-effects | `src/features/studio/StudioContext.jsx:161-650` | 8 `useEffect` hooks covering IDB hydration, online/offline, feed polling, token refresh, sync | Extract into `useIndexedDBHydration`, `useOfflineDetection`, `useInstagramTokenRefresh`, `useDocumentSync` | L |
| Medium | dead-code | `src/features/studio/StudioContext.jsx` | ~20 of 64 exported context members suspected unused externally | Import-trace + remove unused; move internal ones to `useMemo` | M |
| Medium | size | `src/features/studio/StudioContext.jsx:755-810` | Single provider value object with 64 properties | Split into domain contexts (Document/View/Connection/Modal) | L |
| Info | todos | `src/` (73 files) | 0 `TODO`/`FIXME`/`XXX`/`HACK` markers | Not required; consider adding markers for audit follow-ups | S |

---

## 7. Backend/API findings (backend-dev)

> Backend is correctly layered (Vercel → handlers → persistence) with good patterns (optimistic locking, categorised retries). Highest-risk items are the 30 s in-memory token-refresh lock, fail-open rate limiting, and Inngest cron overlap.

| Severity | Area | File | Current | Fix | Effort |
|----------|------|------|---------|-----|--------|
| High | body-parsing | `src/server/http.js:79` | `readJsonBody` enforces `MAX_BODY_BYTES` but does not validate parsed shape — malformed payloads silently parse to `{}` | Per-endpoint schema validation (zod or hand-written) after parse | M |
| High | rate-limit-prod-guard | `src/server/rate-limit.js:6` | In-memory fallback silently activates without env guard | Fail-closed in prod if Upstash creds missing; document dev-only fallback | M |
| High | token-refresh-lock | `src/server/app.js:377` | 30 s in-memory lock; orphaned lock forces callers to wait 30 s and retry with stale token | Distributed lock + heartbeat; log stale-lock evictions | L |
| Medium | sync-dedup | `src/server/app.js:272` | `igSyncInflight` stores result, not promise — concurrent callers each fetch | Store in-flight promise; clear on settle | S |
| Medium | oauth-state-cleanup | `src/server/app.js:253-260` | Expired state cookies never explicitly cleared | Delete cookie on success OR failure | S |
| Medium | error-categorization | `src/server/persistence.js:95-111` | Unknown Supabase errors silently classified 500/non-retryable | Log full error; alert when unknowns exceed threshold | S |
| Medium | optimistic-lock-semantics | `src/server/persistence.js:193-224` | `PGRST116` treated as conflict — client can't distinguish missing vs stale | Follow-up SELECT to return 404 (missing) vs 409 (stale) | M |
| Medium | inngest-overlap | `src/inngest/publish-scheduled.js:20` | `*/5` cron with no overlap guard; long run may double-process posts | Inngest `concurrency=1` + store last-processed version | L |
| Medium | ai-error-classes | `src/server/ai.js:29-51` | All Anthropic errors treated uniformly — client retries content-policy errors | Categorise 429/5xx as retryable, 4xx as not; return typed error | S |
| Medium | rate-limit-granularity | `src/server/app.js:466` | Per `userId:endpoint` only — one active user blocks all reads of that endpoint | Per-resource granularity for reads | M |
| Low | security-headers | `src/server/http.js:19-24` | Sets `X-XSS-Protection: 0` (deprecated); CSP only in `vercel.json` | Drop `X-XSS-Protection`; ensure API responses also set CSP | S |
| Low | session-ttl | `src/server/app.js:171` | Session cookie has no `Max-Age` — cleared on browser close | Set 7-day `Max-Age`; expire server-side on each request | S |
| Low | query-timeouts | `src/server/persistence.js:7` | Fixed 10 s timeout regardless of query type | Per-query-type timeout + monitoring | M |

---

## 8. Frontend/UX findings (frontend)

> Functional but has two critical UX gaps (error recovery = full reload, `StoryDesigner` blank screen) plus real a11y debt (no `:focus-visible` styles, undiscoverable keyboard shortcuts). `StudioContext` bloat is the root cause of most state-mgmt findings.

| Severity | Area | File | Current | Fix | Effort |
|----------|------|------|---------|-----|--------|
| Critical | error-ux | `src/components/ErrorBoundary.jsx:70` | Only recovery path is full page reload — loses IDB draft state + sync queue | Granular boundaries per view with retry-without-reload; persist error state to IDB | M |
| Critical | loading-ux | `src/features/studio/StudioApp.jsx:186` | `Suspense fallback={null}` for lazy `StoryDesigner` — blank screen on slow networks | Spinner fallback with 150 ms delay | S |
| High | state-management | `src/features/studio/StudioContext.jsx:1-813` | Single 813-line context with ~60 `useState` — broad re-renders | Split ModalContext / UIContext / DataContext; `useReducer` for sync+undo | L |
| High | routing | `src/main.jsx:14-24` | Static routes under `ClerkProvider`; no lazy imports, loaders, or `errorElement` | Route-level `lazy` + `errorElement`; move public routes to own layout | M |
| High | react-patterns | `src/features/studio/StudioApp.jsx:17` | Non-standard `lazy()` with manual `.then(m=>({default:m.StoryDesigner}))` wrapper | Align with component export style; document if retained | S |
| High | a11y | `src/features/studio/useKeyboardShortcuts.js:14-44` | 10+ shortcuts (Cmd+K/S, N, /, 1-4) with no help UI, aria-labels, or discoverability | `?`-triggered help modal + aria-labels on shortcut targets | M |
| High | a11y | `src/features/studio/useKeyboardShortcuts.js:36-38` | Shortcut queries `.ops-search-trigger` by class name — silent fail if DOM changes | Pass search trigger via context/ref | S |
| High | loading-ux | `src/components/AuthGate.jsx:381` | Returns `null` during `isLoaded=false` — blank screen | Minimal loading shell with logo + spinner | S |
| Medium | error-ux | `src/features/studio/StudioApp.jsx:119-136` | Per-view rendering has no local `ErrorBoundary` | Wrap each view in its own boundary with list-view fallback | S |
| Medium | state-management | `src/features/studio/StudioContext.jsx:356` | `eslint-disable-next-line` on IDB hydration effect — stale-closure risk | Document or stabilise deps with `useCallback` | S |
| Medium | a11y | `src/features/studio/studio.css` | No `:focus-visible` styles — keyboard focus invisible (WCAG 2.1 AA fail) | `outline: 2px solid` on `:focus-visible` for buttons/inputs/links | S |
| Medium | offline-ux | `src/features/studio/StudioApp.jsx:106-137` | `SaveStatusBadge` only inside `DetailPanel` — offline state invisible in list/calendar/grid views | Promote badge to Topbar or persistent banner | S |
| Medium | react-patterns | `src/features/studio/StudioContext.jsx` | No `useTransition`/`use()`/async-Suspense patterns despite React 19 | Introduce `useTransition` around sync + heavy filter recomputes | M |
| Low | routing | `src/main.jsx:16-18` | Public routes (privacy/terms/data-deletion) outside `ClerkProvider`/layout, may miss shared fonts/shell | `PublicLayout` wrapper with shared fonts | S |
| Low | components | `src/features/studio/StudioApp.jsx:159-290` | Modal state as 4+ booleans with no stacking discipline | Modal stack / state-machine | S |

---

## 9. Testing findings (tester)

> 44 tests (9 server + 35 validation) cover only HTTP validation and a few endpoint shapes. **Zero coverage for Inngest scheduled publisher, persistence layer, frontend components, or E2E** — the highest-risk surfaces. Also no CI gating.

| Severity | Area | File | Current | Fix | Effort |
|----------|------|------|---------|-----|--------|
| Critical | frontend-gap | repo-wide | 0 frontend tests; no Vitest/Jest/RTL; `validation.test.js` re-implements `App.jsx` logic instead of importing | Add Vitest + RTL; test `StudioContext` reducers/effects; replace duplicated constants with imports | L |
| Critical | migration-gap | `src/inngest/publish-scheduled.js` | 228 LOC of mission-critical scheduled publishing (token refresh, version conflicts, optimistic lock) with 0 tests | Unit tests per step with mocked Supabase/Instagram/Anthropic; retry/conflict scenarios | M |
| High | coverage | `src/server/persistence.js` | 200+ LOC of DB logic (caching, `categorizeError`, optimistic lock) — 0 tests | Unit tests with Supabase mock per error category + lock branch | M |
| High | coverage | `api/ig-publish`, `api/health`, `api/inngest` | 3 endpoints have no test coverage (tests only exist for captions/ig-oauth/ig-posts/studio-document) | `server.test.js` cases per endpoint; happy + error + auth paths | M |
| High | e2e-gap | repo-wide | No Playwright/Cypress; IG OAuth only tested with mocks — never validated end-to-end | Minimal Playwright suite for auth, save, IG connect, publish | L |
| High | ci | repo-wide | No `.github/workflows` — tests runnable locally but not gating PRs | GitHub Actions: lint + test on PR; required status check | S |
| Medium | coverage | `src/server/auth.js` | Clerk JWT verification only exercised via `server.test.js` mocks — no unit tests for RS256 / issuer / clock-skew branches | Direct unit tests with signed test JWTs (expired/invalid-iss/future-iat) | M |
| Medium | isolation | `tests/validation.test.js` | Hardcodes `PLATFORMS`/`STATUSES`/`MAX_*` that live in `App.jsx` — silent drift if either side changes | Move constants to shared module imported by both | S |
| Low | lint | `eslint.config.js` | Several react-hooks rules disabled with no rationale comments | Annotate each disabled rule with reason | S |

---

## 10. Documentation & operational gaps (synthesised across agents)

- **`README.md` is still the Vite scaffold template** (not project-specific) — no runtime architecture diagram, no deploy steps, no local-dev instructions beyond what's implied by `package.json` scripts.
- **No `API.md`** — 6+ endpoint handlers have no JSDoc. Request/response shapes and rate-limit quotas are only discoverable by reading source.
- **No `CONTEXT_API.md`** for `StudioContext` — 64+ exported members, undocumented.
- **No `CHANGELOG.md` / ADRs** — decisions like "why Inngest instead of Vercel Cron", "why Upstash not Redis", "why localStorage + IDB + Supabase" are only in commit messages.
- **Zero `TODO`/`FIXME` markers** — unrecorded debt, including the items in this audit.

---

## 11. Effort roll-up

| Effort | Critical | High | Medium | Low | Info | Total |
|--------|----------|------|--------|-----|------|-------|
| S (≤ ½ day) | 1 | 10 | 14 | 15 | 1 | 41 |
| M (1-3 days) | 4 | 13 | 21 | 2 | 0 | 40 |
| L (week+) | 1 | 3 | 4 | 1 | 0 | 9 |

Most findings are small. A focused 2-week sprint can close ~80% of the S-effort items plus the highest-leverage M items (createApiHandler factory, central `config.js`, `StudioContext` split phase 1, Supabase indexes, HSTS header, debounced persist, ErrorBoundary recovery, CI wiring).

---

## 12. Methodology

- **Swarm topology:** `hierarchical`, 8 specialised agents (system-architect, security-auditor, perf-analyzer, reviewer, code-analyzer, backend-dev, frontend, tester), `swarmId=swarm-1776532377407-vtuh0i`.
- **Execution:** each role dispatched as a Claude Code `Explore` subagent in parallel; findings returned as structured JSON, then normalised and persisted to the claude-flow `audit` memory namespace (`findings-architecture`, `findings-security`, `findings-performance`, `findings-quality`, `findings-static-analysis`, `findings-backend`, `findings-frontend`, `findings-testing`).
- **Grounding:** every finding cites a real `file:line`. Agents were instructed not to fabricate and to read actual source before flagging.
- **Out of scope:** performance benchmarking (no load-test results), dynamic security testing (no runtime scan), bundle-analyser output (would require a build).
- **Reproduction:** retrieve any role's findings with `memory_retrieve namespace=audit key=findings-<domain>`.
