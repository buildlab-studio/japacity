// From docs/rules/scenario.md, "The graduate, the banker and the developer": ready lives with no name or sex of their
// own (streets:sex-optional-with-neutral-path). Grades and levels are
// numbered as in docs/rules/quality.md: a bachelor's is 3, a second upper 4,
// a second lower 3.
import type { Id, ScenarioEntry } from "@japacity/sim";

import { naira } from "../units";

export const scenarioTable: Record<Id<"scenario">, ScenarioEntry> = {
  "scenario.graduate": {
    id: "scenario.graduate",
    qualities: {
      // 23 years 2 months.
      "quality.age-months": 278,
      "quality.edu-level": 3,
      "quality.edu-grade": 4,
      "quality.english": 55,
      "quality.tech": 35,
      "quality.interview-prep": 0,
      "quality.portfolio": 0,
      "quality.land": 0,
      "quality.network": 15,
      "quality.family-means": 60,
      "quality.family-stake": 0,
      "quality.standing": 60,
      "quality.wellbeing": 70,
      "quality.belly": 60,
      "quality.energy": 70,
      "quality.credit-mark": 0,
      "quality.care": 0,
      "quality.driving": 0,
      // health.md: the hidden health counters start at nothing.
      "quality.run-down-months": 0,
      "quality.illness-course": 0,
      "quality.forced-wait": 0,
    },
    job: null,
    // person:invite-fills-a-slot: a working value, as scenario.md gives this life no count.
    siblings: 2,
    hometown: "hometown.enugu",
    tenure: {},
    // Four months of living in hand, so a graduate who follows the nudge to the board is hired before the money runs
    // out (scenario.md's table).
    pockets: { NGN: { bank: naira(355000), cash: naira(25000) } },
    documents: [],
    obligations: [{ obligation: "obligation.upkeep", amount: naira(95000) }],
  },
  "scenario.banker": {
    id: "scenario.banker",
    qualities: {
      // 28 years 6 months.
      "quality.age-months": 342,
      "quality.edu-level": 3,
      "quality.edu-grade": 3,
      "quality.english": 50,
      "quality.tech": 10,
      "quality.interview-prep": 0,
      "quality.portfolio": 0,
      "quality.land": 1,
      "quality.network": 40,
      "quality.family-means": 35,
      "quality.family-stake": 0,
      "quality.standing": 70,
      "quality.wellbeing": 55,
      "quality.belly": 60,
      "quality.energy": 70,
      "quality.credit-mark": 0,
      "quality.care": 0,
      // car.md: the banker can drive.
      "quality.driving": 1,
      // health.md: the hidden health counters start at nothing.
      "quality.run-down-months": 0,
      "quality.illness-course": 0,
      "quality.forced-wait": 0,
    },
    job: "activity.job-bank-officer",
    // person:invite-fills-a-slot: a working value, as scenario.md gives this life no count.
    siblings: 2,
    hometown: "hometown.abeokuta",
    tenure: { "activity.job-bank-officer": 48 },
    pockets: { NGN: { bank: naira(4200000), cash: naira(60000) } },
    documents: [{ document: "document.passport", monthsLeft: 22, value: null }],
    obligations: [{ obligation: "obligation.upkeep", amount: naira(140000) }],
  },
  "scenario.developer": {
    id: "scenario.developer",
    qualities: {
      // 25 years.
      "quality.age-months": 300,
      "quality.edu-level": 3,
      "quality.edu-grade": 4,
      "quality.english": 62,
      "quality.tech": 58,
      "quality.interview-prep": 0,
      "quality.portfolio": 2,
      "quality.land": 0,
      "quality.network": 30,
      "quality.family-means": 20,
      "quality.family-stake": 0,
      "quality.standing": 50,
      "quality.wellbeing": 60,
      "quality.belly": 60,
      "quality.energy": 70,
      "quality.credit-mark": 0,
      "quality.care": 0,
      "quality.driving": 0,
      // health.md: the hidden health counters start at nothing.
      "quality.run-down-months": 0,
      "quality.illness-course": 0,
      "quality.forced-wait": 0,
    },
    job: "activity.job-junior-developer",
    // person:invite-fills-a-slot: a working value, as scenario.md gives this life no count.
    siblings: 2,
    hometown: "hometown.kaduna",
    tenure: { "activity.job-junior-developer": 18 },
    pockets: { NGN: { bank: naira(900000), cash: naira(40000) } },
    documents: [],
    obligations: [
      { obligation: "obligation.upkeep", amount: naira(130000) },
      { obligation: "obligation.home-support", amount: naira(60000) },
    ],
  },
};

/**
 * The nurse, from route-gates.md's last table: a staff nurse 30 months in, the life
 * the care route is built for.
 *
 * It is joined to the table in index.ts, after the documents the route gates bring.
 */
export const nurseScenario: ScenarioEntry = {
  id: "scenario.nurse",
  qualities: {
    // 27 years.
    "quality.age-months": 324,
    "quality.edu-level": 3,
    // Second upper.
    "quality.edu-grade": 4,
    "quality.english": 58,
    // The page gives no tech, prep, portfolio or land; each starts at 0.
    "quality.tech": 0,
    "quality.interview-prep": 0,
    "quality.portfolio": 0,
    "quality.land": 0,
    "quality.network": 25,
    "quality.family-means": 30,
    "quality.family-stake": 0,
    "quality.standing": 65,
    "quality.wellbeing": 50,
    "quality.belly": 60,
    "quality.energy": 70,
    "quality.credit-mark": 0,
    "quality.care": 60,
    // car.md: the nurse can drive.
    "quality.driving": 1,
    // health.md: the hidden health counters start at nothing.
    "quality.run-down-months": 0,
    "quality.illness-course": 0,
    "quality.forced-wait": 0,
  },
  job: "activity.job-nurse",
  tenure: { "activity.job-nurse": 30 },
    // person:invite-fills-a-slot: a working value, as scenario.md gives this life no count.
    siblings: 2,
    hometown: "hometown.owerri",
  pockets: { NGN: { bank: naira(650000), cash: naira(30000) } },
  documents: [
    { document: "document.passport", monthsLeft: 40, value: null },
    { document: "document.nursing-licence", monthsLeft: 30, value: null },
  ],
  obligations: [
    { obligation: "obligation.upkeep", amount: naira(120000) },
    { obligation: "obligation.home-support", amount: naira(40000) },
  ],
};

/**
 * The teacher, the fifth life: a maths teacher four years
 * in, who codes after marking. Its family is Efik-Ibibio (scenario.md), so the ready lives' families
 * cover the three largest peoples and at least one other (familyPeople in person.names.data.ts).
 *
 * It is joined to the table in index.ts.
 */
export const teacherScenario: ScenarioEntry = {
  id: "scenario.teacher",
  qualities: {
    // 26 years.
    "quality.age-months": 312,
    "quality.edu-level": 3,
    // Second upper.
    "quality.edu-grade": 4,
    "quality.english": 60,
    "quality.tech": 32,
    "quality.interview-prep": 0,
    "quality.portfolio": 0,
    "quality.land": 0,
    "quality.network": 20,
    "quality.family-means": 30,
    "quality.family-stake": 0,
    "quality.standing": 60,
    "quality.wellbeing": 60,
    "quality.belly": 60,
    "quality.energy": 70,
    "quality.credit-mark": 0,
    "quality.care": 0,
    "quality.driving": 0,
    // health.md: the hidden health counters start at nothing.
    "quality.run-down-months": 0,
    "quality.illness-course": 0,
    "quality.forced-wait": 0,
  },
  job: "activity.job-teacher",
  tenure: { "activity.job-teacher": 48 },
  // person:invite-fills-a-slot: the two siblings scenario.md gives.
  siblings: 2,
  hometown: "hometown.uyo",
  pockets: { NGN: { bank: naira(350000), cash: naira(20000) } },
  documents: [],
  obligations: [
    { obligation: "obligation.upkeep", amount: naira(80000) },
    { obligation: "obligation.home-support", amount: naira(25000) },
  ],
};
