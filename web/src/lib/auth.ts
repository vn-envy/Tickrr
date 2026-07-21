/**
 * Auth helpers — Google sign-in via Firebase. All functions are safe no-ops when auth is
 * not configured (authEnabled === false), so callers never need to guard.
 */
import { authEnabled, auth, authPersistenceReady, googleProvider } from "./firebase";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type AuthError,
  type User,
} from "firebase/auth";

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
  // Completes mobile redirect sign-in before the observer emits the persisted user.
  void getRedirectResult(auth).catch((error) => console.warn("[Tickrr] redirect sign-in failed:", error));
  return onAuthStateChanged(auth, (u) => cb(u ? toAuthUser(u) : null));
}

function authMessage(error: unknown): string {
  const code = (error as AuthError)?.code || "";
  if (code === "auth/popup-closed-by-user") return "Sign-in was cancelled.";
  if (code === "auth/cancelled-popup-request") return "A sign-in window is already open.";
  if (code === "auth/unauthorized-domain") return "This domain is not authorized for Google sign-in.";
  if (code === "auth/network-request-failed") return "Could not reach Google sign-in. Check your connection.";
  return "Google sign-in failed. Please try again.";
}

export async function signInWithGoogle(): Promise<void> {
  if (!authEnabled || !auth) throw new Error("Authentication is not configured.");
  await authPersistenceReady;
  const mobile = window.matchMedia("(max-width: 767px)").matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile) {
    await signInWithRedirect(auth, googleProvider);
    return;
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    const code = (error as AuthError)?.code;
    if (code === "auth/popup-blocked") {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw new Error(authMessage(error));
  }
}

export async function signOutUser(): Promise<void> {
  if (!authEnabled || !auth) throw new Error("Authentication is not configured.");
  try {
    await signOut(auth);
  } catch (error) {
    const message = (error as AuthError)?.code === "auth/network-request-failed"
      ? "Could not sign out while offline. Please reconnect and retry."
      : "Sign-out failed. Please try again.";
    throw new Error(message);
  }
}
