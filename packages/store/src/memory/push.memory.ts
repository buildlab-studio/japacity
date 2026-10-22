import { compareIds } from "../pairKeys";
import type { PushStore, PushSubscriptionJson } from "../types";
import { copy } from "./copy.memory";

/** clock:full-bank-push-notification: one entry per endpoint, naming the account that holds it. */
export function memoryPushStore(): PushStore {
  const rows = new Map<string, { account: string; subscription: PushSubscriptionJson }>();

  return {
    subscribe: (account, subscription) => {
      rows.set(subscription.endpoint, { account, subscription: copy(subscription) });
      return Promise.resolve();
    },
    unsubscribe: (account, endpoint) => {
      if (rows.get(endpoint)?.account === account) rows.delete(endpoint);
      return Promise.resolve();
    },
    forAccount: (account) =>
      Promise.resolve(
        copy(
          [...rows.values()]
            .filter((row) => row.account === account)
            .map((row) => row.subscription)
            .sort((x, y) => compareIds(x.endpoint, y.endpoint)),
        ),
      ),
    forget: (account) => {
      for (const [endpoint, row] of rows) if (row.account === account) rows.delete(endpoint);
      return Promise.resolve();
    },
  };
}
