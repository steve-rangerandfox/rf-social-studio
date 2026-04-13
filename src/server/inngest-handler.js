// Shared Inngest HTTP handler — used by both the local dev server (app.js)
// and the Vercel production function (api/inngest.js).
//
// serve() registers all Inngest functions and handles:
//   GET  /api/inngest  — function discovery (Inngest dev server syncs here)
//   POST /api/inngest  — function invocation (Inngest calls this to run a step)
//   PUT  /api/inngest  — introspection / health check

import { serve } from "inngest/node";
import { inngest } from "./inngest-client.js";
import { publishScheduledPosts } from "../inngest/publish-scheduled.js";

export const inngestHandler = serve({
  client: inngest,
  functions: [publishScheduledPosts],
});
