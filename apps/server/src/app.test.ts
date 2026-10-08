import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { currentTick, makeApp } from "./app";
import { productionConfig, testConfig } from "./config";
import { memoryStores } from "./deps";
import type { ServerDeps } from "./deps";

export function testDeps(over: Partial<ServerDeps> = {}): ServerDeps {
  let seed = 1;
  return {
    config: testConfig(),
    stores: memoryStores(),
    contents: { current: content, previous: null },
    secrets: { worldSeed: "test-world-seed" },
    now: () => productionConfig.clock.epoch,
    randomBytes: (count) => Uint8Array.from({ length: count }, () => (seed = (seed * 48271) % 2147483647) & 255),
    ...over,
  };
}

describe("the server shell", () => {
  test("[R-CLOCK-001] given the server's clock, when the tick is read, then it is the floor of the time since the epoch over a tick", () => {
    const { epoch, worldTickMs } = productionConfig.clock;
    expect(currentTick(testDeps({ now: () => epoch }))).toBe(0);
    expect(currentTick(testDeps({ now: () => epoch + worldTickMs - 1 }))).toBe(0);
    expect(currentTick(testDeps({ now: () => epoch + worldTickMs }))).toBe(1);
    expect(currentTick(testDeps({ now: () => epoch + 14 * worldTickMs }))).toBe(14);
  });

  test("[R-CLOCK-002] given the default epoch, when it is read, then it is a Friday at 18:00 UTC", () => {
    const epoch = new Date(productionConfig.clock.epoch);
    expect(epoch.getUTCDay()).toBe(5);
    expect(epoch.getUTCHours()).toBe(18);
    expect(epoch.getUTCMinutes()).toBe(0);
  });

  test("[R-ACCOUNT-005] [R-CLOCK-009] given the production config, when its test switches are read, then every one is off", () => {
    expect(Object.values(productionConfig.testing).every((on) => on === false)).toBe(true);
    expect(testConfig({ testing: { fastClock: true } }).testing.fastClock).toBe(true);
    expect(productionConfig.testing.fastClock).toBe(false);
  });

  test("given the app, when health is fetched, then it answers with the content version and the tick", async () => {
    const reply = await makeApp(testDeps()).request("/api/health");
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ ok: true, content: content.version, tick: 0 });
  });
});
