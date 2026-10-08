import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { testDeps } from "../app.test";
import { makeApp } from "../app";
import { testConfig } from "../config";
import { testSession } from "../deps";
import { dayOf, dropOldFeedback } from "../moderation/feedback";

const ADMIN = "account.admin";
const NOON = Date.UTC(2026, 9, 8, 12, 0, 0);

function setup() {
  const config = testConfig({ testing: { testLogin: true }, admin: { accounts: [ADMIN] } });
  let now = NOON;
  const deps = testDeps({ config, session: testSession(config), now: () => now });
  const app = makeApp(deps);
  const send = (account: string | null, body: unknown, country = "NG") =>
    app.request("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-ipcountry": country, ...(account === null ? {} : { "x-test-account": account }) },
      body: JSON.stringify(body),
    });
  return {
    deps,
    app,
    send,
    at: (ms: number) => {
      now = ms;
    },
  };
}

const feedback = (text: string) => ({ text, build: "b-41.a1b2c3d", screen: "month", mode: "high" });

describe("feedback", () => {
  test("[R-MODERATION-020] given a text at the longest allowed and one character over, when each is sent, then the first is kept and the second refused; characters are counted as code points", async () => {
    const { send, deps } = setup();
    const max = deps.config.feedback.maxChars;

    expect((await send("account.a", feedback("a".repeat(max)))).status).toBe(200);
    const over = await send("account.b", feedback("a".repeat(max + 1)));
    expect(over.status).toBe(400);
    expect(await over.json()).toMatchObject({ ok: false, code: "not-legal" });
    expect((await send("account.c", feedback("😀".repeat(max)))).status).toBe(200);
    expect((await send("account.d", feedback("😀".repeat(max + 1)))).status).toBe(400);
    expect((await deps.stores.feedback.list(10)).map((row) => [...row.text].length)).toEqual([max, max]);
  });

  test("[R-MODERATION-020] given a session that has sent five today, when it sends a sixth, then it is refused until the next UTC day; another session is not counted with it", async () => {
    const { send, deps, at } = setup();
    const statuses: number[] = [];
    for (let sent = 0; sent < deps.config.feedback.perDay + 1; sent += 1) statuses.push((await send("account.a", feedback(`note ${String(sent)}`))).status);

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    const sixth = await send("account.a", feedback("again"));
    expect(await sixth.json()).toEqual({ ok: false, code: "rate-limited", detail: "At most 5 a day.", retryAfter: 12 * 3600 });
    expect(sixth.headers.get("Retry-After")).toBe(String(12 * 3600));
    expect((await send("account.b", feedback("mine"))).status).toBe(200);
    at(Date.UTC(2026, 9, 9, 0, 0, 0) - 1);
    expect((await send("account.a", feedback("still today"))).status).toBe(429);
    at(Date.UTC(2026, 9, 9, 0, 0, 0));
    expect((await send("account.a", feedback("tomorrow"))).status).toBe(200);
  });

  test("[R-MODERATION-020] given feedback sent, when it is stored, then it holds the text, build, screen, mode, day and region and nothing that names the sender", async () => {
    const { send, deps } = setup();
    await send("account.sender-77", { ...feedback("  The map is slow on my phone.  "), mode: "low", screen: "road" }, "GB");

    const [row] = await deps.stores.feedback.list(10);
    expect(row).toEqual({ id: expect.stringMatching(/^feedback\.[0-9a-f]{16}$/) as string, text: "The map is slow on my phone.", build: "b-41.a1b2c3d", screen: "road", mode: "low", day: "2026-10-08", region: "GB" });
    expect(JSON.stringify(row)).not.toContain("sender-77");
  });

  test("[R-MODERATION-020] given no session or a body that is not feedback, when it is sent, then it is refused and nothing is kept", async () => {
    const { send, deps } = setup();
    expect((await send(null, feedback("hello"))).status).toBe(401);
    for (const body of [{}, feedback(""), feedback("   "), { ...feedback("x"), mode: "medium" }, { ...feedback("x"), build: "" }, { ...feedback("x"), screen: "a b" }, { ...feedback("x"), build: "b".repeat(65) }, "text"]) {
      expect((await send("account.a", body)).status).toBe(400);
    }
    expect(await deps.stores.feedback.list(10)).toEqual([]);
  });

  test("[R-MODERATION-020] given feedback from a day, when the daily job runs, then it is kept for the configured days counting its own and dropped on the day after", async () => {
    const { send, deps, at } = setup();
    const keep = deps.config.feedback.keepDays;
    await send("account.a", feedback("old words"));

    at(NOON + (keep - 1) * time.DAY_MS);
    expect(await dropOldFeedback(deps)).toBe(0);
    expect(await deps.stores.feedback.list(10)).toHaveLength(1);
    at(NOON + keep * time.DAY_MS);
    expect(dayOf(deps.now())).toBe("2027-04-06");
    expect(await dropOldFeedback(deps)).toBe(1);
    expect(await deps.stores.feedback.list(10)).toEqual([]);
  });

  test("[R-MODERATION-020] given feedback, when an admin reads the admin view, then it is there and not in the report queue; a player cannot read it", async () => {
    const { send, app } = setup();
    await send("account.a", feedback("Love the bus stop."));
    const read = (account: string) => app.request("/api/admin/moderation/feedback", { headers: { "x-test-account": account } });

    const body = await (await read(ADMIN)).json<{ feedback: { text: string }[] }>();
    expect(body.feedback.map((row) => row.text)).toEqual(["Love the bus stop."]);
    expect((await read("account.a")).status).toBe(404);
    const queue = await (await app.request("/api/admin/moderation/queue", { headers: { "x-test-account": ADMIN } })).json<{ queue: { items: unknown[] } }>();
    expect(queue.queue.items).toEqual([]);
  });
});
