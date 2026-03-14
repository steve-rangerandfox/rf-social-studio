import { handleApiRequest } from "../src/server/app.js";
import { loadServerEnv } from "../src/server/env.js";

const env = loadServerEnv();

export default async function handler(req, res) {
  return handleApiRequest(req, res, env);
}
