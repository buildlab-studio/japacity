// The admin's statement timeout on a real Postgres, which PGlite does not enforce (R-SERVER-012, amended 11 Oct
// 2026). Run with `DATABASE_URL=postgres://... pnpm vitest run --project db-race` against a database kept for
// these tests; nothing here writes.
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { type Connection, connect } from "../connect";
import { boundedHandle, STATEMENT_TIMED_OUT } from "../handle";

// Fails the run, never skips it, when there is no database.
const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (DATABASE_URL === "") throw new Error("db-race needs DATABASE_URL set to a Postgres 18 database kept for these tests.");

let connection: Connection;

beforeAll(async () => {
  connection = await connect(DATABASE_URL);
});

afterAll(async () => {
  await connection.close();
});

function codesOf(error: unknown): unknown[] {
  const codes: unknown[] = [];
  for (let link = error; typeof link === "object" && link !== null && codes.length < 8; link = (link as { cause?: unknown }).cause) codes.push((link as { code?: unknown }).code);
  return codes;
}

describe("a bounded handle on Postgres", () => {
  test("[R-SERVER-012] given a statement longer than the timeout, when it runs through a bounded handle, then Postgres stops it with query_canceled, and the next read on the same connection has no timeout", async () => {
    const bounded = boundedHandle(connection.handle, 50);
    const started = Date.now();
    const error: unknown = await bounded.read((db) => db.execute(sql`select pg_sleep(2)`)).catch((caught: unknown) => caught);
    expect(codesOf(error)).toContain(STATEMENT_TIMED_OUT);
    expect(Date.now() - started).toBeLessThan(1500);
    const after: unknown = await connection.handle.read((db) => db.execute(sql`show statement_timeout`));
    expect((after as { rows: { statement_timeout: string }[] }).rows[0]?.statement_timeout).toBe("0");
  });
});
