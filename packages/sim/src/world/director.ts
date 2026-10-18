// The director: docs/rules/director.md. Eras, the per-tick story roll, the
// stages of each story and the policy cycle, stepped one tick at a time from a
// book of plain data (clock:world-is-stored-history, clock:tick-row-is-pure-step). Everything it reads is the
// book, the world seed, the content and the tick's calendar (rate:world-follows-seed-and-tick): no
// character reaches it. Stories without director fields keep the fixed
// schedule of news.md, drawn in `schedule.ts`.
//
// Draw positions. The era stream gives era n (calm at tick 0 is era 0) the
// positions 2n (which era) and 2n + 1 (its length). The shock stream's first
// positions belong to the fixed schedule; after them, each tick owns one run of
// positions with one for each story of the pool, by its place in id order. So
// whether one story fires never moves the draws of another.
//
// Where the page leaves room:
// - Calm is announced at tick 0 like any era; the pool is rolled from tick 1, so tick 0 holds every start value.
// - The chance of a roll is chanceBp times the era's weight for the group, out of 10000, at most 10000.
//   A group the era does not name weighs 1.
// - The cap of new stories a tick counts only rolled stories, not an era's own story.
// - Cooldown and the shock gap count from the tick a story is rolled. A shock is once per era for each story.
// - A story fires again only once its last pass has been seen ended for a tick, or when it stays in force
//   for good; so one story never runs two passes at once.
// - A reopening is a story whose needs hold a window at 0; the director adds the closed-ticks wait.
// - `endedBy` ends a pass already in force; a pass still at rumour or announced runs on.
// - Surges move on the window as it stood at the end of the tick before, then the tick's stories land,
//   so a reopening that sets the surge to 0 leaves it at 0. Surges and strictness stay inside 0 to 100.
// - The book keys stories and variables by id, so a stored book steps on under newer content (clock:new-content-from-next-tick):
//   a story new to the content starts unfired, a variable new to it starts at its start value, and a story
//   or variable the content no longer has leaves the book and the world on the first tick under it.
// - `scale` (clock:online-lengths-scaled) multiplies an era's drawn length, a story's rumour lead, force lag, end and
//   cooldown, the closed ticks and the shock gap. The fixed schedule of news.md is not the director's and
//   keeps its own ticks.
import { VAR } from "../engine/ids";
import { BP_WHOLE } from "../engine/int";
import { createRandom, drawAt, scaleDraw } from "../engine/random";
import type { Content, EraEntry, Id, NewsEntry, Requirement, World, WorldNews } from "../engine/types";
import type { RateBook } from "./rate";
import { FOREIGN } from "../wallet/wallet.rates";
import { FLOAT_STORY, openRates, stepRates, SUPPLY } from "./rate";
import type { StoryTicks, WorldStream } from "./schedule";
import { DRAWS_PER_STORY, newsSchedule, stageAt } from "./schedule";

const OPENING_ERA: Id<"era"> = "era.calm";
const SHOCK: WorldStream = "shock";
const WINDOW_OPEN = 2;
const WINDOW_NARROWING = 1;
const SCALE_MAX = 100;
const ERA_DRAWS = 2;
const MONTHS_A_YEAR = 12;
/** Offline, the eleventh tick of each game year is December (director:december-and-inflation). */
const DECEMBER_TICK = 11;

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

/** What a variable held before a story in force changed it, for `revert` (rate:latest-story-sets-variable). */
interface HeldValue {
  value: number;
  setBy: Id<"news"> | null;
}

/** One story in the book: its latest pass, what it changed, and the tick it last fired from the pool. */
interface BookStory {
  pass: StoryTicks | null;
  before: Record<Id<"var">, HeldValue> | null;
  lastFired: number | null;
}

/** The era running, with its place in the world's run of eras for its draw positions. */
interface BookEra {
  id: Id<"era">;
  since: number;
  until: number;
  index: number;
}

/**
 * Everything the world carries from one tick to the next (clock:world-is-stored-history): the
 * era and the eras run, the shocks this era, each story's pass, the variables'
 * values and the stories holding them, the rates, and the world's draw counts.
 * Plain data: it survives JSON, and the server stores it beside each tick's
 * world. It never reaches a client (server:secrets-stay-on-server).
 */
export interface DirectorBook {
  /** The tick this book stands at. */
  tick: number;
  era: BookEra | null;
  erasRun: Id<"era">[];
  shocksThisEra: Id<"news">[];
  lastShock: number | null;
  stories: Record<Id<"news">, BookStory>;
  values: Record<Id<"var">, number>;
  setBy: Record<Id<"var">, Id<"news"> | null>;
  /** The tick each window last became 0, or null while it is open or narrowing. */
  closedSince: Record<Id<"var">, number | null>;
  rates: RateBook;
  /** Draws made on the streams the world draws in order. `era` and `shock` are read by position and never counted. */
  draws: Partial<Record<WorldStream, number>>;
}

/** The facts of the real calendar a tick needs (clock:december-by-lagos-time, director:december-and-inflation). */
export interface WorldCalendar {
  december: boolean;
}

/** What the director reads of one story, worked out once for each content. Stories are held by their place in id order. */
interface Story {
  id: Id<"news">;
  entry: NewsEntry;
  /** The stories this one ends when it comes into force (their `endedBy`). */
  ends: number[];
  /** A reopening's window (director:policy-cycle-surge-backlash), or null. */
  reopens: Id<"var"> | null;
  /** In force for good once it gets there: no end and nothing ends it. */
  forGood: boolean;
}

/** What the director works out from the content alone. */
interface Reading {
  stories: Story[];
  place: Record<Id<"news">, number>;
  /** The stories rolled each tick, in id order, by their place in `stories`. */
  pool: number[];
  pairs: [window: Id<"var">, surge: Id<"var">][];
  windows: Id<"var">[];
  /** The shock stream's positions the fixed schedule owns; the pool's begin after them. */
  base: number;
}

/** Content is never changed once loaded, so its reading is kept beside it. */
const READINGS = new WeakMap<Content, Reading>();

type WorldRequirement = Extract<Requirement, { type: "var/min" | "var/max" | "era/is" | "not" | "any" }>;

const WORLD_REQUIREMENTS: readonly string[] = ["var/min", "var/max", "era/is", "not", "any"] satisfies WorldRequirement["type"][];

export function isWorldRequirement(requirement: Requirement): requirement is WorldRequirement {
  return WORLD_REQUIREMENTS.includes(requirement.type);
}

/** A story's needs read the world only: its variables and its era. */
function holds(requirement: Requirement, book: DirectorBook): boolean {
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

function valueOf(book: DirectorBook, variable: Id<"var">): number {
  const value = book.values[variable];
  if (value === undefined) throw new Error(`A story reads the variable ${variable}, which is not in content.`);
  return value;
}

/** Surges and strictness run 0 to 100 (director:world-variables-per-route). */
function bounded(variable: Id<"var">, value: number): number {
  if (variable.endsWith("-surge") || variable.endsWith("-strictness")) return Math.min(SCALE_MAX, Math.max(0, value));
  return value;
}

/** The windows that have a surge beside them: `var.<route>-window` and `var.<route>-surge` (director:world-variables-per-route). */
function cyclePairs(content: Content): [window: Id<"var">, surge: Id<"var">][] {
  return (Object.keys(content.var) as Id<"var">[])
    .filter((id) => id.endsWith("-window"))
    .sort()
    .map((window): [Id<"var">, Id<"var">] => [window, `${window.slice(0, -"-window".length)}-surge` as Id<"var">])
    .filter(([, surge]) => content.var[surge] !== undefined);
}

/** A reopening's window: the one its needs hold at 0 (director:policy-cycle-surge-backlash). */
function reopeningWindow(entry: NewsEntry): Id<"var"> | null {
  const need = entry.director?.needs.find((one) => one.type === "var/max" && one.var.endsWith("-window") && one.value === 0);
  return need !== undefined && need.type === "var/max" ? need.var : null;
}

function readingOf(content: Content): Reading {
  const known = READINGS.get(content);
  if (known !== undefined) return known;
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
  const windows = Object.values(content.var)
    .map((entry): Id<"var"> => entry.id)
    .filter((id) => id.endsWith("-window"));
  const reading: Reading = { stories, place, pool, pairs: cyclePairs(content), windows, base: DRAWS_PER_STORY * stories.length };
  READINGS.set(content, reading);
  return reading;
}

function eraLength(worldSeed: string, entry: EraEntry, index: number, scale: number): number {
  const random = createRandom<WorldStream>(worldSeed, { era: index * ERA_DRAWS + 1 });
  return random.between("era", entry.ticks[0], entry.ticks[1]) * scale;
}

/**
 * The era after one that ends (director:one-era-at-a-time): weighted by each entry's `after` weight for the era
 * that ended, never the same era twice in a row, and an era marked once never twice in a world.
 */
function nextEra(worldSeed: string, content: Content, ended: BookEra, erasRun: readonly Id<"era">[], scale: number): BookEra {
  const index = ended.index + 1;
  const candidates = (Object.keys(content.era) as Id<"era">[])
    .sort()
    .map((id) => content.era[id]!)
    .filter((entry) => entry.id !== ended.id && !(entry.once && erasRun.includes(entry.id)))
    .map((entry) => ({ entry, weight: entry.after[ended.id] ?? 0 }))
    .filter((candidate) => candidate.weight > 0);
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (total === 0) throw new Error(`No era may follow ${ended.id}: every era needs one that names it in \`after\` (director:stories-never-undo-player-gains).`);
  let draw = createRandom<WorldStream>(worldSeed, { era: index * ERA_DRAWS }).int("era", total);
  for (const { entry, weight } of candidates) {
    if (draw < weight) return { id: entry.id, since: ended.until, until: ended.until + eraLength(worldSeed, entry, index, scale), index };
    draw -= weight;
  }
  throw new Error("The era draw fell outside its weights.");
}

function storyIn(book: DirectorBook, id: Id<"news">): BookStory {
  const story = book.stories[id];
  if (story === undefined) throw new Error(`The book has no story ${id}.`);
  return story;
}

/** The era's story: announced the tick the era begins, in force its force lag later, ended with the era. */
function startEraStory(book: DirectorBook, content: Content, era: BookEra, scale: number): void {
  const story = content.era[era.id]?.story;
  const entry = story === undefined ? undefined : content.news[story];
  // Test contents may name an era without its story; the era runs all the same.
  if (story === undefined || entry === undefined) return;
  storyIn(book, story).pass = { rumour: null, announced: era.since, inForce: era.since + entry.standIn.forceLag * scale, ended: null };
}

function endEraStory(book: DirectorBook, content: Content, era: BookEra, tick: number): void {
  const story = content.era[era.id]?.story;
  const held = story === undefined ? undefined : book.stories[story];
  if (held === undefined || held.pass === null) return;
  held.pass = { ...held.pass, ended: tick };
}

/** A fresh story in the book: never fired. */
function unfired(): BookStory {
  return { pass: null, before: null, lastFired: null };
}

function openBook(worldSeed: string, content: Content, reading: Reading, scale: number): DirectorBook {
  const values: Record<Id<"var">, number> = {};
  const setBy: Record<Id<"var">, Id<"news"> | null> = {};
  for (const entry of Object.values(content.var)) {
    values[entry.id] = entry.start;
    setBy[entry.id] = null;
  }
  const stories: Record<Id<"news">, BookStory> = {};
  for (const story of reading.stories) stories[story.id] = unfired();
  const opening = content.era[OPENING_ERA];
  const era = opening === undefined ? null : { id: opening.id, since: 0, until: eraLength(worldSeed, opening, 0, scale), index: 0 };
  const book: DirectorBook = {
    tick: 0,
    era,
    erasRun: era === null ? [] : [era.id],
    shocksThisEra: [],
    lastShock: null,
    stories,
    values,
    setBy,
    closedSince: {},
    rates: openRates(content),
    draws: {},
  };
  // Stories without director fields keep the fixed schedule of news.md. Drawing it costs a walk's worth
  // of time, so content whose every story has director fields skips it.
  const fixed = reading.stories.some((story) => story.entry.director === undefined) ? newsSchedule(worldSeed, content) : {};
  for (const [id, ticks] of Object.entries(fixed) as [Id<"news">, StoryTicks][]) {
    if (content.news[id]?.director === undefined) storyIn(book, id).pass = ticks;
  }
  if (era !== null) startEraStory(book, content, era, scale);
  markClosed(book, reading, 0);
  return book;
}

/** A copy deep enough that stepping it never touches the one it came from. */
function copyBook(book: DirectorBook): DirectorBook {
  const stories: Record<Id<"news">, BookStory> = {};
  for (const [id, story] of Object.entries(book.stories) as [Id<"news">, BookStory][]) stories[id] = { ...story };
  return {
    ...book,
    era: book.era === null ? null : { ...book.era },
    erasRun: [...book.erasRun],
    shocksThisEra: [...book.shocksThisEra],
    stories,
    values: { ...book.values },
    setBy: { ...book.setBy },
    closedSince: { ...book.closedSince },
    rates: { official: { ...book.rates.official }, street: { ...book.rates.street }, premiumBp: book.rates.premiumBp },
    draws: { ...book.draws },
  };
}

/** clock:new-content-from-next-tick: the book follows the content it is stepped under. */
function followContent(book: DirectorBook, content: Content, reading: Reading): void {
  for (const story of reading.stories) book.stories[story.id] ??= unfired();
  for (const id of Object.keys(book.stories) as Id<"news">[]) {
    if (content.news[id] === undefined) delete book.stories[id];
  }
  for (const entry of Object.values(content.var)) {
    if (book.values[entry.id] === undefined) {
      book.values[entry.id] = entry.start;
      book.setBy[entry.id] = null;
    }
  }
  for (const id of Object.keys(book.values) as Id<"var">[]) {
    if (content.var[id] === undefined) {
      delete book.values[id];
      delete book.setBy[id];
      delete book.closedSince[id];
    }
  }
}

function markClosed(book: DirectorBook, reading: Reading, tick: number): void {
  for (const id of reading.windows) {
    book.closedSince[id] = book.values[id] === 0 ? (book.closedSince[id] ?? tick) : null;
  }
}

/** director:policy-cycle-surge-backlash: surges follow their windows as they stood at the end of the tick before. */
function turnCycle(book: DirectorBook, content: Content, reading: Reading): void {
  const step = content.tuning.director.surgePerTick;
  for (const [window, surge] of reading.pairs) {
    const open = valueOf(book, window);
    const now = valueOf(book, surge);
    if (open >= WINDOW_OPEN) book.values[surge] = Math.min(SCALE_MAX, now + step);
    else if (open < WINDOW_NARROWING) book.values[surge] = Math.max(0, now - 2 * step);
  }
}

/** The stories, in id order, whose pass satisfies the test. */
function storiesWhere(book: DirectorBook, reading: Reading, test: (pass: StoryTicks) => boolean): number[] {
  return reading.stories.flatMap((story, index) => {
    const pass = book.stories[story.id]?.pass ?? null;
    return pass !== null && test(pass) ? [index] : [];
  });
}

/**
 * The stages that land on this tick (director:stories-pass-through-stages). Endings go first, so a
 * story that comes into force on the tick another ends is the later one and
 * wins. A revert puts back only what the ending story itself still holds.
 */
function turnStories(book: DirectorBook, reading: Reading, tick: number): { cameIntoForce: number[]; ended: number[] } {
  const cameIntoForce = storiesWhere(book, reading, (pass) => pass.inForce === tick);
  // A story in force ends on the tick its `endedBy` story comes into force.
  for (const ender of cameIntoForce) {
    for (const index of reading.stories[ender]!.ends) {
      const story = storyIn(book, reading.stories[index]!.id);
      const pass = story.pass;
      if (pass === null || pass.inForce >= tick || (pass.ended !== null && pass.ended <= tick)) continue;
      story.pass = { ...pass, ended: tick };
    }
  }
  const ended = storiesWhere(book, reading, (pass) => pass.ended === tick && pass.inForce < tick);
  for (const index of ended) {
    const { id, entry } = reading.stories[index]!;
    if (!entry.standIn.revert) continue;
    const before = storyIn(book, id).before;
    for (const [variable, held] of Object.entries(before ?? {}) as [Id<"var">, HeldValue][]) {
      if (book.setBy[variable] !== id) continue;
      const back = heldNow(book, reading, variable, held, tick);
      book.values[variable] = back.value;
      book.setBy[variable] = back.setBy;
    }
    // An `adds` is relative and holds nothing: a reverting story takes back what it added.
    for (const add of entry.director?.adds ?? []) {
      const from = book.values[add.var];
      if (from !== undefined) book.values[add.var] = bounded(add.var, from - add.value);
    }
  }
  for (const index of cameIntoForce) {
    const { id, entry } = reading.stories[index]!;
    const before: Record<Id<"var">, HeldValue> = {};
    const change = (variable: Id<"var">, to: (from: number) => number) => {
      const from = book.values[variable];
      if (from === undefined) throw new Error(`The story ${id} changes the variable ${variable}, which is not in content.`);
      before[variable] ??= { value: from, setBy: book.setBy[variable] ?? null };
      book.values[variable] = bounded(variable, to(from));
      book.setBy[variable] = id;
    };
    for (const set of entry.standIn.sets) change(set.var, () => set.value);
    for (const add of entry.director?.adds ?? []) {
      const from = book.values[add.var];
      if (from === undefined) throw new Error(`The story ${id} adds to the variable ${add.var}, which is not in content.`);
      book.values[add.var] = bounded(add.var, from + add.value);
    }
    storyIn(book, id).before = before;
  }
  return { cameIntoForce, ended };
}

/** A story may fire again only once its last pass has been seen ended, or is in force for good. */
function free(book: DirectorBook, story: Story, tick: number): boolean {
  const pass = storyIn(book, story.id).pass;
  if (pass === null) return true;
  if (pass.ended !== null) return pass.ended < tick;
  return story.forGood && pass.inForce <= tick;
}

/**
 * What a variable goes back to when a story reverts (rate:latest-story-sets-variable). The story that held the value before
 * may itself have ended and reverted since, while this story kept the variable: then its own `before`
 * is what stands, and so on down the chain.
 */
function heldNow(book: DirectorBook, reading: Reading, variable: Id<"var">, held: HeldValue, tick: number): HeldValue {
  let back = held;
  for (let guard = 0; guard < reading.stories.length && back.setBy !== null; guard += 1) {
    const at = reading.place[back.setBy];
    const holder = book.stories[back.setBy];
    if (at === undefined || holder === undefined) break;
    const pass = holder.pass;
    const gone = pass !== null && pass.ended !== null && pass.ended <= tick;
    const deeper = holder.before?.[variable];
    if (!gone || !reading.stories[at]!.entry.standIn.revert || deeper === undefined) break;
    back = deeper;
  }
  return back;
}

/** director:stories-start-by-roll: each story of the pool, in id order, rolled on its own position of `shock`. */
function rollStories(book: DirectorBook, worldSeed: string, content: Content, reading: Reading, tick: number, scale: number): void {
  const { director } = content.tuning;
  const weights = book.era === null ? null : (content.era[book.era.id]?.weights ?? null);
  let started = 0;
  for (const [place, index] of reading.pool.entries()) {
    if (started >= director.maxNewPerTick) break;
    const story = reading.stories[index]!;
    const { id, entry, reopens } = story;
    const held = storyIn(book, id);
    const rules = entry.director!;
    const last = held.lastFired;
    if (last !== null && (rules.once || tick - last < rules.cooldown * scale)) continue;
    if (!free(book, story, tick)) continue;
    if (rules.shock && (book.shocksThisEra.includes(id) || (book.lastShock !== null && tick - book.lastShock < director.shockGapTicks * scale))) continue;
    if (reopens !== null) {
      const since = book.closedSince[reopens];
      if (since === undefined || since === null || tick - since < director.closedTicks * scale) continue;
    }
    if (!rules.needs.every((need) => holds(need, book))) continue;
    const chance = Math.min(BP_WHOLE, entry.standIn.chanceBp * (weights?.[rules.group] ?? 1));
    // The same draw `chance` makes, read at this story's own position for the tick.
    if (scaleDraw(drawAt(worldSeed, SHOCK, reading.base + tick * reading.pool.length + place), BP_WHOLE) >= chance) continue;
    // The roll starts the story at its first stage. With a rumour lead the rumour runs from now
    // and the announcement follows the lead later; director:stories-pass-through-stages counts the lead back from the announcement.
    const { rumourLead, forceLag, endsAfter } = entry.standIn;
    const announced = tick + rumourLead * scale;
    const inForce = announced + forceLag * scale;
    held.pass = { rumour: rumourLead > 0 ? tick : null, announced, inForce, ended: endsAfter === null ? null : inForce + endsAfter * scale };
    held.lastFired = tick;
    if (rules.shock) {
      book.lastShock = tick;
      book.shocksThisEra.push(id);
    }
    started += 1;
  }
}

function newsOf(book: DirectorBook, reading: Reading, tick: number): WorldNews[] {
  const news: WorldNews[] = [];
  for (const story of reading.stories) {
    const pass = book.stories[story.id]?.pass ?? null;
    const reached = pass === null ? null : stageAt(pass, tick);
    if (reached !== null) news.push({ id: story.id, ...reached });
  }
  return news;
}

function startedAt(book: DirectorBook, reading: Reading, tick: number): Id<"news">[] {
  return reading.stories.flatMap((story) => {
    const pass = book.stories[story.id]?.pass ?? null;
    return pass !== null && (pass.rumour ?? pass.announced) === tick ? [story.id] : [];
  });
}

/** The scale multiplies whole ticks, so it is a whole number from 1. */
function checkArguments(scale: number): void {
  if (!Number.isSafeInteger(scale) || scale < 1) throw new Error(`The director's scale is a whole number from 1, got ${String(scale)}.`);
}

/** One tick of the world, with the book after it and what moved on it. */
interface WorldStep {
  book: DirectorBook;
  world: World;
  tick: DirectorTick;
}

/**
 * Steps the world one tick: from nothing to tick 0, or from a book to the tick
 * after it (clock:tick-row-is-pure-step). Tick 0 holds every start value, calm and its story;
 * the pool is rolled from tick 1. Never changes the book it is given.
 */
function stepWorldTick(book: DirectorBook | null, worldSeed: string, content: Content, calendar: WorldCalendar, scale: number): WorldStep {
  checkArguments(scale);
  const reading = readingOf(content);
  const next = book === null ? openBook(worldSeed, content, reading, scale) : copyBook(book);
  const tick = book === null ? 0 : book.tick + 1;
  if (book !== null) followContent(next, content, reading);
  next.tick = tick;
  if (next.era !== null && tick === next.era.until) {
    endEraStory(next, content, next.era, tick);
    next.era = nextEra(worldSeed, content, next.era, next.erasRun, scale);
    next.erasRun.push(next.era.id);
    next.shocksThisEra = [];
    startEraStory(next, content, next.era, scale);
  }
  if (tick > 0) turnCycle(next, content, reading);
  if (content.var[VAR.seasonDecember] !== undefined) next.values[VAR.seasonDecember] = calendar.december ? 1 : 0;
  const turned = turnStories(next, reading, tick);
  markClosed(next, reading, tick);
  if (tick > 0) rollStories(next, worldSeed, content, reading, tick, scale);
  const cameIntoForce = turned.cameIntoForce.map((index) => reading.stories[index]!.id);
  if (tick > 0) {
    next.rates = stepRates(next.rates, next.draws, worldSeed, content, next.values[SUPPLY], cameIntoForce.includes(FLOAT_STORY));
  }
  const era = next.era === null ? null : { id: next.era.id, since: next.era.since, until: next.era.until };
  const vars = { ...next.values };
  const news = newsOf(next, reading, tick);
  const rates = {} as World["rates"];
  for (const currency of FOREIGN) rates[currency] = { official: next.rates.official[currency], street: next.rates.street[currency] };
  return {
    book: next,
    // The draw is the online server's; the stand-in runs none.
    world: { tick, rates, vars, news, era, lottery: null, placeNames: {} },
    tick: {
      tick,
      vars,
      news,
      era,
      started: startedAt(next, reading, tick),
      cameIntoForce,
      ended: turned.ended.map((index) => reading.stories[index]!.id),
    },
  };
}

/**
 * The world one tick on (clock:tick-row-is-pure-step): a pure function of the book before, the
 * world seed, the content, the tick's calendar and the online scale
 * (clock:online-lengths-scaled). `null` makes tick 0 from the world seed alone.
 */
export function stepWorld(book: DirectorBook | null, worldSeed: string, content: Content, calendar: WorldCalendar, scale: number): { book: DirectorBook; world: World } {
  const { book: next, world } = stepWorldTick(book, worldSeed, content, calendar, scale);
  return { book: next, world };
}

/** The calendar offline, where one tick is one month played (director:december-and-inflation). */
export function offlineCalendar(tick: number): WorldCalendar {
  return { december: tick % MONTHS_A_YEAR === DECEMBER_TICK };
}

/** Every tick of the director from 0 to `upTo`, offline unless told the scale and the calendar. For tests and reports. */
export function directorTicks(
  worldSeed: string,
  upTo: number,
  content: Content,
  scale = 1,
  calendar: (tick: number) => WorldCalendar = offlineCalendar,
): DirectorTick[] {
  if (!Number.isSafeInteger(upTo) || upTo < 0) throw new Error(`A world tick is a whole number from 0, got ${String(upTo)}.`);
  const ticks: DirectorTick[] = [];
  let book: DirectorBook | null = null;
  for (let tick = 0; tick <= upTo; tick += 1) {
    const step = stepWorldTick(book, worldSeed, content, calendar(tick), scale);
    book = step.book;
    ticks.push(step.tick);
  }
  return ticks;
}
