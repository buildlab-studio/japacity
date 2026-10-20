import type { ServerReply, ViewReply } from "@japacity/api";
import { connectPglite } from "@japacity/db/pglite";
import type { PgliteConnection } from "@japacity/db/pglite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Stores } from "../deps";
import { postgresStores } from "../postgres.testing";
import { drizzleAuthAdapter } from "./drizzle";
import { harness, makeJar } from "./auth.testing";

let connection: PgliteConnection | null = null;

beforeAll(async () => {
  connection = await connectPglite();
});

afterAll(async () => {
  await connection?.close();
});

/** The production wiring on the file's database, and its Drizzle handle for the auth library. */
function onPostgres(): { stores: Stores; db: PgliteConnection["db"] } {
  if (connection === null) throw new Error("The database is opened before the first test.");
  return { stores: postgresStores(connection), db: connection.db };
}

describe("the server on Postgres", () => {
  test("[account:sign-in-without-secret] [account:age-screen-refuses-minors] [account:only-needed-data-kept] [server:one-command-one-transaction] given the auth library on Drizzle's adapter and the Postgres stores, when a player signs up by code, makes a character, plays a month and reads the view, then each answers as on the memory stores and the user row holds no name", async () => {
    const { stores, db } = onPostgres();
    const h = harness({ stores, adapter: drizzleAuthAdapter(db) });
    const { jar, account } = await h.signUp("ada@example.com");

    const user = await (await h.auth.$context).internalAdapter.findUserById(account);
    expect(user).toMatchObject({ id: account, name: "", email: "ada@example.com" });
    expect(await stores.account.get(account)).toMatchObject({ id: account, country: "NG", character: null, sendUsageCounts: true });

    expect((await h.call("/api/character", { method: "POST", jar, json: { scenario: "scenario.graduate" } })).status).toBe(200);
    const first = await (await h.call("/api/view", { jar })).json<ViewReply>();
    if (!first.ok) throw new Error(first.detail);
    const sent = await (await h.call("/api/command", { method: "POST", jar, json: { command: { type: "turn/end", slots: [], basedOn: first.view.v }, basedOn: first.view.v } })).json<ServerReply>();
    expect(sent).toMatchObject({ ok: true, view: { v: first.view.v + 1 } });
    const character = (await stores.account.get(account))?.character ?? "";
    expect((await stores.player.load(character))?.character.v).toBe(first.view.v + 1);
    expect((await h.call("/api/view", { jar: makeJar() })).status).toBe(401);
  });
});
