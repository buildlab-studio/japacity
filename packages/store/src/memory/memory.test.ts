// The in-memory stores, held to the contract every store keeps.
import {
  suiteForAccountStore,
  suiteForAuditStore,
  suiteForDeletionStore,
  suiteForLedgerStore,
  suiteForNudgeBus,
  suiteForPairStore,
  suiteForPlayerStore,
  suiteForPresenceStore,
  suiteForPushStore,
  suiteForWorldStore,
} from "../contract";
import {
  memoryAccountStore,
  memoryAuditStore,
  memoryDeletionStore,
  memoryLedgerStore,
  memoryNudgeBus,
  memoryPlayerStores,
  memoryPresenceStore,
  memoryPushStore,
  memoryWorldStore,
} from ".";

suiteForPlayerStore(() => Promise.resolve(memoryPlayerStores().player));
suiteForPairStore(() => Promise.resolve(memoryPlayerStores()));
suiteForWorldStore(() => Promise.resolve(memoryWorldStore()));
suiteForPresenceStore(() => Promise.resolve(memoryPresenceStore()));
suiteForPushStore(() => Promise.resolve(memoryPushStore()));
suiteForNudgeBus(() => Promise.resolve(memoryNudgeBus()));
suiteForAccountStore(() => Promise.resolve(memoryAccountStore()));
suiteForDeletionStore(() => Promise.resolve(memoryDeletionStore()));
suiteForLedgerStore(() => Promise.resolve(memoryLedgerStore()));
suiteForAuditStore(() => Promise.resolve(memoryAuditStore()));
