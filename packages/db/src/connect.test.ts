// server:one-command-one-transaction: a request's client connects on the
// first statement sent through it, once, and is ended only if it was opened.
import { sql } from "drizzle-orm";
import type { QueryResult } from "pg";
import { describe, expect, test } from "vitest";

import { connectOnFirstUse, DatabaseUnavailable } from "./connect";
import type { PgClient } from "./connect";

/** A client that counts what it is asked and answers every statement with no rows. */
function counted(refuse = false) {
  const asked = { made: 0, connects: 0, statements: [] as string[], ends: 0 };
  const make = (): PgClient => {
    asked.made += 1;
    return {
      connect: () => {
        asked.connects += 1;
        return refuse ? Promise.reject(new Error("connect ECONNREFUSED")) : Promise.resolve();
      },
      query: (config) => {
        asked.statements.push(config.text);
        return Promise.resolve({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] } as QueryResult);
      },
      end: () => {
        asked.ends += 1;
        return Promise.resolve();
      },
    };
  };
  return { asked, make };
}

describe("a request's connection", () => {
  test("[server:one-command-one-transaction] given a connection that is never asked anything, when it is closed, then no client was made, connected or ended", async () => {
    const { asked, make } = counted();
    const connection = connectOnFirstUse("postgres://game", make);
    await connection.close();
    expect(asked).toEqual({ made: 0, connects: 0, statements: [], ends: 0 });
  });

  test("[server:one-command-one-transaction] given two reads and a transaction, when they are sent, then one client is made and connected before the first, every statement goes through it, and close ends it once", async () => {
    const { asked, make } = counted();
    const connection = connectOnFirstUse("postgres://game", make);
    await connection.handle.read((db) => db.execute(sql`select 1`));
    await connection.handle.read((db) => db.execute(sql`select 2`));
    await connection.handle.transaction((tx) => tx.execute(sql`select 3`));
    expect(asked.made).toBe(1);
    expect(asked.connects).toBe(1);
    expect(asked.statements).toEqual(["select 1", "select 2", "begin", "select 3", "commit"]);
    await connection.close();
    expect(asked.ends).toBe(1);
  });

  test("[server:one-command-one-transaction] [server:no-platform-error-page] given a database that refuses the connection, when two statements are sent, then each fails with DatabaseUnavailable from the one attempt, and close ends nothing", async () => {
    const { asked, make } = counted(true);
    const connection = connectOnFirstUse("postgres://game", make);
    const first = await connection.handle.read((db) => db.execute(sql`select 1`)).catch((error: unknown) => error);
    const second = await connection.handle.read((db) => db.execute(sql`select 2`)).catch((error: unknown) => error);
    for (const failure of [first, second]) {
      expect((failure as Error).cause).toBeInstanceOf(DatabaseUnavailable);
    }
    expect(asked.connects).toBe(1);
    expect(asked.statements).toEqual([]);
    await connection.close();
    expect(asked.ends).toBe(0);
  });
});
