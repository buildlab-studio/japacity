// Reading the stand-in world in tests: when a story reaches a stage, a seed
// where it does, and the director's stories and ticks. The director decides
// the ticks, so tests ask the world rather than a schedule.
import type { Content, Id, NewsEntry, NewsStage, World } from "../engine/types";
import type { DirectorTick } from "../world/director";
import { standInWorlds } from "../world/standIn";

/** The stages of a story in the order they come. */
export const RANK: Record<NewsStage, number> = { rumour: 0, announced: 1, "in-force": 2, ended: 3 };

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

/** A director story for a test pool. It fires on every roll it is allowed and stays in force for good unless told otherwise. */
export function pooled(id: Id<"news">, rules: Partial<NonNullable<NewsEntry["director"]>> = {}, standIn: Partial<NewsEntry["standIn"]> = {}): NewsEntry {
  return {
    id,
    touches: [],
    hear: [],
    director: { group: "test", needs: [], cooldown: 0, once: false, shock: false, endedBy: null, adds: [], ...rules },
    standIn: { chanceBp: 10000, announce: { between: [0, 0] }, rumourLead: 0, forceLag: 2, endsAfter: null, sets: [], revert: false, ...standIn },
  };
}

/** The ticks on which a story started a pass. */
export function starts(ticks: DirectorTick[], id: Id<"news">): number[] {
  return ticks.filter((tick) => tick.started.includes(id)).map((tick) => tick.tick);
}

/** A story as a world or a director tick holds it, or null. */
export function stageOf(world: World | DirectorTick, id: Id<"news">) {
  return world.news.find((story) => story.id === id) ?? null;
}
