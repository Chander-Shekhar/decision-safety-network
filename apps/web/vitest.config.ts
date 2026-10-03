import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // No test files exist yet in this foundation task; app/screen tests are
    // added by their owning tasks (Task 2 onward). Avoid a false "no test
    // files found" failure on `npm run test:web` until then.
    passWithNoTests: true,
  },
});
