import type { DeletionRow, DeletionStore } from "../types";
import { refuse } from "../result";
import { accept, copy } from "./copy.memory";

/** R-ACCOUNT-017, R-ACCOUNT-018: an array of requests in the order they came. */
export function memoryDeletionStore(): DeletionStore {
  const rows: DeletionRow[] = [];
  const pending = (account: string) => rows.find((row) => row.account === account && row.completedAt === null);

  return {
    request: (request) => {
      const open = pending(request.account);
      if (open !== undefined) return Promise.resolve(accept(open));
      const row: DeletionRow = { ...copy(request), completedAt: null };
      rows.push(row);
      return Promise.resolve(accept(row));
    },
    due: (now) => {
      const due = rows
        .filter((row) => row.completedAt === null && row.dueAt <= now)
        .sort((x, y) => x.dueAt - y.dueAt || x.requestedAt - y.requestedAt);
      return Promise.resolve(copy(due));
    },
    complete: (account, at) => {
      const row = pending(account);
      if (row === undefined) return Promise.resolve(refuse("missing", `No deletion is pending for ${account}.`));
      row.account = null;
      row.completedAt = at;
      return Promise.resolve(accept(row));
    },
    find: (accountHash) => Promise.resolve(copy(rows.find((row) => row.accountHash === accountHash) ?? null)),
  };
}
