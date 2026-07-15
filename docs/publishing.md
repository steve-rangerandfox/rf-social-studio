# Publishing

Relay publishes social content from either raw gallery media or designed frames. Treat media resolution and platform publishing as separate concerns.

## Source priority

When publishing an existing row, resolve media in this order unless the caller explicitly supplies files:

1. Files attached in the current composer session.
2. Designed frame URLs (`carouselFrameUrls` or the story/designer equivalent).
3. Raw gallery media attached to the row.
4. A generated video poster is preview metadata only; it is not the published media.

Keep this resolution logic centralized. Do not reimplement it independently in Composer, scheduler, previews, and API handlers.

## Instagram mapping

| Relay content | Instagram media type | Notes |
| --- | --- | --- |
| Single image | `IMAGE` | One image or one designed frame |
| Multiple images | `CAROUSEL` | Create children, then parent, wait for parent readiness, then publish |
| Feed video | `VIDEO` | Wait for container processing before publish |
| Reel | `REELS` | Video path; wait for processing |
| Story | `STORIES` | Publish the story row as a story; do not coerce to feed post |

Instagram Login tokens identify the account. Publishing targets `https://graph.instagram.com/me/media` and `/me/media_publish`; do not use the stored app-scoped user ID as a graph node.

## Container lifecycle

1. Create the media container.
2. For videos, reels, and carousel parents, poll container status.
3. Publish only after the container is ready.
4. A polling timeout may fall through to `media_publish` so Meta returns the definitive error.

Use the shared container-wait helper. Do not create separate polling loops for each media type.

## Vercel API rule

Production routes must have a file under `/api` because Vercel maps serverless functions by filename. A route existing only in `server.js` or `app.js` can work locally and still 404 in production.

Whenever adding or renaming an API route:

- add or update the corresponding `/api/<route>.js` bridge;
- confirm its runtime duration is sufficient for polling and carousel work;
- test the deployed path, not only the local Express path.

## Video previews

React's `muted` prop alone has not been reliable for Chrome autoplay in this app. Preview video surfaces must use the shared muted-autoplay behavior:

- set the DOM element's `muted` property;
- call `play()` after metadata is available;
- include `playsInline`;
- include a poster where available;
- handle rejected autoplay without hiding the poster.

Before fixing a video-rendering bug, search every `<video>` surface: feed/story/reel previews, post tiles, thumbnail strips, media gallery, designer canvas, and lightbox.

## Required publishing regression coverage

For publishing changes, cover the affected matrix rather than only the reported case:

- single image;
- carousel;
- feed video;
- reel;
- story;
- designed frames versus raw gallery media;
- immediate publish versus scheduled publish when both paths are affected;
- missing or processing-failed containers;
- production API entrypoint when a route changes.
