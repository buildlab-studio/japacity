// What every route may answer: the server's refusals beside the simulation's,
// and the clock (the Contract sections of docs/rules/server.md and
// docs/rules/clock.md).
import type { RejectionCode, Reply, WorldClock } from "@japacity/sim";

/** R-SERVER-025, R-ACCOUNT-015: the server's own refusals beside the simulation's. */
export type ServerCode =
  | RejectionCode
  | "rate-limited"
  | "signed-out"
  | "diverged"
  | "one-character"
  | "no-character"
  /** R-SERVER-031: the feature's switch is off. */
  | "switched-off"
  /** account.md: the age screen and the bot check. */
  | "under-age"
  | "bad-date"
  | "bot-check"
  | "not-fresh"
  | "bad-code"
  // The people routes' refusals (pair.md R-PAIR-008, 013; moderation.md R-MODERATION-001).
  | "not-possible"
  | "blocked"
  | "too-many"
  | "wrong-place"
  | "bad-fill"
  | "not-here"
  | "used"
  | "expired"
  | "wrong-slot"
  | "not-adult"
  | "moved-on"
  /** R-ACCOUNT-022: only a secured account may do this; the detail names the way to secure. */
  | "guest-only"
  /** R-SERVER-045: a dedication light the shared check refuses; the reply carries its problems. */
  | "bad-light";

/**
 * A refusal from any player route. `retryAfter` is in seconds: with `rate-limited` (R-SERVER-025), and with
 * `switched-off`, whose 503 also sets it (R-SERVER-032).
 */
export interface ServerRejection {
  ok: false;
  code: ServerCode;
  detail: string;
  retryAfter?: number;
}

/** R-CLOCK-003: milliseconds since the epoch of 1970, all set by the server. */
export interface ClockView {
  tick: number;
  nextTickAt: number;
  /** Null while the bank is full. */
  nextTurnAt: number | null;
  /** R-CLOCK-032: when the next sealed result opens: the world's next morning (decision 0011). */
  morningAt: number;
  /** R-CLOCK-033: the world's own clock, the same for everyone. */
  world: WorldClock;
}

/** A command's answer: the simulation's reply with the clock, or the server's refusal. */
export type ServerReply = (Reply & { clock: ClockView }) | ServerRejection;
