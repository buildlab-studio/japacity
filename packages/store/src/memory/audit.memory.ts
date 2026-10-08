import type { AuditRow, AuditStore } from "../types";
import { copy } from "./copy.memory";

/** R-SERVER-009: an array that only grows. */
export function memoryAuditStore(): AuditStore {
  const rows: AuditRow[] = [];

  return {
    retire: (entry) => {
      const row: AuditRow = { ...copy(entry), n: rows.length + 1 };
      rows.push(row);
      return Promise.resolve(copy(row));
    },
    list: (character) => Promise.resolve(copy(rows.filter((row) => row.character === character))),
  };
}
