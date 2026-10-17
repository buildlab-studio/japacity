// The server's reply and clock types (docs/rules/server.md contract item 5,
import type { WorldClock } from "@japacity/sim";
// docs/rules/clock.md contract items 3 and 4). This file is kept by hand.
import type { Command, Id, PlayerView, PrologueSlice, Rejection, RejectionCode, Reply, ReportLine, World } from "@japacity/sim";
import type { Nudge } from "@japacity/store";

export type { Nudge };

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

export interface ServerRejection {
  ok: false;
  code: ServerCode;
  detail: string;
  /** R-SERVER-025: seconds, with `rate-limited` only. */
  retryAfter?: number;
}

/** R-CLOCK-003: milliseconds since the epoch of 1970, all set by the server. */
export interface ClockView {
  tick: number;
  nextTickAt: number;
  /** Null while the bank is full. */
  nextTurnAt: number | null;
  /** R-CLOCK-032: when the next sealed result opens: the world's next morning (decision 0036). */
  morningAt: number;
  /** R-CLOCK-033: the world's own clock, the same for everyone. */
  world: WorldClock;
}

export type ServerReply = (Reply & { clock: ClockView }) | ServerRejection;

// ---------------------------------------------------------------------------
// The HTTP contract between the client and the server. Every route is under
// /api, answers JSON, and needs a signed-in session unless it says otherwise.
// ---------------------------------------------------------------------------

/** R-SERVER-001: `POST /api/command`. The client sends the command and the version it saw, never a tick, a state or a world. */
export interface CommandRequest {
  command: Command;
  basedOn: number;
}

/** R-SERVER-046: `POST /api/prologue/preset`. The archetype's id, the age step and the home chosen at the door, and the version seen. */
export interface PresetRequest {
  archetype: string;
  age: number;
  home: string;
  basedOn: number;
}

/** R-SERVER-046, R-PROLOGUE-014: one step the preset played: its answer, the draw once made, and the outcome its draw gave. */
export interface PresetStep {
  step: string;
  answer: string;
  draw: PrologueSlice["draw"];
  outcome: string | null;
}

/**
 * R-SERVER-046: the view after the last step, its lines, the clock, the count stepped and the trail; `refusal` when an
 * answer was refused after some steps stood. Refused at the first step, nothing is written and the reply is the
 * rejection with the clock, as a command's.
 */
export type PresetReply = { ok: true; view: PlayerView; lines: ReportLine[]; clock: ClockView; stepped: number; trail: PresetStep[]; refusal?: Rejection } | (Rejection & { clock: ClockView }) | ServerRejection;

/** `GET /api/view`: the view, the lines since the client's last fetch are not kept (R-SERVER-019), and the clock. */
export type ViewReply = { ok: true; view: PlayerView; lines: ReportLine[]; clock: ClockView } | ServerRejection;

/** R-CLOCK-018, R-CLOCK-019: `GET /api/world`, the same for everyone, kept in the server's cache by its tick until the next tick (R-SERVER-039). Needs no session. */
export interface WorldReply {
  tick: number;
  world: World;
  nextTickAt: number;
}

/** `POST /api/character`: a new character for the account (R-ACCOUNT-015, R-SERVER-016). */
export interface NewCharacterRequest {
  scenario: Id<"scenario">;
}

/** `GET /api/place/:place/socket`: the nudge and presence socket, upgraded from this route (R-CLOCK-020, R-CLOCK-027, R-CLOCK-030). */
export interface PresenceReply {
  place: string;
  others: { name: string; look: string }[];
  today: { name: string; look: string }[];
}
