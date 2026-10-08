// The stand-in world: engine.md section 7, rate.md, news.md and director.md. The
// world at a tick depends only on the world seed, the tick and the content
// (R-RATE-001, R-DIRECTOR-008). It is the online world's own step
// (`stepWorld`) looped from tick 0 with the scale at 1 and December read from
// the tick, so offline and online share one director.
import type { Content, ForeignCurrency, World } from "../engine/types";
import type { DirectorBook } from "./director";
import { offlineCalendar, stepWorld } from "./director";

/** The rates and the premium at one tick. The premium is kept because the street rate is derived from it. */
export interface RateTrack {
  tick: number;
  official: Record<ForeignCurrency, number>;
  street: Record<ForeignCurrency, number>;
  premiumBp: number;
}

/** Steps the stand-in world from tick 0 to `upTo` and hands each tick to `visit`. */
function walk(worldSeed: string, upTo: number, content: Content, visit: (world: World, book: DirectorBook) => void): void {
  if (!Number.isSafeInteger(upTo) || upTo < 0) throw new Error(`A world tick is a whole number from 0, got ${String(upTo)}.`);
  let book: DirectorBook | null = null;
  for (let tick = 0; tick <= upTo; tick += 1) {
    const next = stepWorld(book, worldSeed, content, offlineCalendar(tick), 1);
    book = next.book;
    visit(next.world, next.book);
  }
}

/** Every world from tick 0 to `upTo`, in one walk. For tests and reports. */
export function standInWorlds(worldSeed: string, upTo: number, content: Content): World[] {
  const worlds: World[] = [];
  walk(worldSeed, upTo, content, (world) => worlds.push(world));
  return worlds;
}

/** The world at a tick. */
export function standInWorld(worldSeed: string, tick: number, content: Content): World {
  let found: World | null = null;
  walk(worldSeed, tick, content, (world) => {
    if (world.tick === tick) found = world;
  });
  if (found === null) throw new Error(`The walk never reached tick ${String(tick)}.`);
  return found;
}

/** The rates with the premium behind them, at a tick. The premium never reaches the view. */
export function rateTrack(worldSeed: string, tick: number, content: Content): RateTrack {
  let track: RateTrack | null = null;
  walk(worldSeed, tick, content, (world, book) => {
    if (world.tick === tick) track = { tick, official: { ...book.rates.official }, street: { ...book.rates.street }, premiumBp: book.rates.premiumBp };
  });
  if (track === null) throw new Error(`The walk never reached tick ${String(tick)}.`);
  return track;
}
