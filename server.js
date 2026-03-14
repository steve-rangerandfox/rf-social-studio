import { fileURLToPath } from "node:url";

import { createNodeServer } from "./src/server/app.js";
import { loadServerEnv } from "./src/server/env.js";
import { createLogger } from "./src/server/log.js";

const env = loadServerEnv();
const log = createLogger("rf-social-studio-server");
const server = createNodeServer(env);

function isExecutedDirectly() {
  const current = fileURLToPath(import.meta.url);
  return process.argv[1] === current;
}

if (isExecutedDirectly()) {
  server.listen(env.port, () => {
    log("info", "startup", "server_ready", {
      port: env.port,
      instagramConfigured: Boolean(env.igAppId && env.igAppSecret && env.sessionSecret),
      aiConfigured: Boolean(env.anthropicApiKey),
    });
  });
}

export { server };
