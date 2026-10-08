import type { AccountRow, AccountStore } from "../types";
import { accept, copy, refuse } from "./copy.memory";

/** R-ACCOUNT-015, R-ACCOUNT-017: a map by account id. */
export function memoryAccountStore(): AccountStore {
  const rows = new Map<string, AccountRow>();

  return {
    get: (id) => Promise.resolve(copy(rows.get(id) ?? null)),
    create: (row) => {
      if (rows.has(row.id)) return Promise.resolve(refuse("exists", `Account ${row.id} already exists.`));
      rows.set(row.id, copy(row));
      return Promise.resolve(accept(row));
    },
    setCharacter: (id, character) => {
      const row = rows.get(id);
      if (row === undefined) return Promise.resolve(refuse("missing", `No account ${id}.`));
      if (character !== null && row.character !== null && row.character !== character) {
        return Promise.resolve(refuse("one-character", `Account ${id} already holds ${row.character}.`));
      }
      row.character = character;
      return Promise.resolve(accept(row));
    },
    setNotify: (id, on) => {
      const row = rows.get(id);
      if (row === undefined) return Promise.resolve(refuse("missing", `No account ${id}.`));
      row.notifyBankFull = on;
      return Promise.resolve(accept(row));
    },
    setUsageCounts: (id, on) => {
      const row = rows.get(id);
      if (row === undefined) return Promise.resolve(refuse("missing", `No account ${id}.`));
      row.sendUsageCounts = on;
      return Promise.resolve(accept(row));
    },
    remove: (id) => {
      rows.delete(id);
      return Promise.resolve();
    },
  };
}
