import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { currentTick, makeApp } from "./app";
import { testDeps } from "./app.testing";
import { productionConfig, testConfig } from "./config";
import { TEST_SIGNED_IN_WITH, testSession } from "./deps";

describe("the server shell", () => {
  test("[clock:server-owns-the-clock] given the server's clock, when the tick is read, then it is the floor of the time since the epoch over a tick", () => {
    const { epoch, worldTickMs } = productionConfig.clock;
    expect(currentTick(testDeps({ now: () => epoch }))).toBe(0);
    expect(currentTick(testDeps({ now: () => epoch + worldTickMs - 1 }))).toBe(0);
    expect(currentTick(testDeps({ now: () => epoch + worldTickMs }))).toBe(1);
    expect(currentTick(testDeps({ now: () => epoch + 14 * worldTickMs }))).toBe(14);
  });

  test("[clock:world-tick-length-and-epoch] given the default epoch, when it is read, then it is a Friday at 18:00 UTC", () => {
    const epoch = new Date(productionConfig.clock.epoch);
    expect(epoch.getUTCDay()).toBe(5);
    expect(epoch.getUTCHours()).toBe(18);
    expect(epoch.getUTCMinutes()).toBe(0);
  });

  test("[account:stand-ins-test-sign-in] [clock:production-has-no-fast-clock] given the production config, when its test switches are read, then every one is off", () => {
    expect(Object.values(productionConfig.testing).every((on) => on === false)).toBe(true);
    expect(testConfig({ testing: { fastClock: true } }).testing.fastClock).toBe(true);
    expect(productionConfig.testing.fastClock).toBe(false);
  });

  test("[account:stand-ins-test-sign-in] given the production config, when the test session reads a request with the test header, then no one is signed in", async () => {
    const request = new Request("http://server/api/view", { headers: { "x-test-account": "acc-1" } });
    expect(await testSession(productionConfig)(request)).toBeNull();
    expect(await testSession(testConfig({ testing: { testLogin: true } }))(request)).toEqual({ account: "acc-1", passkey: true });
    request.headers.set(TEST_SIGNED_IN_WITH, "email-code");
    expect(await testSession(testConfig({ testing: { testLogin: true } }))(request)).toEqual({ account: "acc-1", passkey: false });
  });

  test("given the app, when health is fetched, then it answers with the content version and the tick", async () => {
    const reply = await makeApp(testDeps()).request("/api/health");
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ ok: true, content: content.version, tick: 0 });
  });
});
