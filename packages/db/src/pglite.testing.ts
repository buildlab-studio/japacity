// For the db project's test files only: one migrated PGlite per test file,
// emptied each time a suite asks for a fresh store.
import { afterAll, beforeAll } from "vitest";

import type { Handle } from "./handle";
import { connectPglite, type PgliteConnection } from "./pglite";

export function freshHandle(): () => Promise<Handle> {
  let connection: PgliteConnection | null = null;
  beforeAll(async () => {
    connection = await connectPglite();
  });
  afterAll(async () => {
    await connection?.close();
  });
  return async () => {
    if (connection === null) throw new Error("The database is opened before the first test.");
    await connection.empty();
    return connection.handle;
  };
}
