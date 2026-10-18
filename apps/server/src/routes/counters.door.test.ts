import type { CounterTotal } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { utcDay } from "../ops/day";
import { dayName } from "../analytics/day";
import { testServer } from "../authority/authority.testing";
import type { TestServer } from "../authority/authority.testing";
import type { Limiter } from "../deps";
import { openLimiters } from "../deps";

async function post(server: TestServer, rows: unknown[], headers: Record<string, string> = {}): Promise<Response> {
  return server.app.request("/api/counters", { method: "POST", headers: { "content-type": "text/plain", "cf-connecting-ip": "203.0.113.9", ...headers }, body: JSON.stringify({ rows }) });
}

const door = (key: string, count = 1) => ({ name: "screen/opened", key, count });

async function stored(server: TestServer): Promise<CounterTotal[]> {
  return server.deps.stores.counters.days("2000-01-01", "2100-01-01");
}

describe("the door's screens sent signed out", () => {
  test("[R-ANALYTICS-004] [R-ANALYTICS-008] given a batch with no session holding only the door's three screens, when it is sent, then each is counted under the request's region and nothing is dropped", async () => {
    const server = testServer();
    expect((await post(server, [door("door-1", 2), door("door-2"), door("page")], { "cf-ipcountry": "GB" })).status).toBe(204);
    const day = dayName(utcDay(server.deps.now()));
    expect(await stored(server)).toEqual([
      { day, region: "GB", name: "screen/opened", key: "door-1", count: 2 },
      { day, region: "GB", name: "screen/opened", key: "door-2", count: 1 },
      { day, region: "GB", name: "screen/opened", key: "page", count: 1 },
    ]);
  });

  test("[R-ANALYTICS-004] given a batch with no session holding the door beside another screen, a load time and an ask, when it is sent, then only the door is counted and the batch is dropped signed out once; a country that is not a code counts under the unknown region", async () => {
    const server = testServer();
    await post(server, [door("door-1"), door("wallet"), { name: "load/time", key: "1s-3s", count: 1 }, { name: "ask/shown", key: "sign-in:after", count: 1 }], { "cf-ipcountry": "T1" });
    const day = dayName(utcDay(server.deps.now()));
    expect(await stored(server)).toEqual([
      { day, region: "XX", name: "analytics/dropped", key: "signed-out", count: 1 },
      { day, region: "XX", name: "screen/opened", key: "door-1", count: 1 },
    ]);
  });

  test("[R-ANALYTICS-004] [R-SERVER-026] given an address over the anonymous limit, when a door batch is sent with no session, then nothing is counted", async () => {
    let allowed = 1;
    const anon60s: Limiter = { limit: () => Promise.resolve({ success: allowed-- > 0 }) };
    const server = testServer({ limits: { ...openLimiters, anon60s } });
    await post(server, [door("door-1")], { "cf-ipcountry": "NG" });
    await post(server, [door("door-1")], { "cf-ipcountry": "NG" });
    expect((await stored(server)).map((row) => [row.key, row.count])).toEqual([["door-1", 1]]);
  });
});
