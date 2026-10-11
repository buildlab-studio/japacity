// R-SERVER-012: the admin's reads run with a statement timeout, set with SET LOCAL inside a
// transaction of their own, so it ends with that transaction and never stays on the connection. PGlite keeps the
// setting but does not stop a statement by it; race/timeout.race.test.ts shows the stop on a real Postgres.
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { boundedHandle, type Handle } from "./handle";
import { connectPglite, type PgliteConnection } from "./pglite";

let pglite: PgliteConnection;

beforeAll(async () => {
  pglite = await connectPglite();
});

afterAll(async () => {
  await pglite.close();
});

async function timeoutIn(handle: Handle, kind: "read" | "transaction"): Promise<string> {
  return handle[kind](async (db) => {
    // The handle's builder is typed for either driver, so its result's rows are read as both give them.
    const found: unknown = await db.execute(sql`show statement_timeout`);
    return (found as { rows: { statement_timeout: string }[] }).rows[0]?.statement_timeout ?? "";
  });
}

describe("a bounded handle", () => {
  test("[R-SERVER-012] given a bounded handle, when it reads or runs a transaction, then the statement timeout is set inside, and outside it is back as it was", async () => {
    const bounded = boundedHandle(pglite.handle, 5000);
    expect(await timeoutIn(bounded, "read")).toBe("5s");
    expect(await timeoutIn(bounded, "transaction")).toBe("5s");
    expect(await timeoutIn(pglite.handle, "read")).toBe("0");
  });

  test("[R-SERVER-012] given a timeout that is not a whole number of milliseconds above 0, then no bounded handle is made", () => {
    for (const ms of [0, -1, 2.5, Number.NaN]) expect(() => boundedHandle(pglite.handle, ms)).toThrow(/whole number of milliseconds/);
  });
});
