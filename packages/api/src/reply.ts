// What every route may answer: the server's refusals beside the simulation's,
// and the clock (the Contract sections of docs/rules/server.md and
// docs/rules/clock.md).
import type { RejectionCode, Reply, WorldClock } from "@japacity/sim";

/** server:per-account-rate-limits, account:one-character-per-account: the server's own refusals beside the simulation's. */
export type ServerCode =
  | RejectionCode
  | "rate-limited"
  | "signed-out"
  | "diverged"
  | "one-character"
  | "no-character"
  /** server:four-off-switches: the feature's switch is off. */
  | "switched-off"
  /** account.md: the age screen and the bot check. */
  | "under-age"
  | "bad-date"
  | "bot-check"
  | "not-fresh"
  | "bad-code"
  // The people routes' refusals (pair:invite-link-single-use, pair:phrase-checks-before-send; moderation:block-refuses-both-ways).
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
  /** account:social-needs-secured-account: only a secured account may do this; the detail names the way to secure. */
  | "guest-only"
  /** server:dedication-routes: a dedication light the shared check refuses; the reply carries its problems. */
  | "bad-light";

/**
 * A refusal from any player route. `retryAfter` is in seconds: with `rate-limited` (server:per-account-rate-limits), and with
 * `switched-off`, whose 503 also sets it (server:signups-off-shows-full).
 */
export interface ServerRejection {
  ok: false;
  code: ServerCode;
  detail: string;
  retryAfter?: number;
}

/** clock:reply-carries-the-clock: milliseconds since the epoch of 1970, all set by the server. */
export interface ClockView {
  tick: number;
  nextTickAt: number;
  /** Null while the bank is full. */
  nextTurnAt: number | null;
  /** clock:envelopes-show-real-waits: when the next sealed result opens: the world's next morning (decision 0011). */
  morningAt: number;
  /** clock:game-day-on-real-time: the world's own clock, the same for everyone. */
  world: WorldClock;
}

/** A command's answer: the simulation's reply with the clock, or the server's refusal. */
export type ServerReply = (Reply & { clock: ClockView }) | ServerRejection;
