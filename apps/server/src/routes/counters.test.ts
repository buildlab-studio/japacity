import { content } from "@japacity/content";
import type { AdvertSlotEntry } from "@japacity/sim";
import { time } from "@japacity/sim";
import type { AccountRow, CounterTotal } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { utcDay } from "../ops/day";
import { dayName } from "../analytics/day";
import { signUp, testServer } from "../authority/authority.testing";
import type { TestServer } from "../authority/authority.testing";
import type { Limiter } from "../deps";
import { openLimiters } from "../deps";

const { maxBatchBytes, maxCount, batchesPerHour } = content.tuning.analytics;

async function post(server: TestServer, account: string | null, body: string, headers: Record<string, string> = {}): Promise<Response> {
  return server.app.request("/api/counters", { method: "POST", headers: { "content-type": "text/plain", ...(account === null ? {} : { "x-test-account": account }), ...headers }, body });
}

const batch = (rows: unknown[]) => JSON.stringify({ rows });
const wallet = { name: "screen/opened", key: "wallet", count: 1 };

async function stored(server: TestServer): Promise<CounterTotal[]> {
  return server.deps.stores.counters.days("2000-01-01", "2100-01-01");
}

/** The stored total of one name and key on the server's day, 0 when none. */
async function total(server: TestServer, name: string, key: string, region = "NG"): Promise<number> {
  const day = dayName(utcDay(server.deps.now()));
  return (await stored(server)).find((row) => row.day === day && row.region === region && row.name === name && row.key === key)?.count ?? 0;
}

/** A body of exactly `size` bytes holding the wallet row, padded by a field the server ignores. */
function sized(size: number): string {
  const bare = JSON.stringify({ rows: [wallet], pad: "" });
  return JSON.stringify({ rows: [wallet], pad: "x".repeat(size - bare.length) });
}

async function account(server: TestServer, id: string, over: Partial<AccountRow> = {}): Promise<void> {
  const made = await server.deps.stores.account.create({ id, country: "NG", age: { passed: true, at: 0, method: "declared" }, createdAt: server.deps.now(), character: null, notifyBankFull: false, sendUsageCounts: true, state: "secured", username: id.replaceAll(/\W/g, "_"), usernameChangedAt: null, lastPlayedAt: server.deps.now(), ...over });
  if (!made.ok) throw new Error(made.detail);
}

describe("POST /api/counters", () => {
  test("[R-ANALYTICS-004] given a batch of exactly the largest size, when it is sent, then it is counted; one byte more and it is dropped whole and counted as dropped for its size", async () => {
    const server = testServer();
    await signUp(server, "account.a");
    expect(new TextEncoder().encode(sized(maxBatchBytes)).length).toBe(maxBatchBytes);

    const at = await post(server, "account.a", sized(maxBatchBytes));
    expect(at.status).toBe(204);
    expect(await total(server, "screen/opened", "wallet")).toBe(1);

    const over = await post(server, "account.a", sized(maxBatchBytes + 1));
    expect(over.status).toBe(204);
    expect(await over.text()).toBe("");
    expect(await total(server, "screen/opened", "wallet")).toBe(1);
    expect(await total(server, "analytics/dropped", "size")).toBe(1);
  });

  test("[R-ANALYTICS-004] [R-ANALYTICS-001] given rows the list does not allow, when the batch is sent, then each is dropped silently with a 204 and counted by why, and the rest are counted", async () => {
    const server = testServer();
    await signUp(server, "account.a");
    const reply = await post(
      server,
      "account.a",
      batch([
        wallet,
        { name: "screen/secret", key: "wallet", count: 1 },
        { name: "turns/ended", key: "NG", count: 50 },
        { name: "screen/opened", key: "nowhere", count: 1 },
        { name: "advert/tap", key: "advert.none", count: 1 },
        { name: "screen/opened", key: "route", count: 0 },
        { name: "screen/opened", key: "route", count: maxCount + 1 },
        { name: "screen/opened", key: "route", count: 2.5 },
        { name: "screen/opened", key: "news", count: maxCount },
        "a row",
      ]),
    );
    expect(reply.status).toBe(204);
    expect(await total(server, "screen/opened", "wallet")).toBe(1);
    expect(await total(server, "screen/opened", "news")).toBe(maxCount);
    expect(await total(server, "screen/opened", "route")).toBe(0);
    expect(await total(server, "turns/ended", "NG")).toBe(0);
    expect(await total(server, "analytics/dropped", "name")).toBe(2);
    expect(await total(server, "analytics/dropped", "key")).toBe(2);
    expect(await total(server, "analytics/dropped", "count")).toBe(3);
    expect(await total(server, "analytics/dropped", "shape")).toBe(1);
  });

  test("[R-ANALYTICS-004] given a body that is not a batch, when it is sent, then it answers 204 and counts one dropped batch", async () => {
    const server = testServer();
    await signUp(server, "account.a");
    for (const body of ["not json", "[]", JSON.stringify({ rows: "none" })]) expect((await post(server, "account.a", body)).status).toBe(204);
    expect(await total(server, "analytics/dropped", "shape")).toBe(3);
  });

  test("[R-ANALYTICS-004] given a session at its batches for the hour, when one more is sent, then it is dropped; in the next hour it is counted again", async () => {
    const server = testServer();
    await signUp(server, "account.a");
    for (let sent = 0; sent < batchesPerHour; sent += 1) await post(server, "account.a", batch([wallet]));
    expect(await total(server, "screen/opened", "wallet")).toBe(batchesPerHour);

    await post(server, "account.a", batch([wallet]));
    expect(await total(server, "screen/opened", "wallet")).toBe(batchesPerHour);
    expect(await total(server, "analytics/dropped", "rate")).toBe(1);

    server.wait(time.HOUR_MS);
    await post(server, "account.a", batch([wallet]));
    expect(await total(server, "screen/opened", "wallet")).toBe(batchesPerHour + 1);
  });

  test("[R-ANALYTICS-004] given no session, when a batch is sent, then nothing in it is counted and the drop is counted within the address limit", async () => {
    let allowed = 1;
    const anon60s: Limiter = { limit: () => Promise.resolve({ success: allowed-- > 0 }) };
    const server = testServer({ limits: { ...openLimiters, anon60s } });
    expect((await post(server, null, batch([wallet]))).status).toBe(204);
    expect((await post(server, null, batch([wallet]))).status).toBe(204);
    expect(await stored(server)).toEqual([{ day: dayName(utcDay(server.deps.now())), region: "XX", name: "analytics/dropped", key: "signed-out", count: 1 }]);
  });

  test("[R-ANALYTICS-006] given an account with usage counts turned off, when it sends a batch, then nothing at all is stored, not even a drop", async () => {
    const server = testServer();
    await account(server, "account.off", { sendUsageCounts: false });
    expect((await post(server, "account.off", batch([wallet, { name: "screen/secret", key: "x", count: 1 }]))).status).toBe(204);
    expect((await post(server, "account.off", sized(maxBatchBytes + 1))).status).toBe(204);
    expect(await stored(server)).toEqual([]);

    await account(server, "account.on", { sendUsageCounts: true });
    await post(server, "account.on", batch([wallet]));
    expect(await total(server, "screen/opened", "wallet")).toBe(1);
  });

  test("[R-ANALYTICS-005] given batches from two regions on two days, when they are counted, then each day and region holds its own total and nothing else", async () => {
    const server = testServer();
    await signUp(server, "account.ng");
    await account(server, "account.gb", { country: "GB" });
    await post(server, "account.ng", batch([wallet, { ...wallet, count: 4 }]));
    await post(server, "account.gb", batch([wallet]));
    const first = dayName(utcDay(server.deps.now()));
    server.wait(time.DAY_MS);
    await post(server, "account.ng", batch([wallet]));
    const second = dayName(utcDay(server.deps.now()));

    expect(await stored(server)).toEqual([
      { day: first, region: "GB", name: "screen/opened", key: "wallet", count: 1 },
      { day: first, region: "NG", name: "screen/opened", key: "wallet", count: 5 },
      { day: second, region: "NG", name: "screen/opened", key: "wallet", count: 1 },
    ]);
  });

  test("[R-ANALYTICS-007] given a batch carrying an account, a session, an address and a device beside each row, when it is counted, then only the name, key and count reach the store", async () => {
    const server = testServer();
    await signUp(server, "account.a");
    const extras = { account: "account.a", session: "session-123", ip: "203.0.113.9", userAgent: "Agent/1.0", device: "device-9", name2: "Ada" };
    await post(server, "account.a", JSON.stringify({ ...extras, rows: [{ ...wallet, ...extras }] }), { "user-agent": "Agent/1.0", "cf-connecting-ip": "203.0.113.9" });

    const rows = await stored(server);
    expect(rows).toEqual([{ day: dayName(utcDay(server.deps.now())), region: "NG", name: "screen/opened", key: "wallet", count: 1 }]);
    const text = JSON.stringify(rows);
    for (const value of Object.values(extras)) expect(text).not.toContain(value);
  });

  test("[R-ANALYTICS-004] given advert slots in content, when a tap is counted, then a slot id the content holds is allowed and any other is dropped", async () => {
    const slot: AdvertSlotEntry = { id: "advert.test-board", surface: "billboard", place: "place.lagos", width: 10, height: 10, maxBytes: 1000 };
    const server = testServer({ contents: { current: { ...content, advert: { [slot.id]: slot } }, previous: null } });
    await signUp(server, "account.a");
    await post(server, "account.a", batch([{ name: "advert/tap", key: slot.id, count: 2 }, { name: "advert/tap", key: "advert.other", count: 1 }, { name: "advert/tap", key: "route.uk-student", count: 1 }]));
    expect(await total(server, "advert/tap", slot.id)).toBe(2);
    expect(await total(server, "analytics/dropped", "key")).toBe(2);
  });
});
