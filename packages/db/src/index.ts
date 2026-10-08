// The Postgres implementations of the store interfaces. Tests reach PGlite
// through `@japacity/db/pglite`; nothing here imports it.
import type {
  AdvertStore,
  BoardStore,
  PushStore,
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
  pgAdvertStore,
  pgBoardStore,
  pgPushStore,
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
  pgAdvertStore,
  pgBoardStore,
  pgPushStore,
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
  push: PushStore;
  adverts: AdvertStore;
  moderationLog: ModerationLogStore;
  banned: BannedIdentityStore;
  appeals: AppealStore;
  feedback: FeedbackStore;
  boards: BoardStore;
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
    push: pgPushStore(handle),
    adverts: pgAdvertStore(handle),
    moderationLog: pgModerationLogStore(handle),
    banned: pgBannedIdentityStore(handle),
    appeals: pgAppealStore(handle),
    feedback: pgFeedbackStore(handle),
    boards: pgBoardStore(handle),
  };
}
