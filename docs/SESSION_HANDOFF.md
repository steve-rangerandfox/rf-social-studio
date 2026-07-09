# Relay — Session Handoff (2026-07-09)

Continuation kit for the Relay build sessions (Ranger & Fox social media studio).
A new Claude Code session with this repo + this file can pick up exactly where we left off.
(Mirror copy lives in Dropbox: /Ranger & Fox/Docs/Relay/RELAY_SESSION_HANDOFF.md)

---

## 1. Links & sources

| What | Where |
|---|---|
| **Repo (the only source of truth)** | `steve-rangerandfox/rf-social-studio` — https://github.com/steve-rangerandfox/rf-social-studio |
| **Working branch** | `claude/relaxed-thompson-eqmpln` (see workflow below) |
| **Live site (prod)** | https://www.rangerandfox-social.studio |
| **Prior session** | https://claude.ai/code/session_01Eqbv1vvFZ2tnS4iX62DGLw |

Connected services (config lives in their dashboards, not the repo):
- **Vercel** — hosting + deploys (auto-deploys `main`), Web Analytics, env vars
- **Supabase** — `assets` storage bucket (public), tables `media_assets`, `studio_documents` (optimistic version locking)
- **Clerk** — auth
- **Stripe** — billing; env `STRIPE_PRICE_ESSENTIALS` / `STRIPE_PRICE_TEAM` hold the price IDs (internal plan keys stay `essentials`/`team`; labels are Solo $24 / Studio $59)
- **Inngest** — cron scheduler (`src/inngest/publish-scheduled.js`) that auto-publishes due posts
- **Anthropic API** — AI captions; needs `ANTHROPIC_API_KEY` in Vercel env

## 2. Working agreement / workflow

- All work on branch `claude/relaxed-thompson-eqmpln`. Never push other branches.
- Ship loop: commit → push → open PR → **squash-merge to `main`** (Vercel auto-deploys) → reset the branch: `git fetch origin main && git checkout -B claude/relaxed-thompson-eqmpln origin/main && git push -u origin claude/relaxed-thompson-eqmpln --force-with-lease`.
- User says "deploy" (or has an established cadence of every fix going live) → do the full loop without asking.
- Verify before every ship: `npm run build` · `npx vitest run` (66 tests as of handoff) · `npx eslint src` (0 errors; a couple of pre-existing warnings are fine).
- Commit trailer: `Co-Authored-By: Claude <noreply@anthropic.com>`. Never put model IDs in repo artifacts.
- GitHub access is via the GitHub MCP tools (no `gh` CLI in the remote env).
- The user tests on the live site and reports with screenshots — expect visual bug reports; consider Playwright/Chromium (preinstalled in the remote env) to verify UI before shipping.
- Chat style: the user uses a "caveman" brevity skill (compressed prose in replies, code/errors verbatim). Re-install to `~/.claude/skills/caveman/` if missing.

## 3. Architecture map (key files)

- `src/features/studio/StudioApp.jsx` — shell; mounts views + modals (Composer, AddPostModal, StoryDesigner, CarouselComposer, DetailPanel…)
- `src/features/studio/StudioContext.jsx` — all app state; **serialized save pipeline** (one in-flight save, merge-on-conflict, merge-on-poll), `createPostDraft` (creates post, can open designer via `openDesigner`/`openCarousel`)
- `src/features/studio/document-store.js` — row model. **`normalizeRow` is an allowlist: any field not named there is silently stripped on every save.** `createNewRow` spreads overrides through it. `mergeStudioDocuments` = per-row newest-updatedAt merge
- `src/features/studio/components/AddPostModal.jsx` — Buffer-style Create Post window (channels, caption, multi-image tiles w/ progress rings, live previews, Design door)
- `src/features/studio/components/DetailPanel.jsx` — Buffer-style post editor window (same shell; gallery w/ drag-reorder via MediaGallery, thumbnail control for video, approval/comments/publish)
- `src/features/studio/components/PostPreviews.jsx` — product-accurate per-network previews (feed w/ actions+likes, story 9:16 w/ playable video, reel w/ action rail, LinkedIn card); carousel paging w/ arrows
- `src/features/studio/components/MediaGallery.jsx` — multi-image gallery (active preview, drag-reorder marks `application/x-mg-reorder` so drops aren't treated as uploads)
- `src/features/studio/components/StoryDesigner.jsx` — THE canvas designer (~2500 lines): multi-artboard pages, per-outlet layouts (`storyLayouts`/`storyPreset`), Canva contextual top bar, uploads library (media_assets), fonts panel w/ real per-family weights, seeding from `row.mediaItems` (one canvas per image), render-on-close → `storyFrames`
- `src/features/studio/components/CanvasElement.jsx` — element rendering: zoom×scale-invariant selection chrome, auto-width text w/ cap-height trim (`text-box`), shape X/Y stretch, line endpoint nodes
- `src/features/studio/components/CarouselComposer.jsx` — legacy carousel builder (being absorbed into the universal designer; UI door already removed — only `openCarousel` flag reaches it)
- `src/inngest/publish-scheduled.js` — scheduler; `resolveCarouselFrames` prefers `carouselFrameUrls` (designer render) then falls back to `mediaItems` (raw uploads)
- `src/lib/supabase.js` — `uploadAssetWithProgress`, `fetchAssets`/`saveAsset` (media_assets library)
- `src/features/studio/studio.css` — design tokens: `--t-*` + semantic aliases; radii ONLY 6/12/20/pill (canvases square, radius 0); accent `#ff5a1f`
- `src/server/` — API handlers (captions.js needs `ANTHROPIC_API_KEY`), entitlements, Stripe, LinkedIn/IG publish

## 4. Row (post) data model — media fields

- `mediaItems: [{url, kind: "image"|"video"}]` — canonical uploaded gallery (source of truth)
- `mediaUrl` (first item), `mediaKind` (`image`|`video`|`carousel`), `thumbnailUrl` (first image or video poster)
- `carouselFrameUrls` — ONLY designer-rendered slide images; scheduler falls back to `mediaItems`
- `platforms: [..]` — outlet list, first = main channel; designer size dropdown follows it
- `storyPages`/`storyElements`/`storyLayouts`/`storyPreset`/`storyFrames` — designer state + rendered frames
- Seeding rule: designer/carousel seed from `mediaItems` (one canvas/slide per image) unless saved pages already contain real media

## 5. Hard-won gotchas (repeat-bug classes — check these FIRST)

1. **Field allowlists**: new row fields MUST be added to `normalizeRow` (document-store.js) or they're stripped on every save. This bug shipped three times (#93/#95/#96).
2. **Stale closures in the designer**: async continuations (post-upload) must go through the latest-value refs in `pushElements` — never resolve against render-time `elements`.
3. **CSS tokens**: only use tokens that exist (`--t-*` or the alias block ~line 150 of studio.css). A missing token = transparent UI (the "carousel looks crazy" bug).
4. **Radii**: token scale only (6/12/20/999). Canvases: 0.
5. **Selection chrome**: divides by `--sd-zoom` = canvas zoom × element scale. Any new chrome dimension needs the same `calc(Npx/var(--sd-zoom,1))` treatment.
6. **Animations on positioned popovers**: never animate `transform` on elements that use transform for centering (use `fIn` opacity fade).
7. **Save pipeline**: serialized; conflicts merge per-row by `updatedAt`. Don't add parallel `saveStudioDocument` callers.

## 6. Shipped state (PRs #60–#97, all merged)

Typography/icon system (Radix behind lucide-style API) · watermark removal · canvas size presets incl. LinkedIn 4:5 · clipboard paste + Ctrl+D · Figma shapes w/ full stroke system (width/cap/align/dash) · custom fonts as brand assets · corner-radius audit · SEO load-out (robots/sitemap/guides/JSON-LD) · GTM re-tier (Solo $24/Studio $59 + demo path + analytics events) · Canva contextual top bar + fonts panel (accurate per-family weights) · uploads library (media_assets) · multi-outlet posts (⊕ channels, per-outlet designer layouts, primary-outlet render) · custom size dropdown · zoom-invariant 1px selection chrome in brand accent · Buffer-style Create Post + post editor windows w/ live previews · create→edit flow · media drag-drop + video thumbnails (auto poster + custom) · save pipeline fix (no more keystroke-eating conflicts) · designer doors (single "Design" button) · native multi-image posts (gallery, reorder, IG carousel publish via mediaItems) · Buffer upload sequence (tiles + progress rings) · designer seeding from uploads · product-accurate previews (story/reel/feed).

## 7. Open queue (in priority order)

1. **Universal Post Designer** (plan approved by user, not yet built):
   - Layout L→R: icon rail (exact current designer rail) → collapsible slides panel (carousel-composer style thumbs: reorder/delete/add, live mini-previews; replaces bottom page strip) → canvas workspace (keep top bar/zoom; canvases square) → permanent right properties panel (selection-contextual: background / text incl. fonts+weights / shape stroke / media filters; content moves from left props drawer)
   - Absorb carousel composer: its 5 slide layouts (Title/Number/Photo/Quote/CTA) become one-click layout presets stamping real editable elements; gradient presets join background panel; then retire CarouselComposer + cc2 CSS
   - **Channel capability matrix** (`capabilities.js` + tests) — verified facts: IG carousel = 2–10 items, images AND videos OK; LinkedIn multi-image = 2–20 IMAGES ONLY (video = separate single post ≤10min; organic document carousel NOT in API); IG story = image or video 3–60s/frame; Reel = video ≤90s via API; TikTok = video 3s–10min OR photo carousel ≤35, no mixing
   - Enforcement: drop/upload violating a channel → dialog naming the channel with actions (switch type / remove channel / cancel); slide-count caps; duration checks
2. **LinkedIn multi-image publish** — data (`mediaItems`) is stored and ready; scheduler's LinkedIn path still publishes single media. Needs LinkedIn MultiImage API wiring in `src/server/linkedin.js` + scheduler.
3. **Owner env checklist** (user action, keeps resurfacing): `ANTHROPIC_API_KEY` (AI captions), Stripe price IDs into `STRIPE_PRICE_ESSENTIALS`/`STRIPE_PRICE_TEAM`, enable Vercel Web Analytics, optional `VITE_DEMO_URL`, submit sitemap in Search Console.
4. Shelf: Meta App Review prep · per-route social share cards (needs prerendering) · CLAUDE.md with the gotcha list above · Playwright smoke test for visual regressions.

## 8. Verify commands

```bash
npm run build          # Vite production build
npx vitest run         # 66 tests green at handoff
npx eslint src         # 0 errors (few pre-existing warnings OK)
```
