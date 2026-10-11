import type { AccountRow, AccountStore } from "../types";
import { accept, copy, refuse } from "./copy.memory";

/** R-ACCOUNT-024: usernames are compared whatever the capitals. */
function fold(username: string): string {
  return username.toLowerCase();
}

/** R-ACCOUNT-015, R-ACCOUNT-017, R-ACCOUNT-024: a map by account id. */
export function memoryAccountStore(): AccountStore {
  const rows = new Map<string, AccountRow>();

  function holder(username: string): AccountRow | null {
    const folded = fold(username);
    for (const row of rows.values()) if (fold(row.username) === folded) return row;
    return null;
  }

  return {
    get: (id) => Promise.resolve(copy(rows.get(id) ?? null)),
    create: (row) => {
      if (rows.has(row.id)) return Promise.resolve(refuse("exists", `Account ${row.id} already exists.`));
      if (holder(row.username) !== null) return Promise.resolve(refuse("conflict", `The username ${row.username} is taken.`));
      rows.set(row.id, copy(row));
      return Promise.resolve(accept(row));
    },
    byUsername: (username) => Promise.resolve(copy(holder(username))),
    usernames: (ids) => {
      const found = new Map<string, string>();
      for (const id of ids) {
        const row = rows.get(id);
        if (row !== undefined) found.set(id, row.username);
      }
      return Promise.resolve(found);
    },
    setUsername: (id, username, at) => {
      const row = rows.get(id);
      if (row === undefined) return Promise.resolve(refuse("missing", `No account ${id}.`));
      const held = holder(username);
      if (held !== null && held.id !== id) return Promise.resolve(refuse("conflict", `The username ${username} is taken.`));
      row.username = username;
      row.usernameChangedAt = at;
      return Promise.resolve(accept(row));
    },
    secure: (id) => {
      const row = rows.get(id);
      if (row === undefined) return Promise.resolve(refuse("missing", `No account ${id}.`));
      row.state = "secured";
      return Promise.resolve(accept(row));
    },
    touch: (id, at) => {
      const row = rows.get(id);
      if (row !== undefined && row.lastPlayedAt < at) row.lastPlayedAt = at;
      return Promise.resolve();
    },
    idleGuests: (before) => {
      const idle = [...rows.values()].filter((row) => row.state === "guest" && row.lastPlayedAt < before);
      idle.sort((one, two) => one.lastPlayedAt - two.lastPlayedAt || (one.id < two.id ? -1 : 1));
      return Promise.resolve(copy(idle));
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
