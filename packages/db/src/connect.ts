// The production handle: a new `pg` client for one request, as Hyperdrive
// asks. The server passes the connection string and closes the client after
// the response.
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import { type Handle, oneConnection, type Queries } from "./handle";

export interface Connection {
  handle: Handle;
  /** The same client as Drizzle sees it, for the auth library's adapter, which runs its own statements. */
  db: Queries;
  close: () => Promise<void>;
}

export async function connect(connectionString: string): Promise<Connection> {
  const client = new Client({ connectionString });
  await client.connect();
  const db = drizzle({ client });
  return { handle: oneConnection(db), db, close: () => client.end() };
}
