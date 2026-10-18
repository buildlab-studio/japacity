// The Canada cut-offs against the points table (route-gates:points-score-from-table and route-gates:pool-draws-invite, and the Numbers): a strong,
// prepared life reaches the general cut-off within about two years of trying, and a weak one reaches neither cut-off.
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content } from "../index";

const CANADA: Id<"route"> = "route.canada-points";
const block = content.route[CANADA]!.points!;
const table = content.points[block.table]!;
const start = (id: Id<"var">): number => content.var[id]!.start;
const CUTOFF = start(block.cutoffVar);
const CARE_CUTOFF = start(block.careCutoffVar!);

/** The sum the world's stories add to a var while in force, by story. */
function adds(story: Id<"news">, id: Id<"var">): number {
  return (content.news[story]?.director?.adds ?? []).filter((add) => add.var === id).reduce((sum, add) => sum + add.value, 0);
}
const GENERAL_PAUSE = adds("news.ca-general-stops", block.cutoffVar);
const CARE_DRAW = adds("news.ca-care-draw", block.careCutoffVar!);

/**
 * route-gates:points-score-from-table from the table: age, education, the band on each of four abilities, and the transferability part capped.
 * Education after secondary school is level 2 (a diploma) and up, as the points gate reads it.
 */
function score(years: number, level: number, band: number, workMonths: number): number {
  const row = <T extends { points: number }>(rows: T[], at: (item: T) => number, value: number): number =>
    rows.filter((item) => at(item) <= value).at(-1)?.points ?? 0;
  const t = table.transfer;
  const low = band >= (table.language[0]?.band ?? 0);
  const high = band >= t.highBand;
  const education = level >= 2 && low ? (high ? t.educationHighBand : t.educationLowBand) : 0;
  let work = 0;
  if (low && workMonths >= t.longMonths) work = high ? t.workLongHighBand : t.workLongLowBand;
  else if (low && workMonths >= t.workMonths) work = high ? t.workHighBand : t.workLowBand;
  return (
    row(table.age, (item) => item.years, years) +
    row(table.education, (item) => item.level, level) +
    4 * row(table.language, (item) => item.band, band) +
    Math.min(t.cap, education + work)
  );
}

describe("the Canada cut-offs", () => {
  test("[route-gates:pool-draws-invite] given a bachelor's, band 7.0 on every ability, 12 months of work and 29 years, when scored, then it is one under the general cut-off's start: the page's worked example", () => {
    expect(score(29, 3, 70, 12)).toBe(404);
    expect(score(29, 3, 70, 12)).toBe(CUTOFF - 1);
  });

  test("[route-gates:pool-draws-invite] given the same life two years on, with 36 months of work and still under thirty, when scored, then it reaches the general cut-off even after the general pause has raised it", () => {
    expect(score(29, 3, 70, 36)).toBe(429);
    expect(score(29, 3, 70, 36)).toBeGreaterThanOrEqual(CUTOFF + GENERAL_PAUSE);
    expect(score(29, 3, 70, 35)).toBeLessThan(CUTOFF);
  });

  test("[route-gates:pool-draws-invite] given a diploma, band 6.0 and no work at 29, when scored, then it is under the general cut-off and under the care cut-off at its lowest, in a draw round", () => {
    expect(score(29, 2, 60, 0)).toBe(289);
    expect(score(29, 2, 60, 0)).toBeLessThan(CUTOFF);
    expect(score(29, 2, 60, 0)).toBeLessThan(CARE_CUTOFF + CARE_DRAW);
    // Three years of work and a sibling in Canada do not lift it there either.
    expect(score(29, 2, 60, 36) + table.siblingBonus).toBeLessThan(CARE_CUTOFF + CARE_DRAW);
  });

  test("[route-gates:pool-draws-invite] given the two cut-offs' starts, when compared, then the care cut-off sits below the general one by the share of the real ones, 475 of 520, to the nearest point", () => {
    expect(CARE_CUTOFF).toBeLessThan(CUTOFF);
    expect(Math.abs(CARE_CUTOFF * 520 - CUTOFF * 475)).toBeLessThanOrEqual(260);
    expect([CUTOFF, CARE_CUTOFF, GENERAL_PAUSE, CARE_DRAW]).toEqual([405, 370, 20, -20]);
  });
});
