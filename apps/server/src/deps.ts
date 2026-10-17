// What every route and job is given: the stores, the config, the clock and
// the random bytes, all passed in so a test can replace each.
import type { Content } from "@japacity/sim";
import type {
  AccountStore,
  AppealStore,
  AdvertStore,
  AuditStore,
  BoardStore,
  CounterStore,
  BannedIdentityStore,
  DedicationStore,
  DeletionStore,
  FeedbackStore,
  LedgerStore,
  ModerationLogStore,
  ConversationStore,
  InviteStore,
  ModerationStore,
  NudgeBus,
  PairStore,
  PlayerStore,
  PresenceStore,
  SwitchStore,
  PushStore,
  WorldStore,
} from "@japacity/store";
import {
  memoryAccountStore,
  memoryAppealStore,
  memoryAdvertStore,
  memoryAuditStore,
  memoryBoardStore,
  memoryCounterStore,
  memoryBannedIdentityStore,
  memoryDedicationStore,
  memoryDeletionStore,
  memoryFeedbackStore,
  memoryLedgerStore,
  memoryModerationLogStore,
  memoryConversationStore,
  memoryInviteStore,
  memoryModerationStore,
  memoryNudgeBus,
  memoryPlayerStores,
  memoryPresenceStore,
  memorySwitchStore,
  memoryPushStore,
  memoryWorldStore,
} from "@japacity/store";

import type { ServerConfig } from "./config";

export interface Stores {
  player: PlayerStore;
  pair: PairStore;
  world: WorldStore;
  presence: PresenceStore;
  nudges: NudgeBus;
  account: AccountStore;
  deletion: DeletionStore;
  ledger: LedgerStore;
  audit: AuditStore;
  switches: SwitchStore;
  counters: CounterStore;
  moderationLog: ModerationLogStore;
  banned: BannedIdentityStore;
  appeals: AppealStore;
  feedback: FeedbackStore;
  invite: InviteStore;
  conversation: ConversationStore;
  moderation: ModerationStore;
  push: PushStore;
  adverts: AdvertStore;
  /** city.md R-CITY-039, R-CITY-040. */
  boards: BoardStore;
  /** server.md R-SERVER-045, the dedication's lights. */
  dedication: DedicationStore;
}

/** R-SERVER-023, R-SERVER-024: the contents a segment may name, with any overlay already applied (R-SERVER-016). */
export interface Contents {
  current: Content;
  /** A second content a segment may name: the public one under an overlay (`contentsFor`), so a segment run without it replays; null with none. */
  previous: Content | null;
  /**
   * R-SERVER-023: the older content versions, still bundled so a life saved under one replays and is upgraded on its
   * first load (`withContentBefore`). Missing: none.
   */
  older?: readonly Content[];
}

/** R-SERVER-015, R-SERVER-016: the secrets of the deployment. Never in a reply. */
export interface Secrets {
  worldSeed: string;
  /** The salt of the banned identities' hashes (R-MODERATION-012) and the HMAC key of the draw tokens (R-SERVER-015, 016). */
  banSalt: string;
  drawTokenKey: string;
}

/** R-SERVER-028: the shape of Cloudflare's rate-limit binding, so a memory limiter and the binding are used alike. */
export interface Limiter {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

/** R-SERVER-025 to 027: one limiter per limit, each counting its own period. */
export interface Limiters {
  commands10s: Limiter;
  commands60s: Limiter;
  reads60s: Limiter;
  anon60s: Limiter;
  socket10s: Limiter;
}

/**
 * Who sent a request: the signed-in account and whether its session was opened
 * with a passkey (R-MODERATION-012), or null. The auth module provides it;
 * tests hand in a stand-in.
 */
export type SessionReader = (request: Request) => Promise<{ account: string; passkey: boolean } | null>;

export interface ServerDeps {
  config: ServerConfig;
  stores: Stores;
  contents: Contents;
  secrets: Secrets;
  limits: Limiters;
  session: SessionReader;
  /** Milliseconds since 1970. Injected so a test can move time. */
  now: () => number;
  /** R-SERVER-016: cryptographically secure bytes. */
  randomBytes: (count: number) => Uint8Array;
}

/** A limiter that never refuses, for tests that are not about limits. */
const openLimiter: Limiter = { limit: () => Promise.resolve({ success: true }) };

export const openLimiters: Limiters = {
  commands10s: openLimiter,
  commands60s: openLimiter,
  reads60s: openLimiter,
  anon60s: openLimiter,
  socket10s: openLimiter,
};

/** How a test session says it was opened, as the auth module records it (auth/session.ts); a passkey when absent. */
export const TEST_SIGNED_IN_WITH = "x-test-signed-in-with";

/**
 * R-ACCOUNT-005: the test server's session, from the `x-test-account` header,
 * read only while `testing.testLogin` is on. Production refuses every request
 * through it.
 */
export function testSession(config: ServerConfig): SessionReader {
  return (request) => {
    if (!config.testing.testLogin) return Promise.resolve(null);
    const account = request.headers.get("x-test-account");
    const passkey = (request.headers.get(TEST_SIGNED_IN_WITH) ?? "passkey") === "passkey";
    return Promise.resolve(account === null || account === "" ? null : { account, passkey });
  };
}

export function memoryStores(): Stores {
  const world = memoryWorldStore();
  const audit = memoryAuditStore();
  // R-SERVER-002: a transaction's work is given the same world and audit stores the server holds.
  const { player, pair } = memoryPlayerStores({ world, audit });
  return {
    player,
    pair,
    world,
    presence: memoryPresenceStore(),
    nudges: memoryNudgeBus(),
    account: memoryAccountStore(),
    deletion: memoryDeletionStore(),
    ledger: memoryLedgerStore(),
    audit,
    switches: memorySwitchStore(),
    counters: memoryCounterStore(),
    moderationLog: memoryModerationLogStore(),
    banned: memoryBannedIdentityStore(),
    appeals: memoryAppealStore(),
    feedback: memoryFeedbackStore(),
    invite: memoryInviteStore(),
    conversation: memoryConversationStore(),
    moderation: memoryModerationStore(),
    push: memoryPushStore(),
    adverts: memoryAdvertStore(),
    boards: memoryBoardStore(),
    dedication: memoryDedicationStore(),
  };
}

export function webRandomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bytes;
}
