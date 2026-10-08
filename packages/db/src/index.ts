// The Postgres implementations of the store interfaces. Tests reach PGlite
// through `@japacity/db/pglite`; nothing here imports it.
import type {
  ConversationStore,
  InviteStore,
  ModerationStore,
  SwitchStore,
  AccountStore,
  AppealStore,
  AuditStore,
  BannedIdentityStore,
  DeletionStore,
  FeedbackStore,
  LedgerStore,
  ModerationLogStore,
  PairStore,
  PlayerStore,
  WorldStore,
} from "@japacity/store";

import type { Handle } from "./handle";
import {
  pgConversationStore,
  pgInviteStore,
  pgModerationStore,
  pgSwitchStore,
  pgAccountStore,
  pgAppealStore,
  pgAuditStore,
  pgBannedIdentityStore,
  pgDeletionStore,
  pgFeedbackStore,
  pgLedgerStore,
  pgModerationLogStore,
  pgPlayerStores,
  pgWorldStore,
} from "./stores";

export { type Connection, connect } from "./connect";
export { type Handle, oneConnection, type Queries } from "./handle";
export * as schema from "./schema";
export {
  pgConversationStore,
  pgInviteStore,
  pgModerationStore,
  pgSwitchStore,
  pgCounterStore,
  pgDayLog,
  pgAccountStore,
  pgAppealStore,
  pgAuditStore,
  pgBannedIdentityStore,
  pgDeletionStore,
  pgFeedbackStore,
  pgLedgerStore,
  pgModerationLogStore,
  pgPlayerStores,
  pgWorldStore,
} from "./stores";

export interface PgStores {
  player: PlayerStore;
  pair: PairStore;
  world: WorldStore;
  account: AccountStore;
  deletion: DeletionStore;
  ledger: LedgerStore;
  audit: AuditStore;
  switches: SwitchStore;
  invite: InviteStore;
  conversation: ConversationStore;
  moderation: ModerationStore;
  moderationLog: ModerationLogStore;
  banned: BannedIdentityStore;
  appeals: AppealStore;
  feedback: FeedbackStore;
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
    switches: pgSwitchStore(handle),
    invite: pgInviteStore(handle),
    conversation: pgConversationStore(handle),
    moderation: pgModerationStore(handle),
    moderationLog: pgModerationLogStore(handle),
    banned: pgBannedIdentityStore(handle),
    appeals: pgAppealStore(handle),
    feedback: pgFeedbackStore(handle),
  };
}
