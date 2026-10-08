// A server for tests: in-memory stores, a clock a test moves, open limits and
// the test session, with helpers to sign in, make a character and send
// requests through the app as a client would. Never imported by the Worker.
import { content } from "@japacity/content";
import type { Command, Id, State } from "@japacity/sim";
import { hashState, newState } from "@japacity/sim";
import type { Held } from "@japacity/store";
import type { Hono } from "hono";

import { makeApp } from "../app";
import { productionConfig, testConfig } from "../config";
import type { ServerDeps } from "../deps";
import { memoryStores, openLimiters, testSession } from "../deps";
import type { ServerReply, ViewReply } from "../types";

export interface TestServer {
  deps: ServerDeps;
  app: Hono;
  /** Moves the server's clock to `ms` since 1970. */
  setNow: (ms: number) => void;
  /** Moves the server's clock on by `ms`. */
  wait: (ms: number) => void;
}

/** A test server at the epoch, with `over` in place of any dependency. */
export function testServer(over: Partial<ServerDeps> = {}): TestServer {
  let now = over.config?.clock.epoch ?? productionConfig.clock.epoch;
  let seed = 7;
  const config = over.config ?? testConfig({ testing: { testLogin: true } });
  const deps: ServerDeps = {
    config,
    stores: memoryStores(),
    contents: { current: content, previous: null },
    secrets: { worldSeed: "test-world-seed" },
    limits: openLimiters,
    session: testSession(config),
    now: () => now,
    randomBytes: (count) => Uint8Array.from({ length: count }, () => (seed = (seed * 48271) % 2147483647) & 255),
    ...over,
  };
  return {
    deps,
    app: makeApp(deps),
    setNow: (ms) => {
      now = ms;
    },
    wait: (ms) => {
      now += ms;
    },
  };
}

/** R-ACCOUNT-012: the account row the accounts work makes at sign-in. */
export async function signUp(server: TestServer, account: string): Promise<void> {
  const made = await server.deps.stores.account.create({
    id: account,
    country: "NG",
    age: { passed: true, at: server.deps.now(), method: "declared" },
    createdAt: server.deps.now(),
    character: null,
  });
  if (!made.ok) throw new Error(made.detail);
}

export interface Sent<B> {
  status: number;
  body: B;
  headers: Headers;
  text: string;
}

/** Sends a request through the app as `account` (or with no session when null). */
export async function call<B>(server: TestServer, method: "GET" | "POST", path: string, account: string | null, body?: unknown, ip = "203.0.113.9"): Promise<Sent<B>> {
  const headers: Record<string, string> = { "cf-connecting-ip": ip };
  if (account !== null) headers["x-test-account"] = account;
  if (body !== undefined) headers["content-type"] = "application/json";
  const init: RequestInit = body === undefined ? { method, headers } : { method, headers, body: JSON.stringify(body) };
  const reply = await server.app.request(path, init);
  const text = await reply.text();
  return { status: reply.status, body: JSON.parse(text) as B, headers: reply.headers, text };
}

/** Signs `account` up and makes its character; returns the character's id. */
export async function newLife(server: TestServer, account: string, scenario: Id<"scenario"> = "scenario.ada"): Promise<string> {
  await signUp(server, account);
  const made = await call<ViewReply>(server, "POST", "/api/character", account, { scenario });
  if (!made.body.ok) throw new Error(`No character: ${made.body.code} ${made.body.detail}`);
  const row = await server.deps.stores.account.get(account);
  if (row?.character == null) throw new Error("The account names no character.");
  return row.character;
}

/** Sends a command based on `basedOn`. */
export function send(server: TestServer, account: string, command: Command, basedOn = command.basedOn): Promise<Sent<ServerReply>> {
  return call<ServerReply>(server, "POST", "/api/command", account, { command, basedOn });
}

export function view(server: TestServer, account: string): Promise<Sent<ViewReply>> {
  return call<ViewReply>(server, "GET", "/api/view", account);
}

/** The stored character, which must exist. */
export async function held(server: TestServer, character: string): Promise<Held> {
  const found = await server.deps.stores.player.load(character);
  if (found === null) throw new Error(`No character ${character}.`);
  return found;
}

/** A month with every free slot resting: legal whatever the character owes (R-ENGINE-011). */
export function restMonth(state: { v: number }): Command {
  return { type: "turn/end", slots: [], basedOn: state.v };
}

/** The state a fresh character in `scenario` with `seed` starts from, and its hash. */
export function startOf(scenario: Id<"scenario">, seed: string): { state: State; hash: string } {
  const state = newState(scenario, seed, content);
  return { state, hash: hashState(state) };
}
