// The admin tools' database form (server.md R-SERVER-008, R-SERVER-009 and
// R-SERVER-047): the game's Postgres reached through packages/db on the
// migrator's string, `DATABASE_URL_UNPOOLED`, as the migration step reads it,
// with the contents the Worker bundles, so a segment replays here under the
// same content it ran under there.
import { content } from "@japacity/content";
import { connect, pgStores } from "@japacity/db";

import { productionConfig } from "../config";
import { contentsFor, withContentBefore } from "../authority/overlay";
import type { Contents, ServerDeps, Stores } from "../deps";
import { memoryStores } from "../deps";

/** The variable both tools read, the one the migration step is given. */
export const DATABASE_ENV = "DATABASE_URL_UNPOOLED";

/** What the tools run on: the deps they read and write through, and how the connection ends. */
export interface Database {
  deps: Pick<ServerDeps, "config" | "contents" | "stores" | "now">;
  close: () => Promise<void>;
}

/** Opens the database once a tool has read its arguments; null when no string was given. */
export type OpenDatabase = (() => Promise<Database>) | null;

/** R-SERVER-023, R-SERVER-024: the Worker's contents, its overlay applied when the deployment has one. */
export function workerContents(overlayJson: string | undefined): Contents {
  return withContentBefore(contentsFor(content, overlayJson), content);
}

/**
 * The deps over `stores`: the Postgres stores for what a character is and
 * reads, the memory ones for what a tool never touches (the nudge bus, the
 * presence, the counters), so nothing here reaches a player's socket.
 */
export function databaseDeps(stores: Partial<Stores>, contents: Contents, now: () => number = () => Date.now()): Database["deps"] {
  return { config: productionConfig, contents, stores: { ...memoryStores(), ...stores }, now };
}

/** The opener for `env`: one `pg` client on the string, or null when the string is missing or empty. */
export function databaseFrom(env: Readonly<Record<string, string | undefined>>): OpenDatabase {
  const url = env[DATABASE_ENV];
  if (url === undefined || url === "") return null;
  return async () => {
    const connection = await connect(url);
    return { deps: databaseDeps(pgStores(connection.handle), workerContents(env["OVERLAY"])), close: connection.close };
  };
}
