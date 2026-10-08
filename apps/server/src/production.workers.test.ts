/// <reference types="@cloudflare/vitest-plugin/types" />
import { content, text } from "@japacity/content";
import { connect, pgStores } from "@japacity/db";
import type { Connection, Queries } from "@japacity/db";
import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

import { productionConfig } from "./config";
import { memoryStores, openLimiters } from "./deps";
import worker from "./index";
import { readsToday } from "./place/place.presence";
import { isolateFor, openRequest } from "./production";

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
