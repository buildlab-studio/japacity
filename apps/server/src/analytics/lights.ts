// R-ACCOUNT-031: the two lights' counts, made from the stored
// totals of analytics.md R-ANALYTICS-008 and nothing else. The whole game's,
// never a region's, rounded to the nearest ten, so no figure stands for one
// person. Home and abroad are the lives being played as the nightly count
// last found them (`lives/playing`); before its first run, the lives ever
// started and the departures stand in. Plain functions over plain data.
import type { Where } from "@japacity/sim";
import { int } from "@japacity/sim";
import type { CounterTotal } from "@japacity/store";

import { WHOLE_GAME } from "./list";

/** R-ANALYTICS-008: the nightly count of the lives being played, keyed by where each stands. */
export const LIVES_PLAYING = "lives/playing";

/** Every key of `lives/playing`, written for the whole game even at 0, so a run that found no life still shows. */
export const LIVES_KEYS: readonly Where[] = ["home", "abroad", "road"];

/** What the lights are made from: every stored total, and the days of this UTC month among them. */
export interface LightsInput {
  /** Every stored total so far. */
  totals: readonly CounterTotal[];
  /** The first day of this UTC month, `YYYY-MM-DD`: returns from it on came back this month. */
  monthFrom: string;
}

/** The counts as they are made public: whole tens. */
export interface LightsCounts {
  home: number;
  abroad: number;
  back: number;
}

/**
 * The counters each light reads (R-ANALYTICS-008) besides `lives/playing`. Every
 * life starts at home (`lives/started`); a departure (`japa/departed`) moves one
 * abroad and a return home of any shape (`place/returned`) moves one back.
 */
export const LIGHTS_COUNTERS = { started: "lives/started", departed: "japa/departed", returned: "place/returned" } as const;

/** The step the public figures are rounded to. */
export const LIGHTS_ROUNDING = 10;

/** `count` to the nearest ten, a half rounded up; never below zero. */
export function roundToTen(count: number): number {
  const at = Math.max(0, count);
  return int.divFloor(at + int.divFloor(LIGHTS_ROUNDING, 2), LIGHTS_ROUNDING) * LIGHTS_ROUNDING;
}

/**
 * R-ACCOUNT-031: the lives being played, from the last
 * day the nightly count wrote (its whole-game rows); null before its first run.
 * a life on the road counts at home, as the place rule has two places
 * (place.md R-PLACE-001) and the road is no departure (road.md R-ROAD-001); its
 * own key keeps it apart in the store.
 */
export function livesPlaying(totals: readonly CounterTotal[]): { home: number; abroad: number } | null {
  const whole = totals.filter((row) => row.name === LIVES_PLAYING && row.region === WHOLE_GAME);
  const last = whole.reduce<string | null>((latest, row) => (latest === null || row.day > latest ? row.day : latest), null);
  if (last === null) return null;
  let home = 0;
  let abroad = 0;
  for (const row of whole) {
    if (row.day !== last) continue;
    if (row.key === "abroad") abroad += row.count;
    else home += row.count;
  }
  return { home, abroad };
}

/**
 * R-ACCOUNT-031: home and abroad are the lives being played (`livesPlaying`);
 * until the nightly count has run, abroad is every departure less every
 * return and home every life started less those abroad. Back is the returns
 * this month. Each is whole-game and rounded only at the end, so the rounding
 * never adds up.
 */
export function lightsOf(input: LightsInput): LightsCounts {
  let started = 0;
  let departed = 0;
  let returned = 0;
  let back = 0;
  for (const row of input.totals) {
    if (row.name === LIGHTS_COUNTERS.started) started += row.count;
    else if (row.name === LIGHTS_COUNTERS.departed) departed += row.count;
    else if (row.name === LIGHTS_COUNTERS.returned) {
      returned += row.count;
      if (row.day >= input.monthFrom) back += row.count;
    }
  }
  const playing = livesPlaying(input.totals);
  const abroad = playing?.abroad ?? Math.max(0, departed - returned);
  const home = playing?.home ?? Math.max(0, started - abroad);
  return { home: roundToTen(home), abroad: roundToTen(abroad), back: roundToTen(back) };
}
