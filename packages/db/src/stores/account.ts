import type { AccountRow, AccountStore } from "@japacity/store";
import { eq } from "drizzle-orm";

import type { Handle } from "../handle";
import { accounts } from "../schema";
import { accept, refuse } from "./result";

function toAccount(row: typeof accounts.$inferSelect): AccountRow {
  return {
    id: row.id,
    country: row.country,
    age: { passed: row.agePassed, at: row.ageAt, method: row.ageMethod },
    createdAt: row.createdAt,
    character: row.character,
  };
}

/** R-ACCOUNT-015, R-ACCOUNT-017, R-ACCOUNT-020: one row per account. */
export function pgAccountStore(handle: Handle): AccountStore {
  return {
    get: (id) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(accounts).where(eq(accounts.id, id));
        return row === undefined ? null : toAccount(row);
      }),

    create: (row) =>
      handle.read(async (db) => {
        const made = await db
          .insert(accounts)
          .values({
            id: row.id,
            country: row.country,
            agePassed: row.age.passed,
            ageAt: row.age.at,
            ageMethod: row.age.method,
            createdAt: row.createdAt,
            character: row.character,
          })
          .onConflictDoNothing()
          .returning();
        const [stored] = made;
        return stored === undefined ? refuse("exists", `Account ${row.id} already exists.`) : accept(toAccount(stored));
      }),

    setCharacter: (id, character) =>
      handle.transaction(async (tx) => {
        const [row] = await tx.select().from(accounts).where(eq(accounts.id, id)).for("update");
        if (row === undefined) return refuse("missing", `No account ${id}.`);
        if (character !== null && row.character !== null && row.character !== character) {
          return refuse("one-character", `Account ${id} already holds ${row.character}.`);
        }
        const [updated] = await tx.update(accounts).set({ character }).where(eq(accounts.id, id)).returning();
        if (updated === undefined) throw new Error(`Account ${id} vanished under its lock.`);
        return accept(toAccount(updated));
      }),

    remove: (id) =>
      handle.read(async (db) => {
        await db.delete(accounts).where(eq(accounts.id, id));
      }),
  };
}
