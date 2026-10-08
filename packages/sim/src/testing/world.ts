// Reading the stand-in world in tests: when a story reaches a stage, and a
// seed where it does. The director decides the ticks, so tests ask the world
// rather than a schedule.
import type { Content, Id, NewsStage } from "../engine/types";
import { standInWorlds } from "../world/standIn";

const RANK: Record<NewsStage, number> = { rumour: 0, announced: 1, "in-force": 2, ended: 3 };

/** The first tick at which the story has reached the stage (or a later one), or null within `upTo` ticks. */
export function firstTick(worldSeed: string, content: Content, story: Id<"news">, stage: NewsStage, upTo = 240): number | null {
  const worlds = standInWorlds(worldSeed, upTo, content);
  for (const world of worlds) {
    const found = world.news.find((item) => item.id === story);
    if (found !== undefined && RANK[found.stage] >= RANK[stage]) return world.tick;
  }
  return null;
}

/** The first of the numbered seeds `world-0`, `world-1`, ... in which the story reaches the stage, with its tick. */
export function seedWhere(content: Content, story: Id<"news">, stage: NewsStage, upTo = 240, seeds = 100): { seed: string; tick: number } {
  for (let index = 0; index < seeds; index += 1) {
    const seed = `world-${String(index)}`;
    const tick = firstTick(seed, content, story, stage, upTo);
    if (tick !== null) return { seed, tick };
  }
  throw new Error(`No seed in the first ${String(seeds)} brings ${story} to ${stage} within ${String(upTo)} ticks.`);
}
