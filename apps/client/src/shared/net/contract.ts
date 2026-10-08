// The HTTP contract between the client and the server, copied from
// apps/server/src/types.ts (and the Nudge of packages/store/src/types.ts),
// because the client imports nothing from the server's side (decision 0004,
// tests/boundaries.test.ts). Keep each copy the same as its source.
import type { Command, ConversationRow, Id, PlayerView, RejectionCode, Reply, ReportLine, SayRefusal, World } from "@japacity/sim";

/** Copied from apps/server/src/types.ts: the server's own refusals beside the simulation's. */
export type ServerCode =
  | RejectionCode
  | "rate-limited"
  | "signed-out"
  | "diverged"
  | "region-closed"
  | "one-character"
  | "no-character"
  /** R-SERVER-031: the feature's switch is off. */
  | "switched-off"
  /** The two players' regions do not allow the pair (R-PAIR-018). */
  | "region";

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

// ---------------------------------------------------------------------------
// Assumed for people (docs/rules/pair.md, moderation.md), ahead of the server's
// routes. The paths are the ones the server's people brief names; the bodies
// and replies are the client's reading, for the maintainer to hold both sides to.
// ---------------------------------------------------------------------------

/** Assumed: `POST /api/invite` makes the single-use link for the card the character's `people/invite` put on `slot` (R-PAIR-008). */
export interface InviteRequest {
  slot: string;
}

/** Assumed: the answer to `POST /api/invite`. `expires` is milliseconds since 1970, the server's clock. */
export type InviteReply = { ok: true; code: string; expires: number } | ServerRejection;

/**
 * Assumed: `GET /api/pairs` names the pair record each of the reader's bonds
 * with a player rests on, because the view carries the bond's id and not its pair.
 */
export type PairsReply = { ok: true; pairs: { bond: string; pair: string }[] } | ServerRejection;

/** Assumed: `POST /api/pair/:pair/say` stores one phrase in the pair's conversation (R-PAIR-011, R-PAIR-013). */
export interface SayRequest {
  phrase: Id<"phrase">;
  fill: string | null;
}

/** Assumed: a refused phrase names the check that failed and nothing about the other side (R-PAIR-013). */
export type SayReply = { ok: true; row: ConversationRow } | (ServerRejection & { failed?: SayRefusal });

/**
 * Assumed: `GET /api/pair/:pair/conversation?after=<row id>` gives the rows after
 * the one named, oldest first, and marks the reader's incoming rows read.
 * `me` is the reader's character id, so the client can tell its own rows.
 */
export type ConversationReply = { ok: true; me: string; rows: ConversationRow[] } | ServerRejection;

/** Copied from docs/rules/moderation.md R-MODERATION-004: why a player is reported. `advert` is for adverts only. */
export type ReportReason = "scam" | "harassment" | "impersonation" | "underage" | "sexual" | "hate" | "self-harm" | "illegal" | "cheating" | "other";

/** Assumed: `POST /api/moderation/block` blocks the other side of a pair (R-PAIR-015, R-MODERATION-001). */
export interface BlockRequest {
  pair: string;
}

/** Assumed: `POST /api/moderation/report` cites the pair and, from a conversation, its message ids, and may block in the same step (R-PAIR-016, R-MODERATION-006). */
export interface ReportRequest {
  pair: string;
  reason: ReportReason;
  messages: string[];
  block: boolean;
}

/** Assumed: the answer to a block or a report. */
export type ModerationReply = { ok: true } | ServerRejection;
