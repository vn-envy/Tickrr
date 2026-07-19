/**
 * Pro waitlist client — posts intent to /api/waitlist (Firestore on Cloud Run, file locally;
 * Google stack only). Every submission carries the user's real usage snapshot so we know
 * exactly how much value they consumed before raising their hand.
 */
import { usageSnapshot } from "./quota";

const KEY = "tickrr_waitlist_joined";

export function hasJoinedWaitlist(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export interface WaitlistIntent {
  email: string;
  name?: string | null;
  uid?: string | null;
  intent: string; // "pro" | "founder" | "pass_..."
  reason?: string; // what tripped the paywall (quota label), for funnel analysis
}

export async function joinWaitlist(entry: WaitlistIntent): Promise<boolean> {
  try {
    const r = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, usage: usageSnapshot(), source: window.location.pathname }),
    });
    if (!r.ok) return false;
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}
