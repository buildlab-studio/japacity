// The director as the online world steps it: from a stored book, one tick at a
// time, at the online scale and on the real calendar (docs/rules/clock.md).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { hashState } from "../engine/hash";
import type { Content, EraEntry, Id, NewsEntry, World } from "../engine/types";
import type { DirectorBook, DirectorTick, WorldCalendar } from "./director";
import { directorTicks, offlineCalendar, stepWorld } from "./director";
import { standInWorld, standInWorlds } from "./standIn";
import { pooled, stageOf, starts } from "../testing/world";
import { CALM, DECEMBER_VAR } from "../testing/ids";

const { director } = content.tuning;
const SCALE = director.onlineTickScale;
const SEEDS = ["online-0", "online-1", "online-2", "online-3"];

/** A calendar that is not the offline one: a December of 62 ticks in each year of 730. */
const realish = (tick: number): WorldCalendar => ({ december: tick % 730 >= 200 && tick % 730 < 262 });

function era(id: Id<"era">, ticks: [number, number], after: Record<string, number>): EraEntry {
  return { id, ticks, weights: {}, after, once: false, story: content.era[id]!.story };
}

const LONG_CALM = { [CALM]: era(CALM, [400, 400], {}) };

/** The real content with a test pool of stories, test eras and the director's numbers changed. */
function withPool(news: NewsEntry[], change: { eras?: Content["era"]; director?: Partial<Content["tuning"]["director"]>; vars?: Content["var"] } = {}): Content {
  const eras = change.eras ?? LONG_CALM;
  const eraStories = Object.values(eras).map((entry) => content.news[entry.story]!);
  return {
    ...content,
    news: Object.fromEntries([...news, ...eraStories].map((entry) => [entry.id, entry])),
    era: eras,
    var: { ...content.var, ...change.vars },
    tuning: { ...content.tuning, director: { ...director, ...change.director } },
  };
}

/** Steps `count` ticks from `book`, keeping the book in memory. */
function inOneGo(worldSeed: string, upTo: number, used: Content, scale: number, calendar: (tick: number) => WorldCalendar) {
  const worlds: World[] = [];
  const hashes: string[] = [];
  let book: DirectorBook | null = null;
  for (let tick = 0; tick <= upTo; tick += 1) {
    const next: { book: DirectorBook; world: World } = stepWorld(book, worldSeed, used, calendar(tick), scale);
    book = next.book;
    worlds.push(next.world);
    hashes.push(hashState(next.book));
  }
  return { worlds, hashes };
}

/** Steps tick by tick as the server does, storing each book as JSON and reading it back for the next tick. */
function fromStoredBooks(worldSeed: string, upTo: number, used: Content, scale: number, calendar: (tick: number) => WorldCalendar) {
  const rows: { world: string; book: string }[] = [];
  for (let tick = 0; tick <= upTo; tick += 1) {
    const before = tick === 0 ? null : (JSON.parse(rows[tick - 1]!.book) as DirectorBook);
    const next = stepWorld(before, worldSeed, used, calendar(tick), scale);
    rows.push({ world: JSON.stringify(next.world), book: JSON.stringify(next.book) });
  }
  return {
    worlds: rows.map((row) => JSON.parse(row.world) as World),
    hashes: rows.map((row) => hashState(JSON.parse(row.book))),
  };
}

describe("the resumable director", () => {
  test("[clock:world-is-stored-history] [clock:tick-row-is-pure-step] [director:world-stepped-from-seed] given four world seeds at the offline and the online scale, when 300 ticks are stepped in one go and again tick by tick from books stored as JSON, then every world and every book's hash agree", () => {
    for (const seed of SEEDS) {
      for (const [scale, calendar] of [
        [1, offlineCalendar],
        [SCALE, realish],
      ] as const) {
        const one = inOneGo(seed, 300, content, scale, calendar);
        const stored = fromStoredBooks(seed, 300, content, scale, calendar);
        expect(stored.worlds).toEqual(one.worlds);
        expect(stored.hashes).toEqual(one.hashes);
      }
    }
  });

  test("[director:world-stepped-from-seed] [clock:tick-row-is-pure-step] given the stand-in world, when it is compared with stepWorld at scale 1 on the offline calendar, then they are the same worlds", () => {
    for (const seed of SEEDS) {
      expect(standInWorlds(seed, 120, content)).toEqual(inOneGo(seed, 120, content, 1, offlineCalendar).worlds);
      expect(standInWorld(seed, 0, content)).toEqual(stepWorld(null, seed, content, offlineCalendar(0), 1).world);
    }
  });

  test("[clock:tick-row-is-pure-step] given a book, when the world is stepped from it, then the book is left as it was and the next book stands one tick on", () => {
    let book = stepWorld(null, "online-0", content, offlineCalendar(0), SCALE).book;
    for (let tick = 1; tick <= 40; tick += 1) book = stepWorld(book, "online-0", content, realish(tick), SCALE).book;
    const text = JSON.stringify(book);
    const next = stepWorld(book, "online-0", content, realish(41), SCALE);
    expect(JSON.stringify(book)).toBe(text);
    expect(book.tick).toBe(40);
    expect(next.book.tick).toBe(41);
    expect(next.world.tick).toBe(41);
    expect(JSON.parse(JSON.stringify(next.book))).toEqual(next.book);
  });

  test("[clock:tick-row-is-pure-step] given a scale that is not a whole number from 1, when the world is stepped, then it throws", () => {
    expect(() => stepWorld(null, "online-0", content, offlineCalendar(0), 0)).toThrow(/scale/);
    expect(() => stepWorld(null, "online-0", content, offlineCalendar(0), -2)).toThrow(/scale/);
  });
});

describe("the online scale", () => {
  test("[clock:online-lengths-scaled] [director:one-era-at-a-time] given many world seeds, when the world runs at the online scale, then the eras come in the same order with each length the scale times the offline one, and the era's story comes into force the scale times its lag after the era begins", () => {
    const erasOf = (ticks: DirectorTick[]) =>
      ticks.map((tick) => tick.era!).filter((one, index, all) => index === 0 || one.since !== all[index - 1]!.since);
    for (const seed of SEEDS) {
      const offline = erasOf(directorTicks(seed, 300, content));
      const online = erasOf(directorTicks(seed, 300 * SCALE, content, SCALE, realish));
      expect(offline.length).toBeGreaterThan(3);
      const whole = offline.slice(0, -1);
      expect(online.slice(0, whole.length)).toEqual(whole.map((one) => ({ id: one.id, since: one.since * SCALE, until: one.until * SCALE })));
    }
    const calmStory = content.era[CALM]!.story;
    const lag = content.news[calmStory]!.standIn.forceLag;
    const ticks = directorTicks("online-0", lag * SCALE, content, SCALE, realish);
    expect(stageOf(ticks[lag * SCALE - 1]!, calmStory)?.stage).toBe("announced");
    expect(stageOf(ticks[lag * SCALE]!, calmStory)).toEqual({ id: calmStory, stage: "in-force", since: lag * SCALE });
  });

  test("[clock:online-lengths-scaled] [director:stories-pass-through-stages] given a story with a rumour lead, a force lag and an end, when it fires at the online scale, then each gap between its stages is the scale times its own", () => {
    const story = pooled("news.t-stages", { once: true }, { rumourLead: 2, forceLag: 3, endsAfter: 4 });
    expect(SCALE).toBe(2);
    const ticks = directorTicks("w", 24, withPool([story]), SCALE);
    const stage = (tick: number) => stageOf(ticks[tick]!, "news.t-stages");
    expect(stage(0)).toBeNull();
    // Rumour at 1, announced 4 later, in force 6 after that, ended 8 after that.
    expect(stage(1)).toEqual({ id: "news.t-stages", stage: "rumour", since: 1 });
    expect(stage(4)?.stage).toBe("rumour");
    expect(stage(5)).toEqual({ id: "news.t-stages", stage: "announced", since: 5 });
    expect(stage(10)?.stage).toBe("announced");
    expect(stage(11)).toEqual({ id: "news.t-stages", stage: "in-force", since: 11 });
    expect(stage(18)?.stage).toBe("in-force");
    expect(stage(19)).toEqual({ id: "news.t-stages", stage: "ended", since: 19 });
  });

  test("[clock:online-lengths-scaled] [director:stories-start-by-roll] given a story with a cooldown of 10, when it may always fire at the online scale, then it fires every twentieth tick", () => {
    const ticks = directorTicks("w", 80, withPool([pooled("news.t-cool", { cooldown: 10 })]), SCALE);
    expect(starts(ticks, "news.t-cool")).toEqual([1, 21, 41, 61]);
  });

  test("[clock:online-lengths-scaled] [director:stories-start-by-roll] given two shocks that may always fire, when one era runs at the online scale, then the second waits the scale times the gap", () => {
    const pool = [pooled("news.t-shock-a", { shock: true }), pooled("news.t-shock-b", { shock: true })];
    const ticks = directorTicks("w", 100, withPool(pool), SCALE);
    expect(starts(ticks, "news.t-shock-a")).toEqual([1]);
    expect(starts(ticks, "news.t-shock-b")).toEqual([1 + director.shockGapTicks * SCALE]);
    const edge = directorTicks("w", 100, withPool(pool, { director: { shockGapTicks: 1 } }), SCALE);
    expect(starts(edge, "news.t-shock-b")).toEqual([1 + SCALE]);
  });

  test("[clock:online-lengths-scaled] [director:policy-cycle-surge-backlash] given a closure and its reopening, when they run at the online scale, then the reopening waits the scale times the closed ticks and comes into force the scale times its lag later", () => {
    const ended = pooled("news.t-closes", { once: true, endedBy: "news.t-opens" }, { forceLag: 2, sets: [{ var: "var.uae-window", value: 0 }], revert: true });
    const ender = pooled("news.t-opens", { once: true, needs: [{ type: "var/max", var: "var.uae-window", value: 0 }] }, { forceLag: 3, sets: [{ var: "var.uae-window", value: 2 }] });
    const ticks = directorTicks("w", 40, withPool([ended, ender], { director: { closedTicks: 4 } }), SCALE);
    // In force at 1 + 4 = 5, closed eight ticks to 13, announced then, in force six later.
    expect(starts(ticks, "news.t-opens")).toEqual([13]);
    expect(ticks.find((tick) => tick.cameIntoForce.includes("news.t-opens"))?.tick).toBe(19);
  });
});

describe("the calendar", () => {
  test("[clock:december-by-lagos-time] [director:december-and-inflation] given the tick's calendar, when the world is stepped, then the December variable follows the calendar and not the tick", () => {
    const ticks = directorTicks("online-0", 300, content, SCALE, realish);
    for (const tick of ticks) expect(tick.vars[DECEMBER_VAR]).toBe(realish(tick.tick).december ? 1 : 0);
    expect(ticks.filter((tick) => tick.vars[DECEMBER_VAR] === 1)).toHaveLength(62);
    const offline = directorTicks("online-0", 24, content);
    expect(offline.filter((tick) => tick.vars[DECEMBER_VAR] === 1).map((tick) => tick.tick)).toEqual([11, 23]);
  });
});

describe("a book under new content", () => {
  test("[clock:new-content-from-next-tick] given a book stepped under one content, when the next tick is stepped under content that adds a story and a variable and drops a story, then the new story starts unfired, the new variable starts at its start, and the dropped story leaves the book and the world", () => {
    const before = withPool([pooled("news.t-old", { once: true }), pooled("news.t-kept", { once: true })]);
    let book = stepWorld(null, "w", before, offlineCalendar(0), SCALE).book;
    for (let tick = 1; tick <= 5; tick += 1) book = stepWorld(book, "w", before, offlineCalendar(tick), SCALE).book;
    expect(book.stories["news.t-old"]?.lastFired).toBe(1);
    expect(book.stories["news.t-kept"]?.lastFired).toBe(1);

    const after = withPool([pooled("news.t-kept", { once: true }), pooled("news.t-new", { once: true })], { vars: { "var.t-new": { id: "var.t-new", start: 7 } } });
    const next = stepWorld(book, "w", after, offlineCalendar(6), SCALE);
    expect(next.book.stories["news.t-old"]).toBeUndefined();
    expect(next.world.news.map((story) => story.id)).not.toContain("news.t-old");
    expect(next.book.stories["news.t-kept"]?.lastFired).toBe(1);
    expect(next.book.stories["news.t-new"]).toEqual({ pass: { rumour: null, announced: 6, inForce: 6 + 2 * SCALE, ended: null }, before: null, lastFired: 6 });
    expect(next.world.vars["var.t-new"]).toBe(7);
  });
});
