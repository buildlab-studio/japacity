// The Worker's request plumbing (worker.ts) on Postgres, with PGlite standing
// in for `pg` behind a client that counts its connections: R-SERVER-002's
// client opened on first use, and R-SERVER-043's answer when the database
// does not take the connection.
import { content, text } from "@japacity/content";
import { connectOnFirstUse, pgStores } from "@japacity/db";
import type { Connection, PgClient } from "@japacity/db";
import { connectPglite } from "@japacity/db/pglite";
import type { PgliteConnection } from "@japacity/db/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { drizzleAuthAdapter } from "./auth/drizzle";
import { harness, makeJar, SECRET, SITE } from "./auth/testing";
import type { Jar } from "./auth/testing";
import { productionConfig } from "./config";
import { memoryStores, openLimiters } from "./deps";
import type { Env } from "./index";
import type { Place } from "./place/place.object";
import { isolateFor } from "./production";
import type { Isolate } from "./production";
import { answered } from "./security/fail";
import type { ServerReply, ViewReply } from "./types";
import { gameReply } from "./worker";

let connection: PgliteConnection | null = null;

beforeAll(async () => {
  connection = await connectPglite();
});

afterAll(async () => {
  await connection?.close();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await connection?.empty();
});

function database(): PgliteConnection {
  if (connection === null) throw new Error("The database is opened before the first test.");
  return connection;
}

/** The value parsers Drizzle's own PGlite driver sets: dates and intervals come back as text, as they do from pg under Drizzle. */
const AS_TEXT = Object.fromEntries([1114, 1184, 1186, 1082, 1231, 1115, 1185, 1187, 1182].map((type) => [type, (value: string) => value]));

type QueryResult = Awaited<ReturnType<PgClient["query"]>>;

/** A `pg` client over PGlite, counting each connection made. `refuse` makes every connection fail as a database that is down. */
function pgOverPglite(opened: { count: number }, refuse = false): () => PgClient {
  return () => ({
    connect: () => {
      opened.count += 1;
      return refuse ? Promise.reject(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })) : Promise.resolve();
    },
    query: async (config, values) => {
      const result = await database().client.query(config.text, values, { rowMode: (config as { rowMode?: string }).rowMode === "array" ? "array" : "object", parsers: AS_TEXT });
      return { rows: result.rows, rowCount: result.affectedRows ?? 0, command: "", oid: 0, fields: result.fields } as unknown as QueryResult;
    },
    end: () => Promise.resolve(),
  });
}

/** Place objects that are never really there: every call on a room answers nothing. Only the nudge after a command reaches them. */
const NO_PLACES = {
  idFromName: (name: string) => name,
  get: () => new Proxy({}, { get: (_target, name) => (name === "then" ? undefined : () => Promise.resolve(0)) }),
} as unknown as DurableObjectNamespace<Place>;

/** The deployment's bindings for a test: the auth library's keys the harness signs with, the rest unused. */
function testEnv(): Env {
  const limit = { limit: () => Promise.resolve({ success: true }) } as RateLimit;
  return {
    SITE_URL: SITE,
    WORLD_SEED: "test-world-seed",
    BAN_SALT: "test-ban-salt",
    DRAW_TOKEN_KEY: "test-draw-token-key",
    COMMANDS_10S: limit,
    COMMANDS_60S: limit,
    READS_60S: limit,
    ANON_60S: limit,
    SOCKET_10S: limit,
    GAME_DB: { connectionString: "postgres://counted" } as Hyperdrive,
    CACHED_DB: { connectionString: "postgres://counted" } as Hyperdrive,
    PLACE: NO_PLACES,
    BETTER_AUTH_SECRET: SECRET,
    GOOGLE_CLIENT_ID: "test-google-client",
    GOOGLE_CLIENT_SECRET: "test-google-secret",
    TURNSTILE_SECRET_KEY: "test-turnstile-secret",
    // Both environments set the tick cron and bind the mail; neither is reached by these tests.
    TICK_CRON: "*/30 * * * *",
    MAIL: { send: () => Promise.reject(new Error("no mail in this test")) } as unknown as SendEmail,
  };
}

/** The plumbing with the counting clients: one count for the request's own client, one for the isolate's switch and counter stores. */
function counting(refuse = false) {
  const request = { count: 0 };
  const isolateCalls = { count: 0 };
  const open = (url: string): Promise<Connection> => Promise.resolve(connectOnFirstUse(url, pgOverPglite(request, refuse)));
  const isolate: Isolate = isolateFor(
    { connectionString: "postgres://counted", place: NO_PLACES },
    { config: productionConfig, contents: { current: content, previous: null }, secrets: { worldSeed: "w", banSalt: "b", drawTokenKey: "d" }, limits: openLimiters, text, now: () => Date.now(), randomBytes: (count) => crypto.getRandomValues(new Uint8Array(count)) },
    (url) => Promise.resolve(connectOnFirstUse(url, pgOverPglite(isolateCalls, refuse))),
  );
  return { request, isolateCalls, plumbing: { isolate, open } };
}

/** A request to the Worker's game as a browser on the site, the jar's cookies sent. */
function browser(path: string, init: { method?: string; json?: unknown; jar?: Jar } = {}): Request {
  const headers = new Headers({ origin: SITE, "cf-ipcountry": "NG", "cf-connecting-ip": "203.0.113.7" });
  if (init.jar !== undefined) headers.set("cookie", init.jar.header());
  if (init.json !== undefined) headers.set("content-type", "application/json");
  return new Request(`${SITE}${path}`, { method: init.method ?? "GET", headers, ...(init.json === undefined ? {} : { body: JSON.stringify(init.json) }) });
}

/** A signed-up player with a character, made through the harness on the same database. */
async function playerWithLife(): Promise<{ jar: Jar; v: number }> {
  const db = database();
  const h = harness({ stores: { ...memoryStores(), ...pgStores(db.handle) }, adapter: drizzleAuthAdapter(db.db) });
  const { jar } = await h.signUp("ada@example.com");
  expect((await h.call("/api/character", { method: "POST", jar, json: { scenario: "scenario.ada" } })).status).toBe(200);
  const view = await (await h.call("/api/view", { jar })).json<ViewReply>();
  if (!view.ok) throw new Error(view.detail);
  return { jar, v: view.view.v };
}

/** The reply, and every task the request handed to `waitUntil` settled, the client's close among them. */
async function asked(request: Request, plumbing: ReturnType<typeof counting>["plumbing"]): Promise<Response> {
  const kept: Promise<unknown>[] = [];
  const reply = await answered(request, () => gameReply(request, testEnv(), (promise) => kept.push(promise), plumbing));
  await Promise.allSettled(kept);
  return reply;
}

describe("the database client of a request (R-SERVER-002)", () => {
  test("[R-SERVER-002] given the Worker's plumbing, when GET /api/health is asked, then it answers and no database client is opened, neither the request's nor the isolate's", async () => {
    const { request, isolateCalls, plumbing } = counting();
    const reply = await asked(browser("/api/health"), plumbing);
    expect(reply.status).toBe(200);
    expect(await reply.json()).toMatchObject({ ok: true, content: content.version });
    expect(request.count).toBe(0);
    expect(isolateCalls.count).toBe(0);
  });

  test("[R-SERVER-002] given a signed-in player with a character, when POST /api/command is sent, then it is stepped through exactly one client of the request's, which the session, the stores and the transaction share", async () => {
    const { jar, v } = await playerWithLife();
    const { request, plumbing } = counting();
    const reply = await asked(browser("/api/command", { method: "POST", jar, json: { command: { type: "turn/end", slots: [], basedOn: v }, basedOn: v } }), plumbing);
    expect(await reply.json<ServerReply>()).toMatchObject({ ok: true, view: { v: v + 1 } });
    expect(request.count).toBe(1);
  });

  test("[R-SERVER-002] given a request with no session, when GET /api/view is asked, then it is refused signed-out without opening a client: no cookie, nothing to look up", async () => {
    const { request, plumbing } = counting();
    const reply = await asked(browser("/api/view", { jar: makeJar() }), plumbing);
    expect(reply.status).toBe(401);
    expect(request.count).toBe(0);
  });
});

describe("a database that does not answer (R-SERVER-043)", () => {
  test("[R-SERVER-043] [R-SERVER-042] given a signed-in player and a database that refuses the connection, when POST /api/command is sent, then the reply is 503 unavailable with Retry-After, the connection was tried once, and one log line names no account, session, address or body", async () => {
    const { jar, v } = await playerWithLife();
    const { request, plumbing } = counting(true);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reply = await asked(browser("/api/command", { method: "POST", jar, json: { command: { type: "turn/end", slots: [], basedOn: v }, basedOn: v } }), plumbing);
    expect(reply.status).toBe(503);
    expect(reply.headers.get("retry-after")).toBe("5");
    expect(await reply.json()).toMatchObject({ ok: false, code: "unavailable", retryAfter: 5 });
    expect(request.count).toBe(1);
    // The auth library's line, with the driver's code, then the request's, with the status it was answered.
    const lines = error.mock.calls.map((call) => String(call[0]));
    expect(lines.map((line) => JSON.parse(line) as Record<string, unknown>)).toEqual([
      expect.objectContaining({ level: "error", what: "auth", cause: "DatabaseUnavailable", code: "ECONNREFUSED" }),
      expect.objectContaining({ level: "error", what: "request", method: "POST", path: "/api/command", status: 503 }),
    ]);
    for (const line of lines) {
      for (const secret of ["ada@example.com", "203.0.113.7", jar.header(), "turn/end", SECRET]) expect(line).not.toContain(secret);
    }
  });
});
