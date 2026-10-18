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
    // person:canada-sibling-bonus: a sibling in Canada, 18 or over, a citizen or resident.
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
    // The care cut-off is read at care 60 or more (route-gates:pool-draws-invite).
    careMin: 60,
  },

  // docs/rules/person.md, "Entry: points.canada-spouse": the lead's columns with
  // a spouse, then the spouse's own factors, capped at 40 (person:canada-spouse-points). The
  // transferability part, the sibling bonus and the care figure are unchanged.
  "points.canada-spouse": {
    id: "points.canada-spouse",
    age: [
      { years: 18, points: 90 },
      { years: 19, points: 95 },
      { years: 20, points: 100 },
      { years: 30, points: 95 },
      { years: 31, points: 90 },
      { years: 32, points: 85 },
      { years: 33, points: 80 },
      { years: 34, points: 75 },
      { years: 35, points: 70 },
      { years: 36, points: 65 },
      { years: 37, points: 60 },
      { years: 38, points: 55 },
      { years: 39, points: 50 },
      { years: 40, points: 45 },
      { years: 41, points: 35 },
      { years: 42, points: 25 },
      { years: 43, points: 15 },
      { years: 44, points: 5 },
      { years: 45, points: 0 },
    ],
    education: [
      { level: 1, points: 28 },
      { level: 2, points: 91 },
      { level: 3, points: 112 },
      { level: 4, points: 126 },
      { level: 5, points: 140 },
    ],
    // CLB 7, 8, 9 and 10 or more, as the bands of points.canada read them.
    language: [
      { band: 60, points: 16 },
      { band: 65, points: 22 },
      { band: 70, points: 29 },
      { band: 80, points: 32 },
    ],
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
    spouse: {
      // Secondary, diploma, bachelor's, then a master's or a doctorate.
      education: [
        { level: 1, points: 2 },
        { level: 2, points: 7 },
        { level: 3, points: 8 },
        { level: 4, points: 10 },
      ],
      // Per ability. CLB 5 or 6 is band 50 (5.0) and up, the step below CLB 7's band 60.
      language: [
        { band: 50, points: 1 },
        { band: 60, points: 3 },
        { band: 70, points: 5 },
      ],
      canadianWork: [
        { years: 0, points: 0 },
        { years: 1, points: 5 },
        { years: 2, points: 7 },
        { years: 3, points: 8 },
        { years: 4, points: 9 },
        { years: 5, points: 10 },
      ],
      cap: 40,
    },
    careMin: 60,
  },
};
