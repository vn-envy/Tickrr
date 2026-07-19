/**
 * Hardcoded free-tier quotas (waitlist phase — no live billing yet).
 *
 * Sign in → 5 Gemini queries (deep analysis + ask-anything advisory combined) and ONE
 * Deliberation Room round capped at 6 turns. Counters live in localStorage keyed by the
 * signed-in uid, so every Google account gets its own allowance and every consumed unit
 * is a real, attributable user action. When a limit is hit the UI routes to the Pro
 * waitlist — that's the intent signal we're capturing before wiring live payments.
 */

export const LIMITS = {
  gemini: 5,      // deep analysis + advisory questions, combined
  delibRounds: 1, // deliberation rooms per user
  delibTurns: 6,  // user turns inside that one round
} as const;

let userKey = "anon";

/** Call whenever auth state changes so counters are scoped to the signed-in account. */
export function setQuotaUser(uid: string | null | undefined): void {
  userKey = uid || "anon";
}

const k = (name: string) => `tickrr_q_${userKey}_${name}`;

function get(name: string): number {
  try { return Number(localStorage.getItem(k(name)) || 0) || 0; } catch { return 0; }
}

function bump(name: string): void {
  try { localStorage.setItem(k(name), String(get(name) + 1)); } catch { /* ignore */ }
}

// --- Gemini queries (analysis + advisory) ---
export function geminiUsed(): number { return get("gemini"); }
export function geminiRemaining(): number { return Math.max(0, LIMITS.gemini - geminiUsed()); }
/** Consume one query. Returns false (and consumes nothing) when the allowance is gone. */
export function consumeGemini(): boolean {
  if (geminiRemaining() <= 0) return false;
  bump("gemini");
  return true;
}

// --- Deliberation Room: one round, capped turns ---
export function delibRoundUsed(): boolean { return get("delib_round") >= LIMITS.delibRounds; }
export function markDelibRoundStarted(): void { if (!delibRoundUsed()) bump("delib_round"); }
export function delibTurnsUsed(): number { return get("delib_turns"); }
export function delibTurnsRemaining(): number { return Math.max(0, LIMITS.delibTurns - delibTurnsUsed()); }
/** Consume one turn. Returns false (and consumes nothing) when the round is over. */
export function consumeDelibTurn(): boolean {
  if (delibTurnsRemaining() <= 0) return false;
  markDelibRoundStarted();
  bump("delib_turns");
  return true;
}

/** Usage snapshot attached to waitlist submissions — real actions behind the intent. */
export function usageSnapshot(): Record<string, number> {
  return {
    gemini_queries: geminiUsed(),
    delib_rounds: get("delib_round"),
    delib_turns: delibTurnsUsed(),
  };
}
