/**
 * Auth helpers — Google sign-in via Firebase. All functions are safe no-ops when auth is
 * not configured (authEnabled === false), so callers never need to guard.
 *
 * Sign-in strategy: try the popup first (fast, keeps app state). Popups are routinely
 * blocked in production — mobile Safari, in-app browsers (Instagram/X webviews), strict
 * popup blockers, and Cross-Origin-Opener-Policy environments — which used to make the
 * SIGN IN button silently do nothing. When the popup fails for an environmental reason we
 * now fall back to a full-page redirect, and the redirect result is resolved on boot.
 */
import { authEnabled, auth, googleProvider } from "./firebase";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
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

// Popup failures that mean "the environment can't do popups" — retry with a redirect.
const POPUP_ENV_ERRORS = new Set([
  "auth/popup-blocked",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

/** Resolve a pending redirect sign-in (no-op when there is none). Call once on boot. */
export async function completeRedirectSignIn(): Promise<AuthUser | null> {
  if (!authEnabled || !auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user ? toAuthUser(result.user) : null;
  } catch (e) {
    console.warn("[Tickrr] redirect sign-in failed:", e);
    return null;
  }
}

/** Subscribe to auth state. Returns an unsubscribe fn. Immediately emits null when disabled. */
export function subscribeAuth(cb: (u: AuthUser | null) => void): () => void {
  if (!authEnabled || !auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, (u) => cb(u ? toAuthUser(u) : null));
}

/**
 * Google sign-in. Returns the signed-in user, or null when sign-in did not complete
 * (auth disabled, user closed the popup, or a redirect navigation is in flight).
 */
export async function signInWithGoogle(): Promise<AuthUser | null> {
  if (!authEnabled || !auth) return null;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return toAuthUser(result.user);
  } catch (e: any) {
    const code: string = e?.code || "";
    if (code === "auth/popup-closed-by-user") return null; // user dismissed — not an error
    if (POPUP_ENV_ERRORS.has(code) || !code) {
      // Popup can't work here (blocker / webview / COOP) — do a full-page redirect instead.
      try {
        await signInWithRedirect(auth, googleProvider);
        return null; // page navigates away; completeRedirectSignIn() resolves it on return
      } catch (re) {
        console.warn("[Tickrr] redirect sign-in failed:", re);
        return null;
      }
    }
    console.warn("[Tickrr] sign-in failed:", e);
    return null;
  }
}

/** Sign out. Resolves once Firebase has cleared the session (auth listeners then fire). */
export async function signOutUser(): Promise<void> {
  if (!authEnabled || !auth) return;
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("[Tickrr] sign-out failed:", e);
  }
}
