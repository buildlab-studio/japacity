import { fc, test } from "@fast-check/vitest";
import { content } from "@japacity/content";
import { describe, expect } from "vitest";

import { bp, mulDiv } from "../engine/int";
import { drawAt, scaleDraw } from "../engine/random";
import type { Content, Id, NewsEntry } from "../engine/types";
import { seedWhere } from "../testing/world";
import { rateTrack, standInWorld, standInWorlds } from "./standIn";

const { rate } = content.tuning;
const FLOAT: Id<"news"> = "news.naira-float";

/** The real content with tuning or variables changed, for tests about one number. */
function variant(change: { rate?: Partial<Content["tuning"]["rate"]>; vars?: Partial<Record<Id<"var">, number>>; news?: Content["news"] }): Content {
  const vars = { ...content.var };
  for (const [id, start] of Object.entries(change.vars ?? {})) vars[id as Id<"var">] = { id: id as Id<"var">, start: start! };
  return {
    ...content,
    var: vars,
    news: change.news ?? content.news,
    tuning: { ...content.tuning, rate: { ...rate, ...change.rate } },
  };
}

/** A story that is always announced at a fixed tick. */
function story(id: Id<"news">, at: number, standIn: Partial<NewsEntry["standIn"]>): NewsEntry {
  return {
    id,
    touches: [],
    hear: [],
    standIn: { chanceBp: 10000, announce: { between: [at, at] }, rumourLead: 0, forceLag: 2, endsAfter: null, sets: [], revert: false, ...standIn },
  };
}

/** A seed whose schedule has the float, so R-RATE-004 can be seen. */
function seedWithFloat(): { seed: string; tick: number } {
  return seedWhere(content, FLOAT, "in-force");
}

describe("the stand-in world's rates", () => {
  test("[R-RATE-001] given a world seed and a tick, when the world is asked for twice, in any order, then the worlds are equal", () => {
    const later = standInWorld("world-1", 30, content);
    const earlier = standInWorld("world-1", 12, content);
    expect(standInWorld("world-1", 30, content)).toEqual(later);
    expect(standInWorld("world-1", 12, content)).toEqual(earlier);
    const walked = standInWorlds("world-1", 30, content);
    expect(walked[30]).toEqual(later);
    expect(walked[12]).toEqual(earlier);
  });

  test("[R-RATE-001] given two world seeds, when asked at the same tick, then the rates differ", () => {
    expect(standInWorld("world-1", 10, content).rates).not.toEqual(standInWorld("world-2", 10, content).rates);
  });

  test("[R-RATE-002] given tick 0, when the world is read, then the official rates are the start values and every variable has its start value", () => {
    const world = standInWorld("world-1", 0, content);
    expect(world.tick).toBe(0);
    expect(world.rates.GBP.official).toBe(rate.start.GBP);
    expect(world.rates.USD.official).toBe(rate.start.USD);
    for (const entry of Object.values(content.var)) expect(world.vars[entry.id]).toBe(entry.start);
    // Only the opening era's story is on the page at tick 0 (R-DIRECTOR-002).
    expect(world.news.filter((story) => !story.id.startsWith("news.era-"))).toEqual([]);
  });

  test("[R-RATE-002] given tick 1, when the world is read, then both official rates moved by the same factor of drift plus the first noise draw", () => {
    const noise = -rate.noiseBp + scaleDraw(drawAt("world-1", "rate", 0), 2 * rate.noiseBp + 1);
    const factor = 10000 + rate.driftBp + noise;
    const world = standInWorld("world-1", 1, content);
    expect(world.rates.GBP.official).toBe(mulDiv(rate.start.GBP, factor, 10000));
    expect(world.rates.USD.official).toBe(mulDiv(rate.start.USD, factor, 10000));
  });

  test("[R-RATE-002] given no noise, when twelve ticks pass, then each official rate is the drift applied twelve times, rounding down each time", () => {
    const quiet = variant({ rate: { noiseBp: 0 } });
    let pound = rate.start.GBP;
    for (let tick = 1; tick <= 12; tick += 1) pound = mulDiv(pound, 10000 + rate.driftBp, 10000);
    expect(standInWorld("world-1", 12, quiet).rates.GBP.official).toBe(pound);
  });

  test("[R-RATE-003] given tick 0, when the street rate is read, then it is the official rate raised by the floor premium", () => {
    const world = standInWorld("world-1", 0, content);
    expect(world.rates.GBP.street).toBe(rate.start.GBP + bp(rate.start.GBP, rate.premiumFloorBp));
    expect(rateTrack("world-1", 0, content).premiumBp).toBe(rate.premiumFloorBp);
  });

  test("[R-RATE-003] given supply at 100 and no premium noise, when ticks pass, then the premium stays exactly at the floor", () => {
    const flat = variant({ rate: { premiumNoiseBp: 0 }, vars: { "var.fx-supply": 100 }, news: {} });
    for (const tick of [1, 5, 20]) {
      const track = rateTrack("world-1", tick, flat);
      expect(track.premiumBp).toBe(rate.premiumFloorBp);
      const { official, street } = standInWorld("world-1", tick, flat).rates.GBP;
      expect(street).toBe(official + bp(official, rate.premiumFloorBp));
    }
  });

  test("[R-RATE-003] given supply at 40 and no premium noise, when one tick passes, then the premium moves a third of the way to the floor plus 72 for each missing point", () => {
    const short = variant({ rate: { premiumNoiseBp: 0 }, vars: { "var.fx-supply": 40 }, news: {} });
    const target = rate.premiumFloorBp + rate.premiumPerSupplyBp * 60;
    expect(target).toBe(4520);
    const first = rate.premiumFloorBp + mulDiv(target - rate.premiumFloorBp, 1, 3);
    expect(rateTrack("world-1", 1, short).premiumBp).toBe(first);
    const second = first + mulDiv(target - first, 1, 3);
    expect(rateTrack("world-1", 2, short).premiumBp).toBe(second);
    const settled = rateTrack("world-1", 60, short).premiumBp;
    expect(target - settled).toBeLessThan(3);
  });

  test("[R-RATE-003] given a premium above its target, when it falls with noise, then it never goes below the floor", () => {
    const noisy = variant({ rate: { premiumNoiseBp: 400 }, vars: { "var.fx-supply": 100 }, news: {} });
    const premiums = Array.from({ length: 80 }, (_, tick) => rateTrack("world-3", tick, noisy).premiumBp);
    expect(Math.min(...premiums)).toBe(rate.premiumFloorBp);
    expect(Math.max(...premiums)).toBeGreaterThan(rate.premiumFloorBp);
  });

  test("[R-RATE-004] given the float comes into force, when that tick is read, then the premium is 3% and the street rate stays where it was", () => {
    const { seed, tick } = seedWithFloat();
    const before = standInWorld(seed, tick - 1, content);
    const after = standInWorld(seed, tick, content);
    expect(rateTrack(seed, tick, content).premiumBp).toBe(rate.floatPremiumBp);
    for (const currency of ["GBP", "USD"] as const) {
      expect(after.rates[currency].street).toBe(before.rates[currency].street);
      expect(after.rates[currency].official).toBe(mulDiv(before.rates[currency].street, 10000, 10000 + rate.floatPremiumBp));
      // The jump is large: during the scarcity the premium heads for 45%.
      expect(after.rates[currency].official).toBeGreaterThan(before.rates[currency].official);
    }
  });

  test.prop([fc.string({ minLength: 1, maxLength: 10 })], { numRuns: 12 })(
    "[R-RATE-005] given any world seed, when 200 ticks pass, then every rate is whole and above zero and street is never under official",
    (seed) => {
      for (const world of standInWorlds(seed, 200, content)) {
        for (const currency of ["GBP", "USD"] as const) {
          const { official, street } = world.rates[currency];
          expect(Number.isSafeInteger(official) && Number.isSafeInteger(street)).toBe(true);
          expect(official).toBeGreaterThan(0);
          expect(street).toBeGreaterThanOrEqual(official);
        }
      }
    },
  );

  test("[R-RATE-006] given the living-line story, when it comes into force, then the variable holds its start value until that tick and the new value from it", () => {
    const { seed, tick } = seedWhere(content, "news.uk-living-rise", "in-force");
    expect(standInWorld(seed, tick - 1, content).vars["var.uk-living-line"]).toBe(117100);
    expect(standInWorld(seed, tick, content).vars["var.uk-living-line"]).toBe(120300);
    expect(standInWorld(seed, tick + 30, content).vars["var.uk-living-line"]).toBe(120300);
  });

  test("[R-RATE-006] given two stories in force that set the same variable, when both are in force, then the one that came into force later wins", () => {
    const news = {
      "news.a": story("news.a", 5, { sets: [{ var: "var.uk-study-strictness", value: 60 }] }),
      "news.b": story("news.b", 2, { sets: [{ var: "var.uk-study-strictness", value: 80 }] }),
    };
    const both = variant({ news });
    expect(standInWorld("w", 4, both).vars["var.uk-study-strictness"]).toBe(80);
    expect(standInWorld("w", 7, both).vars["var.uk-study-strictness"]).toBe(60);
  });

  test("[R-RATE-006] given a story with revert, when it ends, then its variables go back to what they were before it", () => {
    const news = { "news.a": story("news.a", 3, { sets: [{ var: "var.fx-bank-queue", value: 2 }], endsAfter: 4, revert: true }) };
    const reverting = variant({ news });
    expect(standInWorld("w", 4, reverting).vars["var.fx-bank-queue"]).toBe(0);
    expect(standInWorld("w", 5, reverting).vars["var.fx-bank-queue"]).toBe(2);
    expect(standInWorld("w", 8, reverting).vars["var.fx-bank-queue"]).toBe(2);
    expect(standInWorld("w", 9, reverting).vars["var.fx-bank-queue"]).toBe(0);
    const keeping = variant({ news: { "news.a": { ...news["news.a"], standIn: { ...news["news.a"].standIn, revert: false } } } });
    expect(standInWorld("w", 9, keeping).vars["var.fx-bank-queue"]).toBe(2);
  });

  test("[R-RATE-006] given the scarcity ends as the float comes into force, when that tick is read, then the float's values hold, not the ones from before the scarcity", () => {
    const { seed, tick } = seedWithFloat();
    const during = standInWorld(seed, tick - 1, content).vars;
    expect(during["var.fx-supply"]).toBe(40);
    expect(during["var.fx-bank-queue"]).toBe(2);
    // The scarcity cuts the allowance to a fifth rather than to nothing, so the queue can be seen (news.md).
    expect(during["var.fx-bank-allowance"]).toBe(20000);
    const after = standInWorld(seed, tick, content).vars;
    expect(after["var.fx-supply"]).toBe(90);
    expect(after["var.fx-bank-queue"]).toBe(0);
    expect(after["var.fx-bank-allowance"]).toBe(50000);
  });
});
