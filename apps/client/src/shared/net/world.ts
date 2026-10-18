// clock:world-fetch-is-jittered: the new world is fetched at `nextTickAt` plus a random wait of
// up to 60 seconds drawn on the device, so a tick is not one burst of requests.
import type { RandomBelow } from "./random";

/** clock.md Numbers: the spread of the world fetch, the server's `clock.worldFetchSpreadMs`. */
export const WORLD_SPREAD_MS = 60_000;

export interface WorldSchedule {
  /** Plans the fetch for this tick's end. A second call for the same time keeps the first plan. */
  at(nextTickAt: number): void;
  stop(): void;
}

export function worldSchedule({ now, random, due }: { now: () => number; random: RandomBelow; due: () => void }): WorldSchedule {
  let planned: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    at(nextTickAt) {
      if (planned === nextTickAt) return;
      planned = nextTickAt;
      clearTimeout(timer);
      const delay = Math.max(0, nextTickAt - now()) + random(WORLD_SPREAD_MS + 1);
      timer = setTimeout(due, delay);
    },
    stop() {
      clearTimeout(timer);
      planned = null;
    },
  };
}
