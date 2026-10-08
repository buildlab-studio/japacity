// The stand-in world: engine.md section 7, rate.md, news.md and director.md. The
// world at a tick depends only on the world seed, the tick and the content
// (R-RATE-001, R-DIRECTOR-008).
// The rules are recurrences, so the world is built by stepping from tick 0.
// Every tick makes the same two draws on the `rate` stream, so the nth tick
// always reads the same positions however the function is called.
import { BP_WHOLE, bp, divFloor, mulDiv } from "../engine/int";
import { createRandom } from "../engine/random";
import type { Content, ForeignCurrency, Id, World } from "../engine/types";
import type { DirectorTick } from "./director";
import { directWorld } from "./director";
import type { WorldStream } from "./schedule";

const FOREIGN: readonly ForeignCurrency[] = ["GBP", "USD", "CAD", "AED", "EUR"];

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

/**
 * Walks the world from tick 0 to `upTo` and hands each tick's rates and the
 * director's tick to `visit`. The one place the rate recurrences live; the
 * variables, the news and the era come from the director.
 */
function walk(worldSeed: string, upTo: number, content: Content, visit: (track: RateTrack, tick: DirectorTick) => void): void {
  const { rate } = content.tuning;
  const random = createRandom<WorldStream>(worldSeed, {});
  const official = { ...rate.start };
  let premiumBp = rate.premiumFloorBp;
  const street = {} as Record<ForeignCurrency, number>;
  for (const currency of FOREIGN) street[currency] = streetOf(official[currency], premiumBp);

  directWorld(worldSeed, upTo, content, (director) => {
    const { tick } = director;
    if (tick === 0) {
      visit({ tick: 0, official: { ...official }, street: { ...street }, premiumBp }, director);
      return;
    }
    // Both draws are made every tick, float or not, so positions never shift.
    const noise = random.between("rate", -rate.noiseBp, rate.noiseBp);
    const premiumNoise = random.between("rate", -rate.premiumNoiseBp, rate.premiumNoiseBp);
    const factor = BP_WHOLE + rate.driftBp + noise;
    // Content without the supply variable (the engine's mini content) has no shortage to price.
    const supply = director.vars[SUPPLY] ?? FULL_SUPPLY;
    const target = rate.premiumFloorBp + rate.premiumPerSupplyBp * Math.max(0, FULL_SUPPLY - supply);
    premiumBp = Math.max(rate.premiumFloorBp, premiumBp + thirdTowardZero(target - premiumBp) + premiumNoise);
    const floats = director.cameIntoForce.includes(FLOAT_STORY);
    for (const currency of FOREIGN) {
      if (floats) {
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
    if (floats) premiumBp = rate.floatPremiumBp;
    visit({ tick, official: { ...official }, street: { ...street }, premiumBp }, director);
  });
}

function worldOf(track: RateTrack, director: DirectorTick): World {
  const rates = {} as World["rates"];
  for (const currency of FOREIGN) rates[currency] = { official: track.official[currency], street: track.street[currency] };
  return { tick: track.tick, rates, vars: director.vars, news: director.news, era: director.era };
}

/** Every world from tick 0 to `upTo`, in one walk. For tests and reports. */
export function standInWorlds(worldSeed: string, upTo: number, content: Content): World[] {
  const worlds: World[] = [];
  walk(worldSeed, upTo, content, (track, director) => worlds.push(worldOf(track, director)));
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
