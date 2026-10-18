import './index.css';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { createRoot } from 'react-dom/client';
import { App, type AuthProvider } from './App';

/**
 * Real Firebase web config comes from VITE_FIREBASE_* at build time (an
 * untracked apps/web/.env.production.local). Without it the app targets the
 * local Auth emulator (project `demo-dsn`, dummy key the emulator ignores).
 * The Firebase web API key is a public client identifier, not a secret.
 */
const useEmulator = !import.meta.env.VITE_FIREBASE_API_KEY;
const firebaseApp = initializeApp(
  useEmulator
    ? { apiKey: 'demo-emulator', projectId: 'demo-dsn' }
    : {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      },
);
const firebaseAuth = getAuth(firebaseApp);
if (useEmulator) {
  connectAuthEmulator(firebaseAuth, 'http://localhost:9099', { disableWarnings: true });
}

const firebaseAuthProvider: AuthProvider = {
  async signInSynthetic() {
    await signInAnonymously(firebaseAuth);
  },
  async getIdToken() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      throw new Error('NOT_SIGNED_IN');
    }
    return user.getIdToken();
  },
};

createRoot(document.getElementById('root') as HTMLElement).render(<App auth={firebaseAuthProvider} />);
