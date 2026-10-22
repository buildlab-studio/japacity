// analytics:nightly-game-counters: the day's log while the server runs on the memory stores.
// The memory stores cannot list characters or accounts, so the
// active characters are the ones the money job's isolate list holds
// (ops/active.ts, filled by markAfterCommit), and the accounts created on
// the day are found among their accounts. The Worker's jobs read the
// Postgres `pgDayLog` from packages/db instead (index.ts).
import { time } from "@japacity/sim";
import type { AccountRow, DayLog } from "@japacity/store";

import { activeOn } from "../ops/active";
import type { ServerDeps } from "../dependencies";

export function isolateDayLog(deps: Pick<ServerDeps, "stores">): DayLog {
  const activeIn = (start: number, end: number): string[] => {
    const found = new Set<string>();
    for (let day = time.utcDay(start); day <= time.utcDay(end - 1); day += 1) for (const character of activeOn(deps, day)) found.add(character);
    return [...found].sort();
  };
  return {
    // The list is read before the first await, since the money job forgets the day once it has run.
    active: (start, end) => Promise.resolve(activeIn(start, end)),
    created: async (start, end) => {
      const accounts = new Map<string, AccountRow>();
      for (const character of activeIn(start, end)) {
        const held = await deps.stores.player.load(character);
        const account = held === null ? null : await deps.stores.account.get(held.character.account);
        if (account !== null && account.createdAt >= start && account.createdAt < end) accounts.set(account.id, account);
      }
      return [...accounts.values()].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
    },
  };
}
