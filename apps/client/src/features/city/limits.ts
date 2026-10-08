// What a place may show (docs/rules/world.md R-WORLD-011), applied when the place is built so a
// phone never draws more: the crowd by the place's scope and the mode, and at most one moving sheet,
// none in low mode. The numbers are the place check's (tools/assets/world-check.ts). Pure.
import { SHEET_KINDS, WORLD_LIMITS } from "../../../../../tools/assets/world-check";
import type { CityTuning, Mode } from "./mode";
import type { Motion, PlaceFile } from "./placeFile";

/**
 * The city's tuning with the crowd capped for the place: tuning's `crowdLow` and `crowdHigh` stand
 * for the outdoor numbers, and the rule's caps for a room and for an outdoor place apply under them.
 * A place dressed for the send-off party keeps its own crowd: its ten and its dancers.
 */
// tuning.city.crowdLow and crowdHigh are 8 and 16, over the rule's 6 and 10 outdoors; the caps are applied here in code until someone adds tuning.
export function crowdTuning(city: CityTuning, scope: PlaceFile["scope"], dressed: boolean): CityTuning {
  if (dressed) return city;
  const cap = WORLD_LIMITS.people[scope];
  return { ...city, crowdLow: Math.min(city.crowdLow, cap.low), crowdHigh: Math.min(city.crowdHigh, cap.high) };
}

/** Segments of a sheet at the coarse level, by kind: what one copy costs to bend each frame. */
const SHEET_COST: Record<string, number> = { flag: 50, hang: 12, frond: 12 };

/** What a moving sheet costs: its segments times its copies (a row of hangs, a palm's fronds). */
export function sheetCost(motion: Pick<Motion, "kind" | "count">): number {
  return (SHEET_COST[motion.kind] ?? 0) * (motion.count ?? 1);
}

/**
 * The place's motion as the mode may draw it: every moving sheet but the cheapest is dropped in high
 * mode, and every one in low mode. Water, smoke, leaves and bunting stay: they are not sheets.
 */
export function limitMotion(motion: readonly Motion[], mode: Mode): Motion[] {
  const allowed = WORLD_LIMITS.sheets[mode];
  const sheets = motion.filter((entry) => SHEET_KINDS.has(entry.kind));
  // The cheapest first, the earlier of two that cost the same.
  const kept = new Set([...sheets].sort((one, two) => sheetCost(one) - sheetCost(two) || sheets.indexOf(one) - sheets.indexOf(two)).slice(0, allowed));
  return motion.filter((entry) => !SHEET_KINDS.has(entry.kind) || kept.has(entry));
}
