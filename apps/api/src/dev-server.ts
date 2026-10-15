import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { ApiDeps } from './app.js';
import type { SchedulerIdentityConfig } from './retention-routes.js';
import { buildServer } from './server.js';
import { createGeminiPort, createGeminiTranscriptionPort } from './gemini.js';
import { createFakeGemini, createFakeTranscription } from '../test/fake-gemini.js';

/**
 * DEV-ONLY local bootstrap for the clickable end-to-end demo (DSN-014 local
 * sub-gate). Run under `firebase emulators:exec` so the Firebase Admin SDK
 * auto-targets the Auth + Firestore emulators via FIREBASE_AUTH_EMULATOR_HOST /
 * FIRESTORE_EMULATOR_HOST.
 *
 * Gemini backend selection (same adapters as production, only the auth differs):
 * - Default (`DSN_LIVE_GEMINI` unset): the deterministic fake Gemini — NO real
 *   model call and NO billable cloud resource.
 * - `DSN_LIVE_GEMINI=1`: the REAL `gemini.ts` adapters, so the local end-to-end
 *   journey exercises the same model path that runs in the cloud. Supply either
 *   `GEMINI_API_KEY` (Gemini Developer API — no GCP project needed) or ADC +
 *   `GOOGLE_CLOUD_PROJECT` (Vertex AI). Auth/Firestore stay on the emulators, so
 *   the only live dependency is the model itself. This is a real, billable model
 *   call against your key/project.
 *
 * This bootstrap is never used in production — production boots through
 * `server.ts` `main()`, which refuses to start if handed a test double.
 */
async function devMain(): Promise<void> {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('DEV_SERVER_REQUIRES_EMULATORS: start it via `npm run dev:api` (firebase emulators:exec)');
  }
  const live = process.env.DSN_LIVE_GEMINI === '1';
  if (live && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_CLOUD_PROJECT) {
    throw new Error(
      'DSN_LIVE_GEMINI=1 needs a backend: set GEMINI_API_KEY (Gemini Developer API) or GOOGLE_CLOUD_PROJECT + ADC (Vertex AI)',
    );
  }
  if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-dsn' });
  }
  const deps: ApiDeps = { auth: getAuth(), db: getFirestore(), now: () => new Date() };
  // The scheduler/retention route is not exercised in the manual demo; a dummy
  // identity config keeps the installer mountable without any real credential.
  const schedulerConfig: SchedulerIdentityConfig = {
    audience: 'dev-local',
    serviceAccountEmail: 'dev-scheduler@demo-dsn.example.invalid',
    keySource: { getPublicKey: async () => undefined },
  };
  const gemini = live ? createGeminiPort() : createFakeGemini();
  const transcription = live ? createGeminiTranscriptionPort() : createFakeTranscription();
  const app = buildServer(deps, gemini, schedulerConfig, undefined, transcription);
  const port = Number(process.env.PORT ?? 8787);
  await app.listen({ host: '127.0.0.1', port });
  const backend = live
    ? process.env.GEMINI_API_KEY
      ? 'LIVE Gemini — Developer API key'
      : 'LIVE Gemini — Vertex AI/ADC'
    : 'SIMULATED fake Gemini, no cloud cost';
  console.log(`[dev] DSN API (${backend}, emulator-backed auth/db) listening on http://127.0.0.1:${port}`);
}

devMain().catch((error: unknown) => {
  console.error(JSON.stringify({ severity: 'CRITICAL', message: error instanceof Error ? error.message : 'DEV_BOOT_FAILED' }));
  process.exit(1);
});
