# Relay

Relay is Ranger & Fox's social planning, creation, approval, scheduling, and publishing studio. It combines a calendar/list workflow, media library, visual post and story designer, brand tools, account connections, and direct social publishing.

## Stack

- React 19 and Vite
- Clerk authentication
- Supabase-backed persistence
- Vercel serverless functions under `/api`
- Inngest background work
- Upstash rate limiting and Redis
- Node test runner and Vitest

The project uses JavaScript and JSX rather than TypeScript.

## Local development

Requirements:

- Node.js 20.x
- npm
- a local environment file with the required service credentials

Install and start the frontend:

```bash
npm install
npm run dev
```

Run the local API server in a second terminal:

```bash
npm run dev:api
```

Environment values are service-specific and must not be committed. Common groups include Clerk, Supabase, Meta/Instagram, LinkedIn, Inngest, Upstash, billing, and application URLs.

## Commands

```bash
npm run dev             # Vite frontend
npm run dev:api         # local API server using .env.local
npm run lint            # ESLint
npm run test:node       # Node server and validation tests
npm run test:unit       # Vitest suite
npm test                # all tests
npm run build           # production bundle
npm run preview         # preview production bundle
```

## Repository map

```text
api/                              Vercel serverless entrypoints
src/components/                   shared application components
src/features/studio/              primary Relay product surface
  StudioApp.jsx                   studio shell and major surfaces
  StudioContext.jsx               studio state, navigation, sync, and actions
  document-store.js               document creation, normalization, merge, persistence
  components/                     calendar, list, designer, composer, settings, etc.
src/lib/api-client.js             browser-to-API client
server.js                         local API server entrypoint
tests/                            Node integration and validation tests
docs/                             architecture and behavioral invariants
CLAUDE.md                         operating instructions for Claude Code
```

## Product architecture

The authenticated application loads the studio shell, which consumes `StudioContext`. The context coordinates the current studio document, route/view state, filtering, account data, panels and modals, local persistence, server synchronization, and user-facing actions. UI surfaces call context actions rather than writing persistence independently.

See:

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/publishing.md`](docs/publishing.md)
- [`docs/designer.md`](docs/designer.md)
- [`docs/testing.md`](docs/testing.md)

## Deployment note

Vercel maps production serverless routes by filename under `/api`. Adding a route only to the local server does not create a deployed endpoint. Every production route must have the corresponding `/api/<route>.js` entrypoint.

## Development expectations

Before changing code, reproduce the issue, identify the violated invariant, and search for analogous surfaces. Add regression coverage for the shared behavior rather than patching only the first reported screen. Run targeted tests while iterating, then run lint, the full test suite, and the production build before completing a code change.

Claude Code contributors should read [`CLAUDE.md`](CLAUDE.md) first.
