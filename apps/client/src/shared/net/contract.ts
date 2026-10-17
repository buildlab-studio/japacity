import type { WorldClock } from "@japacity/sim";
// The HTTP contract between the client and the server, copied from the
// server's files (and the Nudge of packages/store/src/types.ts), because the
// client imports nothing from the server's side (decision 0004,
// tests/boundaries.test.ts). Each copy names its source; contract.test.ts
// holds every copy to its source's declaration, comments aside.
import type { Command, ConversationRow, Id, InviteCard, LotteryOdds, LotteryResult, PairView, PlayerView, PrologueSlice, Rejection, RejectionCode, Reply, ReportLine, World } from "@japacity/sim";

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
  /** R-REGION: the two players' regions do not allow the pair (R-PAIR-018). */
  | "region"
  /** account.md: the age screen and the bot check. */
  | "under-age"
  | "bad-date"
  | "bot-check"
  | "not-fresh"
  | "bad-code"
  // pair.md R-PAIR-008, 013; moderation.md R-MODERATION-001.
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
 * Copied from apps/server/src/types.ts. `retryAfter` is in seconds: with
 * `rate-limited` (R-SERVER-025), and with `switched-off`, whose 503 also sets
 * it (switches/switches.ts `switchedOff`, R-SERVER-032).
 */
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
  /** R-CLOCK-032: when the next sealed result opens: the world's next morning (decision 0036). */
  morningAt: number;
  /** R-CLOCK-033: the world's own clock, the same for everyone. */
  world: WorldClock;
}

/** Copied from apps/server/src/types.ts. */
export type ServerReply = (Reply & { clock: ClockView }) | ServerRejection;

/** Copied from apps/server/src/types.ts: `POST /api/command` (R-SERVER-001). */
export interface CommandRequest {
  command: Command;
  basedOn: number;
}

/** Copied from apps/server/src/types.ts: `POST /api/prologue/preset` (R-SERVER-046), the age step and home chosen at the door. */
export interface PresetRequest {
  archetype: string;
  age: number;
  home: string;
  basedOn: number;
}

/** Copied from apps/server/src/types.ts: one step the preset played, for the page's trail (R-PROLOGUE-014). */
export interface PresetStep {
  step: string;
  answer: string;
  draw: PrologueSlice["draw"];
  outcome: string | null;
}

/** Copied from apps/server/src/types.ts: the view after the last step, the trail, and `refusal` when an answer was refused after some steps stood. */
export type PresetReply = { ok: true; view: PlayerView; lines: ReportLine[]; clock: ClockView; stepped: number; trail: PresetStep[]; refusal?: Rejection } | (Rejection & { clock: ClockView }) | ServerRejection;

/** Copied from apps/server/src/types.ts: `GET /api/view`, with `?since=<version>` for the authority's lines after it. */
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

/** Copied from apps/server/src/types.ts: `GET /api/place/:place`, the presence sample (R-CLOCK-028) and some seen there today (R-CITY-036). */
export interface PresenceReply {
  place: string;
  others: { name: string; look: string }[];
  today: { name: string; look: string }[];
}

/** Copied from packages/store/src/types.ts (R-CLOCK-020). */
export type Nudge = { nudge: "view"; v: number } | { nudge: "messages" } | { nudge: "presence" };

/** Read from apps/server/src/authority/character.ts `newCharacter`: `POST /api/character` answers like `GET /api/view`. */
export type NewCharacterReply = ViewReply;

/** Read from apps/server/src/place/: the text a client pings with on the socket, answered by the server's automatic reply (R-CLOCK-024). */
export const PING = "ping";

// ---------------------------------------------------------------------------
// The age screen (account.md R-ACCOUNT-011 to 013).
// ---------------------------------------------------------------------------

/** Copied from apps/server/src/routes/age.ts: the body of `POST /api/age`. */
export interface AgeRequest {
  dateOfBirth: string;
}

/** Read from apps/server/src/routes/age.ts: a pass, or `region-closed`, `under-age`, `bad-date`, and `switched-off` while sign-ups are off. */
export type AgeReply = { ok: true } | ServerRejection;

/** Copied from apps/server/src/routes/age.ts: `GET /api/age`, whether this browser was refused at the age screen and must not be asked again (R-ACCOUNT-012). */
export interface AgeStatus {
  refused: boolean;
}

// ---------------------------------------------------------------------------
// The account (account.md R-ACCOUNT-015, 016; analytics.md R-ANALYTICS-006).
// ---------------------------------------------------------------------------

/**
 * Copied from apps/server/src/routes/account.ts: `GET /api/account`, the
 * account as its owner sees it (R-ACCOUNT-015), with the usage setting
 * (R-ANALYTICS-006) and the admin mark (R-MODERATION-012).
 */
export interface AccountView {
  id: string;
  country: string;
  age: { passed: boolean; method: "declared" | "verified" };
  createdAt: number;
  character: string | null;
  /** R-ANALYTICS-006: the "Send usage counts" setting. */
  sendUsageCounts: boolean;
  /** R-MODERATION-012: the account is on `config.admin.accounts` and the session was opened with a passkey, so the client mounts the admin page. */
  admin: boolean;
  /** R-ACCOUNT-021: a guest's life lives only in this browser until it is secured. */
  state: "guest" | "secured";
  /** R-ACCOUNT-024. */
  username: string;
  /** R-ACCOUNT-024: from when the username may change; 0 while the free change is unused. */
  renameFrom: number;
  /** R-ACCOUNT-027: the address Google gave where Google is linked, the address a code goes to, the passkeys held; none for a guest. */
  ways: { google: string | null; email: string | null; passkeys: number };
}

/** Copied from apps/server/src/routes/account.ts: the body of `POST /api/guest`; the Turnstile token goes in the `x-captcha-response` header (R-ACCOUNT-013). */
export interface GuestRequest {
  username: string;
}

/** Copied from apps/server/src/routes/account.ts: the body of `PUT /api/account/username`. */
export interface UsernameRequest {
  username: string;
}

/** Copied from apps/server/src/account/username.ts: why a username was refused; `taken` and `wait` come from the store and the clock. */
export type NameProblem = "format" | "reserved" | "blocked" | "taken" | "wait";

/** As apps/server/src/routes/account.ts answers `POST /api/guest` and `PUT /api/account/username`: a refused username says why. */
export type NameReply = { ok: true; account: AccountView } | (ServerRejection & { name?: NameProblem });

/** Copied from apps/server/src/routes/account.ts: `GET /api/account` and `PUT /api/account` answer the row. */
export type AccountReply = { ok: true; account: AccountView } | ServerRejection;

/** Copied from apps/server/src/routes/account.ts: the body of `PUT /api/account` (R-ANALYTICS-006). */
export interface AccountChange {
  sendUsageCounts: boolean;
}

/** The client's earlier name for the change body. */
export type AccountSettingsRequest = AccountChange;

/** Copied from apps/server/src/routes/account.ts: the body of `DELETE /api/account`; `code` is an email code sent with type `sign-in`, needed once the session is not fresh. */
export interface DeleteRequest {
  code?: string;
}

/** As apps/server/src/routes/account.ts answers `DELETE /api/account` (R-ACCOUNT-016); `dueAt`: the removal of R-ACCOUNT-017 happens by then. Its refusals are `not-fresh`, `bad-code` and `signed-out`. */
export type DeleteReply = { ok: true; dueAt: number } | ServerRejection;

// ---------------------------------------------------------------------------
// People: invite links, pairs, conversations, block and report (pair.md,
// moderation.md). Every refusal is a ServerRejection: the pair routes' codes
// (apps/server/src/pair/codes.ts PairCode) are all in ServerCode.
// ---------------------------------------------------------------------------

/** Read from apps/server/src/pair/invite.ts `makeInvite`: the body of `POST /api/invite`. */
export interface InviteRequest {
  slot: string;
}

/** Copied from apps/server/src/pair/invite.ts: `POST /api/invite`, the link made for a card. */
export interface InviteMade {
  ok: true;
  code: string;
  slot: string;
  expires: number;
  card: InviteCard;
}

/** Copied from apps/server/src/pair/invite.ts: `GET /api/invite/:code`, what the link shows, before sign-up. */
export interface InviteShown {
  ok: true;
  slot: string;
  looking: "partner" | "sibling";
  expires: number;
  card: InviteCard;
}

/** Copied from apps/server/src/pair/invite.ts: `POST /api/invite/:code/accept`, the pair made, as the friend sees it. */
export interface InviteAccepted {
  ok: true;
  pair: string;
  character: string;
  view: PairView | null;
}

/** Read from apps/server/src/pair/invite.ts `acceptInvite`: the slot the card offers, and the scenario when the friend needs a new character. */
export interface AcceptRequest {
  slot: string;
  scenario?: Id<"scenario">;
}

export type InviteReply = InviteMade | ServerRejection;
export type InviteShownReply = InviteShown | ServerRejection;
export type AcceptReply = InviteAccepted | ServerRejection;

/** Copied from apps/server/src/pair/conversation.ts: `GET /api/pair/:pair`. */
export interface PairRead {
  ok: true;
  pair: PairView;
}

/** Copied from apps/server/src/pair/conversation.ts: `POST /api/pair/:pair/say`. */
export interface Said {
  ok: true;
  message: ConversationRow;
}

/** Copied from apps/server/src/pair/conversation.ts: `GET /api/pair/:pair/conversation?after=`. */
export interface ConversationRead {
  ok: true;
  pair: string;
  messages: ConversationRow[];
}

/** Read from apps/server/src/pair/conversation.ts `say`: the phrase and its fill-in, when it has one. */
export interface SayRequest {
  phrase: Id<"phrase">;
  fill?: string;
}

export type PairReply = PairRead | ServerRejection;
/** A refused phrase names only the check that failed, as its code (R-PAIR-013). */
export type SayReply = Said | ServerRejection;
export type ConversationReply = ConversationRead | ServerRejection;

/** Copied from apps/server/src/pair/moderation.ts: `POST /api/moderation/block` and `/unblock`. */
export interface Blocked {
  ok: true;
}

/** Copied from apps/server/src/pair/moderation.ts: `POST /api/moderation/report`, received at once (R-MODERATION-007). */
export interface Reported {
  ok: true;
  report: string;
}

/** Read from apps/server/src/pair/moderation.ts `block`: the other player named by the pair the two share, or by their character. */
export type BlockRequest = { pair: string } | { character: string };

/** Copied from apps/server/src/moderation/reports.ts (R-MODERATION-004). */
export const REPORT_REASONS = ["scam", "harassment", "impersonation", "underage", "sexual", "hate", "self-harm", "illegal", "cheating", "advert", "other"] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** Read from apps/server/src/pair/moderation.ts `report`: a pair, and from a conversation its message ids; a block in the same step (R-PAIR-016, R-MODERATION-006). */
export interface PairReportRequest {
  pair: string;
  reason: ReportReason;
  messages?: string[];
  block?: boolean;
}

/** Copied from apps/server/src/moderation/reports.ts: what a report cites (R-MODERATION-004). */
export type ReportCite =
  | { messages: string[] }
  | { place: string; phrase: string; at: number }
  | { card: string }
  | { pair: string }
  | { campaign: string; slot: string };

/** Copied from apps/server/src/moderation/reports.ts. */
export type ReportSubject = { account: string } | { campaign: string };

/**
 * Read from apps/server/src/moderation/reports.ts `readReport`: the cite form of
 * `POST /api/moderation/report`, for a report that cites no pair (an advert, a
 * card, a phrase heard in a place). `subject` is left out for a card, whose
 * inviter the server finds from the code, and for a phrase heard in a place.
 */
export interface CiteReportRequest {
  subject?: ReportSubject;
  reason: ReportReason;
  cites: ReportCite;
}

export type BlockReply = Blocked | ServerRejection;
export type ReportReply = Reported | ServerRejection;

// ---------------------------------------------------------------------------
// The lottery (lottery.md R-LOTTERY-007, 008, 015).
// ---------------------------------------------------------------------------

/** Copied from apps/server/src/routes/draw.ts: `GET /api/draw/:n`, no session. */
export interface DrawReply {
  draw: number;
  closesTick: number;
  closesAt: number;
  fingerprint: string;
  beaconRound: number;
  /** R-LOTTERY-021, R-LOTTERY-012: the odds and the jackpot fixed when the draw opened. */
  odds: LotteryOdds;
  jackpot: number;
  list: string[] | null;
  count: number | null;
  listHash: string | null;
  result: LotteryResult | null;
}
