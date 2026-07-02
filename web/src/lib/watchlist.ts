/**
 * Personal watchlist — the user's saved teams/players. Stored in localStorage (no auth needed);
 * upgrades cleanly to a per-user Firestore doc once accounts land. Keyed by market/entity id.
 */
const KEY = "tickrr_favorites";

export function getFavorites(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return new Set<string>();
  }
}

function save(s: Set<string>): void {
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}

/** Toggle a favorite; returns the updated set. */
export function toggleFavorite(id: string): Set<string> {
  const s = getFavorites();
  if (s.has(id)) s.delete(id); else s.add(id);
  save(s);
  return s;
}
