/**
 * Auth helpers — Google sign-in via Firebase. All functions are safe no-ops when auth is
 * not configured (authEnabled === false), so callers never need to guard.
 */
import { authEnabled, auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged, type User } from "firebase/auth";

export interface AuthUser {
  uid: string;
  name: string | null;
  email: string | null;
  photo: string | null;
}

function toAuthUser(u: User): AuthUser {
  return { uid: u.uid, name: u.displayName, email: u.email, photo: u.photoURL };
}

/** Subscribe to auth state. Returns an unsubscribe fn. Immediately emits null when disabled. */
export function subscribeAuth(cb: (u: AuthUser | null) => void): () => void {
  if (!authEnabled || !auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, (u) => cb(u ? toAuthUser(u) : null));
}

export async function signInWithGoogle(): Promise<void> {
  if (!authEnabled || !auth) return;
  try { await signInWithPopup(auth, googleProvider); } catch (e) { console.warn("[Tickrr] sign-in failed:", e); }
}

export async function signOutUser(): Promise<void> {
  if (!authEnabled || !auth) return;
  try { await signOut(auth); } catch { /* ignore */ }
}
