import type { ByReason, DayRow, LedgerMark, LedgerRows, LedgerStore } from "../types";
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

function addToDay(days: Map<number, DayRow>, day: number, created: ByReason, destroyed: ByReason): void {
  const row = days.get(day) ?? { day, created: {}, destroyed: {} };
  addInto(row.created, created);
  addInto(row.destroyed, destroyed);
  days.set(day, row);
}

/** R-SERVER-011: marks by character and totals by day. */
export function memoryLedgerStore(): LedgerStore {
  const marks = new Map<string, LedgerMark>();
  const days = new Map<number, DayRow>();

  /**
   * R-SERVER-011: a transaction's writes wait in its own journal, read through by its own reads,
   * and reach the store only when the work has resolved; a work that throws leaves the store as it found it.
   */
  async function transaction<T>(work: (ledger: LedgerRows) => Promise<T>): Promise<T> {
    const staged = new Map<string, LedgerMark | null>();
    const added: DayRow[] = [];
    const rows: LedgerRows = {
      mark: (character) => Promise.resolve(copy(staged.has(character) ? (staged.get(character) ?? null) : (marks.get(character) ?? null))),
      setMark: (character, totals, day) => {
        staged.set(character, copy({ character, day, totals }));
        return Promise.resolve();
      },
      addDay: (day, created, destroyed) => {
        added.push(copy({ day, created, destroyed }));
        return Promise.resolve();
      },
      day: (day) => {
        const row = copy(days.get(day) ?? { day, created: {}, destroyed: {} });
        for (const each of added) {
          if (each.day !== day) continue;
          addInto(row.created, each.created);
          addInto(row.destroyed, each.destroyed);
        }
        return Promise.resolve(row);
      },
      dropMark: (character) => {
        staged.set(character, null);
        return Promise.resolve();
      },
    };
    const result = await work(rows);
    for (const [character, mark] of staged) {
      if (mark === null) marks.delete(character);
      else marks.set(character, mark);
    }
    for (const each of added) addToDay(days, each.day, each.created, each.destroyed);
    return result;
  }

  return {
    mark: (character) => Promise.resolve(copy(marks.get(character) ?? null)),
    setMark: (character, totals, day) => {
      marks.set(character, copy({ character, day, totals }));
      return Promise.resolve();
    },
    addDay: (day, created, destroyed) => {
      addToDay(days, day, created, destroyed);
      return Promise.resolve();
    },
    day: (day) => Promise.resolve(copy(days.get(day) ?? { day, created: {}, destroyed: {} })),
    dropMark: (character) => {
      marks.delete(character);
      return Promise.resolve();
    },
    transaction,
  };
}
