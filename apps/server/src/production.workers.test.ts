/// <reference types="@cloudflare/vitest-plugin/types" />
import type { PresenceReply, ServerRejection } from "@japacity/api";
import { content, text } from "@japacity/content";
import { connect, pgStores } from "@japacity/db";
import type { Connection, Queries } from "@japacity/db";
import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

import { productionConfig } from "./config";
import { memoryStores, openLimiters } from "./deps";
import worker from "./index";
import { makeApp } from "./app";
import { newLife, testServer } from "./authority/authority.testing";
import { placePresenceStore, readsToday } from "./place/place.presence";
import { freshRooms, listenTo, until } from "./place/place.testing";
import { roomCounts } from "./place/place.rooms";
import { isolateFor, openRequest, placeOfIn, profileOfIn } from "./production";
import { placeSocketRoutes } from "./routes/place";

/** A connection that is never asked anything: these tests build the stores and close them. */
function idle(closed: string[]): (url: string) => Promise<Connection> {
  return (url) => {
    const handle = { read: () => Promise.reject(new Error("not asked")), transaction: () => Promise.reject(new Error("not asked")) };
    return Promise.resolve({ handle, db: {} as Queries, close: () => Promise.resolve(void closed.push(url)) });
  };
}

const BASE = {
  config: productionConfig,
  contents: { current: content, previous: null },
  secrets: { worldSeed: "w", banSalt: "b", drawTokenKey: "d" },
  limits: openLimiters,
  text,
  now: () => productionConfig.clock.epoch,
  randomBytes: (count: number) => new Uint8Array(count),
};

describe("the Worker on Postgres", () => {
  test("[R-SERVER-002] [R-SERVER-016] given the Workers runtime, when the Worker and @japacity/db are loaded, then pg is importable there and the entry exports its handlers", async () => {
    expect(typeof worker.fetch).toBe("function");
    expect(typeof worker.scheduled).toBe("function");
    expect(Object.keys(pgStores({ read: () => Promise.reject(new Error("x")), transaction: () => Promise.reject(new Error("x")) })).sort()).toContain("player");
    // Nothing listens on port 1: the pg client loads and fails to connect, as it would without the database.
    await expect(connect("postgres://test:test@127.0.0.1:1/test")).rejects.toThrow();
  });

  test("[R-SERVER-002] given two requests, when each opens its scope, then each has its own client and every store, the presence on the place objects, and the switch and counter stores shared by the isolate", async () => {
    const closed: string[] = [];
    const isolate = isolateFor({ connectionString: "postgres://game", place: env.PLACE }, BASE, idle(closed));
    const first = await openRequest(isolate, "postgres://game", idle(closed));
    const second = await openRequest(isolate, "postgres://game", idle(closed));
    expect(Object.keys(first.deps.stores).sort()).toEqual(Object.keys(memoryStores()).sort());
    expect(readsToday(first.deps.stores.presence)).toBe(true);
    expect(first.deps.stores.player).not.toBe(second.deps.stores.player);
    expect(first.deps.stores.switches).toBe(second.deps.stores.switches);
    expect(first.deps.stores.counters).toBe(second.deps.stores.counters);
    await first.close();
    await second.close();
    expect(closed).toEqual(["postgres://game", "postgres://game"]);
  });
});

describe("the socket on the production readers", () => {
  test("[R-CITY-036] [R-CLOCK-028] given two characters at home, when one opens the socket on the hub the client sends, then it is let in and the other's presence fetch shows it by name and look; a socket on another place is refused", async () => {
    const rooms = freshRooms();
    const server = testServer({ stores: { ...memoryStores(), presence: placePresenceStore(rooms) } });
    await newLife(server, "account-a", "scenario.ada");
    await newLife(server, "account-b", "scenario.tunde");
    const app = makeApp(server.deps).route("/", placeSocketRoutes(server.deps, { rooms, placeOf: placeOfIn(server.deps), profileOf: profileOfIn(server.deps, text) }));
    const headers = (account: string, upgrade: boolean): Record<string, string> => ({ "x-test-account": account, "cf-ipcountry": "NG", ...(upgrade ? { upgrade: "websocket" } : {}) });

    const elsewhere = await app.request("/api/place/place.family-house/socket", { headers: headers("account-a", true) });
    expect(elsewhere.status).toBe(409);
    expect((await elsewhere.json<ServerRejection>()).detail).toContain("place.ojuelegba");

    const opened = await app.request("/api/place/place.ojuelegba/socket", { headers: headers("account-a", true) });
    expect(opened.status).toBe(101);
    const end = opened.webSocket;
    if (end === null) throw new Error("no socket");
    end.accept();
    listenTo(end);
    await until(async () => ((await roomCounts(rooms, "place.ojuelegba"))[0] ?? 0) === 1, "the socket to join the room");

    const fetched = await (await app.request("/api/place/place.ojuelegba", { headers: headers("account-b", false) })).json<PresenceReply>();
    expect(fetched.others).toEqual([{ name: text["share.first-name.scenario.ada"], look: "scenario.ada" }]);
    end.close();
  });
});
