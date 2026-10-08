// The production handle: a new `pg` client for one request, as Hyperdrive
// asks. The server passes the connection string and closes the client after
// the response.
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import { type Handle, oneConnection } from "./handle";

export interface Connection {
  handle: Handle;
  close: () => Promise<void>;
}

export async function connect(connectionString: string): Promise<Connection> {
  const client = new Client({ connectionString });
  await client.connect();
  return { handle: oneConnection(drizzle({ client })), close: () => client.end() };
}
