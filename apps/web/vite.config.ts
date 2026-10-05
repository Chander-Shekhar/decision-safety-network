import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Local dev server for the clickable end-to-end demo (DSN-014 local sub-gate).
 * Serves the SPA and proxies the single-origin API paths to the local dev API
 * (apps/api/src/dev-server.ts on :8787, backed by the Firebase emulator + the
 * deterministic fake Gemini — no real Gemini call, no cloud cost).
 *
 * Not used in production: Firebase Hosting serves the built SPA and rewrites
 * /api/v1/** to Cloud Run (firebase.json), which is the still-blocked deploy
 * sub-gate. The Firestore emulator owns :8080, so the dev API uses :8787.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/v1': { target: 'http://localhost:8787', changeOrigin: true },
      '/healthz': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
