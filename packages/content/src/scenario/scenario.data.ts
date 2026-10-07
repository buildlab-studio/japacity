// From docs/rules/scenario.md, "The three lives". Grades and levels are
// numbered as in docs/rules/quality.md: a bachelor's is 3, a second upper 4,
// a second lower 3.
import type { Id, ScenarioEntry } from "@japacity/sim";

import { naira } from "../units";

export const scenarioTable: Record<Id<"scenario">, ScenarioEntry> = {
  "scenario.ada": {
    id: "scenario.ada",
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
      "quality.credit-mark": 0,
    },
    job: null,
    tenure: {},
    pockets: { NGN: { bank: naira(180000), cash: naira(25000) } },
    documents: [],
    obligations: [{ obligation: "obligation.upkeep", amount: naira(95000) }],
  },
  "scenario.tunde": {
    id: "scenario.tunde",
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
      "quality.credit-mark": 0,
    },
    job: "activity.job-bank-officer",
    tenure: { "activity.job-bank-officer": 48 },
    pockets: { NGN: { bank: naira(4200000), cash: naira(60000) } },
    documents: [{ document: "document.passport", monthsLeft: 22, value: null }],
    obligations: [{ obligation: "obligation.upkeep", amount: naira(140000) }],
  },
  "scenario.zainab": {
    id: "scenario.zainab",
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
      "quality.credit-mark": 0,
    },
    job: "activity.job-junior-dev",
    tenure: { "activity.job-junior-dev": 18 },
    pockets: { NGN: { bank: naira(900000), cash: naira(40000) } },
    documents: [],
    obligations: [
      { obligation: "obligation.upkeep", amount: naira(130000) },
      { obligation: "obligation.home-support", amount: naira(60000) },
    ],
  },
};
