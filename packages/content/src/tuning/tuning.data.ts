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
    // activity.md R-ACTIVITY-010: a side job halves every skill gain.
    sideJobSkillBp: pct(50),
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
    // Kobo for one pound (₦1,758.00) and one dollar (₦1,331.50); the Canadian dollar and the
    // euro from the cross rates of 7 Oct 2026; the dirham on the dollar's peg (abroad-money.md R-ABROAD-001).
    start: { GBP: 175800, USD: 133150, CAD: 97000, AED: 36255, EUR: 155800 },
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
  // streets.md: the hidden places' life (R-STREET-001 to 008).
  street: { phonePrice: naira(45000), phoneMood: 6, phoneNetwork: 3, salesPay: naira(70000), salesHireBp: 6000, apprenticeTech: 4, apprenticeUntil: 60, theftBp: 2000, theftNaira: naira(5000), mosquitoBp: 3500, harassBp: 3000, harassMood: 8, shoppingGbp: 2000, shoppingAed: 8000, shoppingMood: 5, findBp: 1500, findMood: 4, runMood: 8 },
  // status.md R-STATUS-011: months a student status must be held for the course to count as passed.
  status: { courseMonths: 12 },

  // credit.md
  // credit.md R-CREDIT-003: a clean year before the file drifts.
  credit: { onTime: 3, onMiss: 12, onDefault: 30, drift: 1, driftTo: 40, judgmentMonths: 72, judgmentCap: 20, returnPenalty: 20, cleanMonths: 12 },

  // car.md
  car: { lessons: pounds(2200), testFee: 6200, passBp: pct(55), passPerAttemptBp: pct(5), passCapBp: pct(90) },

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
  // road.md R-ROAD-002: the pressure lines; the figures each adds are on the pitch entries.
  road: { enabled: true, meansStep: naira(100000), pressureStandingUnder: 30, pressureAgeOver: 30, pressureStrongRoute: 60 },

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
    privateSession: naira(2500000),
  },

  // luck.md. The jackpot, 1 in 100,000, is under one basis point, so its figure is draws out of a
  // million; the mid prize, 1 in 2,000, and the small one are basis points.
  // advice.md: the four ways and the agents (R-ADVICE-003 to 013). Fees in kobo; a kind's fee is drawn from its range, and the ranges overlap so the fee never tells the kind.
  // R-ADVICE-013: the chaser's share comes out of the fixer's; he is slower (one month to the fixer's two) and cheaper.
  advice: { warnings: false, networkToAsk: 40, adviserFee: naira(80000), agentKindsBp: { fixer: 3000, chaser: 2000, overpromiser: 3000, scammer: 2000 }, fees: { fixer: [naira(10000), naira(30000)], overpromiser: [naira(8000), naira(25000)], scammer: [naira(8000), naira(35000)] }, chaserFee: [naira(5000), naira(12000)], fixerMonths: 2, chaserMonths: 1, fakePapersFee: naira(20000), scamTells: 2, overpromiseTells: 1, floorNaira: naira(2000), warnMonths: 6 },
  luck: {
    downUnder: 30,
    rescueAfterMonths: 12,
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
    jackpotPerMillion: 10,
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

  // chapter.md R-CHAPTER-006: the send-off card names the three lines played most.
  // R-CHAPTER-008: what the send-off party at the house costs.
  chapter: { cardLines: 3, sendOffNaira: naira(150000) },

  // obligation.md, the group loan
  groupLoan: { feeBp: 1500, savingsBp: 1000, vanishBp: pct(25), visit: { standing: -12, wellbeing: -5 } },
  // obligation.md R-OBLIGATION-014: cooking takes 15% off the upkeep's next charge and fetching water 4%, the maintainer's
  // starting figures. the page gives no figure for the weekend cooking takes; 2 wellbeing, as a month of study costs.
  room: { cookedBp: pct(15), waterBp: pct(4), cookWellbeing: 2 },

  // lottery.md Numbers, the Friday draw at fixed odds: 1 in 10 wins ₦500, 1 in 2,000 wins ₦50,000, 1 in 5,000 the jackpot from ₦200,000, growing by 10% of the sales of a week nobody hits it.
  // the page's cap of ₦2,000,000 returns ₦475 on a ₦200 ticket and fails R-LOTTERY-022; ₦380,000 gives the page's own "about ₦151 at the cap".
  lottery: {
    ticket: naira(200),
    maxTickets: 5,
    odds: {
      smallPerMillion: 100000,
      small: naira(500),
      midPerMillion: 500,
      mid: naira(50000),
      jackpotPerMillion: 200,
      jackpotStart: naira(200000),
      jackpotGrowthBp: 1000,
      jackpotCap: naira(380000),
      forcedWinWeeks: null,
    },
  },
  advert: { maxSlotsPerPlace: 2, maxPhoneTiles: 1, impressionMs: 1000 },
  share: { width: 1080, height: 1920, maxBytes: 153600, previewWidth: 1200, previewHeight: 630, previewMaxBytes: 300000 },
  guide: { staleMonths: 6 },
  // analytics.md Numbers; 16 KB is 16384 bytes
  analytics: { batchSeconds: 60, maxBatchBytes: 16384, maxCount: 500, batchesPerHour: 90, minShown: 10, refD1Bp: 3000, refD7Bp: 900 },

  // city.md "Numbers": the crowd bands and the graphics switches. Working values.
  city: { crowdLow: 8, crowdHigh: 16, playersMax: 4, fridayBp: 4000, saturdayBp: 5000, raiseAfterMs: 10000, raiseFrameMs: 20, dropAfterMs: 5000, dropFrameMs: 33, maxPixelRatio: 2, desktopMinWidth: 1024, idleAfterMs: 20000, idleFps: 10, walkMmPerS: 1400, stopShortMm: 300, tagNearMm: 3000, residentFloor: 4,
    // world.md: nothing roams and the fly-over is retired (R-WORLD-010, 015); the crowd and sheet caps (R-WORLD-011); the rides' fares in kobo and pace (R-WORLD-017).
    roam: false, flyover: false, indoorLow: 4, indoorHigh: 6, outdoorLow: 6, outdoorHigh: 10, motionSheets: 1,
    ride: { fareKobo: { danfo: 30000, keke: 60000, okada: 90000, walk: 0 }, metresPerMinute: { danfo: 250, keke: 300, okada: 450, walk: 80 }, waitMinutes: 6, scarcityBp: 20000 } },

  // people.md, pair.md, interview.md, undertaking.md: their Numbers tables
  people: { matchmaker: false, maxCourting: 3, partnerMoments: 6, marryAfterMonths: 6, weddingShare: naira(3000000), proposeCooldown: 3, recourtMonths: 6, gossipBp: 2500, weddingStanding: 8, gossipStanding: -3, endStanding: { courting: -2, partner: -6, married: -12, applying: -6 }, endWellbeing: -4, leftWellbeing: -8, couchMonths: 3, warnDays: 7, standInDays: 14, computerAfterMonths: 0 },
  pair: { inviteDays: 14, maxOpenInvites: 3, rewardFriends: 10, phrasesPerHour: 30, placePhrasesPerMinute: 6 },
  interview: { ask: 5, decoys: 3, passBp: 7000, failBp: 4000, caughtBelowBp: 2000, thinMoments: 8, thinMonths: 6, doubtBp: 3000, standInRecallBp: 8000, caughtStanding: 15 },
  undertaking: { months: 36, assistanceUnder: 100000 },
};
