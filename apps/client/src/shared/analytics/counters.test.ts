import type { CounterBatch, CounterRow } from "@japacity/api";
import { content } from "@japacity/content";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { loadBand, makeCounters, packBatches } from "./counters";
import { countAsk, counting, setUsageCounts, startCounting } from "./start";

const { batchSeconds, maxBatchBytes, maxCount } = content.tuning.analytics;
const bytes = (text: string) => new TextEncoder().encode(text).length;
const rowsIn = (bodies: readonly string[]) => bodies.flatMap((body) => (JSON.parse(body) as CounterBatch).rows);

function sink() {
  const sent: string[] = [];
  return { sent, counters: makeCounters({ send: (body) => sent.push(body) }) };
}

describe("the interface counters", () => {
  test("[analytics:client-sends-interface-counts] [analytics:game-counters-from-server] given names and keys on and off the list, when they are counted, then only the client's listed names with allowed keys are sent", () => {
    const { sent, counters } = sink();
    counters.count("screen/opened", "wallet");
    counters.count("screen/opened", "wallet", 2);
    counters.count("advert/impression", "advert.board-one");
    counters.count("turns/ended", "NG", 5);
    counters.count("players/active", "NG");
    counters.count("screen/opened", "my secret password");
    counters.count("advert/impression", "hello there");
    counters.count("screen/typed", "wallet");
    counters.count("screen/opened", "route", 0);
    counters.flush();

    expect(rowsIn(sent)).toEqual([
      { name: "screen/opened", key: "wallet", count: 3 },
      { name: "advert/impression", key: "advert.board-one", count: 1 },
    ]);
  });

  test("[analytics:client-batches-counters] given rows that fill a batch to exactly the largest size, when they are packed, then they go as one; one byte more and they go as two, none over the size", () => {
    const row = (key: string): CounterRow => ({ name: "advert/impression", key, count: 1 });
    const two = (extra: number) => [row("advert.a"), row(`advert.b${"b".repeat(extra)}`)];
    const base = bytes(packBatches(two(0), maxBatchBytes)[0] ?? "");
    const filled = two(maxBatchBytes - base);

    const atLimit = packBatches(filled, maxBatchBytes);
    expect(atLimit).toHaveLength(1);
    expect(bytes(atLimit[0] ?? "")).toBe(maxBatchBytes);

    const over = packBatches(two(maxBatchBytes - base + 1), maxBatchBytes);
    expect(over).toHaveLength(2);
    for (const body of over) expect(bytes(body)).toBeLessThanOrEqual(maxBatchBytes);
    expect(rowsIn(over)).toEqual(two(maxBatchBytes - base + 1));
  });

  test("[analytics:client-batches-counters] [analytics:server-checks-every-batch] given more counted than one batch or one row may carry, when it is flushed, then every body is within the size and every count within the largest", () => {
    const { sent, counters } = sink();
    for (let index = 0; index < 600; index += 1) counters.count("advert/impression", `advert.slot-${String(index)}`);
    counters.count("screen/opened", "news", maxCount * 2 + 1);
    counters.flush();

    expect(sent.length).toBeGreaterThan(1);
    for (const body of sent) expect(bytes(body)).toBeLessThanOrEqual(maxBatchBytes);
    const news = rowsIn(sent).filter((row) => row.key === "news");
    expect(news.map((row) => row.count)).toEqual([maxCount, maxCount, 1]);
    expect(rowsIn(sent)).toHaveLength(603);
  });

  test("[analytics:player-can-stop-usage-counts] given usage counts turned off, when anything is counted and flushed, then nothing is sent, and what was held before is dropped", () => {
    const { sent, counters } = sink();
    counters.count("screen/opened", "wallet");
    counters.setEnabled(false);
    counters.count("screen/opened", "route");
    counters.ask("sign-in", "shown", true);
    counters.flush();
    expect(sent).toEqual([]);

    counters.setEnabled(true);
    counters.count("screen/opened", "route");
    counters.flush();
    expect(rowsIn(sent)).toEqual([{ name: "screen/opened", key: "route", count: 1 }]);
  });

  test("[analytics:day-one-and-seven-return] given asks before and after the early win, when they are counted, then each is keyed by what was asked and when", () => {
    const { sent, counters } = sink();
    counters.ask("sign-in", "shown", true);
    counters.ask("sign-in", "accepted", true);
    counters.ask("notify", "shown", false);
    counters.flush();
    expect(rowsIn(sent)).toEqual([
      { name: "ask/shown", key: "sign-in:after", count: 1 },
      { name: "ask/accepted", key: "sign-in:after", count: 1 },
      { name: "ask/shown", key: "notify:before", count: 1 },
    ]);
  });

  test("[analytics:client-sends-interface-counts] given load times at the band edges, when banded, then each falls in its band", () => {
    expect([0, 999, 1000, 2999, 3000, 9999, 10000].map(loadBand)).toEqual(["under-1s", "under-1s", "1s-3s", "1s-3s", "3s-10s", "3s-10s", "over-10s"]);
  });
});

describe("counting against the server", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("[analytics:client-batches-counters] given the game started online, when a batch period passes and when the page is hidden, then a batch goes by beacon to /api/counters, and nothing is written to the device", async () => {
    const beacons: { url: string; body: string }[] = [];
    const pending: Promise<void>[] = [];
    const beacon = (url: string, body: Blob) => {
      pending.push(body.text().then((text) => void beacons.push({ url, body: text })));
      return true;
    };
    startCounting({ baseUrl: "https://game.example/", beacon, now: () => 1500 });
    counting().count("screen/opened", "wallet");
    countAsk("notify", "shown", true);

    vi.advanceTimersByTime(batchSeconds * 1000 - 1);
    expect(pending).toHaveLength(0);
    vi.advanceTimersByTime(1);
    await Promise.all(pending);
    expect(beacons.map((each) => each.url)).toEqual(["https://game.example/api/counters"]);
    expect(rowsIn(beacons.map((each) => each.body))).toEqual([
      { name: "load/time", key: "1s-3s", count: 1 },
      { name: "screen/opened", key: "wallet", count: 1 },
      { name: "ask/shown", key: "notify:after", count: 1 },
    ]);

    counting().count("screen/opened", "route");
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.all(pending);
    expect(rowsIn(beacons.slice(1).map((each) => each.body))).toEqual([{ name: "screen/opened", key: "route", count: 1 }]);

    setUsageCounts(false);
    counting().count("screen/opened", "route");
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.all(pending);
    expect(beacons).toHaveLength(2);

    expect(document.cookie).toBe("");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
