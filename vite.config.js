import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    // Suppress source maps in production — prevents leaking original source
    // to end-users via browser devtools. Enable 'hidden' for error-monitoring
    // services (e.g., Sentry) that upload maps server-side.
    sourcemap: mode === 'production' ? false : 'inline',
    // Warn if any individual chunk exceeds 1 MB (before minification)
    chunkSizeWarningLimit: 1024,
  },
}))
