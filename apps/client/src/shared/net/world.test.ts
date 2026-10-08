import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { WORLD_SPREAD_MS, worldSchedule } from "./world";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the world on its schedule", () => {
  test("[R-CLOCK-019] given the next tick in 10 seconds and a random wait of 25 seconds, then the world is fetched at 35 seconds and not before", () => {
    let fetched = 0;
    const asked: number[] = [];
    const schedule = worldSchedule({ now: () => 0, random: (below) => (asked.push(below), 25_000), due: () => (fetched += 1) });
    schedule.at(10_000);
    vi.advanceTimersByTime(34_999);
    expect(fetched).toBe(0);
    vi.advanceTimersByTime(1);
    expect(fetched).toBe(1);
    expect(asked).toEqual([WORLD_SPREAD_MS + 1]);
    expect(WORLD_SPREAD_MS).toBe(60_000);
  });

  test("[R-CLOCK-019] given the longest random wait, then it is 60 seconds after the tick", () => {
    let fetched = 0;
    const schedule = worldSchedule({ now: () => 0, random: (below) => below - 1, due: () => (fetched += 1) });
    schedule.at(1000);
    vi.advanceTimersByTime(60_999);
    expect(fetched).toBe(0);
    vi.advanceTimersByTime(1);
    expect(fetched).toBe(1);
  });

  test("[R-CLOCK-019] given the same tick planned twice, then the first plan stands and the world is fetched once", () => {
    let fetched = 0;
    let draws = 0;
    const schedule = worldSchedule({ now: () => 0, random: () => (draws += 1, 0), due: () => (fetched += 1) });
    schedule.at(1000);
    schedule.at(1000);
    vi.advanceTimersByTime(1000);
    expect(fetched).toBe(1);
    expect(draws).toBe(1);
  });
});
