// The production handle: a new `pg` client for one request, as Hyperdrive
// asks. The server passes the connection string and closes the client after
// the response. `connectOnFirstUse` is what a request uses: its client
// connects only when a store or the auth library first sends a statement, so a
// request that reads nothing from the database opens nothing
// (server:one-command-one-transaction).
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import type { QueryConfig, QueryResult } from "pg";

import { type Handle, oneConnection, type Queries } from "./handle";

export interface Connection {
  handle: Handle;
  /** The same client as Drizzle sees it, for the auth library's adapter, which runs its own statements. */
  db: Queries;
  close: () => Promise<void>;
  /**
   * True once the database refused the connection or dropped it under a statement. A library that catches the
   * failure and throws its own error (the auth library does) loses the cause; the request's answer reads this instead.
   */
  unavailable?: () => boolean;
}

export async function connect(connectionString: string): Promise<Connection> {
  const client = new Client({ connectionString });
  await client.connect();
  const db = drizzle({ client });
  return { handle: oneConnection(db), db, close: () => client.end() };
}

/** What a request's connection asks of its client: `pg`'s own `Client`, or a test's stand-in for one. */
export interface PgClient {
  connect: () => Promise<unknown>;
  query: (config: QueryConfig, values?: unknown[]) => Promise<QueryResult>;
  end: () => Promise<void>;
}

/** The database did not take the connection: the request can be answered "try again" (server:no-platform-error-page). */
export class DatabaseUnavailable extends Error {
  override name = "DatabaseUnavailable";
}

/**
 * One request's connection, opened by its first statement. Drizzle's
 * node-postgres session sends every statement, a transaction's `begin` and
 * `commit` included, through the client's `query`, and keeps a transaction on
 * a client that is not a pool; so the stand-in below answers `query` by
 * connecting once and handing the statement on. A connection that fails is
 * not tried again within the request. `close` ends the client only if it
 * was opened.
 */
export function connectOnFirstUse(connectionString: string, makeClient: (connectionString: string) => PgClient = (url) => new Client({ connectionString: url })): Connection & { unavailable: () => boolean } {
  let opened: Promise<PgClient> | null = null;
  let lost = false;
  const client = (): Promise<PgClient> => {
    opened ??= (async () => {
      const made = makeClient(connectionString);
      try {
        await made.connect();
      } catch (error) {
        lost = true;
        throw new DatabaseUnavailable("The database did not take the connection.", { cause: error });
      }
      return made;
    })();
    return opened;
  };
  const query = async (config: QueryConfig, values?: unknown[]): Promise<QueryResult> => {
    const made = await client();
    try {
      return await made.query(config, values);
    } catch (error) {
      // Postgres's own refusal of a statement carries a SQLSTATE; anything else is the connection failing under it.
      if (!isPostgresError(error)) lost = true;
      throw error;
    }
  };
  const onFirstUse = { query };
  // Drizzle reads only `query` from a client that is not a pool (drizzle-orm/node-postgres/session.js, 0.45.3).
  const db = drizzle({ client: onFirstUse as unknown as Client });
  return {
    handle: oneConnection(db),
    db,
    close: async () => {
      if (opened === null) return;
      const made = await opened.catch(() => null);
      await made?.end();
    },
    unavailable: () => lost,
  };
}

function isPostgresError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code);
}
