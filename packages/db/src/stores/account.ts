import type { AccountRow, AccountStore } from "@japacity/store";
import { and, asc, eq, lt, ne, sql } from "drizzle-orm";

import type { Handle } from "../handle";
import { accounts } from "../schema";
import { accept, refuse } from "./result";

export function toAccount(row: typeof accounts.$inferSelect): AccountRow {
  return {
    id: row.id,
    country: row.country,
    age: { passed: row.agePassed, at: row.ageAt, method: row.ageMethod },
    createdAt: row.createdAt,
    character: row.character,
    notifyBankFull: row.notifyBankFull,
    sendUsageCounts: row.sendUsageCounts,
    state: row.state,
    username: row.username,
    usernameChangedAt: row.usernameChangedAt,
    lastPlayedAt: row.lastPlayedAt,
  };
}

/** Postgres's unique_violation, as pg and PGlite both report it, directly or as the cause Drizzle wraps. */
function uniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "23505") return true;
  const cause = (error as { cause?: unknown } | null)?.cause;
  return cause !== undefined && cause !== error && uniqueViolation(cause);
}

/** R-ACCOUNT-024: the clause that finds a username whatever the capitals; the unique index is on the same expression. */
function sameName(username: string) {
  return sql`lower(${accounts.username}) = lower(${username})`;
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
            notifyBankFull: row.notifyBankFull,
            sendUsageCounts: row.sendUsageCounts,
            state: row.state,
            username: row.username,
            usernameChangedAt: row.usernameChangedAt,
            lastPlayedAt: row.lastPlayedAt,
          })
          .onConflictDoNothing()
          .returning();
        const [stored] = made;
        if (stored !== undefined) return accept(toAccount(stored));
        const [same] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, row.id));
        return same === undefined ? refuse("conflict", `The username ${row.username} is taken.`) : refuse("exists", `Account ${row.id} already exists.`);
      }),

    byUsername: (username) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(accounts).where(sameName(username));
        return row === undefined ? null : toAccount(row);
      }),

    setUsername: (id, username, at) =>
      // Two renames racing to one name: the unique index refuses the second, which is the same answer.
      handle.transaction(async (tx) => {
        const [row] = await tx.select().from(accounts).where(eq(accounts.id, id)).for("update");
        if (row === undefined) return refuse("missing", `No account ${id}.`);
        const [held] = await tx.select({ id: accounts.id }).from(accounts).where(and(sameName(username), ne(accounts.id, id)));
        if (held !== undefined) return refuse("conflict", `The username ${username} is taken.`);
        const [updated] = await tx.update(accounts).set({ username, usernameChangedAt: at }).where(eq(accounts.id, id)).returning();
        if (updated === undefined) throw new Error(`Account ${id} vanished under its lock.`);
        return accept(toAccount(updated));
      }).catch((error: unknown) => {
        if (uniqueViolation(error)) return refuse("conflict", `The username ${username} is taken.`);
        throw error;
      }),

    secure: (id) =>
      handle.read(async (db) => {
        const [updated] = await db.update(accounts).set({ state: "secured" }).where(eq(accounts.id, id)).returning();
        return updated === undefined ? refuse("missing", `No account ${id}.`) : accept(toAccount(updated));
      }),

    touch: (id, at) =>
      handle.read(async (db) => {
        await db
          .update(accounts)
          .set({ lastPlayedAt: at })
          .where(and(eq(accounts.id, id), lt(accounts.lastPlayedAt, at)));
      }),

    idleGuests: (before) =>
      handle.read(async (db) => {
        const rows = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.state, "guest"), lt(accounts.lastPlayedAt, before)))
          .orderBy(asc(accounts.lastPlayedAt), asc(accounts.id));
        return rows.map(toAccount);
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

    setNotify: (id, on) =>
      handle.read(async (db) => {
        const [updated] = await db.update(accounts).set({ notifyBankFull: on }).where(eq(accounts.id, id)).returning();
        return updated === undefined ? refuse("missing", `No account ${id}.`) : accept(toAccount(updated));
      }),

    setUsageCounts: (id, on) =>
      handle.read(async (db) => {
        const [updated] = await db.update(accounts).set({ sendUsageCounts: on }).where(eq(accounts.id, id)).returning();
        return updated === undefined ? refuse("missing", `No account ${id}.`) : accept(toAccount(updated));
      }),

    remove: (id) =>
      handle.read(async (db) => {
        await db.delete(accounts).where(eq(accounts.id, id));
      }),
  };
}
