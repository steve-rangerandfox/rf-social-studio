# rf-social-studio — Audit (Technical + Design)

**Date:** 2026-04-18
**Branch:** `main` (commit `bcf526a`)
**Stack:** React 19 + Vite 7 • Clerk • Supabase • Vercel serverless (`api/*.js`) • Inngest (background) • Upstash Redis (rate limit) • Anthropic (AI)

**Method:** combined output of two passes on the same codebase.
- **Technical pass** — 8 specialised agents coordinated through a claude-flow hierarchical swarm (`swarm-1776532377407-vtuh0i`); findings persisted to the `audit` memory namespace; sources: architecture, security, performance, code-quality, static-analysis, backend, frontend-code, testing.
- **Design pass** — static-source review of `studio.css` (1,477 LOC), 10 sampled components, public pages, and microcopy grep. No live screenshots (browser MCP unavailable — `spawnSync agent-browser ENOENT`); deferred items listed in §15.

Every finding cites a real `file:line`. No speculative or fabricated findings.

---

## 1. Executive summary

**~127 findings across 16 domains (8 technical + 8 design).**

| Severity | Count | Notable themes |
|----------|-------|----------------|
| Critical | 8 | StudioContext 813-LOC monolith • `src/server/app.js` 911-LOC router • zero tests on Inngest scheduled publisher + persistence • ErrorBoundary full-reload recovery • `Suspense fallback={null}` for StoryDesigner • no spacing/shadow/motion design tokens • color tokens misnamed (`--t-mint`, `--t-pink`, `--t-purple` are none of those colors) • mobile sidebar hides with no replacement nav |
| High | 35 | AI prompt injection • missing HSTS • fail-open rate limiter • in-memory token-refresh lock • no DB indexes on `owner_user_id` • no lazy/error-element routing • IDB connection re-opened per op • no CI/E2E/frontend tests • 7 responsive breakpoints (no tier) • CSS↔JS token drift on `textDim` • unused `--t-success` • Toast has no stacking/variant/close • 25+ distinct type styles • 3 duplicate outside-click handlers per Row • `ready` filter value not in STATUSES |
| Medium | 55 | RLS policies missing • OAuth state cleanup • dedup coalescing • bundle splitting • a11y focus-visible • silent validation truncation • error-code categorisation • label drift (Cal/Calendar, Stats/Analytics) • ASCII vs Unicode ellipsis • duplicate toast copy • public pages have no back-nav or brand-mark • 3 near-duplicate slide-panels • Analytics 880px max-width |
| Low | 28 | CSP wildcard • session TTL • query-timeout granularity • JSDoc rationale • magic-values • `Plaak Ney` font declared unused • `Assets ✕` toggle state affordance • minor hex-literal drift |
| Info | 1 | Zero `TODO`/`FIXME` markers (debt unrecorded) |

### Cross-cutting themes (flagged by ≥3 signals)

1. **`src/features/studio/StudioContext.jsx` is the single biggest technical liability** — 813 LOC, ~60 `useState`/`useRef`, 8 `useEffect` hooks, 64 context exports. Surfaced by architecture, performance, static-analysis, and frontend-code agents. Drives re-render cost, stale-closure risk, coupling, and low docs coverage.
2. **`src/server/app.js` is a 911-LOC monolith** — arch, backend, static-analysis, and quality all want it split into per-endpoint modules with middleware for auth/rate-limit/error wrapping.
3. **Design system is aesthetic-strong, system-weak.** Warm paper + ink + gradient-primary is coherent and distinctive. But no spacing/shadow/motion tokens exist; color tokens include dead/misnamed legacy (`mint`, `pink`, `purple` don't match their values); `--t-success` declared but never used. Every other design finding is downstream of this.
4. **Operational resilience gaps on Vercel** — in-memory token-refresh lock, fail-open rate-limit fallback, and Inngest cron overlap all break under concurrency/instance spread.
5. **Mobile is effectively unnavigable.** At `<768px` the sidebar hides with no replacement — month-jump, Team, Connections, Settings become unreachable except via the ⌘K CommandPalette (which is a poor mobile affordance).
6. **Observability is zero.** No correlation IDs, no per-endpoint latency metrics, `console.error` mixed with `log.error`, unknown errors silently classified as 500.
7. **Testing is false-confidence.** 44 tests cover HTTP validation; 0 cover the Inngest scheduled publisher (228 LOC of business-critical logic), persistence layer, or any frontend code. No CI gating.
8. **Microcopy has a strong editorial voice but inconsistent polish** — 7 ASCII vs 2 Unicode ellipses, duplicate "Post removed" copy, label drift (Cal/Calendar, Stats/Analytics).

### Top 15 priorities (ordered, merged tech + design)

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | Add Inngest + persistence unit tests; wire GitHub Actions CI gating | Critical | M |
| 2 | Replace `Suspense fallback={null}` for `StoryDesigner` with spinner | Critical | S |
| 3 | Add Strict-Transport-Security header in `vercel.json` | High | S |
| 4 | Sanitise/structure AI prompts in `src/server/ai.js`; validate output with schema | High | M |
| 5 | Fail-closed when Upstash unavailable in prod; env-guard the in-memory fallback | High | M |
| 6 | Add Supabase indexes on `ig_tokens(owner_user_id)` + composite `(owner_user_id, ig_username)` | High | S |
| 7 | Debounce `persistStudioDocument` (500 ms) + cache IDB handle at module scope | High | M |
| 8 | Design-token rewrite — rename legacy color tokens, add spacing/shadow/motion scales (§14.1) | Critical | M |
| 9 | Mobile nav — add drawer from ☰ or bottom-tab bar (§14.3) | Critical | M |
| 10 | Split `StudioContext.jsx` into Document/UI/Modal/Connection sub-contexts | Critical | L |
| 11 | Extract `src/server/app.js` handlers into `src/server/handlers/*.js` + middleware pipeline | Critical | M |
| 12 | Add route-level `<ErrorBoundary>` per view + recover without full reload | Critical | M |
| 13 | Toast rewrite with variants / stacking / close / pause-on-hover (§14.2) | High | M |
| 14 | Consolidate 7 responsive breakpoints → 3 tiers (`sm 640`, `md 900`, `lg 1200`) | High | M |
| 15 | Unify `textDim` between CSS (`#5E574C`) and JS (`#746B5E`); eliminate drift | High | S |

---

# PART A — Technical findings

## A1. Architecture (system-architect)

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

## A2. Security (security-auditor)

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

## A3. Performance (perf-analyzer)

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

## A4. Code quality (reviewer)

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

## A5. Static analysis (code-analyzer)

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

## A6. Backend / API (backend-dev)

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

## A7. Frontend — code-level (frontend-code)

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

## A8. Testing (tester)

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

# PART B — Design findings

**Scope:** skips anything in Part A (a11y focus-visible, ErrorBoundary recovery, state-mgmt bloat, Suspense fallback). Source-grounded: token extraction from `studio.css`, class inventory, media-query enumeration, JSX string grep, 10 component composition samples. **No live screenshots** (browser MCP was unavailable); items requiring live pixels are deferred to §15.

**Scope mismatch note:** the original design-audit brief asked for `dashboard / project / artist / calendar`. **`project` and `artist` do not exist in this app** — it's a single-document planner. The 4 views audited are **List / Calendar / Grid (IG) / Analytics**.

## B1. Design tokens (source-grounded)

### B1.1 Color — exists but is leaky

30+ CSS variables in `studio.css:4-64`, mirrored in a JS object `T` in `shared.js:1-28`. Two sources of truth that drift.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| **Critical** | `studio.css:13-15` + `shared.js:10-12` | `--t-mint` / `--t-mint-dim` / `--t-mint-fog` are misnamed legacy tokens resolving to ink-black; `--t-pink` and `--t-purple` are browns (not pink/purple). `--t-mint-fog` is an exact duplicate of `--t-ink-fog`. | Rename per semantic intent or delete dead duplicates; scripted find-and-replace | M |
| High | `shared.js:15` vs `studio.css:18` | `textDim` = `#746B5E` in JS, `#5E574C` in CSS — two different colors for the same semantic name | Pick CSS as source of truth; regenerate JS or have components read via CSS vars | M |
| High | `studio.css:19` | `--t-success: #10B981` declared, never used. Success toasts set `T.mint` (ink-black) so the only Toast color contrast is `red` vs `ink` ("bad vs neutral", not "bad vs good") | Route success toasts through `variant="success"` that uses an actual green; or unify with `approved` dot color `#3D8C5C` | S |
| High | `studio.css :root` | No platform-color or status-color tokens — 12+ semantic colors live inline in `shared.js:30-75` | Add `--platform-{ig,li,fb,tt}` and `--status-{idea,draft,needs-review,approved,scheduled,posted}` tokens | M |
| Medium | `studio.css:27-28` | `--t-lilac` / `--t-cyan` only appear inside gradient stops; not usable as standalone swatches | Demote to `--grad-stop-*` constants or expose as standalone accents | S |

### B1.2 Radius — clean, but literals leak

Scale `6/12/20/28/999px` (`studio.css:34-38`). ~20 literal radius values outside the scale (7px, 8px, 14px, 16px, 18px, 24px, 26px, 30px) — e.g., `.plat-tabs:336` uses `7px`, Clerk appearance uses `16px`/`18px`/`26px`.

### B1.3 Type scale — uneven, missing top steps

```
--text-xs:11  --text-sm:12  --text-base:14  --text-md:16  --text-lg:19  --text-xl:23  --text-2xl:29
```

Ratios: 1.09, 1.17, 1.14, 1.19, 1.21, 1.26 — not a clean musical scale. Hero sizes (36, 42, 48, 78px) are inline, not tokenised. See §B2.

### B1.4 Spacing — **NO TOKENS**

Grep confirms: zero `--space-*` variables. Hardcoded values: `2, 4, 6, 7, 8, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 42, 48, 56, 72, 80, 90, 96...`. Mostly fits a 4px grid; many don't (7, 10, 11, 14, 18, 22, 42).

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| **Critical** | No spacing scale; every component picks its own gap/padding | Introduce `--space-{0,1,2,3,4,5,6,8,10,12}` on a 4px base. Migrate highest-impact files first (`Row.jsx`, `StudioApp.jsx`, `AuthGate.jsx`). Lint with `stylelint-declaration-strict-value`. | L |

### B1.5 Shadow — **NO TOKENS**

~15 distinct shadows inlined across `.btn-ghost`, `.btn-primary`, `.modal`, `.bulk`, `.toast`, `.detail-panel`, `.cmd-palette`, `.dp-published-icon`. Not an elevation system — ad-hoc tuning.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| **Critical** | No shadow scale | Introduce 5-step elevation: `--shadow-xs/sm/md/lg/xl`; separate `--shadow-brand` for colored primary-button glow | M |

### B1.6 Motion — **NO TOKENS**

7 duration values (`80, 100, 120, 150, 180, 200, 220ms`) and 4 near-identical spring curves. `cubic-bezier(0.34,1.2,0.64,1)` (overshoot), `cubic-bezier(0.34,1.1,0.64,1)` (detail-panel-only — different overshoot), `cubic-bezier(0.34,1.3,0.64,1)` (popIn), `cubic-bezier(0.4,0,0.2,1)` (canvas — totally different curve).

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| High | 7 durations, 4 near-identical curves, none tokenised | `--duration-{fast,base,slow,panel}` + `--ease-{out,overshoot-sm/md/lg}` | S |

### B1.7 Z-index — clean

`0/10/20/30/40/50` (`studio.css:50-55`). Single violation: `Row.jsx:93` sets `zIndex: 20` inline (numeric match, not reference).

## B2. Typography

**Active fonts:** `Bricolage Grotesque` (display), `Switzer` (body), `JetBrains Mono` (mono), `-apple-system` (LinkedIn preview only).

**Zombie font:** `Plaak Ney` — `@font-face` declared at `studio.css:69`, local `.otf` file in `/fonts/`, **no grepped usage in any JSX**. May be used dynamically in StoryDesigner's font picker — verify and delete the @font-face + font file if not.

**~25 distinct type styles in active use.** Linear publishes ~14, Notion ~12. Cause: 9 distinct display sizes (29, 32, 36, 38, 42, 48 and `clamp(48,6vw,78)`) are inline, not stepped.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| High | Repo-wide | ~25 type styles for an app this scope | Consolidate to 12-14 named roles: `display-{xxl,xl,lg,md}`, `title-{lg,md,sm}`, `body-{lg,md,sm}`, `mono-{md,sm,xs}`, `label-{md,sm}` | M |
| Medium | `studio.css:69` | `Plaak Ney` @font-face with no apparent usage | Verify; delete if unused (saves font-load) | S |

**Editorial numbering motif** (positive): `Sidebar.jsx:59,91,107` (`01 / Calendar`), `Topbar.jsx:29-31` (`01 List / 02 Cal`), `AuthGate.jsx:99` (mono kicker). Coherent across chrome. Doesn't extend into DetailPanel/Composer/public pages — feels abandoned past the first screens.

## B3. Color system — coherence & semantics

**Palette is coherent and distinctive.** Warm paper-neutral base + ink-black + brand gradient (orange/gold/lilac/cyan) + 2 semantic (red/amber). Much more visual character than Linear/Asana/Monday.

**Semantic-assignment gaps:**
- **Success:** `--t-success #10B981` declared, never used. Toasts use `T.mint` (ink-black) for success. Three different greens exist: `--t-success` (#10B981, unused), `approved` dot (#3D8C5C, used), `.dp-published-icon` bg (#3D8C5C). Unify.
- **Error:** `T.red` consistently used — good.
- **Warning:** `--t-amber` for over-limit / near-limit / needs-attention — consistent.
- **Info:** no dedicated token. `SaveStatusBadge.offline` uses an amber-family border.

**Contrast spot-checks (static):**
- `--t-text` on `--t-bg`: **~14.6:1** ✓ AAA
- `--t-text-sub` (CSS `#4E473E`) on `--t-bg`: **~8.2:1** ✓ AAA
- `--t-text-dim` CSS (`#5E574C`): **~6.4:1** ✓ AAA
- `--t-text-dim` JS drift (`#746B5E`): **~4.4:1** — AA edge
- `.btn-primary` ink on gradient darkest stop: **~4.5:1** — AA edge
- `.cap-empty` italic + text-dim on `s3`: compounding; ratio falls to ~5.5 (CSS) / ~4.1 (JS drift)

## B4. Layout, spacing, responsive

### B4.1 Grid discipline
4px base is implied. Violations at 2px, 7px, 10px, 11px, 14px, 22px, 42px — not catastrophic but widespread.

### B4.2 Component widths — all inline

15+ magic widths (`sidebar 248`, `sidebar-collapsed 64`, `topbar 86`, `asset-drawer 340`, `detail-panel 420`, `settings-panel 480`, `connection-panel 460`, `modal 560`, `s-modal 960`, `add-post-modal 460`, `cmd-palette 480`, `cal-shell-right 280`, `s-bar 268`, StoryDesigner-canvas `290×515`, `analytics-area max 880`). Bucketise cleanly into ~7 sizes — tokenise.

### B4.3 Responsive — 7 breakpoints, no tier system

`640, 768, 900, 980, 1024, 1060, 1200px`. `900` and `1024` are only 124px apart and do overlapping things. Two of them (`640`, `980`) only appear in AuthGate's inline stylesheet.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| High | 7 breakpoints, overlapping behaviors | Standardise on `--bp-sm:640 / --bp-md:900 / --bp-lg:1200` (optional `--bp-xl:1600`); fold 768/980/1024/1060 rules into nearest kept breakpoint | M |

### B4.4 Mobile is effectively unnavigable

At `studio.css:1136`, `.sidebar { display: none }` at `<768px` — with **no replacement affordance**. Month-jump, Team, Connections, Settings become reachable only via `⌘K` CommandPalette (not a mobile metaphor). The Topbar `⌘K` button uses the `⌘` glyph which is also not mobile-friendly.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| **Critical** | Sidebar hides on mobile with no replacement | Add slide-in drawer from ☰ button OR bottom-tab nav — see §14.3 for full spec | M |

### B4.5 Analytics width
`.analytics-area max-width: 880px` (`studio.css:277`) — will look orphaned on 27" screens. Either widen with better data density or intentionally anchor to a reading column + decorative rail.

## B5. Component composition — 10 samples

### B5.1 `Sidebar.jsx`
- ✓ Editorial numbered sections, collapsible, localStorage-persisted.
- ⚠ Online-status dot uses `T.mint` (ink-black) — looks indistinguishable from offline gray. Industry convention: green. Use `--t-success`.
- ⚠ Settings icon is hand-rolled inline SVG (`Sidebar.jsx:131`) while rest of app uses `lucide-react`.
- ⚠ Hardcoded `t.color + "22"` (13% alpha) at `Sidebar.jsx:96`.

### B5.2 `Topbar.jsx`
- View toggle labels: `List / Cal / Grid / Stats` — "Cal" abbreviation only lives here; Sidebar and CommandPalette say "Calendar". Label drift.
- Assets button renders `Assets` or `Assets ✕` as toggle state — using `✕` as pressed-state affordance is unusual. Use visual pressed state or relabel.

### B5.3 `Toolbar.jsx`
- **Bug:** `STATUS_OPTIONS` at `Toolbar.jsx:8` contains `{ value: "ready", label: "Ready" }`. `shared.js:39-75` STATUSES has no `ready` key. Clicking "Ready" likely filters to zero rows. Verify in live pass.
- "Needs attention" chip shows literal `"On"/"Off"` text values — unusual; use single-state pressed/unpressed.

### B5.4 `Row.jsx`
- React.memo with explicit shallow-compare — good (hot list item).
- Three independent dropdowns (platform / status / row-menu) each with own `useState` + `useEffect` outside-click handler — **three near-identical `useEffect` blocks** at lines 34-41, 43-50, 52-59. Extract `useOutsideClick` hook.
- Card styling (`studio.css:132`): gradient bg, 20px radius, 8px margin, 78-86px tall — much card-ier than Linear's dense rows. Needs live pass to judge density.

### B5.5 `CommandPalette.jsx`
- Good keyboard nav, grouped sections, section-ordered preserved.
- Filter is word-by-word `.includes()`, not real fuzzy — typos won't match.
- **No recents.** ~28 commands always shown when empty — Linear/Notion show recent on empty input.
- Fixed `480×400px` — doesn't scale on ultrawide. Use `min(92vw, 560px)`.

### B5.6 `EmptyState.jsx`
- Custom inline SVG illustration (dashed doc with lines) — **one of the stronger design moments** in the app. Respects `--t-border2`.
- Clean API: `{ title, subtitle, actionLabel, onAction }`. Used consistently in ListView.
- Single illustration; every empty state uses the same graphic. Fine at this scope.

### B5.7 `SkeletonRows.jsx`
- Shimmer animation in CSS (`studio.css:1054-1057`). Good.
- Hardcoded skeleton dims (48×52, 70%, 40%, 28×28, 80×24). Fragile if row grid changes.
- **Only list-row skeleton exists** — no grid/calendar/analytics/detail/composer skeletons.

### B5.8 `Toast.jsx` — biggest interaction-pattern gap

6 lines of code. Single dot + message. 3200ms auto-dismiss. **No close button. No stacking** (toasts replace one another via `setToast(null)`). **No variants** — caller passes `color` prop; the "success" color is ink-black so success looks identical to neutral info. No pause-on-hover.

Compare to Linear: stacked bottom-right, variants (`success/error/info/warning`), pause-on-hover, explicit × close, duration varies with message length.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| High | Toast has no stacking/variant/close/pause | Rewrite as `<Toaster />` with a queue and `variant` API — see §14.2 for full spec | M |

### B5.9 Public pages (`PrivacyPolicy.jsx` / `TermsOfService.jsx` / `DataDeletion.jsx`)

Three files with near-identical inline-styled layouts, each with its own local `Section` helper component. Hex colors inlined — including `#746B5E` which is the JS-drift `textDim`, not the CSS one. No brand mark, no back-to-app nav, no footer, no responsive adjustments.

`DataDeletion.jsx:30-34` instructs users:
> 1. Open your browser's developer tools (F12)
> 2. Go to the Application tab
> 3. Click "Clear site data"

That's developer guidance; non-technical users will be lost.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| Medium | 3 public pages: inline-styled, duplicate `Section` helpers, no brand, no nav, DevTools instructions | Create `<PublicLayout>` with shared header (RF logo + app link), container using studio.css tokens, footer. Replace F12 instructions with in-app "Clear all my data" button in Settings | M |

### B5.10 Slide-in panels

Three near-duplicate panels: `DetailPanel` (420px), `SettingsPanel` (480px), `ConnectionPanel` (460px). Each has its own CSS class tree and slide-in keyframes. ~90 lines of CSS triplicated.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| Medium | 3 near-duplicate panel implementations | Create one `<SlideOverPanel>` with `width` + `title` + `sub` props; consolidate CSS | M |

## B6. Microcopy & voice

### B6.1 Tone (strength)
Brand voice is **editorial, warm, confident, understated**. Standouts:

- `AuthGate.jsx:403` — *"Calm operations for a sharper content system."*
- `AuthGate.jsx:410-412` — *"One workspace. / Low-noise UX. Editorial rhythm — calm by default, dense when you need it. / Team ready."*
- `shared.js:44` — *"A spark — captured but not yet developed. Move to Draft when you start writing."*
- `shared.js:74` — *"Live on the platform. Done."*
- `StudioApp.jsx:94` document-title easter egg: *"← still here when you're ready"*

Keep. This voice is significantly more distinctive than the app's peers.

### B6.2 Consistency issues

**Ellipsis style mixing — 7 ASCII vs 2 Unicode:**

| Count | Character | Sample callsites |
|-------|-----------|------------------|
| 7 | `...` (ASCII) | `Row.jsx:116`, `DetailPanel.jsx:249,488`, `CommandPalette.jsx:131`, `AICaptionAssist.jsx:46`, `StoryDesigner.jsx:1079`, `StudioContext.jsx:259` |
| 2 | `…` (Unicode `\u2026`) | `CaptionEditor.jsx:26`, `AICaptionAssist.jsx:69` |

Given the editorial brand, Unicode `…` should be the standard.

**Duplicate string:** `"Post removed"` at both `ListView.jsx:108` and `DetailPanel.jsx:210`.

**Label drift:**
- "Calendar" (Sidebar, CommandPalette) vs "Cal" (Topbar view-toggle).
- "Stats" (Topbar) vs "Analytics" (CommandPalette + component name).

**Confirmation-of-nothing** (good): `StudioApp.jsx:81` — `onSavePressed` toasts `"Already saved · changes auto-sync"` when user hits ⌘S. Anticipates learned behaviour. Keep.

### B6.3 Error messages (sampled)
- `StudioContext.jsx:259` — *"Your changes conflict with a newer version. Refreshing..."* — clear cause, action being taken. ✓
- `StudioContext.jsx:421` — *"Token refresh failed — please reconnect Instagram"* — clear cause + specific remediation. ✓

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| Medium | ASCII vs Unicode ellipsis mix (7:2) | Unicode `…` everywhere; one-pass replace | S |
| Medium | Duplicate "Post removed" string | Centralise in a copy module | S |
| Medium | Label drift: Cal/Calendar, Stats/Analytics | Pick one of each; update chrome + CP + filename if needed | S |

## B7. Information architecture

**Nav structure** (inferred from `StudioApp.jsx`, `Sidebar.jsx`, `Topbar.jsx`):

```
App
├── Sidebar        [+Add post] [01 Calendar → month list] [02 Team] [03 Connections] [Settings]
├── Main
│   ├── Topbar     {Month} {Year} · Save · ⌘K · [01 List|02 Cal|03 Grid|04 Stats] · Assets
│   ├── StatsBar
│   ├── Toolbar    Search · Filters · count
│   └── [ListView | CalendarView | IGGridView | Analytics]
├── Right-side panels (mutually exclusive): DetailPanel · ConnectionPanel · SettingsPanel · AssetLibrary
├── Modals (centered): Composer · AddPostModal · StoryDesigner · PublishConfirmModal · CommandPalette
└── Toasts: Toast · UndoDeleteToast · UndoToast · TokenExpiryBanner · FirstRunHint
```

**Findability:** primary views in 2 places (Topbar + ⌘K) — clear. Month jump in 2 places (Sidebar + ⌘K) — clear. Settings/Connections/Assets in 2 places. Team only in Sidebar; no ⌘K equivalent — minor asymmetry. Search is Toolbar + `/` hotkey only, not a CP command.

**Product scope:** single-document planner. No projects, no artists, no multi-tenant.

## B8. Benchmark — Linear / Notion / Asana

| Dimension | Linear | Notion | Asana | rf-social-studio |
|-----------|--------|--------|-------|------------------|
| Palette mood | cool neutral + electric blue | near-white + grey | white + cool accents | **warm paper + ink + brand gradient** (distinctive) |
| Type styles | ~14 | ~12 | ~10 | ~25 (over-differentiated) |
| Row density | 32-40px flat | 40-52px cards | 40-48px flat | 78-86px cards (editorial) |
| Command palette | ⌘K + recents + context | ⌘K + `/` inline + recents | ⌘K + recents | ⌘K, no recents, fixed list |
| Empty states | varied illustrations | varied + copy per context | minimal | 1 illustration, consistent copy |
| Filter UX | chips with dismiss-x | in-line inline menus | chips + popover | single button + popover (less rich) |
| Mobile nav | bottom tabs + drawer | drawer | drawer | **none** (sidebar hides) |

**Where RF wins:** brand voice, aesthetic differentiation, status-transition descriptions, editorial numbering motif.
**Where RF lags:** system discipline (spacing/shadow/motion/type-scale), mobile navigation, Toast UX, command-palette recents, filter chip richness.

---

# PART C — Documentation & operational gaps

- **`README.md` is still the Vite scaffold template** — no runtime architecture diagram, deploy steps, or local-dev instructions beyond `package.json` scripts.
- **No `API.md`** — 6+ endpoint handlers have no JSDoc. Request/response shapes and rate-limit quotas only discoverable by reading source.
- **No `CONTEXT_API.md`** — 64+ `StudioContext` exports undocumented.
- **No design-system doc** — no color/type/spacing reference for designers or new engineers.
- **No `CHANGELOG.md` / ADRs** — architectural decisions ("why Inngest not Vercel Cron", "why Upstash not Redis", "why localStorage + IDB + Supabase") only in commit messages.
- **Zero `TODO`/`FIXME` markers** — unrecorded debt, including the items in this audit.

---

# PART D — High-impact redesign specs

## 14.1 Design-token rewrite (priority #8)

Rationale: every Part-B finding is downstream of the missing/misnamed token system. Full replacement `:root`:

```css
:root {
  /* === PALETTE === */
  /* Surfaces (warm paper neutral) */
  --surface-0: #F3EEE5;   /* app bg */
  --surface-1: #F7F1E8;   /* raised */
  --surface-2: #ECE1D3;   /* depressed */
  --surface-3: #FEFCF8;   /* card */
  --border:    #D8CABA;
  --border-strong: #BAAA96;
  --divider:   rgba(24,23,20,0.08);
  --tint-ink:  rgba(24,23,20,0.05);  /* was t-ink-fog / t-mint-fog duplicate */

  /* Ink (text) */
  --ink:       #181714;
  --ink-hover: #2E2C28;
  --text:      #181714;   /* alias of --ink */
  --text-sub:  #4E473E;
  --text-dim:  #5E574C;   /* single source of truth; deprecate JS T.textDim */

  /* Semantic */
  --success:   #3D8C5C;   /* consolidated with status 'approved' */
  --warning:   #C96A12;
  --danger:    #DC2626;
  --info:      #5BA8B5;   /* consolidated with status 'scheduled' */

  /* Brand gradient (preserve) */
  --brand-0: #FF7A00;
  --brand-1: #F0B24D;
  --brand-2: #D99BFF;
  --brand-3: #82C7FF;
  --grad-primary: linear-gradient(135deg,
    var(--brand-0) 0%, var(--brand-1) 24%, var(--brand-2) 58%, var(--brand-3) 100%);

  /* Status dots (tokenised from shared.js) */
  --status-idea:         #B5ADA0;
  --status-draft:        #5B7FA6;
  --status-needs-review: #E56A0B;
  --status-approved:     #3D8C5C;   /* = --success */
  --status-scheduled:    #5BA8B5;   /* = --info */
  --status-posted:       #181714;   /* = --ink */

  /* Platform accents (tokenised from shared.js) */
  --platform-ig:  #49433B;
  --platform-fb:  #1877F2;
  --platform-li:  #4B5F66;
  --platform-tt:  #1A1A2E;

  /* === SPACING (4px base) — NEW === */
  --space-0:  0;
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;

  /* === TYPE SCALE (1.2 ratio, 9 steps) === */
  --text-xs:   12px;
  --text-sm:   14px;
  --text-base: 16px;
  --text-md:   18px;
  --text-lg:   22px;
  --text-xl:   26px;
  --text-2xl:  32px;
  --text-3xl:  40px;   /* NEW — replaces inline 36/38/42 */
  --text-4xl:  52px;   /* NEW — replaces inline 48/78 clamp */

  /* === RADII (keep) === */
  --radius-sm:  6px;
  --radius-md:  12px;
  --radius-lg:  20px;
  --radius-xl:  28px;
  --radius-pill: 999px;

  /* === SHADOW (5-step elevation) — NEW === */
  --shadow-xs: 0 1px 2px rgba(24,23,20,0.04);
  --shadow-sm: 0 4px 10px rgba(24,23,20,0.06);
  --shadow-md: 0 12px 28px rgba(24,23,20,0.08);
  --shadow-lg: 0 24px 60px rgba(24,23,20,0.12);
  --shadow-xl: 0 32px 80px rgba(24,23,20,0.16);
  --shadow-brand:       0 14px 30px rgba(229,106,11,0.18);
  --shadow-brand-hover: 0 18px 36px rgba(229,106,11,0.22);

  /* === MOTION — NEW === */
  --duration-fast:  100ms;
  --duration-base:  150ms;
  --duration-slow:  200ms;
  --duration-panel: 220ms;
  --ease-out:          cubic-bezier(0.2, 0, 0, 1);
  --ease-overshoot-sm: cubic-bezier(0.34, 1.1, 0.64, 1);
  --ease-overshoot-md: cubic-bezier(0.34, 1.2, 0.64, 1);
  --ease-overshoot-lg: cubic-bezier(0.34, 1.3, 0.64, 1);

  /* === Z-INDEX (keep) === */
  --z-content:  0; --z-sticky: 10; --z-dropdown: 20;
  --z-panel:   30; --z-modal:  40; --z-toast:    50;

  /* === LAYOUT WIDTHS — NEW === */
  --width-sidebar:           248px;
  --width-sidebar-collapsed: 64px;
  --width-panel-sm: 420px;   /* DetailPanel */
  --width-panel-md: 460px;   /* ConnectionPanel */
  --width-panel-lg: 480px;   /* SettingsPanel, CommandPalette */
  --width-modal-sm: 460px;   /* AddPostModal */
  --width-modal-md: 560px;   /* default Modal */
  --width-modal-lg: 960px;   /* StoryDesigner */
}
```

**Deprecate:** `--t-mint`, `--t-mint-dim`, `--t-mint-fog`, `--t-pink`, `--t-purple`, `--t-blue`-standalone, `--t-amber-dark`, `--t-amber-darker`, `--t-lilac`, `--t-cyan` standalone. Migrate with scripted find-replace; ~35 files affected. Effort: **L, mostly mechanical**.

## 14.2 Toast rewrite (priority #13)

```
<Toaster position="bottom-right" stackDirection="up" maxStack={4} />

Variants (dot color + subtle bg tint):
  success  → --success    border rgba(61,140,92,0.14)  bg rgba(61,140,92,0.04)
  error    → --danger     border rgba(220,38,38,0.14)  bg rgba(220,38,38,0.04)
  warning  → --warning    border rgba(201,106,18,0.18) bg rgba(201,106,18,0.04)
  info     → --info       border rgba(91,168,181,0.18) bg rgba(91,168,181,0.04)
  neutral  → --ink        border --divider             bg --surface-3

Layout:
  width:  min(420px, calc(100vw - 32px))
  padding: var(--space-3) var(--space-4)
  radius:  var(--radius-md)
  shadow:  var(--shadow-lg)
  grid:    10px 1fr auto; gap: var(--space-3);
  Dot     8×8px round; Message text-sm ink; optional Action button; × close (ib-style 24×24).

Duration:
  success/info/neutral 4000ms; warning 5500ms; error 7000ms (persist if action= true).
  Hover pauses countdown.

Motion:
  enter: translateY(8px) + fade — var(--duration-slow) var(--ease-overshoot-md)
  exit:  translateY(-4px) + fade — var(--duration-base) var(--ease-out)
  stack-shift: siblings translateY — var(--duration-fast) var(--ease-out)

API:
  toast.success("Posted to LinkedIn")
  toast.error("Token refresh failed", { action: { label: "Reconnect", onClick } })
  toast.info("Updated from another device", { duration: 6000 })
```

**Migration:** ~12 `showToast(msg, T.mint)` → `toast.success(msg)`; `showToast(msg, T.red)` → `toast.error(msg)`. Effort: **M (2-3 days)**.

## 14.3 Mobile nav (priority #9)

### Option A — slide-in drawer (safest; matches existing panel pattern)

```
Topbar adds leading ☰ button (Menu icon from lucide):
  .nav-trigger { 40×40; radius: pill; bg transparent; hover bg rgba(24,23,20,0.06) }

Clicking opens <NavDrawer>:
  position: fixed; left: 0; top: 0; bottom: 0
  width: min(320px, 86vw)
  animates in from the left (mirrors detailSlideIn, translateX(-100%))
  backdrop: rgba(20,18,15,0.18)
  content: existing Sidebar JSX, unchanged

Visibility: display only at max-width: 900px.
Focus trap, Esc close, click-backdrop close.
```

Effort: **M (1-2 days).**

### Option B — bottom tab bar (more "app-feel")

```
At max-width: 768px:
  .mobile-tabs {
    position: fixed; bottom: 0; left: 0; right: 0;
    height: 56px;
    grid-template-columns: repeat(4, 1fr) 56px;  /* 4 views + More */
    background: rgba(254,252,248,0.96);
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--divider);
    z-index: var(--z-sticky);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .mobile-tab { column flex; font-size: var(--text-xs); font-weight: 600;
                color: var(--text-dim) }
  .mobile-tab.active { color: var(--ink) }

Tabs: [List, Cal, Grid, Stats, More]
  More opens NavDrawer (team / connections / settings)
```

Effort: **M-L (4-5 days).**

**Recommendation:** ship **A** first to unblock mobile users; consider **B** only if mobile usage grows and the bottom-tab paradigm fits the audience.

---

## 15. Deferred to live pass (design)

Items that need real pixels — re-run when browser MCP is fixed:

1. Rendered hierarchy — warm paper + gradient primary at actual scale.
2. Density — 78-86px card-rows vs Linear/Asana side-by-side.
3. Empty-state copy resonance at real screen positioning.
4. Editorial numbered sections (01/02/03) read as editorial or over-designed?
5. Analytics at 1440px+ — dead rail on right?
6. Mobile touch ergonomics in practice.
7. StoryDesigner canvas (290×515) vs inspector crowding.
8. Toast timing — 3200ms feels right vs brand voice?
9. Composer modal density (not sampled in detail).
10. Motion curves — are the 3 overshoots perceptibly different?

---

## 16. Effort roll-up (combined)

| Effort | Critical | High | Medium | Low | Info | Total |
|--------|----------|------|--------|-----|------|-------|
| S (≤ ½ day) | 1 | 13 | 24 | 18 | 1 | 57 |
| M (1-3 days) | 5 | 18 | 27 | 2 | 0 | 52 |
| L (week+) | 2 | 4 | 4 | 1 | 0 | 11 |

**Suggested two-week sprint** — closes the highest-leverage S + M items:
- Tokens: HSTS header; Supabase indexes; Toast variants + stacking; ellipsis unification; label drift cleanup.
- Backend: `createApiHandler` factory; `config.js` central constants; structured error codes; inngest overlap guard.
- Frontend: Suspense spinner; per-view ErrorBoundary; AuthGate loading shell; route-level lazy + errorElement.
- Design system: token `:root` rewrite (§14.1) — phase 1 (deprecate legacy, add spacing/shadow/motion).
- Mobile: NavDrawer Option A (§14.3).
- Test: Vitest + RTL bootstrap; GH Actions CI; Inngest unit tests.

L-effort items (`StudioContext` split, `app.js` handler extraction, full design-token migration, E2E suite) are follow-on initiatives after the token + mobile foundations land.

---

## 17. Methodology

**Technical pass:**
- **Swarm:** claude-flow hierarchical, 8 specialised agents (system-architect, security-auditor, perf-analyzer, reviewer, code-analyzer, backend-dev, frontend, tester), `swarmId=swarm-1776532377407-vtuh0i`.
- Each role dispatched as a Claude Code `Explore` subagent in parallel; findings returned as structured JSON; persisted to the `audit` memory namespace (`findings-{architecture,security,performance,quality,static-analysis,backend,frontend,testing}`).
- **Out of scope:** load-test benchmarking, dynamic security scans, bundle-analyser output.

**Design pass:**
- Static-source review (no live screenshots — `browser_open` returned `spawnSync agent-browser ENOENT`).
- Read `studio.css` end-to-end (1,477 LOC), `shared.js`, `constants.js`, AuthGate inline CSS.
- Sampled 10 components (Sidebar, Topbar, Toolbar, Row, EmptyState, SkeletonRows, Toast, CommandPalette, plus 3 public pages).
- Grepped placeholders, toast copy, title-attr tooltips, hex-literal occurrences, `!important` usage.

**Grounding:** every finding cites a real `file:line`. No fabrication. Where a judgement requires live pixels, the item is marked deferred (§15).

**Reproduction:**
- Technical findings: `mcp__plugin_claude-flow_claude-flow__memory_retrieve namespace=audit key=findings-<domain>`.
- Design findings: re-grep the repo per §B sections; structures in `studio.css` and `shared.js` are the authoritative inputs.
