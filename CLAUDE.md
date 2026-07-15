# Relay — Claude Code Guide

Use this file as the first source of truth for work in this repository. Read only the files relevant to the current task, then follow the change protocol below.

## Product

Relay is a social content planning, design, review, scheduling, and publishing application. It supports Instagram and LinkedIn workflows, with media creation, a visual designer, account connections, publishing, analytics, brand settings, and team collaboration.

## Stack

- React 19 + Vite 7
- JavaScript and JSX, not TypeScript
- Clerk authentication
- Supabase persistence
- Vercel serverless functions under `api/`
- Inngest background jobs
- Upstash Redis and rate limiting
- Node test runner + Vitest + Testing Library

## Commands

```bash
npm install
npm run dev
npm run dev:api
npm run lint
npm run test
npm run build
```

Before finishing a code task, run the narrowest relevant test first, then run:

```bash
npm run lint && npm run test && npm run build
```

## Architecture map

- `src/features/studio/StudioApp.jsx` — main application shell, major views, panels, modals, and error boundaries
- `src/features/studio/StudioContext.jsx` — primary application state, routing, filtering, persistence, account state, and studio actions
- `src/features/studio/document-store.js` — studio document model, normalization, audit history, local persistence, merging, and row mutations
- `src/features/studio/shared.js` — shared constants and utility functions
- `src/features/studio/components/` — feature surfaces, editors, previews, designer, settings, and publishing UI
- `src/lib/api-client.js` — client-side API boundary
- `src/lib/idb-store.js` — offline queue and IndexedDB helpers
- `api/` — Vercel function entrypoints; production routes require a matching file here
- `server.js` — local API server and shared backend routing
- `tests/` — Node integration and validation tests

Read `docs/architecture.md` for system boundaries, `docs/publishing.md` for media and publishing rules, `docs/designer.md` for interaction invariants, and `docs/testing.md` for validation expectations.

## Core rules

### Preserve document integrity

The studio document is the source of truth for rows, settings, account snapshots, appearance, review state, and brand data. Changes to persistence must consider:

- local load and save
- server load and save
- conflict merging
- offline queue behavior
- document normalization
- audit entries

Do not introduce a second competing state source for persistent data.

### Keep platform rules centralized

Publishing behavior must not be duplicated across Composer, scheduler, previews, and the designer. Prefer shared helpers for:

- media-source resolution
- Instagram media-type selection
- video poster generation
- muted autoplay behavior
- container readiness polling

### Vercel route rule

A route handled by `server.js` is not automatically deployed. Every production API route must also have a matching entrypoint under `api/`.

### Browser interaction traps

The following have caused real regressions:

- React's `muted` prop may not produce the browser state required for autoplay; set the video element's muted property explicitly and call `play()` where needed.
- `pointerdown` can cause a rerender before `blur`, and `blur` may never fire.
- `contentEditable` DOM values can be clobbered by React rerenders; do not rely on reading stale DOM during blur.
- render-time closures may be stale during drag interactions; use live refs when pointer behavior requires current state.
- build, lint, and ordinary unit tests do not prove that a major React surface mounts successfully.

## Change protocol

For every bug or feature:

1. Reproduce or establish evidence before editing.
2. State the violated invariant, not only the visible symptom.
3. Search for every analogous surface or code path.
4. Identify the smallest complete fix.
5. Prefer one shared abstraction over repeated local patches.
6. Add or update regression coverage.
7. Run targeted validation.
8. Run lint, full tests, and build.
9. Summarize root cause, files changed, tests added, and anything not verified in production.

## Required impact searches

Before changing UI, media, publishing, or designer behavior, search for relevant siblings. Common terms:

```text
<video
poster=
autoplay
contentEditable
onPointerDown
onClick
onBlur
mediaType
media_publish
carouselFrameUrls
thumbnailUrl
```

Do not fix only the first reported surface when the underlying primitive is shared.

## Task discipline

- One task should have one clear objective.
- Do not refactor unrelated code while fixing a bug.
- Do not read the entire repository without a reason.
- Do not create speculative abstractions.
- Do not remove compatibility behavior unless the task explicitly includes migration.
- Keep commit messages explanatory: reproduction, mechanism, fix, and validation.

## Default analysis response before coding

Return:

1. confirmed reproduction or evidence
2. root cause
3. violated invariant
4. analogous paths or surfaces
5. files to change
6. tests to add or update
7. smallest complete implementation plan

Then implement only after the plan is accepted, unless the user explicitly asks for immediate execution.
