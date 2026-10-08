// The HTTP contract between the client and the server, copied from
// apps/server/src/types.ts (and the Nudge of packages/store/src/types.ts),
// because the client imports nothing from the server's side (decision 0004,
// tests/boundaries.test.ts). Keep each copy the same as its source.
import type { Command, Id, PlayerView, RejectionCode, Reply, ReportLine, World } from "@japacity/sim";

/** Copied from apps/server/src/types.ts: the server's own refusals beside the simulation's. */
export type ServerCode =
  | RejectionCode
  | "rate-limited"
  | "signed-out"
  | "diverged"
  | "region-closed"
  | "one-character"
  | "no-character";

/** Copied from apps/server/src/types.ts. `retryAfter` is in seconds, with `rate-limited` only (R-SERVER-025). */
export interface ServerRejection {
  ok: false;
  code: ServerCode;
  detail: string;
  retryAfter?: number;
}

/** Copied from apps/server/src/types.ts (R-CLOCK-003): milliseconds since 1970, all set by the server. */
export interface ClockView {
  tick: number;
  nextTickAt: number;
  /** Null while the bank is full. */
  nextTurnAt: number | null;
}

/** Copied from apps/server/src/types.ts. */
export type ServerReply = (Reply & { clock: ClockView }) | ServerRejection;

/** Copied from apps/server/src/types.ts: `POST /api/command` (R-SERVER-001). */
export interface CommandRequest {
  command: Command;
  basedOn: number;
}

/** Copied from apps/server/src/types.ts: `GET /api/view`. */
export type ViewReply = { ok: true; view: PlayerView; lines: ReportLine[]; clock: ClockView } | ServerRejection;

/** Copied from apps/server/src/types.ts: `GET /api/world` (R-CLOCK-018, R-CLOCK-019). Needs no session. */
export interface WorldReply {
  tick: number;
  world: World;
  nextTickAt: number;
}

/** Copied from apps/server/src/types.ts: `POST /api/character` (R-ACCOUNT-015). */
export interface NewCharacterRequest {
  scenario: Id<"scenario">;
}

/** Copied from apps/server/src/types.ts: what the place's presence fetch answers. */
export interface PresenceReply {
  place: string;
  others: { name: string; look: string }[];
}

/** Copied from packages/store/src/types.ts (R-CLOCK-020). */
export type Nudge = { nudge: "view"; v: number } | { nudge: "messages" } | { nudge: "presence" };

// ---------------------------------------------------------------------------
// Assumed beyond apps/server/src/types.ts. The server is held to these
// or changes both sides together.
// ---------------------------------------------------------------------------

/** Assumed: `POST /api/character` answers like `GET /api/view`. */
export type NewCharacterReply = ViewReply;

/**
 * Assumed: `GET /api/age` (no session) says where this browser stands with the
 * age screen, read from the server's own cookies (R-ACCOUNT-012), or refuses
 * with `region-closed` (R-ACCOUNT-011).
 */
export type AgeStatusReply = { ok: true; age: "unasked" | "passed" | "refused" } | ServerRejection;

/** Assumed: `POST /api/age` (no session). The date as `YYYY-MM-DD`; the server decides and keeps no date of birth. */
export interface AgeRequest {
  birth: string;
}

/** Assumed: the answer to `POST /api/age`. `refused` also sets the server's 30-day cookie. */
export type AgeReply = { ok: true; age: "passed" | "refused" } | ServerRejection;

/** Assumed: the text a client pings with on the socket, answered by the server's automatic reply (R-CLOCK-024). */
export const PING = "ping";
