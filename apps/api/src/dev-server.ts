import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { ApiDeps } from './app.js';
import type { SchedulerIdentityConfig } from './retention-routes.js';
import { buildServer } from './server.js';
import { createFakeGemini } from '../test/fake-gemini.js';

/**
 * DEV-ONLY local bootstrap for the clickable end-to-end demo (DSN-014 local
 * sub-gate). Run under `firebase emulators:exec` so the Firebase Admin SDK
 * auto-targets the Auth + Firestore emulators via FIREBASE_AUTH_EMULATOR_HOST /
 * FIRESTORE_EMULATOR_HOST. It injects the deterministic fake Gemini: there is
 * NO real Gemini/Vertex call and NO billable cloud resource. It is never used
 * in production — production boots through `server.ts` `main()` with the live
 * adapter, which refuses to start if handed a test double.
 */
async function devMain(): Promise<void> {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('DEV_SERVER_REQUIRES_EMULATORS: start it via `npm run dev:api` (firebase emulators:exec)');
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
  const app = buildServer(deps, createFakeGemini(), schedulerConfig);
  const port = Number(process.env.PORT ?? 8787);
  await app.listen({ host: '127.0.0.1', port });
  console.log(
    `[dev] DSN API (SIMULATED — fake Gemini, emulator-backed, no cloud cost) listening on http://127.0.0.1:${port}`,
  );
}

devMain().catch((error: unknown) => {
  console.error(JSON.stringify({ severity: 'CRITICAL', message: error instanceof Error ? error.message : 'DEV_BOOT_FAILED' }));
  process.exit(1);
});
