// From docs/rules/route-gates.md, "The points table (points.canada)". Each row
// holds from its figure up to the next row's; the last row is a floor.
import type { Id, PointsEntry } from "@japacity/sim";

export const pointsTable: Record<Id<"points">, PointsEntry> = {
  "points.canada": {
    id: "points.canada",
    // Whole years. Under 18 scores nothing.
    age: [
      { years: 18, points: 99 },
      { years: 20, points: 110 },
      { years: 30, points: 105 },
      { years: 31, points: 99 },
      { years: 32, points: 94 },
      { years: 33, points: 88 },
      { years: 34, points: 83 },
      { years: 35, points: 77 },
      { years: 36, points: 72 },
      { years: 37, points: 66 },
      { years: 38, points: 61 },
      { years: 39, points: 55 },
      { years: 40, points: 50 },
      { years: 41, points: 39 },
      { years: 42, points: 28 },
      { years: 43, points: 17 },
      { years: 44, points: 6 },
      { years: 45, points: 0 },
    ],
    // quality.edu-level: 1 secondary, 2 diploma, 3 bachelor's, 4 master's, 5 doctorate.
    education: [
      { level: 1, points: 30 },
      { level: 2, points: 98 },
      { level: 3, points: 120 },
      { level: 4, points: 135 },
      { level: 5, points: 150 },
    ],
    // The band times ten, points for each of the four abilities. 70 covers 7.0 and 7.5.
    language: [
      { band: 60, points: 17 },
      { band: 65, points: 23 },
      { band: 70, points: 31 },
      { band: 80, points: 34 },
    ],
    // Low band is 60 or 65; high band is 70 or more. Work counts from 12 months; long work is 36 or more.
    // R-PEOPLE-031: a sibling in Canada, 18 or over, a citizen or resident.
    siblingBonus: 15,
    transfer: {
      educationLowBand: 13,
      educationHighBand: 25,
      workLowBand: 13,
      workHighBand: 25,
      workLongLowBand: 25,
      workLongHighBand: 50,
      highBand: 70,
      workMonths: 12,
      longMonths: 36,
      cap: 100,
    },
    // The care cut-off is read at care 60 or more (R-POINTS-003).
    careMin: 60,
  },
};
