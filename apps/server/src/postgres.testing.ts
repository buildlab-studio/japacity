// Postgres for tests: PGlite with the committed migrations, the stores
// production wires over it, and a fresh database for each test.
import { pgStores } from "@japacity/db";
import { connectPglite } from "@japacity/db/pglite";
import type { PgliteConnection } from "@japacity/db/pglite";
import { afterEach } from "vitest";

import { memoryStores } from "./dependencies";
import type { Stores } from "./dependencies";

/** The production wiring on `connection`: every store the database holds, presence and nudges in memory as the place objects stand in for them. */
export function postgresStores(connection: PgliteConnection): Stores {
  return { ...memoryStores(), ...pgStores(connection.handle) };
}

/** Opens a fresh database on each call and closes every one after its test. Called once, at a test file's top level. */
export function freshDatabases(): () => Promise<PgliteConnection> {
  const opened: PgliteConnection[] = [];
  afterEach(async () => {
    await Promise.all(opened.splice(0).map((connection) => connection.close()));
  });
  return async () => {
    const connection = await connectPglite();
    opened.push(connection);
    return connection;
  };
}
