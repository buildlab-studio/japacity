// The contract suites. Each takes a factory that returns an empty store, so
// the in-memory stores here and the Postgres stores in packages/db are held
// to the same tests. This entry imports Vitest: never import it from runtime code.
export { suiteForAccountStore } from "./account.contract";
export { suiteForAuditStore } from "./audit.contract";
export { suiteForCounterStore } from "./counter.contract";
export { suiteForDeletionStore } from "./deletion.contract";
export { suiteForLedgerStore } from "./ledger.contract";
export { suiteForNudgeBus } from "./nudge.contract";
export { suiteForPairStore } from "./pair.contract";
export type { PairStores } from "./pair.contract";
export { suiteForPlayerStore } from "./player.contract";
export { suiteForPresenceStore } from "./presence.contract";
export { suiteForWorldStore } from "./world.contract";
export { suiteForSwitchStore } from "./switches.contract";
