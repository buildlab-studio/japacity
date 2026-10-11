// R-ACCOUNT-031: the two lights' counts, made from the stored
// totals of analytics.md R-ANALYTICS-008 and nothing else. The whole game's,
// never a region's, rounded to the nearest ten, so no figure stands for one
// person. Plain functions over plain data.
import { int } from "@japacity/sim";
import type { CounterTotal } from "@japacity/store";

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
 * The counters each light reads (R-ANALYTICS-008). Every life starts at home
 * (`lives/started`); a departure (`japa/departed`) moves one abroad and a return
 * home of any shape (`place/returned`) moves one back.
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
 * R-ACCOUNT-031: home is every life started less the lives abroad; abroad is
 * every departure less every return; back is the returns this month. Each is
 * whole-game and rounded only at the end, so the rounding never adds up.
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
  const abroad = Math.max(0, departed - returned);
  const home = Math.max(0, started - abroad);
  return { home: roundToTen(home), abroad: roundToTen(abroad), back: roundToTen(back) };
}
