// The world on a schedule (docs/rules/clock.md R-CLOCK-010 to 017): one stored
// row per tick, each a pure function of the row before, the world seed, the
// content and the tick's calendar. A row is never rewritten; two writers make
// the same row and the store keeps the first.
import type { DirectorBook, World, WorldCalendar } from "@japacity/sim";
import { hashState, stepWorld, time } from "@japacity/sim";
import type { WorldTickRow } from "@japacity/store";

import { tickStartsAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import { lotteryFor } from "./lottery.world";

/** R-CLOCK-014: Lagos keeps UTC+1 all year. */
const LAGOS_OFFSET_MS = time.HOUR_MS;
const DECEMBER = 11;

export type WorldDeps = Pick<ServerDeps, "config" | "stores" | "contents" | "secrets">;

/** R-CLOCK-014: December when the tick begins in December in Lagos. */
export function lagosCalendar(startsAt: number): WorldCalendar {
  return { december: new Date(startsAt + LAGOS_OFFSET_MS).getUTCMonth() === DECEMBER };
}

/** R-CLOCK-011, R-CLOCK-015, R-CLOCK-016: the row for the tick after `previous`, or tick 0 from the seed alone, under the current content. */
export async function makeTick(deps: WorldDeps, previous: WorldTickRow | null): Promise<WorldTickRow> {
  const content = deps.contents.current;
  const tick = previous === null ? 0 : previous.tick + 1;
  const book = previous === null ? null : (previous.book as DirectorBook);
  const calendar = lagosCalendar(tickStartsAt(deps.config.clock, tick));
  const stepped = stepWorld(book, deps.secrets.worldSeed, content, calendar, content.tuning.director.onlineTickScale);
  if (stepped.world.tick !== tick) throw new Error(`The book after tick ${String(previous?.tick)} stepped to ${String(stepped.world.tick)}.`);
  const world: World = { ...stepped.world, lottery: await lotteryFor(tick, deps) };
  return { tick, world, book: stepped.book, content: content.version, hash: hashState({ world, book: stepped.book }) };
}

/**
 * R-CLOCK-012, R-CLOCK-013: stores every tick after the latest stored one up
 * to `upTo`, in order, one insert each, and returns the ticks this call
 * stored. Each next row steps from the row the store kept.
 */
export async function catchUp(deps: WorldDeps, upTo: number): Promise<number[]> {
  const stored: number[] = [];
  let previous = await deps.stores.world.latest();
  while ((previous?.tick ?? -1) < upTo) {
    const row = await makeTick(deps, previous);
    if (await deps.stores.world.insertTick(row)) stored.push(row.tick);
    previous = await deps.stores.world.tick(row.tick);
    if (previous === null) throw new Error(`Tick ${String(row.tick)} was inserted and is not stored.`);
  }
  return stored;
}

/** R-CLOCK-013, R-CLOCK-017: the stored row of a tick, made first when it is missing. */
export async function tickRow(deps: WorldDeps, tick: number): Promise<WorldTickRow> {
  const found = await deps.stores.world.tick(tick);
  if (found !== null) return found;
  await catchUp(deps, tick);
  const made = await deps.stores.world.tick(tick);
  if (made === null) throw new Error(`Tick ${String(tick)} is missing under a later stored tick.`);
  return made;
}

/** R-CLOCK-017: the stored worlds of the given ticks, by tick. */
export async function storedWorlds(deps: WorldDeps, ticks: Iterable<number>): Promise<Map<number, World>> {
  const worlds = new Map<number, World>();
  for (const tick of ticks) {
    if (!worlds.has(tick)) worlds.set(tick, (await tickRow(deps, tick)).world);
  }
  return worlds;
}
