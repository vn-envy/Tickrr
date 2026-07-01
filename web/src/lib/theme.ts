/**
 * Theme control — dark (default, the Bloomberg terminal look) ⇄ light (monochrome: white,
 * black, greys only). The light theme is a pure CSS overlay keyed on `html.theme-light`
 * (see the bottom of index.css), so the dark UI is untouched. Persisted to localStorage.
 */
export type Theme = "dark" | "light";
const KEY = "tickrr_theme";

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(t: Theme): void {
  const el = document.documentElement;
  el.classList.toggle("theme-light", t === "light");
}

export function setTheme(t: Theme): void {
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyTheme(t);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}

/** Call once before render to apply the saved theme and avoid a flash. */
export function initTheme(): void {
  applyTheme(getTheme());
}
