/**
 * Firebase bootstrap — Auth (Google) + Firestore for per-user watchlist sync.
 * Reads VITE_FIREBASE_* at build time. If they're absent, `authEnabled` is false and the whole
 * layer is inert — the app runs exactly as before (local-only watchlist, no sign-in UI).
 */
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const cfg = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID as string | undefined,
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

export const authEnabled = Boolean(cfg.apiKey && cfg.projectId && cfg.appId);

let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
export const googleProvider = new GoogleAuthProvider();

if (authEnabled) {
  app = initializeApp(cfg as Record<string, string>);
  auth = getAuth(app);
  db = getFirestore(app);
}
