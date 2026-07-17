# Testing and validation

Use the cheapest test that can disprove the current hypothesis, then run the full relevant gate once the change is complete.

## What each check proves

- `npm run lint`: static lint rules only.
- `npm run build`: the app bundles successfully.
- `npm run test:node`: server and validation behavior covered by Node tests.
- `npm run test:unit`: explicitly mounted or invoked Vitest behavior.
- `npm test`: Node and Vitest suites.

Passing lint, build, and unrelated unit tests does **not** prove that a major React surface mounts or that a browser interaction works.

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

### Browser-only behavior

Use a focused development harness when jsdom cannot reproduce the browser mechanism. Document the observed evidence, then preserve a durable automated test for the application invariant. Remove temporary harness code after it has served its purpose.

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
