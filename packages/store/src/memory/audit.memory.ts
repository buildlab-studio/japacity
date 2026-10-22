import type { AuditRow, AuditStore } from "../types";
import { copy } from "./copy.memory";

/** server:rollback-apply-one-account: an array that only grows, but for a character's rows that a deletion forgets. */
export function memoryAuditStore(): AuditStore {
  let rows: AuditRow[] = [];
  let made = 0;

  return {
    retire: (entry) => {
      made += 1;
      const row: AuditRow = { ...copy(entry), n: made };
      rows.push(row);
      return Promise.resolve(copy(row));
    },
    list: (character) => Promise.resolve(copy(rows.filter((row) => row.character === character))),
    forget: (character) => {
      rows = rows.filter((row) => row.character !== character);
      return Promise.resolve();
    },
  };
}
