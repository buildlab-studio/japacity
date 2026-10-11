// The in-memory stores, held to the contract every store keeps.
import {
  suiteForAccountStore,
  suiteForAuditStore,
  suiteForCounterStore,
  suiteForDeletionStore,
  suiteForLedgerStore,
  suiteForNudgeBus,
  suiteForPairStore,
  suiteForPlayerStore,
  suiteForPresenceStore,
  suiteForSwitchStore,
  suiteForPushStore,
  suiteForWorldStore,
} from "../contract";
import {
  memoryAccountStore,
  memoryAuditStore,
  memoryCounterStore,
  memoryDeletionStore,
  memoryLedgerStore,
  memoryNudgeBus,
  memoryPlayerStores,
  memoryPresenceStore,
  memorySwitchStore,
  memoryPushStore,
  memoryWorldStore,
} from ".";

/** R-SERVER-002: the stores a transaction's work is given, fresh beside each player store. */
const besides = () => ({ world: memoryWorldStore(), audit: memoryAuditStore() });

suiteForPlayerStore(() => Promise.resolve(memoryPlayerStores(besides()).player));
suiteForPairStore(() => Promise.resolve(memoryPlayerStores(besides())));
suiteForWorldStore(() => Promise.resolve(memoryWorldStore()));
suiteForPresenceStore(() => Promise.resolve(memoryPresenceStore()));
suiteForPushStore(() => Promise.resolve(memoryPushStore()));
suiteForNudgeBus(() => Promise.resolve(memoryNudgeBus()));
suiteForAccountStore(() => Promise.resolve(memoryAccountStore()));
suiteForDeletionStore(() => Promise.resolve(memoryDeletionStore()));
suiteForLedgerStore(() => Promise.resolve(memoryLedgerStore()));
suiteForAuditStore(() => Promise.resolve(memoryAuditStore()));
suiteForSwitchStore(() => Promise.resolve(memorySwitchStore()));
suiteForCounterStore(() => Promise.resolve(memoryCounterStore()));
