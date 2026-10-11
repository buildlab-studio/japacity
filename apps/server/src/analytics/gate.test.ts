import { describe, expect, test } from "vitest";

import { utcDay } from "../admin/day";
import { testServer } from "../authority/testing";
import { dayName } from "./day";
import { countFromGate, gateRows } from "./gate";

describe("the gate's counts", () => {
  test("[R-ANALYTICS-008] given the holding screen, the invite link and a card's arrival, when the gate reports them, then each adds one to the day's total under the visitor's country", async () => {
    const server = testServer();
    const day = dayName(utcDay(server.deps.now()));
    expect(await countFromGate(server.deps, [{ name: "funnel/step", key: "holding" }, { name: "share/arrival", key: "send-off" }], "NG")).toBe(2);
    expect(await countFromGate(server.deps, [{ name: "funnel/step", key: "invited" }], "GB")).toBe(1);
    expect(await countFromGate(server.deps, [{ name: "funnel/step", key: "holding" }], "NG")).toBe(1);

    expect(await server.deps.stores.counters.days(day, day)).toEqual([
      { day, region: "GB", name: "funnel/step", key: "invited", count: 1 },
      { day, region: "NG", name: "funnel/step", key: "holding", count: 2 },
      { day, region: "NG", name: "share/arrival", key: "send-off", count: 1 },
    ]);
  });

  test("[R-ANALYTICS-008] [R-ANALYTICS-004] given a step the gate does not see, a card kind not on the list, a client name, a bad shape and too many rows, when the gate reports them, then none of those is counted", () => {
    const { deps } = testServer();
    expect(gateRows(deps, [{ name: "funnel/step", key: "begin" }], "NG")).toEqual([]);
    expect(gateRows(deps, [{ name: "share/arrival", key: "my-own-kind" }], "NG")).toEqual([]);
    expect(gateRows(deps, [{ name: "screen/opened", key: "door-1" }], "NG")).toEqual([]);
    expect(gateRows(deps, [{ name: "players/active", key: "NG" }], "NG")).toEqual([]);
    expect(gateRows(deps, "rows", "NG")).toEqual([]);
    expect(gateRows(deps, [null, 3, { name: 1, key: "holding" }], "NG")).toEqual([]);
    const many = Array.from({ length: 5 }, () => ({ name: "funnel/step", key: "holding" }));
    expect(gateRows(deps, many, "NG")).toHaveLength(2);
  });

  test("[R-ANALYTICS-007] given a country that is not a country code, or extra fields beside a row, when the gate reports, then the unknown region is used and only the name and key are kept", () => {
    const { deps } = testServer();
    for (const country of [undefined, "", "T1", "nigeria", "ng", 42]) expect(gateRows(deps, [{ name: "funnel/step", key: "holding" }], country).map((row) => row.region)).toEqual(["XX"]);
    const [row] = gateRows(deps, [{ name: "funnel/step", key: "holding", ip: "203.0.113.9", ua: "Mozilla" }], "NG");
    expect(Object.keys(row ?? {}).sort()).toEqual(["count", "day", "key", "name", "region"]);
    expect(JSON.stringify(row)).not.toContain("203.0.113.9");
  });
});
