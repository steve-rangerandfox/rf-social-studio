# Relay Architecture

## System overview

Relay is a React application backed by authenticated API routes and a persisted studio document.

```text
Browser routes
  -> StudioApp
  -> StudioContext
  -> document-store / api-client
  -> localStorage + IndexedDB + API
  -> Supabase / platform APIs / background jobs
```

## Frontend boundaries

### `StudioApp.jsx`

The application shell. It composes navigation, major views, panels, modals, scoped error boundaries, and lazy-loaded surfaces. It should coordinate surfaces, not absorb domain logic.

### `StudioContext.jsx`

The current state and action hub. It owns route-to-view state, the loaded studio document, filters, selection, modal state, account snapshots, save state, offline state, and shared actions.

Before adding new state here, ask:

1. Is it shared by multiple distant surfaces?
2. Must it survive navigation or reload?
3. Does it belong in the studio document?
4. Could a focused hook or component own it instead?

Avoid growing the context with purely local UI state.

### `document-store.js`

The domain boundary for persisted studio data. It is responsible for document defaults, normalization, row mutation, audit history, local persistence, merge behavior, deletion and restore, and export.

Changes to the document schema must preserve old documents through normalization or migration.

### `api-client.js`

The browser's network boundary. Components should not construct platform-specific API calls directly when a client helper exists or should exist.

## Persistence model

Relay combines several layers:

- React state for the active session
- local storage for immediate local recovery
- IndexedDB for offline synchronization queues
- server persistence for cross-device state
- platform token/account tables for connected services

The save pipeline must use the freshest document state, serialize writes, and handle conflicts without overwriting newer local changes.

## Backend and deployment

`server.js` contains local/shared route handling. Vercel deploys functions by filename under `api/`, so a backend route is not production-ready until its `api/<route>.js` bridge exists.

Backend changes should consider:

- Clerk identity and authorization
- user or team scoping
- rate limits
- token storage and refresh
- platform API timeouts
- Vercel function duration
- idempotency and retries

## Major feature areas

- list, calendar, grid, and analytics views
- post creation and editing
- visual story/post designer
- media gallery and previews
- Instagram and LinkedIn connections
- immediate and scheduled publishing
- brand profile and settings
- subscriptions and feature entitlements
- team collaboration and review

## Dependency direction

Prefer this direction:

```text
components
  -> feature hooks/context
  -> domain helpers/document store
  -> API client
  -> server routes/integrations
```

Avoid importing UI components into domain helpers, constructing API URLs deep inside components, or duplicating document mutations in multiple surfaces.

## Refactoring guidance

Refactor only when it reduces current task risk or removes verified duplication. High-value extraction candidates include:

- media-source resolution
- video preview behavior
- publish payload construction
- platform container polling
- document save/sync logic

Large context decomposition or TypeScript migration should be separate, deliberate projects rather than side effects of feature work.
