import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { rejectionCounts } from "../ops/rejections";
import { call, newLife, restMonth, send, testServer } from "../authority/authority.testing";
import type { TestServer } from "../authority/authority.testing";
import type { Limiter } from "../deps";
import { openLimiters } from "../deps";

async function rejected(server: TestServer, code: string, region = "NG"): Promise<number> {
  const day = time.dayName(time.utcDay(server.deps.now()));
  const rows = await server.deps.stores.counters.days(day, day);
  return rows.find((row) => row.name === "command/rejected" && row.key === code && row.region === region)?.count ?? 0;
}

const isolate = (code: string) => (rejectionCounts() as Record<string, number | undefined>)[code] ?? 0;

describe("refusals counted by code", () => {
  test("[R-SERVER-005] [R-ANALYTICS-008] [R-SERVER-046] given a stale command and an accepted one, when each is answered, then only the stale one is counted, in the isolate and as the day's command/rejected total for the account's region; a stale preset is counted as well", async () => {
    const server = testServer();
    await newLife(server, "acc-1");
    const before = isolate("stale");

    expect((await send(server, "acc-1", restMonth({ v: 0 }), 5)).body).toMatchObject({ ok: false, code: "stale" });
    expect((await send(server, "acc-1", restMonth({ v: 0 }))).body).toMatchObject({ ok: true });

    expect(isolate("stale") - before).toBe(1);
    expect(await rejected(server, "stale")).toBe(1);
    const day = time.dayName(time.utcDay(server.deps.now()));
    expect((await server.deps.stores.counters.days(day, day)).filter((row) => row.name === "command/rejected")).toHaveLength(1);

    // R-SERVER-046: the prologue's preset is a command route too, its refusals counted the same way.
    expect((await call(server, "POST", "/api/prologue/preset", "acc-1", { archetype: "developer", age: 0, home: "family-house", basedOn: 5 })).body).toMatchObject({ ok: false, code: "stale" });
    expect(isolate("stale") - before).toBe(2);
    expect(await rejected(server, "stale")).toBe(2);
  });

  test("[R-SERVER-005] [R-SERVER-025] [R-ANALYTICS-008] given a command over the limit and one with no session, when they are refused before the route, then rate-limited and signed-out are counted, the second under the unknown region", async () => {
    // One request passes: the character's own.
    let allowed = 1;
    const refusing: Limiter = { limit: () => Promise.resolve({ success: allowed-- > 0 }) };
    const server = testServer({ limits: { ...openLimiters, commands10s: refusing } });
    await newLife(server, "acc-1");

    expect((await send(server, "acc-1", restMonth({ v: 0 }))).status).toBe(429);
    expect((await call(server, "POST", "/api/command", null, { command: restMonth({ v: 0 }), basedOn: 0 })).status).toBe(401);

    expect(await rejected(server, "rate-limited")).toBe(1);
    expect(await rejected(server, "signed-out", "XX")).toBe(1);
  });

  test("[R-ANALYTICS-008] given a people route's refusal and a read, when they are answered, then the refusal's code is counted and the read adds nothing", async () => {
    const server = testServer();
    await newLife(server, "acc-1");

    const linked = await call<{ ok: boolean; code?: string }>(server, "POST", "/api/invite/no-such-code/accept", "acc-1", { slot: "partner" });
    expect(linked.body.ok).toBe(false);
    expect(await rejected(server, linked.body.code ?? "")).toBe(1);
    await call(server, "GET", "/api/view", "acc-1");
    const day = time.dayName(time.utcDay(server.deps.now()));
    expect((await server.deps.stores.counters.days(day, day)).map((row) => row.key)).toEqual([linked.body.code]);
  });
});
