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
    // R-TURN-009
    maxLocked: 2,
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
    // Half a gain is kept at or above the soft cap, rounding up (R-QUALITY-005).
    skillSoftBp: pct(50),
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
    // Half a band: bands are held as the band times ten.
    bandStep: 5,
  },

  // route.md
  route: {
    offerPerGradeBp: pct(5),
    offerMaxBp: pct(95),
    // Second upper.
    goodGrade: 4,
    fundsReasonBp: pct(30),
    reapplyMonths: 6,
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
  // status.md R-STATUS-011: months a student status must be held for the course to count as passed.
  status: { courseMonths: 12 },

  // credit.md
  credit: { onTime: 3, onMiss: 12, onDefault: 30, drift: 1, driftTo: 40, judgmentMonths: 72, judgmentCap: 20, returnPenalty: 20 },

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
  road: { enabled: true, meansStep: naira(100000) },

  // ladders.md
  ladder: { cashDetectBp: 200, accountRent: pounds(60), overtimeBp: pct(25), oneChanceBp: 300, phone: naira(60000), robberyWellbeing: -12 },

  // prologue.md
  prologue: {
    startAgeMonths: 192,
    siblings: [1, 6],
    familyMeans: [10, 80],
    cityBp: pct(55),
    // prologue.md R-PROLOGUE-002 and 003.
    parentsEducatedBp: 2000,
    parentsEducatedPerPoint: 60,
    network: { city: 15, town: 5, educated: 10 },
    standing: 50,
    waecStrain: { under: 30, standing: -2 },
    grade: { base: 2, upBp: 4000, downBp: 2000, min: 2, max: 5 },
  },

  // luck.md. The jackpot is 1 in 100,000 and the mid prize 1 in 2,000: both under one basis point,
  // so they are written as draws out of a million in the kind; here the figures are per million.
  luck: {
    rescue: naira(250000),
    rescueUnder: naira(100000),
    rescueRatio: 30000,
    drySpellMonths: 8,
    drySpellBp: 100,
    drySpellCapBp: 800,
    betWellbeing: 2,
    ticket: naira(200),
    maxTickets: 5,
    prizeSmall: naira(500),
    prizeSmallBp: 1000,
    prizeMid: naira(50000),
    prizeMidBp: 5,
    prizeJackpot: naira(2000000),
    prizeJackpotBp: 1,
    stake: naira(2000),
    betOddsBp: 19000,
    betWinBp: pct(45),
    promo: naira(50000),
  },

  // health.md
  health: {
    runDownBelow: 30,
    illnessBp: pct(25),
    hospital: naira(85000),
    chemist: naira(9000),
    hospitalWorse: naira(180000),
    relapseChemistBp: pct(35),
    relapseIgnoreBp: pct(60),
    sickPayBp: pct(50),
    gapMonths: 10,
  },

  // obligation.md, the group loan
  groupLoan: { feeBp: 1500, savingsBp: 1000, vanishBp: pct(25), visit: { standing: -12, wellbeing: -5 } },

  // lottery.md, the Friday draw: ticket, cap, 45% of sales destroyed, tiers 40/30/30, ten mid prizes, one small prize in 50 tickets
  lottery: { ticket: naira(200), maxTickets: 5, burnBp: 4500, jackpotBp: 4000, midBp: 3000, midCount: 10, smallBp: 3000, smallEvery: 50 },

  // city.md "Numbers": the crowd bands and the graphics switches. Working values.
  city: { crowdLow: 8, crowdHigh: 16, playersMax: 4, fridayBp: 4000, saturdayBp: 5000, raiseAfterMs: 10000, raiseFrameMs: 20, dropAfterMs: 5000, dropFrameMs: 33, maxPixelRatio: 2, desktopMinWidth: 1024 },
};
