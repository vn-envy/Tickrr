/**
 * Auth helpers — Google sign-in via Firebase.
 *
 * Uses popup first, then falls back to redirect when the popup is blocked / closed
 * by COOP policies (common on Cloud Run + mobile). All functions are safe no-ops
 * when auth is not configured.
 */
import { authEnabled, auth, googleProvider } from "./firebase";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
} from "firebase/auth";

export interface AuthUser {
  uid: string;
  name: string | null;
  email: string | null;
  photo: string | null;
}

export type AuthStatus = "idle" | "pending" | "signed-in" | "signed-out" | "error";

export interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  busy: boolean;
}

type Listener = (s: AuthState) => void;

const listeners = new Set<Listener>();
let state: AuthState = { user: null, status: "idle", error: null, busy: false };
let bootstrapped = false;

function toAuthUser(u: User): AuthUser {
  return { uid: u.uid, name: u.displayName, email: u.email, photo: u.photoURL };
}

function emit(partial: Partial<AuthState>): void {
  state = { ...state, ...partial };
  listeners.forEach((l) => l(state));
}

function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  if (code === "auth/popup-blocked") return "Popup blocked — retrying with redirect…";
  if (code === "auth/popup-closed-by-user") return "Sign-in cancelled.";
  if (code === "auth/cancelled-popup-request") return "Sign-in already in progress.";
  if (code === "auth/network-request-failed") return "Network error — check your connection.";
  if (code === "auth/unauthorized-domain") return "This domain is not authorized for sign-in.";
  if (code === "auth/operation-not-allowed") return "Google sign-in is not enabled.";
  return "Sign-in failed. Try again.";
}

/** One-time bootstrap: persistence + consume any pending redirect result. */
async function bootstrap(): Promise<void> {
  if (bootstrapped || !authEnabled || !auth) return;
  bootstrapped = true;
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch { /* older browsers */ }
  try {
    emit({ busy: true, status: "pending", error: null });
    const result = await getRedirectResult(auth);
    if (result?.user) {
      emit({ user: toAuthUser(result.user), status: "signed-in", busy: false, error: null });
      return;
    }
  } catch (e) {
    emit({ busy: false, status: "error", error: friendlyError(e) });
    return;
  }
  emit({ busy: false });
}

/** Subscribe to auth state. Returns an unsubscribe fn. */
export function subscribeAuth(cb: (u: AuthUser | null) => void): () => void {
  if (!authEnabled || !auth) {
    cb(null);
    return () => {};
  }
  void bootstrap();
  return onAuthStateChanged(auth, (u) => {
    const user = u ? toAuthUser(u) : null;
    emit({
      user,
      status: user ? "signed-in" : "signed-out",
      busy: false,
      error: user ? null : state.error,
    });
    cb(user);
  });
}

/** Richer subscription (busy + error) for header UI. */
export function subscribeAuthState(cb: Listener): () => void {
  if (!authEnabled || !auth) {
    cb(state);
    return () => {};
  }
  void bootstrap();
  listeners.add(cb);
  cb(state);
  const unsub = onAuthStateChanged(auth, (u) => {
    const user = u ? toAuthUser(u) : null;
    emit({
      user,
      status: user ? "signed-in" : "signed-out",
      busy: false,
      error: user ? null : state.error,
    });
  });
  return () => {
    listeners.delete(cb);
    unsub();
  };
}

export function getAuthState(): AuthState {
  return state;
}

export async function signInWithGoogle(): Promise<boolean> {
  if (!authEnabled || !auth) return false;
  if (state.busy) return false;
  emit({ busy: true, status: "pending", error: null });
  try {
    await signInWithPopup(auth, googleProvider);
    emit({ busy: false, status: "signed-in", error: null });
    return true;
  } catch (e) {
    const code = (e as { code?: string })?.code || "";
    // Popup blocked / COOP / third-party cookie issues → redirect flow.
    if (
      code === "auth/popup-blocked" ||
      code === "auth/cancelled-popup-request" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      emit({ error: "Redirecting to Google…", busy: true, status: "pending" });
      try {
        await signInWithRedirect(auth, googleProvider);
        return true; // page will navigate away
      } catch (e2) {
        emit({ busy: false, status: "error", error: friendlyError(e2) });
        return false;
      }
    }
    if (code === "auth/popup-closed-by-user") {
      emit({ busy: false, status: "signed-out", error: null });
      return false;
    }
    console.warn("[Tickrr] sign-in failed:", e);
    emit({ busy: false, status: "error", error: friendlyError(e) });
    return false;
  }
}

export async function signOutUser(): Promise<boolean> {
  if (!authEnabled || !auth) return false;
  emit({ busy: true, error: null });
  try {
    await signOut(auth);
    emit({ user: null, status: "signed-out", busy: false, error: null });
    return true;
  } catch (e) {
    console.warn("[Tickrr] sign-out failed:", e);
    emit({ busy: false, status: "error", error: "Sign-out failed. Try again." });
    return false;
  }
}
