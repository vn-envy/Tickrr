/**
 * Personal watchlist — the user's saved teams/players.
 *
 * Reads are synchronous from localStorage (so the UI never blocks). When a user is signed in,
 * changes also mirror to a per-user Firestore doc (users/{uid}.favorites) for cross-device sync,
 * and on sign-in we merge cloud + local. A tiny pub/sub keeps every panel in sync.
 */
import { authEnabled, auth, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const KEY = "tickrr_favorites";
const listeners = new Set<() => void>();

export function onFavoritesChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function notify(): void { listeners.forEach((l) => l()); }

export function getFavorites(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return new Set<string>();
  }
}

function saveLocal(s: Set<string>): void {
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}

function uid(): string | null {
  return authEnabled && auth?.currentUser ? auth.currentUser.uid : null;
}

async function pushCloud(s: Set<string>): Promise<void> {
  const id = uid();
  if (!id || !db) return;
  try { await setDoc(doc(db, "users", id), { favorites: [...s] }, { merge: true }); } catch { /* offline / rules */ }
}

/** Toggle a favorite; returns the updated set. Mirrors to Firestore if signed in. */
export function toggleFavorite(id: string): Set<string> {
  const s = getFavorites();
  if (s.has(id)) s.delete(id); else s.add(id);
  saveLocal(s);
  notify();
  void pushCloud(s);
  return s;
}

/** On sign-in: merge cloud + local favorites, persist to both, and notify all panels. */
export async function syncFavoritesFromCloud(): Promise<void> {
  const id = uid();
  if (!id || !db) return;
  try {
    const snap = await getDoc(doc(db, "users", id));
    const remote: string[] = snap.exists() ? (snap.data().favorites || []) : [];
    const merged = new Set<string>([...getFavorites(), ...remote]);
    saveLocal(merged);
    await setDoc(doc(db, "users", id), { favorites: [...merged] }, { merge: true });
    notify();
  } catch { /* ignore */ }
}
