import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-setup.ts'],
    // Playwright specs under e2e/ import `@playwright/test` (not installed) and
    // drive a served SPA; they are a deferred DSN-014 sub-gate, not vitest unit
    // tests. Exclude them so the web unit run stays green.
    exclude: ['e2e/**', '**/node_modules/**', '**/dist/**'],
    // Feature tasks (DSN-004 onward) add *.test.tsx under src/. Keep this true
    // so `npm run test:web` stays green on the empty foundation stub.
    passWithNoTests: true,
  },
});
