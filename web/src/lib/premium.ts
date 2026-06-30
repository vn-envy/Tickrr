/**
 * Premium state + Stripe checkout helpers.
 *
 * Billing endpoints are served by the same-origin Express server (server.ts), so these use
 * relative /api paths (NOT the FastAPI market backend). Pro state is held client-side and set
 * either by a completed Stripe Checkout (?pro=1 redirect) or, with no Stripe key, demo mode.
 */
const KEY = "tickrr_premium";

export function isPremium(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setPremium(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export interface Plan {
  id: string;
  label: string;
  amount: number; // cents
  mode: string; // "subscription" | "payment"
  interval?: string;
}

export async function fetchPlans(): Promise<{ stripe: boolean; plans: Plan[] }> {
  try {
    const r = await fetch("/api/plans");
    if (!r.ok) return { stripe: false, plans: [] };
    return await r.json();
  } catch {
    return { stripe: false, plans: [] };
  }
}

/**
 * Start checkout for a plan. Returns a Stripe hosted-checkout URL when a key is configured,
 * or { demo: true } when not — in which case the caller unlocks Pro locally.
 */
export async function startCheckout(plan: string): Promise<{ url?: string; demo?: boolean; error?: string }> {
  try {
    const r = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    return await r.json();
  } catch {
    return { error: "network" };
  }
}

/** Go Pro: redirect to Stripe if available, else unlock in demo mode. Returns true if unlocked locally. */
export async function goPro(plan: string): Promise<boolean> {
  const res = await startCheckout(plan);
  if (res.url) {
    window.location.href = res.url;
    return false;
  }
  // demo mode (or error) → unlock locally
  setPremium(true);
  return true;
}
