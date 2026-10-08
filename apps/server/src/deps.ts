// What every route and job is given: the stores, the config, the clock and
// the random bytes, all passed in so a test can replace each. Kept by hand:
// this file; a kind that needs a field says so in its report.
import type { Content } from "@japacity/sim";
import type {
  AccountStore,
  AuditStore,
  DeletionStore,
  LedgerStore,
  NudgeBus,
  PairStore,
  PlayerStore,
  PresenceStore,
  SwitchStore,
  WorldStore,
} from "@japacity/store";
import {
  memoryAccountStore,
  memoryAuditStore,
  memoryDeletionStore,
  memoryLedgerStore,
  memoryNudgeBus,
  memoryPlayerStores,
  memoryPresenceStore,
  memorySwitchStore,
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
}

/** R-SERVER-023: the current content and the one before, with any overlay already applied (R-SERVER-016). */
export interface Contents {
  current: Content;
  previous: Content | null;
}

/** R-SERVER-015, R-SERVER-016: the secrets of the deployment. Never in a reply. */
export interface Secrets {
  worldSeed: string;
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

/** Who sent a request: the signed-in account, or null. The auth module provides it; tests hand in a stand-in. */
export type SessionReader = (request: Request) => Promise<{ account: string } | null>;

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
export const openLimiter: Limiter = { limit: () => Promise.resolve({ success: true }) };

export const openLimiters: Limiters = {
  commands10s: openLimiter,
  commands60s: openLimiter,
  reads60s: openLimiter,
  anon60s: openLimiter,
  socket10s: openLimiter,
};

/**
 * R-ACCOUNT-005: the test server's session, from the `x-test-account` header,
 * read only while `testing.testLogin` is on. Production refuses every request
 * through it.
 */
export function testSession(config: ServerConfig): SessionReader {
  return (request) => {
    if (!config.testing.testLogin) return Promise.resolve(null);
    const account = request.headers.get("x-test-account");
    return Promise.resolve(account === null || account === "" ? null : { account });
  };
}

export function memoryStores(): Stores {
  const { player, pair } = memoryPlayerStores();
  return {
    player,
    pair,
    world: memoryWorldStore(),
    presence: memoryPresenceStore(),
    nudges: memoryNudgeBus(),
    account: memoryAccountStore(),
    deletion: memoryDeletionStore(),
    ledger: memoryLedgerStore(),
    audit: memoryAuditStore(),
    switches: memorySwitchStore(),
  };
}

export function webRandomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bytes;
}
