import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const TEST_PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'demo-dsn';
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';

// Emulator-backed tests across apps/api/test/* share one Admin SDK app.
// Importing this module (directly or via `authHeader`) is enough to
// guarantee it exists before any firebase-admin call.
if (getApps().length === 0) {
  initializeApp({ projectId: TEST_PROJECT_ID });
}

/**
 * Signs in as `uid` against the Firebase Auth emulator and returns a bearer
 * `authorization` header carrying a real, verifiable ID token - exercising
 * the same `auth.verifyIdToken` path the live API uses, rather than a
 * hand-built fake token.
 */
export async function authHeader(uid: string): Promise<Record<string, string>> {
  const customToken = await getAuth().createCustomToken(uid);
  const response = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!response.ok) {
    throw new Error(`AUTH_EMULATOR_SIGNIN_FAILED: ${response.status} ${await response.text()}`);
  }
  const { idToken } = (await response.json()) as { idToken: string };
  return { authorization: `Bearer ${idToken}` };
}
