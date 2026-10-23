// Every "In content as" row of the rule pages' "Numbers" tables. The page each
// group comes from is named above it.
import type { Tuning } from "@japacity/sim";

import { hometownByHome, hometownCities, hometownTowns } from "../prologue/prologue.hometown.data";
import { aed, cad, naira, pct, pounds } from "../units";

export const tuning: Tuning = {
  // turn.md
  turn: {
    cap: 24,
    start: 24,
    freeSlots: 2,
    freeSlotsNoJob: 3,
    // turn:slots-can-be-locked
    maxLocked: 2,
    // turn:month-lived-in-half-days (decision 0011): a life with no job lives the whole month by hand; a job takes its days and leaves ten.
    halfDays: { noJob: 60, withJob: 20 },
    // offer:day-arrivals-roll-offers: an ask may land as the day is lived, at a third and two thirds of the month's free time.
    arrivalsBp: [3333, 6667],
    // activity:acts-may-repeat-in-month: a weekly thing kept as a commitment is three of it a month.
    repeatPerSlot: 3,
    // quality:body-belly-and-energy (decision 0011): each half-day lived takes a little off the belly and the energy; the month's rest brings
    // each back toward 60; a month that ends hungry or spent takes it out of wellbeing.
    // activity:spent-body-refuses-acts: under `spentBelow` energy, an act that takes effort waits for sleep.
    body: { bellyPerHalfDay: 2, energyPerHalfDay: 1, restTo: 60, restBy: 25, lowBelow: 30, hungryWellbeing: 6, spentWellbeing: 4, spentBelow: 10 },
  },

  // quality.md, and activity.md for the hiring figures.
  quality: {
    // What an empty slot gives: the same figure as activity.rest (turn:free-slots-per-month).
    wellbeingRest: 12,
    wellbeingDriftTo: 60,
    wellbeingDrift: 2,
    burnoutBelow: 25,
    networkHireBp: 20,
    hireMaxBp: pct(95),
    skillSoftAt: 70,
    // Half a gain is kept at or above the soft cap, rounding up (quality:high-skills-gain-slower).
    skillSoftBp: pct(50),
    // activity:side-job-holds-a-slot: a side job halves every skill gain.
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
    // Decision 0014: a day's small work is paid in hand; past a few thousand naira people ask for a transfer.
    cashUpTo: naira(10000),
    // wallet:cash-pile-warning: cash on you past this is cash a one-chance bus can take.
    cashWarnAt: naira(100000),
    // The passbook's stamps: a million, two and a half, five, then the road's own figure.
    stamps: [naira(1000000), naira(2500000), naira(5000000)],
  },

  // rate.md
  rate: {
    // Kobo for one pound (₦1,758.00) and one dollar (₦1,331.50); the Canadian dollar and the
    // euro from the cross rates of 7 Oct 2026; the dirham on the dollar's peg (abroad-money:foreign-currencies-join-wallet).
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
    flight: { currency: "NGN", amount: naira(1100000) },
    hintPrep: 40,
  },

  // offer.md
  offer: {
    maxNewPerMonth: 2,
    maxOpen: 4,
  },

  // place.md
  place: { brokeLine: naira(500000), fareFromNaira: true },
  // streets.md: the hidden places' life (streets:buy-phone-at-computer-village, streets:phone-sales-job, streets:apprentice-learns-repair, streets:sleeping-under-the-bridge, streets:street-shopping-abroad, streets:street-finds-abroad, streets:peckham-talks-like-lagos and streets:stadium-morning-run).
  street: { phonePrice: naira(45000), phoneMood: 6, phoneNetwork: 3, salesPay: naira(70000), salesHireBp: 6000, apprenticeTech: 4, apprenticeUntil: 60, theftBp: 2000, theftNaira: naira(5000), mosquitoBp: 3500, harassBp: 3000, harassMood: 8, shoppingGbp: 2000, shoppingAed: 8000, shoppingMood: 5, findBp: 1500, findMood: 4, runMood: 8 },
  // Things shipped home and collected at the cargo office on Bode Thomas Street (offer.parcel.data.ts).
  // The handling is the clerk's charge; a laptop lifts the mood, clothes stand you up a little at an interview.
  parcel: { handling: naira(1500), laptopMood: 8, clothesPrep: 10 },
  // status:course-passed-or-withdrawn: months a student status must be held for the course to count as passed.
  // status:overstayer-hospital-charged: the hospital at 150% of its figure past the grace in the UK. person:partner-route-in-country: the
  // ten-year partner route for a status granted in country past the grace. abroad-money:right-to-rent-check: the wellbeing a room lost to the check costs.
  status: { courseMonths: 12, hospitalChargeBp: 15000, overstayPartnerSettleMonths: 120, rentCheckWellbeing: -6 },

  // credit.md
  // credit:clean-mark-drifts-up: a clean year before the file drifts.
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
  // road:pitch-rises-with-pressure: the pressure lines; the figures each adds are on the pitch entries.
  road: { enabled: true, meansStep: naira(100000), pressureStandingUnder: 30, pressureAgeOver: 30, pressureStrongRoute: 60 },

  // ladders.md
  ladder: { cashDetectBp: 100, accountRent: pounds(60), overtimeBp: pct(25), oneChanceBp: 300, phone: naira(60000), robberyWellbeing: -12 },

  // prologue.md
  prologue: {
    startAgeMonths: 192,
    siblings: [1, 2],
    familyMeans: [10, 80],
    cityBp: pct(55),
    // prologue:family-draw-on-first-answer and prologue:steps-offer-legal-answers.
    parentsEducatedBp: 2000,
    parentsEducatedPerPoint: 60,
    network: { city: 15, town: 5, educated: 10 },
    standing: 50,
    waecStrain: { under: 30, standing: -2 },
    grade: { base: 2, upBp: 4000, downBp: 2000, min: 2, max: 5 },
    privateSession: naira(2500000),
    // home:starting-charges-from-one-function: what a life from sixteen sends home each month once abroad, before the remit share; the fixed lives send ₦25,000 to ₦60,000.
    homeSupport: naira(40000),
    // prologue:family-draw-on-first-answer: where the family drawn is from, read from the draw, never drawn on its own.
    hometowns: { city: hometownCities, town: hometownTowns, byHome: hometownByHome },
  },

  // luck.md. The jackpot, 1 in 100,000, is under one basis point, so its figure is draws out of a
  // million; the mid prize, 1 in 2,000, and the small one are basis points.
  // advice.md: the four ways and the agents. Fees in kobo; a kind's fee is drawn from its range, and the ranges overlap so the fee never tells the kind.
  // advice:chaser-runs-around-cheaper: the chaser's share comes out of the fixer's; he is slower (one month to the fixer's two) and cheaper.
  advice: { networkToAsk: 40, adviserFee: naira(80000), agentKindsBp: { fixer: 3000, chaser: 2000, overpromiser: 3000, scammer: 2000 }, fees: { fixer: [naira(10000), naira(30000)], overpromiser: [naira(8000), naira(25000)], scammer: [naira(8000), naira(30000)] }, chaserFee: [naira(8000), naira(25000)], fixerMonths: 2, chaserMonths: 1, fakePapersFee: naira(20000), scamTells: 2, overpromiseTells: 1, floorNaira: naira(2000) },
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

  // chapter:send-off-card-on-close: the send-off card names the three lines played most.
  // chapter:family-marks-the-grant: what the send-off party at the house costs.
  chapter: { cardLines: 3, sendOffNaira: naira(150000) },

  // obligation.md, the group loan
  groupLoan: { feeBp: 1500, savingsBp: 1000, vanishBp: pct(25), visit: { standing: -12, wellbeing: -5 } },
  // obligation:cooking-and-fetching-water: cooking takes 15% off the upkeep's next charge and fetching water 4%, starting figures.
  // activity:waiting-months-build-profile: being noticed raises the job's pay 10%, once, on a 30% draw.
  activity: { raiseBp: pct(10), raiseChanceBp: pct(30) },
  room: { cookedBp: pct(15), waterBp: pct(4) },

  // lottery.md Numbers, the Friday draw at fixed odds: 1 in 10 wins ₦500, 1 in 2,000 wins ₦50,000, 1 in 5,000 the jackpot from ₦200,000, growing by 10% of the sales of a week nobody hits it.
  // The jackpot cap of ₦380,000 keeps a ticket's return under its price (lottery:expected-return-below-price): about ₦151 at the cap.
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
  city: { crowdLow: 8, crowdHigh: 16, fridayBp: 4000, saturdayBp: 5000, raiseAfterMs: 10000, raiseFrameMs: 20, dropAfterMs: 5000, dropFrameMs: 40, maxPixelRatio: 2, desktopMinWidth: 1024, walkMmPerS: 1400, stopShortMm: 300,
    // world.md: nothing roams and there is no fly-over (world:nothing-roams, world:map-is-painted-lagos); the rides' fares in kobo and pace, and how far a walk goes (world:ride-sheet-shows-fares, place:rides-between-city-places: beyond it a fare is the only way).
    roam: false, flyover: false,
    ride: { fareKobo: { danfo: 20000, keke: 30000, okada: 50000, walk: 0 }, farePerKmKobo: { danfo: 5000, keke: 10000, okada: 15000, walk: 0 }, metresPerMinute: { danfo: 250, keke: 300, okada: 450, walk: 80 }, waitMinutes: 6, scarcityBp: 20000, walkMetres: 2000,
      // place:rides-between-city-places: the metres a thousandth of a degree of longitude is worth, 111 times the cosine
      // of the latitude, rounded: Lagos 111 here, and each country's below; latitude is 111 everywhere.
      lonMetresPerE3: 111,
      // place:rides-between-city-places and place:country-pass-covers-ways (decision 0017, design page 10 section 5): each
      // country's ways in its smallest unit, the step a fare is rounded up to, the month's pass and the ways it covers
      // (place:country-pass-covers-ways, decision 0017), and the pace on foot. London's are 2025 fares, rounded: the hopper bus
      // fare, an off-peak train single by distance, a monthly bus and tram pass. Calgary, Dubai and Castel Volturno's are
      // design page 11 section 4's 2025 figures, rounded: Calgary's one flat fare on the bus and the CTrain and the month's
      // transit pass on both; Dubai's zone fare read as distance on the bus and the metro, the Nol zone pass on both, and a
      // slower walk in the heat; the coast road's bus at one flat fare, and no train, taxi or pass in Castel Volturno.
      abroad: {
        "country.uk": { ways: { bus: { fare: 175, farePerKm: 0, metresPerMinute: 250 }, train: { fare: 280, farePerKm: 10, metresPerMinute: 600 } }, step: 5, pass: pounds(95), passWays: ["bus"], lonMetresPerE3: 69, walkMetresPerMinute: 80 },
        "country.canada": {
          ways: { bus: { fare: 380, farePerKm: 0, metresPerMinute: 300 }, train: { fare: 380, farePerKm: 0, metresPerMinute: 700 }, taxi: { fare: 380, farePerKm: 200, metresPerMinute: 600 } },
          step: 5,
          pass: cad(118),
          passWays: ["bus", "train"],
          lonMetresPerE3: 71,
          walkMetresPerMinute: 80,
        },
        "country.uae": {
          ways: { bus: { fare: 400, farePerKm: 50, metresPerMinute: 250 }, train: { fare: 400, farePerKm: 50, metresPerMinute: 700 }, taxi: { fare: 1200, farePerKm: 200, metresPerMinute: 600 } },
          step: 25,
          pass: aed(140),
          passWays: ["bus", "train"],
          lonMetresPerE3: 100,
          walkMetresPerMinute: 60,
        },
        "country.italy": { ways: { bus: { fare: 160, farePerKm: 0, metresPerMinute: 200 } }, step: 5, pass: null, passWays: [], lonMetresPerE3: 84, walkMetresPerMinute: 80 },
      } } },

  // person.md, pair.md, interview.md, undertaking.md: their Numbers tables
  people: { matchmaker: false, maxCourting: 3, partnerMoments: 6, marryAfterMonths: 6, weddingShare: naira(3000000), proposeCooldown: 3, recourtMonths: 6, gossipBp: 2500, weddingStanding: 8, gossipStanding: -3, endStanding: { courting: -2, partner: -6, married: -12, applying: -6 }, endWellbeing: -4, leftWellbeing: -8, couchMonths: 3, warnDays: 7, standInDays: 14, computerAfterMonths: 0 },
  pair: { inviteDays: 14, maxOpenInvites: 3, rewardFriends: 10, phrasesPerHour: 30, placePhrasesPerMinute: 6 },
  interview: { ask: 5, decoys: 3, passBp: 7000, failBp: 4000, caughtBelowBp: 2000, thinMoments: 8, thinMonths: 6, doubtBp: 3000, standInRecallBp: 8000, caughtStanding: 15 },
  undertaking: { months: 36, assistanceUnder: 100000 },
  // home.md Numbers: a room on the lagoon in Makoko, and the months it is cleared; a room in a compound, its year's
  // rent paid upfront with the agent's and the agreement's fees (home:compound-room-is-a-home); the self-contain the door shows as a goal.
  // The compound's rent, its upkeep and the self-contain's rent are working figures.
  home: {
    makokoUpkeep: naira(25000),
    evictionBp: pct(5),
    evictionLossNaira: naira(20000),
    guestMonths: 3,
    hostBp: pct(25),
    returnStanding: -5,
    compound: { rentYear: naira(350000), feesBp: pct(20), upkeep: naira(50000) },
    selfContainRentYear: naira(700000),
    // A hostel room of your own, rented by the month (decision 0018): about half the room in a compound's month of
    // rent (350,000 naira a year, about 29,200 a month); a working figure.
    hostelRentKobo: naira(15000),
    // home:living-by-hand (decision 0013): at home the whole of living is lived by hand, meals, water, fares and data as acts; nothing of it is charged as the month turns.
    livingByHandBp: pct(100),
  },
  // The market: the car's fuel as its fare, by distance as the rides are (place:rides-between-city-places): 300 naira to
  // start and park, 100 a kilometre (petrol at about 1,000 naira a litre, a used car at about 10 km a litre), so a
  // drive is dearer than the danfo and cheaper than the okada or a ride app; at the pace of the city's traffic.
  thing: { drive: { fareKobo: naira(300), farePerKmKobo: naira(100), metresPerMinute: 400 } },
};
