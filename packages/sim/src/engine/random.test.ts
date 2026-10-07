import { describe, expect, test } from "vitest";

import { characterRandom, createRandom, drawAt, hashString32, mix32, scaleDraw, streamBase } from "./random";

describe("[R-ENGINE-005] random streams", () => {
  test("[R-ENGINE-005] given fixed inputs, when hashed and mixed, then the outputs match the recorded table", () => {
    // Recorded from this implementation on 7 Oct 2026. A change here changes every save.
    expect(hashString32("")).toBe(2166136261);
    expect(hashString32("a")).toBe(3826002220);
    expect(mix32(0)).toBe(0);
    expect(mix32(1)).toBe(2261973619);
    expect(mix32(0xffffffff)).toBe(2578835075);
    expect(streamBase("seed-1", "job")).toBe(592005890);
  });

  test("[R-ENGINE-005] given a seed and a stream, when the nth draw is asked for, then it matches the recorded table", () => {
    const table: [n: number, job: number, visa: number, otherSeed: number][] = [
      [0, 1809801276, 4150217887, 2488316655],
      [1, 3504607873, 1545353090, 4065391588],
      [2, 169504265, 371442000, 879537946],
      [3, 819378136, 794051127, 81915048],
      [10, 200731130, 211658552, 4291130014],
      [1000, 4109868890, 2416924374, 3351132967],
    ];
    for (const [n, job, visa, other] of table) {
      expect(drawAt("seed-1", "job", n)).toBe(job);
      expect(drawAt("seed-1", "visa", n)).toBe(visa);
      expect(drawAt("seed-2", "job", n)).toBe(other);
    }
  });

  test("[R-ENGINE-005] given a draw position, when asked twice, then the answer is the same and depends on nothing else", () => {
    const counts = {};
    const random = characterRandom("seed-1", counts);
    const first = [random.int("job", 1000), random.int("job", 1000), random.int("job", 1000)];
    const again = characterRandom("seed-1", {});
    expect([again.int("job", 1000), again.int("job", 1000), again.int("job", 1000)]).toEqual(first);
    expect(counts).toEqual({ job: 3 });
  });

  test("[R-ENGINE-005] given draws on one stream, when another stream is read, then its draws are unchanged", () => {
    const quiet = characterRandom("seed-1", {});
    const expected = [quiet.int("visa", 100), quiet.int("visa", 100)];

    const noisy = characterRandom("seed-1", {});
    for (let i = 0; i < 50; i += 1) noisy.int("job", 100);
    noisy.chance("fraud", 5000);
    expect([noisy.int("visa", 100), noisy.int("visa", 100)]).toEqual(expected);
  });

  test("[R-ENGINE-005] given the bound methods, when used, then they match the recorded values and count draws", () => {
    const counts: Record<string, number> = {};
    const random = createRandom("seed-1", counts);
    expect(random.int("job", 6)).toBe(2);
    expect(random.int("job", 6)).toBe(4);
    expect(random.int("visa", 100)).toBe(96);
    expect(random.between("job", 5, 9)).toBe(5);
    expect(random.chance("fraud", 3500)).toBe(false);
    expect(random.chance("fraud", 10000)).toBe(true);
    expect(random.chance("fraud", 0)).toBe(false);
    expect(counts).toEqual({ job: 3, visa: 1, fraud: 3 });
  });

  test("[R-ENGINE-005] given a chance of 0 or 10000, when drawn, then the stream still advances by one", () => {
    const counts: Record<string, number> = {};
    const random = createRandom("s", counts);
    random.chance("fraud", 0);
    random.chance("fraud", 10000);
    expect(counts).toEqual({ fraud: 2 });
  });

  test("[R-ENGINE-005] given many draws, when scaled to a small range, then every value appears about equally often", () => {
    const random = characterRandom("uniform", {});
    const buckets = new Array<number>(10).fill(0);
    const draws = 20000;
    for (let i = 0; i < draws; i += 1) {
      const bucket = random.int("gig", 10);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(draws / 10 - 300);
      expect(count).toBeLessThan(draws / 10 + 300);
    }
  });

  test("[R-ENGINE-005] given a bad position or range, when asked, then it throws", () => {
    expect(() => drawAt("s", "job", -1)).toThrow(/from 0/);
    expect(() => drawAt("s", "job", 1.5)).toThrow(/from 0/);
    expect(() => scaleDraw(1, 0)).toThrow(/from 1/);
    const random = characterRandom("s", {});
    expect(() => random.between("job", 5, 4)).toThrow(/min <= max/);
    expect(() => random.chance("job", 1.5)).toThrow(/whole/);
  });
});
