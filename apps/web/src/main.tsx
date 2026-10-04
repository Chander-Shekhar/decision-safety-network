import { createRoot } from 'react-dom/client';
import { App, type AuthProvider } from './App';

/**
 * DSN-014-BLOCKED PLACEHOLDER: real Firebase client sign-in (Auth emulator
 * locally, production Auth when deployed) needs the `firebase` client SDK,
 * which is not a dependency yet. Replace this stub with a provider backed by
 * `firebase/auth` once that dependency is approved. Until then no account can
 * be created and no token is ever issued.
 */
const placeholderAuth: AuthProvider = {
  async signInSynthetic() {
    throw new Error('FIREBASE_CLIENT_NOT_WIRED');
  },
  async getIdToken() {
    throw new Error('FIREBASE_CLIENT_NOT_WIRED');
  },
};

createRoot(document.getElementById('root') as HTMLElement).render(<App auth={placeholderAuth} />);
