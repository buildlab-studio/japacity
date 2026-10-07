import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Content, Id, NewsStage } from "../engine/types";
import type { StoryTicks } from "./schedule";
import { newsSchedule, stageAt } from "./schedule";
import { standInWorld, standInWorlds } from "./standIn";

const STAGES: NewsStage[] = ["rumour", "announced", "in-force", "ended"];
const SEEDS = Array.from({ length: 200 }, (_, index) => `world-${String(index)}`);
const SCARCITY: Id<"news"> = "news.dollar-scarcity";
const FLOAT: Id<"news"> = "news.naira-float";

/** The real content with one story's stand-in settings changed. */
function withStory(id: Id<"news">, change: Partial<Content["news"][Id<"news">]["standIn"]>): Content {
  const story = content.news[id];
  if (story === undefined) throw new Error(`No story ${id}.`);
  return { ...content, news: { ...content.news, [id]: { ...story, standIn: { ...story.standIn, ...change } } } };
}

describe("the news schedule", () => {
  test("[R-NEWS-001] given many world seeds, when every story is followed tick by tick, then its stage only moves forward, in order", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const worlds = standInWorlds(seed, 80, content);
      const last: Partial<Record<Id<"news">, number>> = {};
      for (const world of worlds) {
        for (const story of world.news) {
          const rank = STAGES.indexOf(story.stage);
          expect(rank).toBeGreaterThanOrEqual(last[story.id] ?? 0);
          last[story.id] = rank;
          expect(story.since).toBeLessThanOrEqual(world.tick);
        }
      }
    }
  });

  test("[R-NEWS-001] given a story with no rumour lead, when it first appears, then it is at announced; with a lead, at rumour", () => {
    const worlds = standInWorlds("world-1", 80, content);
    const first = (id: Id<"news">) => worlds.flatMap((world) => world.news).find((story) => story.id === id);
    expect(content.news["news.uk-unis-recruit"]?.standIn.rumourLead).toBe(0);
    expect(first("news.uk-unis-recruit")?.stage).toBe("announced");
    expect(content.news["news.uk-living-rise"]?.standIn.rumourLead).toBeGreaterThan(0);
    expect(first("news.uk-living-rise")?.stage).toBe("rumour");
  });

  test("[R-NEWS-001] given a story's schedule, when its stage ticks are read, then rumour is the lead before announced and in force is the force lag after", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const schedule = newsSchedule(seed, content);
      for (const [id, ticks] of Object.entries(schedule) as [Id<"news">, StoryTicks][]) {
        const entry = content.news[id]!.standIn;
        expect(ticks.rumour).toBe(entry.rumourLead > 0 ? ticks.announced - entry.rumourLead : null);
        expect(ticks.inForce).toBe(ticks.announced + entry.forceLag);
        expect(entry.endsAfter === null || ticks.ended === ticks.inForce + entry.endsAfter).toBe(true);
        expect(ticks.ended === null || ticks.ended > ticks.inForce).toBe(true);
      }
    }
  });

  test("[R-NEWS-003] given a world seed, when the schedule is drawn twice or the world is asked at any tick, then it is the same", () => {
    expect(newsSchedule("world-7", content)).toEqual(newsSchedule("world-7", content));
    const late = standInWorld("world-7", 60, content);
    const schedule = newsSchedule("world-7", content);
    for (const story of late.news) expect(stageAt(schedule[story.id]!, 60)).toEqual({ stage: story.stage, since: story.since });
  });

  test("[R-NEWS-003] given stories that always happen, when many seeds are drawn, then each is announced inside its window every time", () => {
    for (const seed of SEEDS) {
      const schedule = newsSchedule(seed, content);
      const recruit = schedule["news.uk-unis-recruit"];
      const living = schedule["news.uk-living-rise"];
      expect(recruit?.announced).toBeGreaterThanOrEqual(1);
      expect(recruit?.announced).toBeLessThanOrEqual(3);
      expect(living?.announced).toBeGreaterThanOrEqual(4);
      expect(living?.announced).toBeLessThanOrEqual(14);
    }
  });

  test("[R-NEWS-003] given a story with a 60% chance, when 200 seeds are drawn, then it happens in some and not others, near 60%", () => {
    const happened = SEEDS.filter((seed) => newsSchedule(seed, content)[SCARCITY] !== undefined).length;
    expect(content.news[SCARCITY]?.standIn.chanceBp).toBe(6000);
    expect(happened).toBeGreaterThan(90);
    expect(happened).toBeLessThan(150);
  });

  test("[R-NEWS-003] given a story at 0% or 100%, when drawn, then it never or always happens", () => {
    const never = withStory("news.uk-refusals-up", { chanceBp: 0 });
    const always = withStory("news.uk-refusals-up", { chanceBp: 10000 });
    for (const seed of SEEDS.slice(0, 50)) {
      expect(newsSchedule(seed, never)["news.uk-refusals-up"]).toBeUndefined();
      expect(newsSchedule(seed, always)["news.uk-refusals-up"]).toBeDefined();
    }
  });

  test("[R-NEWS-003] given the float follows the scarcity, when the scarcity happens, then the float is announced 3 to 6 ticks after it is in force, and never otherwise", () => {
    let both = 0;
    for (const seed of SEEDS) {
      const schedule = newsSchedule(seed, content);
      const scarcity = schedule[SCARCITY];
      const float = schedule[FLOAT];
      expect(float === undefined).toBe(scarcity === undefined);
      if (scarcity === undefined || float === undefined) continue;
      both += 1;
      expect(float.announced - scarcity.inForce).toBeGreaterThanOrEqual(3);
      expect(float.announced - scarcity.inForce).toBeLessThanOrEqual(6);
    }
    expect(both).toBeGreaterThan(0);
  });

  test("[R-NEWS-003] given the scarcity never happens, when the schedule is drawn, then the float that follows it never happens either", () => {
    const noScarcity = withStory(SCARCITY, { chanceBp: 0 });
    for (const seed of SEEDS.slice(0, 50)) expect(newsSchedule(seed, noScarcity)[FLOAT]).toBeUndefined();
  });

  test("[R-NEWS-003] given the scarcity and the float, when both happen, then the scarcity ends on the tick the float comes into force", () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const schedule = newsSchedule(seed, content);
      const float = schedule[FLOAT];
      if (float === undefined) continue;
      expect(schedule[SCARCITY]?.ended).toBe(float.inForce);
    }
  });
});
