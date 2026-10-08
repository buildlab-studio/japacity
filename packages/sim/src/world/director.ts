// The director: docs/rules/director.md. Eras, the per-tick story roll, the
// stages of each story and the policy cycle, stepped from tick 0. Everything it
// reads is the world seed, the tick and the content (R-RATE-001): no character
// reaches it. Stories without director fields keep the fixed schedule of
// news.md, drawn in `schedule.ts`.
//
// Draw positions. The era stream gives era n (calm at tick 0 is era 0) the
// positions 2n (which era) and 2n + 1 (its length). The shock stream's first
// positions belong to the fixed schedule; after them, each tick owns one run of
// positions with one for each story of the pool, by its place in id order. So
// whether one story fires never moves the draws of another.
import { BP_WHOLE } from "../engine/int";
import { createRandom, drawAt, scaleDraw } from "../engine/random";
import type { Content, EraEntry, Id, NewsEntry, Requirement, World, WorldNews } from "../engine/types";
import type { StoryTicks, WorldStream } from "./schedule";
import { DRAWS_PER_STORY, newsSchedule, stageAt } from "./schedule";

const OPENING_ERA: Id<"era"> = "era.calm";
const SHOCK: WorldStream = "shock";
const DECEMBER: Id<"var"> = "var.season-december";
const MONTHS_A_YEAR = 12;
/** Offline, the eleventh tick of each game year is December (R-DIRECTOR-006). */
const DECEMBER_TICK = 11;
const WINDOW_OPEN = 2;
const WINDOW_NARROWING = 1;
const SCALE_MAX = 100;
const ERA_DRAWS = 2;

/** One tick of the director's world, with what moved on it. */
export interface DirectorTick {
  tick: number;
  vars: Record<Id<"var">, number>;
  /** Every story that has reached a stage, at its latest pass, in id order. */
  news: WorldNews[];
  era: World["era"];
  /** Stories whose pass began this tick: at rumour, or at announced with no rumour lead. */
  started: Id<"news">[];
  cameIntoForce: Id<"news">[];
  ended: Id<"news">[];
}

/** What a variable held before a story in force changed it, for `revert` (R-RATE-006). */
interface Held {
  value: number;
  setBy: Id<"news"> | null;
}

interface RunningEra {
  id: Id<"era">;
  since: number;
  until: number;
  /** The era's place in the world's run of eras, for its draw positions. */
  index: number;
}

/** What the director reads of one story, worked out once a walk. Stories are held by their place in id order. */
interface Story {
  id: Id<"news">;
  entry: NewsEntry;
  /** The stories this one ends when it comes into force (their `endedBy`). */
  ends: number[];
  /** A reopening's window (R-DIRECTOR-005), or null. */
  reopens: Id<"var"> | null;
  /** In force for good once it gets there: no end and nothing ends it. */
  forGood: boolean;
}

/** The director's whole state as it steps. Built fresh for each walk; never stored. */
interface Book {
  values: Record<Id<"var">, number>;
  setBy: Record<Id<"var">, Id<"news"> | null>;
  stories: Story[];
  /** The stories rolled each tick, in id order, by their place in `stories`. */
  pool: number[];
  /** Every window variable, for the closed count. */
  windows: Id<"var">[];
  /** The latest pass of each story. */
  passes: (StoryTicks | null)[];
  before: (Record<Id<"var">, Held> | null)[];
  /** The tick each story last fired from the pool. */
  lastFired: (number | null)[];
  /** Stories due to come into force, and due to end, by tick. A due entry may be stale; the pass decides. */
  dueInForce: number[][];
  dueEnd: number[][];
  era: RunningEra | null;
  erasRun: Id<"era">[];
  lastShock: number | null;
  shocksThisEra: number[];
  /** The tick each window last became 0, or null while it is open or narrowing. */
  closedSince: Partial<Record<Id<"var">, number | null>>;
}

type WorldRequirement = Extract<Requirement, { type: "var/min" | "var/max" | "era/is" | "not" | "any" }>;

const WORLD_REQUIREMENTS: readonly string[] = ["var/min", "var/max", "era/is", "not", "any"] satisfies WorldRequirement["type"][];

export function isWorldRequirement(requirement: Requirement): requirement is WorldRequirement {
  return WORLD_REQUIREMENTS.includes(requirement.type);
}

/** A story's needs read the world only: its variables and its era. */
function holds(requirement: Requirement, book: Book): boolean {
  if (!isWorldRequirement(requirement)) throw new Error(`A story's needs read only the world, and ${requirement.type} reads a character.`);
  switch (requirement.type) {
    case "var/min":
      return valueOf(book, requirement.var) >= requirement.value;
    case "var/max":
      return valueOf(book, requirement.var) <= requirement.value;
    case "era/is":
      return book.era !== null && requirement.eras.includes(book.era.id);
    case "not":
      return !holds(requirement.of, book);
    case "any":
      return requirement.of.some((inner) => holds(inner, book));
    default: {
      const never: never = requirement;
      throw new Error(`Unknown world requirement ${JSON.stringify(never)}.`);
    }
  }
}

function valueOf(book: Book, variable: Id<"var">): number {
  const value = book.values[variable];
  if (value === undefined) throw new Error(`A story reads the variable ${variable}, which is not in content.`);
  return value;
}

/** Surges and strictness run 0 to 100 (R-DIRECTOR-001). */
function bounded(variable: Id<"var">, value: number): number {
  if (variable.endsWith("-surge") || variable.endsWith("-strictness")) return Math.min(SCALE_MAX, Math.max(0, value));
  return value;
}

/** The windows that have a surge beside them: `var.<route>-window` and `var.<route>-surge` (R-DIRECTOR-001). */
function cyclePairs(content: Content): [window: Id<"var">, surge: Id<"var">][] {
  return (Object.keys(content.var) as Id<"var">[])
    .filter((id) => id.endsWith("-window"))
    .sort()
    .map((window): [Id<"var">, Id<"var">] => [window, `${window.slice(0, -"-window".length)}-surge` as Id<"var">])
    .filter(([, surge]) => content.var[surge] !== undefined);
}

/** A reopening's window: the one its needs hold at 0 (R-DIRECTOR-005). */
function reopeningWindow(entry: NewsEntry): Id<"var"> | null {
  const need = entry.director?.needs.find((one) => one.type === "var/max" && one.var.endsWith("-window") && one.value === 0);
  return need !== undefined && need.type === "var/max" ? need.var : null;
}

function eraLength(worldSeed: string, entry: EraEntry, index: number): number {
  const random = createRandom<WorldStream>(worldSeed, { era: index * ERA_DRAWS + 1 });
  return random.between("era", entry.ticks[0], entry.ticks[1]);
}

/**
 * The era after one that ends (R-DIRECTOR-002): weighted by each entry's `after` weight for the era
 * that ended, never the same era twice in a row, and an era marked once never twice in a world.
 */
function nextEra(worldSeed: string, content: Content, ended: RunningEra, erasRun: readonly Id<"era">[]): RunningEra {
  const index = ended.index + 1;
  const candidates = (Object.keys(content.era) as Id<"era">[])
    .sort()
    .map((id) => content.era[id]!)
    .filter((entry) => entry.id !== ended.id && !(entry.once && erasRun.includes(entry.id)))
    .map((entry) => ({ entry, weight: entry.after[ended.id] ?? 0 }))
    .filter((candidate) => candidate.weight > 0);
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (total === 0) throw new Error(`No era may follow ${ended.id}: every era needs one that names it in \`after\` (R-DIRECTOR-007).`);
  let draw = createRandom<WorldStream>(worldSeed, { era: index * ERA_DRAWS }).int("era", total);
  for (const { entry, weight } of candidates) {
    if (draw < weight) return { id: entry.id, since: ended.until, until: ended.until + eraLength(worldSeed, entry, index), index };
    draw -= weight;
  }
  throw new Error("The era draw fell outside its weights.");
}

function due(table: number[][], tick: number | null, story: number): void {
  if (tick !== null) (table[tick] ??= []).push(story);
}

function setPass(book: Book, story: number, pass: StoryTicks): void {
  book.passes[story] = pass;
  due(book.dueInForce, pass.inForce, story);
  due(book.dueEnd, pass.ended, story);
}

/** The era's story: announced the tick the era begins, in force its force lag later, ended with the era. */
function startEraStory(book: Book, content: Content, era: RunningEra, place: Record<Id<"news">, number>): void {
  const story = content.era[era.id]?.story;
  const index = story === undefined ? undefined : place[story];
  // Test contents may name an era without its story; the era runs all the same.
  if (index === undefined) return;
  const lag = book.stories[index]!.entry.standIn.forceLag;
  setPass(book, index, { rumour: null, announced: era.since, inForce: era.since + lag, ended: null });
}

function endEraStory(book: Book, content: Content, era: RunningEra, tick: number, place: Record<Id<"news">, number>): void {
  const story = content.era[era.id]?.story;
  const index = story === undefined ? undefined : place[story];
  const pass = index === undefined ? null : book.passes[index];
  if (index === undefined || pass === null || pass === undefined) return;
  setPass(book, index, { ...pass, ended: tick });
}

function storiesOf(content: Content): { stories: Story[]; pool: number[]; place: Record<Id<"news">, number> } {
  const ids = (Object.keys(content.news) as Id<"news">[]).sort();
  const place: Record<Id<"news">, number> = {};
  for (const [index, id] of ids.entries()) place[id] = index;
  const eraStories = new Set(Object.values(content.era).map((entry) => entry.story));
  const stories: Story[] = ids.map((id) => {
    const entry = content.news[id]!;
    const endedBy = entry.director?.endedBy ?? null;
    return { id, entry, ends: [], reopens: reopeningWindow(entry), forGood: entry.standIn.endsAfter === null && endedBy === null };
  });
  for (const [index, story] of stories.entries()) {
    const ender = story.entry.director?.endedBy;
    const at = ender === undefined || ender === null ? undefined : place[ender];
    if (at !== undefined) stories[at]!.ends.push(index);
  }
  // The pool: every story with director fields that is not an era's own story.
  const pool = stories.flatMap((story, index) => (story.entry.director !== undefined && !eraStories.has(story.id) ? [index] : []));
  return { stories, pool, place };
}

function openBook(worldSeed: string, content: Content, stories: Story[], pool: number[], place: Record<Id<"news">, number>): Book {
  const values: Record<Id<"var">, number> = {};
  const setBy: Record<Id<"var">, Id<"news"> | null> = {};
  for (const entry of Object.values(content.var)) {
    values[entry.id] = entry.start;
    setBy[entry.id] = null;
  }
  const opening = content.era[OPENING_ERA];
  const era = opening === undefined ? null : { id: opening.id, since: 0, until: eraLength(worldSeed, opening, 0), index: 0 };
  const book: Book = {
    values,
    setBy,
    stories,
    pool,
    windows: (Object.keys(values) as Id<"var">[]).filter((id) => id.endsWith("-window")),
    passes: stories.map(() => null),
    before: stories.map(() => null),
    lastFired: stories.map(() => null),
    dueInForce: [],
    dueEnd: [],
    era,
    erasRun: era === null ? [] : [era.id],
    lastShock: null,
    shocksThisEra: [],
    closedSince: {},
  };
  // Stories without director fields keep the fixed schedule of news.md. Drawing it costs a walk's worth
  // of time, so content whose every story has director fields skips it.
  const fixed = stories.some((story) => story.entry.director === undefined) ? newsSchedule(worldSeed, content) : {};
  for (const [id, ticks] of Object.entries(fixed) as [Id<"news">, StoryTicks][]) {
    const index = place[id];
    if (index !== undefined && content.news[id]?.director === undefined) setPass(book, index, ticks);
  }
  if (era !== null) startEraStory(book, content, era, place);
  markClosed(book, 0);
  return book;
}

function markClosed(book: Book, tick: number): void {
  for (const id of book.windows) {
    book.closedSince[id] = book.values[id] === 0 ? (book.closedSince[id] ?? tick) : null;
  }
}

/** R-DIRECTOR-005: surges follow their windows as they stood at the end of the tick before. */
function turnCycle(book: Book, content: Content, pairs: readonly [Id<"var">, Id<"var">][]): void {
  const step = content.tuning.director.surgePerTick;
  for (const [window, surge] of pairs) {
    const open = valueOf(book, window);
    const now = valueOf(book, surge);
    if (open >= WINDOW_OPEN) book.values[surge] = Math.min(SCALE_MAX, now + step);
    else if (open < WINDOW_NARROWING) book.values[surge] = Math.max(0, now - 2 * step);
  }
}

/** The stories due on a tick whose pass really lands then, once each, in id order. */
function landing(table: number[][], tick: number, lands: (story: number) => boolean): number[] {
  return [...new Set(table[tick] ?? [])].filter(lands).sort((a, b) => a - b);
}

/**
 * The stages that land on this tick (R-DIRECTOR-004). Endings go first, so a
 * story that comes into force on the tick another ends is the later one and
 * wins. A revert puts back only what the ending story itself still holds.
 */
function turnStories(book: Book, tick: number): { cameIntoForce: number[]; ended: number[] } {
  const cameIntoForce = landing(book.dueInForce, tick, (story) => book.passes[story]?.inForce === tick);
  // A story in force ends on the tick its `endedBy` story comes into force.
  for (const ender of cameIntoForce) {
    for (const story of book.stories[ender]!.ends) {
      const pass = book.passes[story];
      if (pass === null || pass === undefined || pass.inForce >= tick || (pass.ended !== null && pass.ended <= tick)) continue;
      setPass(book, story, { ...pass, ended: tick });
    }
  }
  const ended = landing(book.dueEnd, tick, (story) => {
    const pass = book.passes[story];
    return pass !== null && pass !== undefined && pass.ended === tick && pass.inForce < tick;
  });
  for (const story of ended) {
    const { id, entry } = book.stories[story]!;
    const before = book.before[story];
    if (!entry.standIn.revert || before === null || before === undefined) continue;
    for (const [variable, held] of Object.entries(before) as [Id<"var">, Held][]) {
      if (book.setBy[variable] !== id) continue;
      book.values[variable] = held.value;
      book.setBy[variable] = held.setBy;
    }
  }
  for (const story of cameIntoForce) {
    const { id, entry } = book.stories[story]!;
    const before: Record<Id<"var">, Held> = {};
    const change = (variable: Id<"var">, to: (from: number) => number) => {
      const from = book.values[variable];
      if (from === undefined) throw new Error(`The story ${id} changes the variable ${variable}, which is not in content.`);
      before[variable] ??= { value: from, setBy: book.setBy[variable] ?? null };
      book.values[variable] = bounded(variable, to(from));
      book.setBy[variable] = id;
    };
    for (const set of entry.standIn.sets) change(set.var, () => set.value);
    for (const add of entry.director?.adds ?? []) change(add.var, (from) => from + add.value);
    book.before[story] = before;
  }
  return { cameIntoForce, ended };
}

/** A story may fire again only once its last pass has been seen ended, or is in force for good. */
function free(book: Book, story: number, tick: number): boolean {
  const pass = book.passes[story];
  if (pass === null || pass === undefined) return true;
  if (pass.ended !== null) return pass.ended < tick;
  return book.stories[story]!.forGood && pass.inForce <= tick;
}

/** R-DIRECTOR-003: each story of the pool, in id order, rolled on its own position of `shock`. */
function rollStories(book: Book, worldSeed: string, content: Content, tick: number, base: number): void {
  const { director } = content.tuning;
  const weights = book.era === null ? null : (content.era[book.era.id]?.weights ?? null);
  let started = 0;
  for (const [place, story] of book.pool.entries()) {
    if (started >= director.maxNewPerTick) break;
    const { entry, reopens } = book.stories[story]!;
    const rules = entry.director!;
    const last = book.lastFired[story];
    if (last !== null && last !== undefined && (rules.once || tick - last < rules.cooldown)) continue;
    if (!free(book, story, tick)) continue;
    if (rules.shock && (book.shocksThisEra.includes(story) || (book.lastShock !== null && tick - book.lastShock < director.shockGapTicks))) continue;
    if (reopens !== null) {
      const since = book.closedSince[reopens];
      if (since === undefined || since === null || tick - since < director.closedTicks) continue;
    }
    if (!rules.needs.every((need) => holds(need, book))) continue;
    const chance = Math.min(BP_WHOLE, entry.standIn.chanceBp * (weights?.[rules.group] ?? 1));
    // The same draw `chance` makes, read at this story's own position for the tick.
    if (scaleDraw(drawAt(worldSeed, SHOCK, base + tick * book.pool.length + place), BP_WHOLE) >= chance) continue;
    // the roll starts the story at its first stage. With a rumour lead the rumour runs from now
    // and the announcement follows the lead later; R-DIRECTOR-004 counts the lead back from the announcement.
    const { rumourLead, forceLag, endsAfter } = entry.standIn;
    const announced = tick + rumourLead;
    const inForce = announced + forceLag;
    setPass(book, story, { rumour: rumourLead > 0 ? tick : null, announced, inForce, ended: endsAfter === null ? null : inForce + endsAfter });
    book.lastFired[story] = tick;
    if (rules.shock) {
      book.lastShock = tick;
      book.shocksThisEra.push(story);
    }
    started += 1;
  }
}

function newsOf(book: Book, tick: number): WorldNews[] {
  const news: WorldNews[] = [];
  for (const [story, pass] of book.passes.entries()) {
    const reached = pass === null ? null : stageAt(pass, tick);
    if (reached !== null) news.push({ id: book.stories[story]!.id, ...reached });
  }
  return news;
}

function startedAt(book: Book, tick: number): Id<"news">[] {
  return book.passes.flatMap((pass, story) => (pass !== null && (pass.rumour ?? pass.announced) === tick ? [book.stories[story]!.id] : []));
}

/**
 * One tick as the director stepped it. What the rates need is at hand; the
 * whole tick is built only when asked for, since most walks want only the last.
 */
export interface DirectorStep {
  tick: number;
  cameIntoForce: readonly Id<"news">[];
  /** A world variable's value this tick, or undefined when content has no such variable. */
  value(variable: Id<"var">): number | undefined;
  snapshot(): DirectorTick;
}

/**
 * Steps the director from tick 0 to `upTo` and hands each tick to `visit`.
 * Tick 0 holds every start value, calm and its story; the pool is rolled from tick 1.
 */
export function directWorld(worldSeed: string, upTo: number, content: Content, visit: (step: DirectorStep) => void): void {
  if (!Number.isSafeInteger(upTo) || upTo < 0) throw new Error(`A world tick is a whole number from 0, got ${String(upTo)}.`);
  const { stories, pool, place } = storiesOf(content);
  const book = openBook(worldSeed, content, stories, pool, place);
  const pairs = cyclePairs(content);
  const base = DRAWS_PER_STORY * stories.length;
  const hasDecember = content.var[DECEMBER] !== undefined;
  const ids = (list: number[]) => list.map((story) => stories[story]!.id);

  for (let tick = 0; tick <= upTo; tick += 1) {
    if (book.era !== null && tick === book.era.until) {
      endEraStory(book, content, book.era, tick, place);
      book.era = nextEra(worldSeed, content, book.era, book.erasRun);
      book.erasRun.push(book.era.id);
      book.shocksThisEra = [];
      startEraStory(book, content, book.era, place);
    }
    if (tick > 0) turnCycle(book, content, pairs);
    if (hasDecember) book.values[DECEMBER] = tick % MONTHS_A_YEAR === DECEMBER_TICK ? 1 : 0;
    const turned = turnStories(book, tick);
    markClosed(book, tick);
    if (tick > 0) rollStories(book, worldSeed, content, tick, base);
    const era = book.era;
    const cameIntoForce = ids(turned.cameIntoForce);
    visit({
      tick,
      cameIntoForce,
      value: (variable) => book.values[variable],
      // Read before the next tick moves the book on: the walk calls it inside `visit`.
      snapshot: () => ({
        tick,
        vars: { ...book.values },
        news: newsOf(book, tick),
        era: era === null ? null : { id: era.id, since: era.since, until: era.until },
        started: startedAt(book, tick),
        cameIntoForce,
        ended: ids(turned.ended),
      }),
    });
  }
}

/** Every tick of the director from 0 to `upTo`. For tests and reports. */
export function directorTicks(worldSeed: string, upTo: number, content: Content): DirectorTick[] {
  const ticks: DirectorTick[] = [];
  directWorld(worldSeed, upTo, content, (step) => ticks.push(step.snapshot()));
  return ticks;
}
