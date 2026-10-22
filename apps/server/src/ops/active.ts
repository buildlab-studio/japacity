// server:daily-money-report: the characters that logged a command on each UTC day, kept in the
// isolate's memory from markAfterCommit and lost when the isolate restarts. The Worker's money
// job reads the day's characters from the command log (`pgDayLog`); this list serves the memory
// stores, where no log can be read by day.
import type { LedgerStore } from "@japacity/store";

import type { ServerDeps } from "../dependencies";

const byStore = new WeakMap<LedgerStore, Map<number, Set<string>>>();

function days(deps: Pick<ServerDeps, "stores">): Map<number, Set<string>> {
  const found = byStore.get(deps.stores.ledger);
  if (found !== undefined) return found;
  const made = new Map<number, Set<string>>();
  byStore.set(deps.stores.ledger, made);
  return made;
}

export function noteActive(deps: Pick<ServerDeps, "stores">, character: string, day: number): void {
  const held = days(deps);
  const seen = held.get(day) ?? new Set<string>();
  seen.add(character);
  held.set(day, seen);
}

/** The characters noted on the day, in the order they were first noted. */
export function activeOn(deps: Pick<ServerDeps, "stores">, day: number): string[] {
  return [...(days(deps).get(day) ?? [])];
}

/** Drops the days the money job has finished with. */
export function forgetBefore(deps: Pick<ServerDeps, "stores">, day: number): void {
  const held = days(deps);
  for (const noted of [...held.keys()]) if (noted < day) held.delete(noted);
}
