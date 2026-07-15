# Designer invariants

The designer is pointer-heavy, stateful browser UI. Preserve behavior as a system; do not patch one event handler without checking the full pointer sequence.

## Selection and dragging

- Pointer-down establishes selection before drag behavior begins.
- Plain click replaces the selection.
- Shift-click toggles an item in the selection exactly once.
- Dragging an already selected item preserves the current group selection.
- Shift-drag constrains movement to the dominant horizontal or vertical axis.
- Multi-drag snapshots positions at drag start, not at selection time.
- Multi-drag must read live selection and element values from refs rather than stale render closures.
- Locked elements may be selected but must not move.

Whenever changing selection or drag behavior, inspect `pointerdown`, movement, `pointerup`, click, and canvas-background handlers together. Avoid wiring the same selection action to both pointer-down and click.

## Text editing

Do not rely exclusively on `blur` to persist `contentEditable` text. Clicking the canvas can change React state, disable editing, rerender the old value, and prevent or invalidate blur handling.

Required invariant:

- capture live text during `input`;
- commit from the captured value rather than rereading potentially clobbered DOM;
- clicking outside the text element must preserve the latest keystroke;
- rerenders during editing must not overwrite the editable DOM.

## Component safety

- The designer is lazy-loaded.
- It must render inside a designer-scoped error boundary.
- Resetting that boundary closes the designer; it must not take down the full studio.
- Any change to top-level hook/ref initialization requires a real mount test. Build and lint do not detect temporal-dead-zone failures that occur only during render.

## Media in the canvas

Designer videos must use the same shared muted-autoplay behavior as every other preview surface. Include a poster when available and verify the actual frame paints in Chrome.

## Minimum validation for designer changes

Choose the relevant cases and automate them where practical:

- component mounts without throwing;
- plain click selection;
- shift-click add and remove;
- plain drag;
- shift-drag horizontal and vertical lock;
- group drag includes the last selected item;
- locked element behavior;
- typing followed by canvas click-out;
- typing during parent render churn;
- video frame paints in canvas;
- scoped error boundary resets safely.

Prefer tests against the real component wiring. Temporary development harnesses are useful for reproducing browser behavior, but retain a durable regression test before removing the harness.
