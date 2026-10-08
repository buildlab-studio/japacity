// The test handle: PGlite in-process, with the committed migrations applied, so
// the migrations and not the schema are what the suites prove. Kept out of the
// main entry so the server's bundle never pulls in PGlite.
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { type Handle, oneConnection } from "./handle";

const MIGRATIONS = fileURLToPath(new URL("../migrations", import.meta.url));

export interface PgliteConnection {
  handle: Handle;
  /** Empties every table and restarts every sequence, for the next test. */
  empty: () => Promise<void>;
  close: () => Promise<void>;
}

export async function connectPglite(): Promise<PgliteConnection> {
  const client = new PGlite();
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  const handle = oneConnection(db);
  return {
    handle,
    empty: () =>
      handle.read(async () => {
        const found = await db.execute<{ name: string }>(
          sql`select quote_ident(tablename) as name from pg_tables where schemaname = 'public'`,
        );
        const names = found.rows.map((row) => row.name).join(", ");
        if (names !== "") await db.execute(sql.raw(`truncate ${names} restart identity cascade`));
      }),
    close: () => client.close(),
  };
}
