import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for the real-browser test tier ONLY (Playwright webServer).
// Serves browser-harness/*.html, which mount the real studio + designer
// surfaces. "@clerk/react" is aliased to a deterministic mock so the
// auth-gated surfaces render with no network or live credentials.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = here;

export default defineConfig({
  root: resolve(repoRoot, "browser-harness"),
  plugins: [react()],
  // Dummy client env so import-time client construction (src/lib/supabase.js
  // createClient) doesn't throw. Values are non-functional placeholders — the
  // harness has no backend; persistence calls fail and the studio falls back to
  // local state, which is the degraded-backend condition we want to survive.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://harness.invalid"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("harness-anon-key"),
    "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify("pk_test_harness"),
  },
  resolve: {
    alias: {
      "@clerk/react": resolve(repoRoot, "browser-harness/clerk-mock.js"),
    },
  },
  server: {
    port: 4321,
    strictPort: true,
    // Allow importing the real app source from ../src and repo node_modules.
    fs: { allow: [repoRoot] },
  },
});
