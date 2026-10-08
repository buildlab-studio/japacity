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

export interface ServerDeps {
  config: ServerConfig;
  stores: Stores;
  contents: Contents;
  secrets: Secrets;
  /** Milliseconds since 1970. Injected so a test can move time. */
  now: () => number;
  /** R-SERVER-016: cryptographically secure bytes. */
  randomBytes: (count: number) => Uint8Array;
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
  };
}

export function webRandomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bytes;
}
