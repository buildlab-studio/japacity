// The server's reply and clock types (docs/rules/server.md contract item 5,
// docs/rules/clock.md contract items 3 and 4). This file is kept by hand.
import type { Command, Id, PlayerView, RejectionCode, Reply, ReportLine, World } from "@japacity/sim";
import type { Nudge } from "@japacity/store";

export type { Nudge };

/** R-SERVER-025, R-ACCOUNT-011, R-ACCOUNT-015: the server's own refusals beside the simulation's. */
export type ServerCode =
  | RejectionCode
  | "rate-limited"
  | "signed-out"
  | "diverged"
  | "region-closed"
  | "one-character"
  | "no-character";

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

/** `GET /api/view`: the view, the lines since the client's last fetch are not kept (R-SERVER-019), and the clock. */
export type ViewReply = { ok: true; view: PlayerView; lines: ReportLine[]; clock: ClockView } | ServerRejection;

/** R-CLOCK-018, R-CLOCK-019: `GET /api/world`, the same for everyone, cached at the edge until the next tick. Needs no session. */
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
}
