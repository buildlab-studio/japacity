import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { utcDay } from "../admin/day";
import { testDeps } from "../app.testing";
import { makeApp } from "../app";
import { harness } from "../auth/auth.testing";
import { testConfig } from "../config";
import { testSession } from "../deps";
import { dayName } from "./day";

describe("counted the moment the server acts", () => {
  test("[R-ANALYTICS-008] [R-ACCOUNT-023] given a guest made one day and secured the next, when it secures, then it is counted as secured and as the funnel's last step that day, and on its sign-up day for conversion, by region", async () => {
    // The auth library dates the age pass by the machine's clock, so the test starts there.
    let now = Date.now();
    const h = harness({ now: () => now });
    const signedUp = utcDay(now);
    const { jar } = await h.guest(undefined, { country: "GB" });
    now += time.DAY_MS;

    expect((await h.secureByCode(jar, "ada@example.com")).status).toBe(200);

    const rows = await h.deps.stores.counters.days("2000-01-01", "2100-01-01");
    expect(rows.filter((row) => row.name !== "command/rejected" && row.name !== "analytics/dropped")).toEqual([
      { day: dayName(signedUp), region: "GB", name: "players/secured-by-signup", key: "GB", count: 1 },
      { day: dayName(signedUp + 1), region: "GB", name: "funnel/step", key: "secured", count: 1 },
      { day: dayName(signedUp + 1), region: "GB", name: "players/secured", key: "GB", count: 1 },
    ]);
  });

  test("[R-ANALYTICS-008] [R-MODERATION-020] [R-ANALYTICS-007] given feedback kept from two regions and one refused, when they are sent, then feedback/sent counts the kept ones by region and holds no text", async () => {
    const config = testConfig({ testing: { testLogin: true } });
    const deps = testDeps({ config, session: testSession(config), now: () => Date.UTC(2026, 9, 8, 12, 0, 0) });
    const app = makeApp(deps);
    const send = (account: string, text: string, country: string) =>
      app.request("/api/feedback", { method: "POST", headers: { "content-type": "application/json", "cf-ipcountry": country, "x-test-account": account }, body: JSON.stringify({ text, build: "b-41.a1b2c3d", screen: "month", mode: "high" }) });

    expect((await send("account.a", "The bank screen is slow.", "NG")).status).toBe(200);
    expect((await send("account.b", "Love the radio.", "GB")).status).toBe(200);
    expect((await send("account.c", "", "NG")).status).toBe(400);

    const day = dayName(utcDay(deps.now()));
    const rows = (await deps.stores.counters.days(day, day)).filter((row) => row.name === "feedback/sent");
    expect(rows).toEqual([
      { day, region: "GB", name: "feedback/sent", key: "GB", count: 1 },
      { day, region: "NG", name: "feedback/sent", key: "NG", count: 1 },
    ]);
    expect(JSON.stringify(rows)).not.toContain("slow");
  });
});
