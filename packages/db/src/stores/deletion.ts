import type { DeletionRow, DeletionStore } from "@japacity/store";
import { refuse } from "@japacity/store";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";

import type { Handle } from "../handle";
import { deletions } from "../schema";
import { accept } from "./result";

function toDeletion(row: typeof deletions.$inferSelect): DeletionRow {
  return { account: row.account, accountHash: row.accountHash, requestedAt: row.requestedAt, dueAt: row.dueAt, completedAt: row.completedAt };
}

const pending = (account: string) => and(eq(deletions.account, account), isNull(deletions.completedAt));

/** account:deleted-data-removed-within-month, account:deletion-keeps-anonymous-totals: requests in the order they came, at most one pending per account. */
export function pgDeletionStore(handle: Handle): DeletionStore {
  return {
    request: (request) =>
      handle.transaction(async (tx) => {
        await tx
          .insert(deletions)
          .values({ account: request.account, accountHash: request.accountHash, requestedAt: request.requestedAt, dueAt: request.dueAt })
          .onConflictDoNothing({ target: deletions.account, where: sql`${deletions.completedAt} is null` });
        const [row] = await tx.select().from(deletions).where(pending(request.account));
        if (row === undefined) throw new Error(`The deletion of ${request.account} was not stored.`);
        return accept(toDeletion(row));
      }),

    due: (now) =>
      handle.read(async (db) => {
        const rows = await db
          .select()
          .from(deletions)
          .where(and(isNull(deletions.completedAt), lte(deletions.dueAt, now)))
          .orderBy(asc(deletions.dueAt), asc(deletions.requestedAt), asc(deletions.n));
        return rows.map(toDeletion);
      }),

    complete: (account, at) =>
      handle.read(async (db) => {
        const [row] = await db.update(deletions).set({ account: null, completedAt: at }).where(pending(account)).returning();
        return row === undefined ? refuse("missing", `No deletion is pending for ${account}.`) : accept(toDeletion(row));
      }),

    find: (accountHash) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(deletions).where(eq(deletions.accountHash, accountHash)).orderBy(asc(deletions.n)).limit(1);
        return row === undefined ? null : toDeletion(row);
      }),
  };
}
