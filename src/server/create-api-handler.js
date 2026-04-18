import { handleApiRequest } from "./app.js";
import { loadServerEnv } from "./env.js";

// Factory used by every Vercel function entry point (api/*.js). Each
// function instance runs this once at cold start; using a factory keeps
// the entry points down to two lines without changing runtime behavior.
export function createApiHandler() {
  const env = loadServerEnv();
  return (req, res) => handleApiRequest(req, res, env);
}
