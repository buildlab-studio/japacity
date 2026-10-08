// The Postgres implementations of the store interfaces. Tests reach PGlite
// through `@japacity/db/pglite`; nothing here imports it.
import type { AccountStore, AdvertStore, AuditStore, DeletionStore, LedgerStore, PairStore, PlayerStore, WorldStore } from "@japacity/store";

import type { Handle } from "./handle";
import { pgAccountStore, pgAdvertStore, pgAuditStore, pgDeletionStore, pgLedgerStore, pgPlayerStores, pgWorldStore } from "./stores";

export { type Connection, connect } from "./connect";
export { type Handle, oneConnection, type Queries } from "./handle";
export * as schema from "./schema";
export { pgAccountStore, pgAdvertStore, pgAuditStore, pgDeletionStore, pgLedgerStore, pgPlayerStores, pgWorldStore } from "./stores";

export interface PgStores {
  player: PlayerStore;
  pair: PairStore;
  world: WorldStore;
  account: AccountStore;
  deletion: DeletionStore;
  ledger: LedgerStore;
  audit: AuditStore;
  adverts: AdvertStore;
}

/** Every Postgres store over one handle, as the server builds them for one request. */
export function pgStores(handle: Handle): PgStores {
  const { player, pair } = pgPlayerStores(handle);
  return {
    player,
    pair,
    world: pgWorldStore(handle),
    account: pgAccountStore(handle),
    deletion: pgDeletionStore(handle),
    ledger: pgLedgerStore(handle),
    audit: pgAuditStore(handle),
    adverts: pgAdvertStore(handle),
  };
}
