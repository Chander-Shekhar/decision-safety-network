import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Tests (and `tsc`'s tsconfig "paths") resolve the contracts package
      // straight to its TypeScript source so neither typecheck nor the test
      // suite depends on a prior `packages/contracts` build.
      '@dsn/contracts': fileURLToPath(new URL('../../packages/contracts/src/case.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
