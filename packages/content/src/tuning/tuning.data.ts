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
    // Kobo for one pound (₦1,758.00) and one dollar (₦1,331.50).
    start: { GBP: 175800, USD: 133150 },
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
};
