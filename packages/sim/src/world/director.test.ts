import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Content, EraEntry, Id, NewsEntry, World } from "../engine/types";
import { start } from "../testing/play";
import type { DirectorTick } from "./director";
import { directorTicks } from "./director";
import { standInWorld, standInWorlds } from "./standIn";

const { director } = content.tuning;
const SEEDS = Array.from({ length: 20 }, (_, index) => `director-${String(index)}`);
const CALM: Id<"era"> = "era.calm";
const OTHER: Id<"era"> = "era.crash";
const STUDY_WINDOW: Id<"var"> = "var.uk-study-window";
const STUDY_SURGE: Id<"var"> = "var.uk-study-surge";
const PANDEMIC: Id<"news"> = "news.pandemic-borders";

/** A director story for a test pool. It fires on every roll it is allowed and stays in force for good unless told otherwise. */
function pooled(id: Id<"news">, rules: Partial<NonNullable<NewsEntry["director"]>> = {}, standIn: Partial<NewsEntry["standIn"]> = {}): NewsEntry {
  return {
    id,
    touches: [],
    hear: [],
    director: { group: "test", needs: [], cooldown: 0, once: false, shock: false, endedBy: null, adds: [], ...rules },
    standIn: { chanceBp: 10000, announce: { between: [0, 0] }, rumourLead: 0, forceLag: 2, endsAfter: null, sets: [], revert: false, ...standIn },
  };
}

/** An era for a test, with its story from the real content. */
function era(id: Id<"era">, ticks: [number, number], after: Record<string, number>, weights: Record<string, number> = {}): EraEntry {
  return { id, ticks, weights, after, once: false, story: content.era[id]!.story };
}

/** One calm era longer than any test runs, so era changes stay out of the way. */
const LONG_CALM = { [CALM]: era(CALM, [400, 400], {}) };

/** The real content with a test pool of stories, test eras and the director's numbers changed. */
function withPool(news: NewsEntry[], change: { eras?: Content["era"]; director?: Partial<Content["tuning"]["director"]> } = {}): Content {
  const eras = change.eras ?? LONG_CALM;
  const eraStories = Object.values(eras).map((entry) => content.news[entry.story]!);
  return {
    ...content,
    news: Object.fromEntries([...news, ...eraStories].map((entry) => [entry.id, entry])),
    era: eras,
    tuning: { ...content.tuning, director: { ...director, ...change.director } },
  };
}

/** The ticks on which a story started a pass. */
function starts(ticks: DirectorTick[], id: Id<"news">): number[] {
  return ticks.filter((tick) => tick.started.includes(id)).map((tick) => tick.tick);
}

function stageOf(world: World | DirectorTick, id: Id<"news">) {
  return world.news.find((story) => story.id === id) ?? null;
}

describe("determinism", () => {
  test("[R-DIRECTOR-008] [R-RATE-001] given 20 world seeds, when 300 ticks are built twice and asked for at single ticks, then the worlds are equal", () => {
    for (const seed of SEEDS) {
      const walked = standInWorlds(seed, 300, content);
      expect(standInWorlds(seed, 300, content)).toEqual(walked);
      for (const tick of [0, 37, 150]) expect(standInWorld(seed, tick, content)).toEqual(walked[tick]);
      expect(walked[300]?.era).not.toBeNull();
    }
  });

  test("[R-DIRECTOR-008] given two world seeds, when 300 ticks pass, then their eras or stories differ", () => {
    const one = directorTicks(SEEDS[0]!, 300, content);
    const two = directorTicks(SEEDS[1]!, 300, content);
    expect(one.map((tick) => [tick.era, tick.started])).not.toEqual(two.map((tick) => [tick.era, tick.started]));
  });
});

describe("eras", () => {
  test("[R-DIRECTOR-002] given 20 world seeds, when 300 ticks pass, then calm opens, every era ends inside its range, no era follows itself, each follows one that names it, and a once era runs once", () => {
    const seen = new Set<Id<"era">>();
    for (const seed of SEEDS) {
      const ticks = directorTicks(seed, 300, content);
      expect(ticks[0]?.era).toMatchObject({ id: CALM, since: 0 });
      const runs: NonNullable<World["era"]>[] = [];
      for (const tick of ticks) {
        const running = tick.era!;
        expect(running.since).toBeLessThanOrEqual(tick.tick);
        expect(running.until).toBeGreaterThan(tick.tick);
        if (runs.at(-1)?.since !== running.since) runs.push(running);
      }
      for (const [index, run] of runs.entries()) {
        const entry = content.era[run.id]!;
        seen.add(run.id);
        expect(run.until - run.since).toBeGreaterThanOrEqual(entry.ticks[0]);
        expect(run.until - run.since).toBeLessThanOrEqual(entry.ticks[1]);
        const before = runs[index - 1];
        if (before === undefined) continue;
        expect(run.since).toBe(before.until);
        expect(run.id).not.toBe(before.id);
        expect(entry.after[before.id] ?? 0).toBeGreaterThan(0);
      }
      for (const entry of Object.values(content.era).filter((one) => one.once)) {
        expect(runs.filter((run) => run.id === entry.id).length).toBeLessThanOrEqual(1);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  test("[R-DIRECTOR-002] given an era begins, when that tick is read, then its own story is announced that tick and the story of the era before has ended", () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const ticks = directorTicks(seed, 300, content);
      for (const tick of ticks) {
        const running = tick.era!;
        if (running.since !== tick.tick) continue;
        const story = content.era[running.id]!.story;
        expect(stageOf(tick, story)).toEqual({ id: story, stage: "announced", since: tick.tick });
        const before = ticks[tick.tick - 1]?.era ?? null;
        const endedStories = before === null ? [] : [content.era[before.id]!.story];
        for (const old of endedStories) expect(stageOf(tick, old)).toEqual({ id: old, stage: "ended", since: tick.tick });
      }
    }
  });

  test("[R-DIRECTOR-002] given two eras that each follow only the other, when the eras turn, then they alternate with lengths drawn inside their ranges", () => {
    const eras = { [CALM]: era(CALM, [3, 5], { [OTHER]: 1 }), [OTHER]: era(OTHER, [2, 2], { [CALM]: 1 }) };
    const ticks = directorTicks("w", 60, withPool([], { eras }));
    const order = ticks.map((tick) => tick.era!.id).filter((id, index, all) => id !== all[index - 1]);
    expect(order.slice(0, 6)).toEqual([CALM, OTHER, CALM, OTHER, CALM, OTHER]);
    const lengths = new Set(ticks.filter((tick) => tick.era!.id === CALM).map((tick) => tick.era!.until - tick.era!.since));
    for (const length of lengths) expect([3, 4, 5]).toContain(length);
  });
});

describe("the story roll", () => {
  test("[R-DIRECTOR-003] given a story marked once that may always fire, when 200 ticks pass, then it fires once, on the first tick", () => {
    const ticks = directorTicks("w", 200, withPool([pooled("news.t-once", { once: true })]));
    expect(starts(ticks, "news.t-once")).toEqual([1]);
  });

  test("[R-DIRECTOR-003] given a story with a cooldown of 10, when it may always fire, then it fires every tenth tick and never within its cooldown", () => {
    const ticks = directorTicks("w", 40, withPool([pooled("news.t-cool", { cooldown: 10 })]));
    expect(starts(ticks, "news.t-cool")).toEqual([1, 11, 21, 31]);
  });

  test("[R-DIRECTOR-003] given a story that ends, when it may always fire, then it never runs two passes at once", () => {
    const ticks = directorTicks("w", 40, withPool([pooled("news.t-ends", {}, { rumourLead: 1, endsAfter: 3 })]));
    // A pass: rumour, announced one tick later, in force two after that, ended three after that.
    expect(starts(ticks, "news.t-ends")).toEqual([1, 8, 15, 22, 29, 36]);
  });

  test("[R-DIRECTOR-003] given four stories that may always fire, when a tick is rolled, then at most the most allowed are announced, in id order", () => {
    const pool = ["news.t-a", "news.t-b", "news.t-c", "news.t-d"].map((id) => pooled(id as Id<"news">, { once: true }));
    const ticks = directorTicks("w", 6, withPool(pool));
    expect(director.maxNewPerTick).toBe(2);
    expect(ticks[1]?.started).toEqual(["news.t-a", "news.t-b"]);
    expect(ticks[2]?.started).toEqual(["news.t-c", "news.t-d"]);
    const three = directorTicks("w", 6, withPool(pool, { director: { maxNewPerTick: 3 } }));
    expect(three[1]?.started).toEqual(["news.t-a", "news.t-b", "news.t-c"]);
  });

  test("[R-DIRECTOR-003] given two shocks that may always fire, when one era runs, then the second waits out the gap and neither fires twice in the era", () => {
    const pool = [pooled("news.t-shock-a", { shock: true }), pooled("news.t-shock-b", { shock: true })];
    const ticks = directorTicks("w", 100, withPool(pool));
    expect(director.shockGapTicks).toBe(6);
    expect(starts(ticks, "news.t-shock-a")).toEqual([1]);
    expect(starts(ticks, "news.t-shock-b")).toEqual([1 + director.shockGapTicks]);
    const wider = directorTicks("w", 100, withPool(pool, { director: { shockGapTicks: 9 } }));
    expect(starts(wider, "news.t-shock-b")).toEqual([10]);
  });

  test("[R-DIRECTOR-003] given a shock and eras of 20 ticks, when the eras turn, then it fires again in each new era", () => {
    const eras = { [CALM]: era(CALM, [20, 20], { [OTHER]: 1 }), [OTHER]: era(OTHER, [20, 20], { [CALM]: 1 }) };
    const ticks = directorTicks("w", 70, withPool([pooled("news.t-shock", { shock: true })], { eras }));
    expect(starts(ticks, "news.t-shock")).toEqual([1, 20, 40, 60]);
  });

  test("[R-DIRECTOR-003] given many seeds of the real world, when 300 ticks pass, then no two shocks start within the gap and no shock starts twice in one era", () => {
    const shocks = Object.values(content.news).filter((entry) => entry.director?.shock === true).map((entry) => entry.id);
    expect(shocks.length).toBeGreaterThan(3);
    for (const seed of SEEDS) {
      const ticks = directorTicks(seed, 300, content);
      const fired = ticks.flatMap((tick) => tick.started.filter((id) => shocks.includes(id)).map((id) => ({ id, tick: tick.tick, era: tick.era!.since })));
      for (const [index, shock] of fired.slice(1).entries()) expect(shock.tick - fired[index]!.tick).toBeGreaterThanOrEqual(director.shockGapTicks);
      for (const shock of fired) expect(fired.filter((other) => other.id === shock.id && other.era === shock.era)).toHaveLength(1);
    }
  });

  test("[R-DIRECTOR-003] given the era's weight for a story's group, when it is rolled, then the chance is multiplied by it, and a weight of 0 stops it", () => {
    const eras = { [CALM]: era(CALM, [400, 400], {}, { heavy: 4, muted: 0 }) };
    const heavy = pooled("news.t-heavy", { group: "heavy", once: true }, { chanceBp: 2500 });
    const muted = pooled("news.t-muted", { group: "muted", once: true });
    const plain = pooled("news.t-plain", { group: "plain", once: true }, { chanceBp: 0 });
    for (const seed of SEEDS) {
      const ticks = directorTicks(seed, 30, withPool([heavy, muted, plain], { eras }));
      expect(starts(ticks, "news.t-heavy")).toEqual([1]);
      expect(starts(ticks, "news.t-muted")).toEqual([]);
      expect(starts(ticks, "news.t-plain")).toEqual([]);
    }
  });

  test("[R-DIRECTOR-003] given a story whose needs read a variable and the era, when they do not hold, then it never fires, and when they do it fires", () => {
    const unmet = pooled("news.t-unmet", { needs: [{ type: "var/min", var: STUDY_WINDOW, value: 3 }] });
    const wrongEra = pooled("news.t-era", { needs: [{ type: "era/is", eras: [OTHER] }] });
    const met = pooled("news.t-met", { once: true, needs: [{ type: "any", of: [{ type: "var/max", var: STUDY_WINDOW, value: 2 }] }, { type: "era/is", eras: [CALM] }] });
    const ticks = directorTicks("w", 50, withPool([unmet, wrongEra, met]));
    expect(starts(ticks, "news.t-unmet")).toEqual([]);
    expect(starts(ticks, "news.t-era")).toEqual([]);
    expect(starts(ticks, "news.t-met")).toEqual([1]);
  });
});

describe("stages", () => {
  test("[R-DIRECTOR-004] given a story with a rumour lead, a force lag and an end, when it fires, then it passes each stage on its tick and its sets hold only while in force", () => {
    const story = pooled("news.t-stages", { once: true }, { rumourLead: 2, forceLag: 3, endsAfter: 4, sets: [{ var: "var.fx-bank-queue", value: 5 }], revert: true });
    const ticks = directorTicks("w", 14, withPool([story]));
    const stages = ticks.map((tick) => stageOf(tick, "news.t-stages")?.stage ?? null);
    expect(stages).toEqual([null, "rumour", "rumour", "announced", "announced", "announced", "in-force", "in-force", "in-force", "in-force", "ended", "ended", "ended", "ended", "ended"]);
    expect(ticks.map((tick) => tick.vars["var.fx-bank-queue"])).toEqual([0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 0, 0, 0, 0, 0]);
  });

  test("[R-DIRECTOR-004] given a story ended by another, when that one comes into force, then the first ends on that very tick", () => {
    const ended = pooled("news.t-closes", { once: true, endedBy: "news.t-opens" }, { forceLag: 2, sets: [{ var: "var.uae-window", value: 0 }], revert: true });
    const ender = pooled("news.t-opens", { once: true, needs: [{ type: "var/max", var: "var.uae-window", value: 0 }] }, { forceLag: 3, sets: [{ var: "var.uae-window", value: 2 }] });
    const ticks = directorTicks("w", 30, withPool([ended, ender], { director: { closedTicks: 4 } }));
    const opensInForce = ticks.find((tick) => tick.cameIntoForce.includes("news.t-opens"))!.tick;
    // In force at 3, closed four ticks to 7, announced then, in force three later.
    expect(opensInForce).toBe(10);
    expect(stageOf(ticks[opensInForce - 1]!, "news.t-closes")?.stage).toBe("in-force");
    expect(stageOf(ticks[opensInForce]!, "news.t-closes")).toEqual({ id: "news.t-closes", stage: "ended", since: opensInForce });
    expect(ticks[opensInForce]?.vars["var.uae-window"]).toBe(2);
  });

  test("[R-DIRECTOR-004] given a story that adds to a variable, when it comes into force, then the variable rises by that much from where it was", () => {
    const story = pooled("news.t-adds", { cooldown: 5, adds: [{ var: "var.inflation", value: 300 }] });
    const ticks = directorTicks("w", 12, withPool([story]));
    expect(ticks.map((tick) => tick.vars["var.inflation"])).toEqual([0, 0, 0, 300, 300, 300, 300, 300, 600, 600, 600, 600, 600]);
  });

  test("[R-DIRECTOR-004] given a story with no director fields beside the director's pool, when the world is built, then it keeps its fixed schedule", () => {
    const fixed: NewsEntry = { ...pooled("news.t-fixed", {}, { announce: { between: [5, 5] } }) };
    delete fixed.director;
    const ticks = directorTicks("w", 10, withPool([fixed, pooled("news.t-pooled", { once: true })]));
    expect(starts(ticks, "news.t-fixed")).toEqual([5]);
    expect(starts(ticks, "news.t-pooled")).toEqual([1]);
    expect(stageOf(ticks[7]!, "news.t-fixed")?.stage).toBe("in-force");
  });
});

describe("the policy cycle", () => {
  /** The surge expected one tick on from the window the tick before. */
  function surgeAfter(surge: number, window: number): number {
    if (window >= 2) return Math.min(100, surge + director.surgePerTick);
    if (window === 1) return surge;
    return Math.max(0, surge - 2 * director.surgePerTick);
  }

  test("[R-DIRECTOR-005] given each route's window, when a tick passes, then its surge rises while open, holds while narrowing and falls twice as fast while closed, inside 0 to 100", () => {
    const pairs = Object.keys(content.var)
      .filter((id) => id.endsWith("-window"))
      .map((window) => [window, window.replace(/-window$/, "-surge")] as [Id<"var">, Id<"var">]);
    // Six routes' windows and the two family windows the people milestone added (people.md).
    expect(pairs).toHaveLength(8);
    for (const seed of SEEDS) {
      const ticks = directorTicks(seed, 300, content);
      expect(ticks[1]?.vars[STUDY_SURGE]).toBe(content.var[STUDY_SURGE]!.start + director.surgePerTick);
      for (const tick of ticks.slice(1)) {
        const before = ticks[tick.tick - 1]!;
        // A story that sets or adds to a surge as it comes into force, or takes an add back as it ends (R-DIRECTOR-004).
        const names = (id: Id<"news">, ending: boolean) => {
          const entry = content.news[id];
          const sets = ending ? [] : (entry?.standIn.sets ?? []);
          const adds = ending && entry?.standIn.revert !== true ? [] : (entry?.director?.adds ?? []);
          return [...sets, ...adds].some((one) => pairs.some(([, surge]) => one.var === surge));
        };
        const setByStory = tick.cameIntoForce.some((id) => names(id, false)) || tick.ended.some((id) => names(id, true));
        for (const [window, surge] of pairs) {
          expect(tick.vars[surge]).toBeGreaterThanOrEqual(0);
          expect(tick.vars[surge]).toBeLessThanOrEqual(100);
          if (setByStory && window === STUDY_WINDOW) continue;
          expect(tick.vars[surge]).toBe(surgeAfter(before.vars[surge]!, before.vars[window]!));
        }
      }
    }
  });

  test("[R-DIRECTOR-005] given a reopening, when it is rolled, then its window has been 0 for at least the closed ticks", () => {
    const reopenings = Object.values(content.news).filter((entry) =>
      entry.director?.needs.some((need) => need.type === "var/max" && need.var.endsWith("-window") && need.value === 0),
    );
    expect(reopenings.length).toBe(4);
    let seen = 0;
    for (const seed of Array.from({ length: 200 }, (_, index) => `reopen-${String(index)}`)) {
      const ticks = directorTicks(seed, 200, content);
      for (const entry of reopenings) {
        const window = entry.director!.needs.find((need) => need.type === "var/max")!;
        if (window.type !== "var/max") continue;
        for (const at of starts(ticks, entry.id)) {
          seen += 1;
          for (let back = 0; back <= director.closedTicks; back += 1) expect(ticks[at - back]?.vars[window.var]).toBe(0);
        }
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  test("[R-DIRECTOR-005] given 1000 world seeds, when the UK study route runs its cycle, then it goes open, backlash, restriction, closure, shortage and never skips a step", () => {
    const steps: Record<string, Id<"news">> = {
      backlash: "news.uk-refusals-up",
      restriction: "news.uk-study-narrows",
      closure: "news.uk-study-closes",
      shortage: "news.uk-study-reopens",
    };
    const counted: Record<string, number> = { backlash: 0, restriction: 0, closure: 0, shortage: 0 };
    const broken: string[] = [];
    // Open to narrowing by the restriction, narrowing to closed by the closure, closed to open by the shortage.
    // A closure rolled while narrowing may come into force after the narrowing ran out: 2>0.
    const moves: Record<string, Id<"news">> = { "2>1": steps.restriction!, "1>0": steps.closure!, "2>0": steps.closure!, "0>2": steps.shortage! };
    for (let index = 0; index < 1000; index += 1) {
      const ticks = directorTicks(`cycle-${String(index)}`, 160, content);
      const fail = (tick: DirectorTick, what: string) => broken.push(`cycle-${String(index)} tick ${String(tick.tick)}: ${what}`);
      for (const tick of ticks.slice(1)) {
        const before = ticks[tick.tick - 1]!;
        for (const [step, id] of Object.entries(steps)) if (tick.cameIntoForce.includes(id)) counted[step] = (counted[step] ?? 0) + 1;
        // Each step is rolled only while the one before it holds. The backlash in force is read, as the content
        // reads it, as the strictness it sets; it may be repeating.
        const backlashSeen = ticks.slice(0, tick.tick + 1).some((earlier) => earlier.cameIntoForce.includes(steps.backlash!));
        const restrictionHolds =
          tick.vars[STUDY_WINDOW] === 2 && tick.vars[STUDY_SURGE]! > 40 && tick.vars["var.uk-study-strictness"]! >= 70 && backlashSeen;
        if (tick.started.includes(steps.restriction!) && !restrictionHolds) fail(tick, "restriction rolled without open, surge and backlash");
        // The restriction in force is read, as the content reads it, as the window at 1 (a pandemic's end can put it back after the restriction ran out).
        const closureHolds = tick.vars[STUDY_WINDOW] === 1;
        if (tick.started.includes(steps.closure!) && !closureHolds) fail(tick, "closure rolled without the restriction in force");
        if (tick.started.includes(steps.shortage!) && tick.vars[STUDY_WINDOW] !== 0) fail(tick, "shortage rolled with the window not closed");
        const pandemic = stageOf(tick, PANDEMIC);
        const held = pandemic !== null && (pandemic.stage === "in-force" || (pandemic.stage === "ended" && pandemic.since === tick.tick));
        const move = `${String(before.vars[STUDY_WINDOW])}>${String(tick.vars[STUDY_WINDOW])}`;
        if (before.vars[STUDY_WINDOW] === tick.vars[STUDY_WINDOW] || held) continue;
        // Back from closed to narrowing when the closure runs out, from narrowing to open when the restriction
        // runs out, and from closed to open when both run out on one tick.
        const closureOut = tick.ended.includes(steps.closure!);
        const restrictionOut = tick.ended.includes(steps.restriction!);
        const ranOut = (move === "0>1" && closureOut) || (move === "1>2" && restrictionOut) || (move === "0>2" && closureOut && restrictionOut);
        // A shortage rolled while closed may land after the closure (or the pandemic) ran out and put the narrowing back.
        const rolled = ticks.findLast((earlier) => earlier.started.includes(steps.shortage!));
        const lateShortage = move === "1>2" && tick.cameIntoForce.includes(steps.shortage!) && rolled?.vars[STUDY_WINDOW] === 0;
        const stepped = moves[move] !== undefined && tick.cameIntoForce.includes(moves[move]);
        // A narrowing announced as a closure or the pandemic lands sets 1 over their 0 and gives it back when it ends (R-RATE-006).
        const restrictionPass = tick.cameIntoForce.includes(steps.restriction!) || tick.ended.includes(steps.restriction!);
        if (!ranOut && !lateShortage && !stepped && !restrictionPass) fail(tick, `the window moved ${move} with ${tick.cameIntoForce.join(", ")} in force`);
      }
    }
    expect(broken).toEqual([]);
    for (const step of Object.keys(steps)) expect(counted[step]).toBeGreaterThan(0);
  });

  test("[R-DIRECTOR-005] given the care route, when its closure is rolled, then the backlash before it is in force", () => {
    let closed = 0;
    for (const seed of Array.from({ length: 300 }, (_, index) => `care-${String(index)}`)) {
      for (const tick of directorTicks(seed, 160, content)) {
        if (!tick.started.includes("news.uk-care-closes")) continue;
        closed += 1;
        expect(stageOf(tick, "news.uk-care-sponsors-revoked")?.stage).toBe("in-force");
      }
    }
    expect(closed).toBeGreaterThan(0);
  });
});

describe("December and inflation", () => {
  test("[R-DIRECTOR-006] given 300 ticks, when December's variable is read, then it is 1 on every twelfth tick, the eleventh of each year, and 0 on every other", () => {
    for (const seed of SEEDS.slice(0, 3)) {
      for (const world of standInWorlds(seed, 300, content)) {
        expect(world.vars["var.season-december"]).toBe(world.tick % 12 === 11 ? 1 : 0);
      }
    }
  });

  test("[R-DIRECTOR-006] given the fuel subsidy story, when it comes into force, then inflation rises by its basis points that tick and holds", () => {
    let seen = 0;
    for (const seed of Array.from({ length: 100 }, (_, index) => `fuel-${String(index)}`)) {
      const ticks = directorTicks(seed, 200, content);
      const at = ticks.find((tick) => tick.cameIntoForce.includes("news.fuel-subsidy"));
      if (at === undefined) continue;
      seen += 1;
      const before = ticks[at.tick - 1]!.vars["var.inflation"]!;
      expect(at.vars["var.inflation"]).toBe(before + 2000);
    }
    expect(seen).toBeGreaterThan(5);
  });
});

describe("the world's variables", () => {
  test("[R-DIRECTOR-001] given many seeds, when a variable changes between ticks, then a story came into force or ended that names it, or it is a surge or December", () => {
    const names = (id: Id<"news">) => {
      const entry = content.news[id]!;
      return [...entry.standIn.sets.map((set) => set.var), ...(entry.director?.adds ?? []).map((add) => add.var)];
    };
    for (const seed of SEEDS) {
      const ticks = directorTicks(seed, 300, content);
      for (const entry of Object.values(content.var)) expect(ticks[0]?.vars[entry.id]).toBe(entry.start);
      for (const tick of ticks.slice(1)) {
        const before = ticks[tick.tick - 1]!;
        const moved = [...tick.cameIntoForce, ...tick.ended].flatMap(names);
        for (const id of Object.keys(content.var) as Id<"var">[]) {
          if (tick.vars[id] === before.vars[id] || id.endsWith("-surge") || id === "var.season-december") continue;
          expect(moved).toContain(id);
        }
      }
    }
  });
});

describe("the front page", () => {
  test("[R-DIRECTOR-009] given a character who has heard of a route, when an era's story is shown, then it is for them", () => {
    const game = start({ scenario: "scenario.ada", content, worldSeed: "director-1" });
    for (let month = 0; month < 8; month += 1) {
      if (game.state.turn.banked === 0) game.grant(1);
      game.endTurn();
    }
    expect(Object.values(game.state.route).some((route) => route.state !== "unknown")).toBe(true);
    const story = content.era[game.world().era!.id]!.story;
    expect(game.view().news.find((shown) => shown.id === story)?.forYou).toBe(true);
  });
});

describe("the real world's windows", () => {
  test("[R-DIRECTOR-005] given 200 seeds of the real content, when 120 ticks pass, then windows narrow, close and open in some worlds and not in all", () => {
    const share = (test: (ticks: DirectorTick[]) => boolean) => {
      let count = 0;
      for (let index = 0; index < 200; index += 1) if (test(directorTicks(`rates-${String(index)}`, 120, content))) count += 1;
      return count;
    };
    const studyClosed36 = share((ticks) => ticks.slice(0, 37).some((tick) => tick.vars[STUDY_WINDOW] === 0));
    const studyNarrowed = share((ticks) => ticks.some((tick) => tick.vars[STUDY_WINDOW] === 1));
    const careOpened = share((ticks) => ticks.some((tick) => tick.vars["var.uk-care-window"] === 2));
    expect(studyNarrowed).toBeGreaterThan(20);
    expect(studyClosed36).toBeGreaterThan(0);
    expect(studyClosed36).toBeLessThan(200);
    expect(careOpened).toBeGreaterThan(20);
    expect(careOpened).toBeLessThan(200);
  });
});

describe("the Gulf ban", () => {
  const BAN: Id<"news"> = "news.uae-ban";
  const WINDOW: Id<"var"> = "var.uae-window";

  test("[R-DIRECTOR-004] [R-DIRECTOR-005] given world seeds where the UAE ban comes into force, when the ticks pass, then the ban ends 18 ticks later and the window stays shut until then", () => {
    const lasts = content.news[BAN]!.standIn.endsAfter!;
    expect(lasts).toBe(18);
    let seen = 0;
    for (let n = 0; n < 200 && seen < 3; n += 1) {
      const ticks = directorTicks(`uae-ban-${String(n)}`, 300, content);
      const inForce = ticks.find((tick) => tick.cameIntoForce.includes(BAN));
      if (inForce === undefined || inForce.tick + lasts > 300) continue;
      seen += 1;
      const ended = ticks.find((tick) => tick.tick > inForce.tick && tick.ended.includes(BAN));
      expect(ended?.tick).toBe(inForce.tick + lasts);
      for (let tick = inForce.tick; tick < inForce.tick + lasts; tick += 1) expect(ticks[tick]?.vars[WINDOW]).toBe(0);
    }
    expect(seen).toBeGreaterThan(0);
  });
});
