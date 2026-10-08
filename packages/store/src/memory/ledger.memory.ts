import type { ByReason, DayRow, LedgerMark, LedgerStore } from "../types";
import { copy } from "./copy.memory";

function addInto(into: ByReason, added: ByReason): void {
  for (const [reason, byCurrency] of Object.entries(added) as [keyof ByReason, ByReason[keyof ByReason]][]) {
    if (byCurrency === undefined) continue;
    const held = (into[reason] ??= {});
    for (const [currency, amount] of Object.entries(byCurrency) as [keyof typeof byCurrency, number | undefined][]) {
      if (amount === undefined) continue;
      held[currency] = (held[currency] ?? 0) + amount;
    }
  }
}

/** R-SERVER-011: marks by character and totals by day. */
export function memoryLedgerStore(): LedgerStore {
  const marks = new Map<string, LedgerMark>();
  const days = new Map<number, DayRow>();

  return {
    mark: (character) => Promise.resolve(copy(marks.get(character) ?? null)),
    setMark: (character, totals, day) => {
      marks.set(character, copy({ character, day, totals }));
      return Promise.resolve();
    },
    addDay: (day, created, destroyed) => {
      const row = days.get(day) ?? { day, created: {}, destroyed: {} };
      addInto(row.created, created);
      addInto(row.destroyed, destroyed);
      days.set(day, row);
      return Promise.resolve();
    },
    day: (day) => Promise.resolve(copy(days.get(day) ?? { day, created: {}, destroyed: {} })),
    dropMark: (character) => {
      marks.delete(character);
      return Promise.resolve();
    },
  };
}
