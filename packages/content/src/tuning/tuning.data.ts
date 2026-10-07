// Every "In content as" row of the rule pages' "Numbers" tables. The page each
// group comes from is named above it.
import type { Tuning } from "@japacity/sim";

import { naira, pct, pounds } from "../units";

export const tuning: Tuning = {
  // turn.md
  turn: {
    cap: 24,
    start: 24,
    freeSlots: 2,
    freeSlotsNoJob: 3,
  },

  // quality.md, and activity.md for the hiring figures.
  quality: {
    // What an empty slot gives: the same figure as activity.rest (R-TURN-006).
    wellbeingRest: 12,
    wellbeingDriftTo: 60,
    wellbeingDrift: 2,
    burnoutBelow: 25,
    networkHireBp: 20,
    hireMaxBp: pct(95),
    skillSoftAt: 70,
  },

  // wallet.md
  wallet: {
    // 1.5%
    bankChargeBp: 150,
    streetSpreadBp: pct(2),
    // 1.5%
    streetShortBp: 150,
    streetShortLossBp: [pct(3), pct(8)],
    lotMonths: 3,
    flagDepositAbove: naira(500000),
  },

  // rate.md
  rate: {
    // Kobo for one pound (₦1,758.00) and one dollar (₦1,331.50); the Canadian dollar, dirham and
    // euro from the cross rates of 7 Oct 2026 (docs/rules/abroad-money.md).
    start: { GBP: 175800, USD: 133150, CAD: 97000, AED: 36250, EUR: 155800 },
    // 0.4%
    driftBp: 40,
    // 1.2%
    noiseBp: 120,
    premiumFloorBp: pct(2),
    // 0.72%
    premiumPerSupplyBp: 72,
    // 0.5%
    premiumNoiseBp: 50,
    floatPremiumBp: pct(3),
  },

  // document.md. Bands are held as the band times ten.
  english: {
    base: 40,
    perHundred: 35,
    noiseSteps: 1,
    min: 40,
    max: 90,
  },

  // route.md
  route: {
    refusalBaseBp: pct(9),
    // 0.1%
    refusalPerStrictnessBp: 10,
    // 0.4%
    refusalPerUnexplainedBp: 40,
    refusalPerRefusalBp: pct(8),
    // 1.5%, taken off for each interview point.
    refusalPerInterviewPointBp: 150,
    refusalGoodGradeBp: pct(2),
    refusalMinBp: pct(3),
    refusalMaxBp: pct(80),
    depositAdminFee: pounds(500),
    depositRefundMonths: 2,
    decisionMonths: 1,
    flight: { currency: "NGN", amount: naira(1600000) },
    hintPrep: 40,
  },

  // offer.md
  offer: {
    maxNewPerMonth: 2,
    maxOpen: 4,
  },

  // place.md
  place: { brokeLine: naira(500000), fareFromNaira: true },

  // credit.md
  credit: { onTime: 3, onMiss: 12, onDefault: 30, drift: 1, driftTo: 40, judgmentMonths: 72, returnPenalty: 20 },

  // car.md
  car: { lessons: pounds(2200), testFee: 8500, passBp: pct(55), passPerAttemptBp: pct(5), passCapBp: pct(90) },

  // abroad-money.md
  remit: { appFeeBp: 0, appMarginBp: pct(2), bankFeeBp: pct(8), informalLossBp: pct(5), abroadBp: 30000 },

  // return.md
  return: {
    standing: { "with-papers": 10, "by-choice": 0, broke: -8, assisted: -12, removed: -20 },
    capitalPer: naira(1000000),
    capitalCap: 10,
    offerMonths: 12,
    residentLapseMonths: 24,
  },

  // director.md
  director: { surgePerTick: 3, closedTicks: 8, maxNewPerTick: 2, shockGapTicks: 6, onlineTickScale: 2 },

  // road.md
  road: { enabled: true },

  // ladders.md
  ladder: { cashDetectBp: 200, accountRent: pounds(60), overtimeBp: pct(25) },

  // prologue.md
  prologue: { startAgeMonths: 192, siblings: [1, 6], familyMeans: [10, 80], cityBp: pct(55) },
};
