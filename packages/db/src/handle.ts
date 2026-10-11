// How the stores reach the database. Both drivers give the same query builder,
// so a store is written once against `Queries`.
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/** A Drizzle database or a transaction inside one: the same builder either way. */
export type Queries = PgDatabase<PgQueryResultHKT>;

/** The database as the stores see it. Every call goes through `read` or `transaction`. */
export interface Handle {
  /** Statements outside a transaction. */
  read: <T>(run: (db: Queries) => Promise<T>) => Promise<T>;
  /** One transaction: committed when `run` resolves, rolled back and rethrown when it throws. */
  transaction: <T>(run: (tx: Queries) => Promise<T>) => Promise<T>;
}

/**
 * One async lock: each call waits for the one before to settle, and a failed
 * call releases it too.
 */
function makeLock(): <T>(run: () => Promise<T>) => Promise<T> {
  let last: Promise<unknown> = Promise.resolve();
  return <T>(run: () => Promise<T>): Promise<T> => {
    const next = last.then(run);
    last = next.catch(() => undefined);
    return next;
  };
}

/**
 * Wraps a database that sits on one connection: PGlite in the tests, or one
 * `pg` client for one request. Statements from two overlapping calls would
 * otherwise interleave inside one session, so the lock runs every call, read
 * or transaction, one after the other. Locks between connections are
 * Postgres's own (`SELECT ... FOR UPDATE`). A call made through the same
 * handle inside one of its own transactions would wait for ever, so the work
 * of a transaction reaches the database only through that transaction's
 * client (docs/rules/server.md R-SERVER-002).
 */
export function oneConnection(db: Queries): Handle {
  const locked = makeLock();
  return {
    read: (run) => locked(() => run(db)),
    transaction: (run) => locked(() => db.transaction((tx) => run(tx))),
  };
}
