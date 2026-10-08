import type { NudgeBus, NudgeHandler } from "../types";

/** R-CLOCK-020, R-CLOCK-022: a list of handlers per account. */
export function memoryNudgeBus(): NudgeBus {
  const handlers = new Map<string, NudgeHandler[]>();

  return {
    send: (account, nudge) => {
      for (const handler of handlers.get(account) ?? []) {
        // Best effort: one broken socket must not keep a nudge from the others.
        try {
          handler({ ...nudge });
        } catch {
          continue;
        }
      }
      return Promise.resolve();
    },
    subscribe: (account, handler) => {
      // A wrapper per subscription, so the same handler subscribed twice ends one at a time.
      const entry: NudgeHandler = (nudge) => handler(nudge);
      handlers.set(account, [...(handlers.get(account) ?? []), entry]);
      return () => {
        const left = (handlers.get(account) ?? []).filter((each) => each !== entry);
        if (left.length === 0) handlers.delete(account);
        else handlers.set(account, left);
      };
    },
  };
}
