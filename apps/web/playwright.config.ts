import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end harness for the clickable demo (DSN-032; un-defers the Playwright
 * sub-gate under founder Req C). It boots the SAME local, no-cloud stack the
 * DSN-014 local sub-gate defines and NOTHING else:
 *
 *   1. the Firebase Auth + Firestore emulators wrapping the API dev-server
 *      (`apps/api/src/dev-server.ts` on :8787), which injects the deterministic
 *      `createFakeGemini()` — there is no real Gemini call and no cloud cost;
 *   2. the Vite dev server on :5173 (serves the SPA, proxies `/api/v1` + /healthz
 *      to :8787). The web client (`main.tsx`) is hardwired to the Auth emulator.
 *
 * Determinism guard: `DSN_WEB_VERIFICATION` is forced empty so the API uses the
 * curated (deterministic) web-verification adapter even if a `grounded` value is
 * exported in the ambient shell. No `GOOGLE_CLOUD_PROJECT` / ADC is set, so the
 * live grounding path (DSN-031) is never reached from here.
 *
 * The emulators need a JDK; like the API test command we default to the
 * Homebrew OpenJDK 21 path but honour an inherited `JAVA_HOME`.
 */
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const javaHome = process.env.JAVA_HOME ?? '/opt/homebrew/opt/openjdk@21';
const emulatorEnv = {
  JAVA_HOME: javaHome,
  PATH: `${javaHome}/bin:${process.env.PATH ?? ''}`,
  // Keep the demo deterministic: curated web-verification adapter, fake Gemini.
  DSN_WEB_VERIFICATION: '',
};

export default defineConfig({
  testDir: './e2e',
  // The journeys drive a shared Firestore/Auth emulator, so run them serially.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'line' : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    // retries:0, so `on-first-retry` would never capture anything — retain on the first failure.
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    // 440px narrow viewport — the DSN-022 mobile walkthrough width.
    { name: 'mobile-440', use: { ...devices['Desktop Chrome'], viewport: { width: 440, height: 900 } } },
  ],
  webServer: [
    {
      // Emulators wrap the dev-server; emulators:exec stays alive while the server listens.
      command:
        'firebase emulators:exec --project demo-dsn --only auth,firestore "PORT=8787 npx tsx apps/api/src/dev-server.ts"',
      cwd: repoRoot,
      url: 'http://127.0.0.1:8787/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: emulatorEnv,
    },
    {
      command: 'npm run dev',
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
