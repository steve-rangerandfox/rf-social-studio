// Inngest webhook handler for Vercel production.
// The actual serve() configuration lives in src/server/inngest-handler.js
// so it can also be used by the local dev server (app.js).

export { inngestHandler as default } from "../src/server/inngest-handler.js";
