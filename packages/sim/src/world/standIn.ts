// The stand-in world: engine.md section 7, rate.md and news.md. The world at a
// tick depends only on the world seed, the tick and the content (R-RATE-001).
// The rules are recurrences, so the world is built by stepping from tick 0.
// Every tick makes the same two draws on the `rate` stream, so the nth tick
// always reads the same positions however the function is called.
import { BP_WHOLE, bp, divFloor, mulDiv } from "../engine/int";
import { createRandom } from "../engine/random";
import type { Content, ForeignCurrency, Id, World } from "../engine/types";
import type { NewsSchedule, WorldStream } from "./schedule";
import { newsAt, newsSchedule } from "./schedule";

const FOREIGN: readonly ForeignCurrency[] = ["GBP", "USD"];

/** The story whose coming into force floats the naira (R-RATE-004). */
const FLOAT_STORY: Id<"news"> = "news.naira-float";

/** How freely the banks have foreign currency. Its distance below 100 drives the premium (R-RATE-003). */
const SUPPLY: Id<"var"> = "var.fx-supply";
const FULL_SUPPLY = 100;

/** The rates and the premium at one tick. The premium is kept because the street rate is derived from it. */
export interface RateTrack {
  tick: number;
  official: Record<ForeignCurrency, number>;
  street: Record<ForeignCurrency, number>;
  premiumBp: number;
}

/** A third of a whole number, rounded toward zero, so the premium never overshoots its target. */
function thirdTowardZero(n: number): number {
  return n < 0 ? -divFloor(-n, 3) : divFloor(n, 3);
}

function streetOf(official: number, premiumBp: number): number {
  return official + bp(official, premiumBp);
}

/** One story's variables while it is in force, and what they held before it, for `revert`. */
interface Held {
  value: number;
  setBy: Id<"news"> | null;
}

/** The world's variables as stories come into force and end (R-RATE-006). */
interface VarBook {
  values: Record<Id<"var">, number>;
  setBy: Record<Id<"var">, Id<"news"> | null>;
  before: Partial<Record<Id<"news">, Record<Id<"var">, Held>>>;
}

function openBook(content: Content): VarBook {
  const values: Record<Id<"var">, number> = {};
  const setBy: Record<Id<"var">, Id<"news"> | null> = {};
  for (const entry of Object.values(content.var)) {
    values[entry.id] = entry.start;
    setBy[entry.id] = null;
  }
  return { values, setBy, before: {} };
}

/**
 * Applies what happens to the variables on one tick. Endings go first, so a
 * story that comes into force on the tick another ends is the later one and
 * wins. A revert puts back only what the ending story itself still holds: a
 * value a later story set stays, because the later story wins.
 */
function turnBook(book: VarBook, schedule: NewsSchedule, tick: number, content: Content): void {
  const ids = (Object.keys(schedule) as Id<"news">[]).sort();
  for (const id of ids) {
    const entry = content.news[id];
    const before = book.before[id];
    if (entry === undefined || schedule[id]?.ended !== tick || !entry.standIn.revert || before === undefined) continue;
    for (const [variable, held] of Object.entries(before) as [Id<"var">, Held][]) {
      if (book.setBy[variable] !== id) continue;
      book.values[variable] = held.value;
      book.setBy[variable] = held.setBy;
    }
  }
  for (const id of ids) {
    const entry = content.news[id];
    if (entry === undefined || schedule[id]?.inForce !== tick) continue;
    const before: Record<Id<"var">, Held> = {};
    for (const set of entry.standIn.sets) {
      before[set.var] = { value: book.values[set.var] ?? set.value, setBy: book.setBy[set.var] ?? null };
      book.values[set.var] = set.value;
      book.setBy[set.var] = id;
    }
    book.before[id] = before;
  }
}

/**
 * Walks the world from tick 0 to `upTo` and hands each tick's rates, variables
 * and schedule to `visit`. The one place the recurrences live.
 */
function walk(
  worldSeed: string,
  upTo: number,
  content: Content,
  visit: (track: RateTrack, vars: Record<Id<"var">, number>, schedule: NewsSchedule) => void,
): void {
  if (!Number.isSafeInteger(upTo) || upTo < 0) throw new Error(`A world tick is a whole number from 0, got ${String(upTo)}.`);
  const { rate } = content.tuning;
  const schedule = newsSchedule(worldSeed, content);
  const floatTick = schedule[FLOAT_STORY]?.inForce ?? null;
  const book = openBook(content);
  const random = createRandom<WorldStream>(worldSeed, {});

  turnBook(book, schedule, 0, content);
  const official = { ...rate.start };
  let premiumBp = rate.premiumFloorBp;
  const street = { GBP: streetOf(official.GBP, premiumBp), USD: streetOf(official.USD, premiumBp) };
  visit({ tick: 0, official: { ...official }, street: { ...street }, premiumBp }, { ...book.values }, schedule);

  for (let tick = 1; tick <= upTo; tick += 1) {
    turnBook(book, schedule, tick, content);
    // Both draws are made every tick, float or not, so positions never shift.
    const noise = random.between("rate", -rate.noiseBp, rate.noiseBp);
    const premiumNoise = random.between("rate", -rate.premiumNoiseBp, rate.premiumNoiseBp);
    const factor = BP_WHOLE + rate.driftBp + noise;
    // Content without the supply variable (the engine's mini content) has no shortage to price.
    const supply = book.values[SUPPLY] ?? FULL_SUPPLY;
    // rate.md says supply 95 settles near 2.4%, but the rule as written (floor plus 72 a
    // point) gives 200 + 5 * 72 = 560, so 5.6%. Supply 40 giving about 45% agrees with the rule, so
    // the rule is built and the 2.4% figure is left for the maintainer.
    const target = rate.premiumFloorBp + rate.premiumPerSupplyBp * Math.max(0, FULL_SUPPLY - supply);
    premiumBp = Math.max(rate.premiumFloorBp, premiumBp + thirdTowardZero(target - premiumBp) + premiumNoise);
    for (const currency of FOREIGN) {
      if (tick === floatTick) {
        // R-RATE-004: the street rate stays where it was and the official rate jumps to meet it.
        // "where it was" is read as the street rate of the tick before, so the street
        // rate skips that tick's drift and noise; the official rate is that over 1.03, rounded down.
        official[currency] = Math.max(1, mulDiv(street[currency], BP_WHOLE, BP_WHOLE + rate.floatPremiumBp));
      } else {
        // Whole and above zero (R-RATE-005), whatever the factor.
        official[currency] = Math.max(1, mulDiv(official[currency], factor, BP_WHOLE));
        street[currency] = streetOf(official[currency], premiumBp);
      }
    }
    if (tick === floatTick) premiumBp = rate.floatPremiumBp;
    visit({ tick, official: { ...official }, street: { ...street }, premiumBp }, { ...book.values }, schedule);
  }
}

function worldOf(track: RateTrack, vars: Record<Id<"var">, number>, schedule: NewsSchedule): World {
  const rates = {} as World["rates"];
  for (const currency of FOREIGN) rates[currency] = { official: track.official[currency], street: track.street[currency] };
  return { tick: track.tick, rates, vars, news: newsAt(schedule, track.tick) };
}

/** Every world from tick 0 to `upTo`, in one walk. For tests and reports. */
export function standInWorlds(worldSeed: string, upTo: number, content: Content): World[] {
  const worlds: World[] = [];
  walk(worldSeed, upTo, content, (track, vars, schedule) => worlds.push(worldOf(track, vars, schedule)));
  return worlds;
}

/** The world at a tick. */
export function standInWorld(worldSeed: string, tick: number, content: Content): World {
  const world = standInWorlds(worldSeed, tick, content)[tick];
  if (world === undefined) throw new Error(`The walk never reached tick ${String(tick)}.`);
  return world;
}

/** The rates with the premium behind them, at a tick. The premium never reaches the view. */
export function rateTrack(worldSeed: string, tick: number, content: Content): RateTrack {
  const tracks: RateTrack[] = [];
  walk(worldSeed, tick, content, (track) => tracks.push(track));
  const track = tracks[tick];
  if (track === undefined) throw new Error(`The walk never reached tick ${String(tick)}.`);
  return track;
}
