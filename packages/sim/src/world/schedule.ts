// The stand-in world's news schedule: docs/rules/news.md, R-NEWS-001 to 003.
// Drawn once from the world seed on the world's own `shock` stream. Each story
// owns a fixed run of draw positions, by its place in id order, so whether one
// story happens never moves the draws of another.
import { createRandom } from "../engine/random";
import type { Content, Id, NewsEntry, NewsStage, WorldNews } from "../engine/types";

/** The world's own streams (engine.md section 6). A character's draws never touch them. */
export type WorldStream = "rate" | "shock" | "rule";

/** Draw positions each story owns on `shock`: whether it happens, then its announce tick or lag. */
const DRAWS_PER_STORY = 2;

/** The tick a story reaches each stage. Null: it never reaches that stage. */
export interface StoryTicks {
  rumour: number | null;
  announced: number;
  inForce: number;
  ended: number | null;
}

/** Every story that happens, by id. A story missing from it never happens. */
export type NewsSchedule = Partial<Record<Id<"news">, StoryTicks>>;

function tickOfStage(ticks: StoryTicks, stage: NewsStage): number | null {
  switch (stage) {
    case "rumour":
      // A story with no rumour lead starts at announced (R-NEWS-001), so "after its rumour" is after its announcement.
      return ticks.rumour ?? ticks.announced;
    case "announced":
      return ticks.announced;
    case "in-force":
      return ticks.inForce;
    case "ended":
      // Only known once the whole schedule is drawn: see endedOf.
      return ticks.ended;
    default: {
      const never: never = stage;
      throw new Error(`Unknown stage ${String(never)}.`);
    }
  }
}

function followsOn(entry: NewsEntry, leader: Id<"news">): boolean {
  const { announce } = entry.standIn;
  return "after" in announce && announce.after === leader;
}

/** Draws the whole schedule from the world seed (R-NEWS-003). */
export function newsSchedule(worldSeed: string, content: Content): NewsSchedule {
  const ids = (Object.keys(content.news) as Id<"news">[]).sort();
  const resolved = new Map<Id<"news">, StoryTicks | null>();
  const resolving = new Set<Id<"news">>();

  // Announce, rumour and in force. A follower waits on its leader, so this recurses; a loop is a content bug.
  const start = (id: Id<"news">): StoryTicks | null => {
    const known = resolved.get(id);
    if (known !== undefined) return known;
    if (resolving.has(id)) throw new Error(`The story ${id} follows itself through its announce chain.`);
    const entry = content.news[id];
    if (entry === undefined) throw new Error(`A story follows ${id}, which is not in content.`);
    resolving.add(id);
    const { standIn } = entry;
    const random = createRandom<WorldStream>(worldSeed, { shock: ids.indexOf(id) * DRAWS_PER_STORY });
    const happens = random.chance("shock", standIn.chanceBp);
    let announced: number | null;
    if ("between" in standIn.announce) {
      const [min, max] = standIn.announce.between;
      announced = random.between("shock", min, max);
    } else {
      const [min, max] = standIn.announce.lag;
      const lag = random.between("shock", min, max);
      const { after, stage } = standIn.announce;
      const leader = start(after);
      // A story that follows one that never reaches the named stage never happens (R-NEWS-003).
      const at = leader === null ? null : stage === "ended" ? endedOf(after, leader) : tickOfStage(leader, stage);
      announced = at === null ? null : at + lag;
    }
    resolving.delete(id);
    const ticks: StoryTicks | null =
      !happens || announced === null
        ? null
        : {
            // Clamped so a lead longer than the announce tick still starts at the world's first tick.
            rumour: standIn.rumourLead > 0 ? Math.max(0, announced - standIn.rumourLead) : null,
            announced,
            inForce: announced + standIn.forceLag,
            ended: null,
          };
    resolved.set(id, ticks);
    return ticks;
  };

  // a story with no count of ticks that
  // reverts ends on the tick the first story following it comes into force. A
  // follower that waits for this story to end cannot end it, so it is skipped.
  // the content says only that the scarcity ends when the float comes into
  // force; this is that ruling made general, since NewsEntry has no field for it.
  const endedOf = (id: Id<"news">, ticks: StoryTicks): number | null => {
    const entry = content.news[id];
    if (entry === undefined) return null;
    if (entry.standIn.endsAfter !== null) return ticks.inForce + entry.standIn.endsAfter;
    if (!entry.standIn.revert) return null;
    const ends = ids
      .filter((other) => {
        const follower = content.news[other];
        return follower !== undefined && followsOn(follower, id) && "after" in follower.standIn.announce && follower.standIn.announce.stage !== "ended";
      })
      .map((other) => start(other)?.inForce ?? null)
      .filter((tick): tick is number => tick !== null && tick > ticks.inForce);
    return ends.length === 0 ? null : Math.min(...ends);
  };

  const schedule: NewsSchedule = {};
  for (const id of ids) {
    const ticks = start(id);
    if (ticks !== null) schedule[id] = { ...ticks, ended: endedOf(id, ticks) };
  }
  return schedule;
}

/** The latest stage a story has reached by a tick, or null before its first. */
export function stageAt(ticks: StoryTicks, tick: number): Omit<WorldNews, "id"> | null {
  const stages: [NewsStage, number | null][] = [
    ["ended", ticks.ended],
    ["in-force", ticks.inForce],
    ["announced", ticks.announced],
    ["rumour", ticks.rumour],
  ];
  for (const [stage, at] of stages) {
    if (at !== null && at <= tick) return { stage, since: at };
  }
  return null;
}

/** Every story that has reached any stage by the tick, in id order. */
export function newsAt(schedule: NewsSchedule, tick: number): WorldNews[] {
  const news: WorldNews[] = [];
  for (const id of (Object.keys(schedule) as Id<"news">[]).sort()) {
    const ticks = schedule[id];
    const reached = ticks === undefined ? null : stageAt(ticks, tick);
    if (reached !== null) news.push({ id, ...reached });
  }
  return news;
}
