import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-setup.ts'],
    // Feature tasks (DSN-004 onward) add *.test.tsx under src/. Keep this true
    // so `npm run test:web` stays green on the empty foundation stub.
    passWithNoTests: true,
  },
});
