import './index.css';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { createRoot } from 'react-dom/client';
import { App, type AuthProvider } from './App';

/**
 * Local dev auth: the real Firebase client SDK pointed at the Auth EMULATOR
 * (DSN-014 local sub-gate). `signInSynthetic` creates a fresh anonymous
 * emulator user per browser context — run the owner in one window and the ally
 * in another incognito/profile window — so the ID token the API verifies is a
 * genuine Firebase token (the dev-server's Admin SDK also targets the
 * emulator). No real Firebase project and no cloud cost: `apiKey` is a dummy
 * the emulator ignores and `projectId` matches the emulator project `demo-dsn`.
 *
 * The deployed build will drop `connectAuthEmulator` and read a real web config
 * — that is the still-blocked deploy sub-gate.
 */
const firebaseApp = initializeApp({ apiKey: 'demo-emulator', projectId: 'demo-dsn' });
const firebaseAuth = getAuth(firebaseApp);
connectAuthEmulator(firebaseAuth, 'http://localhost:9099', { disableWarnings: true });

const emulatorAuth: AuthProvider = {
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

createRoot(document.getElementById('root') as HTMLElement).render(<App auth={emulatorAuth} />);
