import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest runs the unit-test tier. The older `tests/*.test.js` suite
// still runs under node:test via `npm run test:node`; this config
// handles any *.test.{js,jsx} file colocated with source plus anything
// under a `__tests__` directory.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.js"],
    include: ["src/**/*.test.{js,jsx}", "src/**/__tests__/**/*.{test,spec}.{js,jsx}"],
    exclude: ["node_modules", "dist", "tests/**"],
  },
});
