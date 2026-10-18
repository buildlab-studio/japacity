// The contract suites. Each takes a factory that returns an empty store, so
// the in-memory stores here and the Postgres stores in packages/db are held
// to the same tests. This entry imports Vitest: never import it from runtime code.
export { suiteForAccountStore } from "./account.contract";
export { suiteForAdvertStore } from "./advert.contract";
export { suiteForAuditStore } from "./audit.contract";
export { suiteForCounterStore } from "./counter.contract";
export { suiteForDeletionStore } from "./deletion.contract";
export { suiteForLedgerStore } from "./ledger.contract";
export { suiteForAppealStore, suiteForBannedIdentityStore, suiteForFeedbackStore, suiteForModerationLogStore } from "./moderation.contract";
export { suiteForNudgeBus } from "./nudge.contract";
export { suiteForPairStore } from "./pair.contract";
export type { PairStores } from "./pair.contract";
export { suiteForPlayerStore } from "./player.contract";
export { suiteForPresenceStore } from "./presence.contract";
export { suiteForPushStore } from "./push.contract";
export { suiteForWorldStore } from "./world.contract";
export { suiteForSwitchStore } from "./switches.contract";
export { suiteForConversationStore } from "./conversation.contract";
export { suiteForInviteStore } from "./invite.contract";
export { suiteForModerationStore } from "./report.contract";
export { suiteForBoardStore } from "./boards.contract";
export type { BoardStores } from "./boards.contract";
export { suiteForDedicationStore } from "./dedication.contract";
export type { DedicationStores } from "./dedication.contract";
export { DRAW_ODDS, logRow, must, newCharacter } from "./contract.testing";
