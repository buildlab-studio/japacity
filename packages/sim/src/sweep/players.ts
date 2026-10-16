// Simulated players for the test sweep (layer 5 of
// docs/design/02-quality-and-testing.md). A strategy reads only the view and
// the public content and ranks the commands it would like to send; the runner
// sends them in that order and keeps the first one the authority accepts, so a
// strategy never needs to know a hidden figure to stay legal.
import { mulDiv, mulDivCeil } from "../engine/int";
import { step } from "../engine/step";
import { refusalChanceBp } from "../route/route.logic";
import type { BaseEvent, Content, Currency, ForeignCurrency, Id, OfferView, PlayerView, SlotPick, State } from "../engine/types";
import { legalCommands } from "../testing/legal";
import type { Game, Loose } from "../testing/play";
import { start } from "../testing/play";

export const UK: Id<"route"> = "route.uk-masters";
const NORTHGATE: Id<"school"> = "school.northgate";
const GULF: Id<"route"> = "route.gulf-contract";
const ROAD: Id<"route"> = "route.road";

/** Naira, bank and cash together, under which offer.md calls a character broke. */
export const BROKE_BELOW = 15000000;

/** Pence of pounds a careful player buys ahead for the deposit and the visa fees. */
const POUND_TARGET = 600000;

const SAFE_CASH_MOVE = 50000000;

export type StrategyName = "careful" | "borrower" | "risky" | "honest-home" | "spender" | "canada" | "road";

export const STRATEGY_NAMES: StrategyName[] = ["careful", "borrower", "risky", "honest-home"];

/** Ranks the commands a player would like to send now, best first. */
export type Strategy = (view: PlayerView, content: Content) => Loose[];

interface Habits {
  /** English practice before sitting the test. */
  englishBeforeTest: number;
  /** Interview prep before applying for the visa. */
  prep: number;
  /** Most unexplained share, in basis points, at which the visa is sent. */
  unexplainedMax: number;
  takesLoans: boolean;
  takesAgent: boolean;
  /** Takes the bank's held funds as soon as offered, at the most it allows. */
  heldAtOnce: boolean;
  paysFamily: boolean;
  buysPounds: boolean;
  /** Months of what is due kept back before spending on anything optional. */
  bufferMonths: number;
  /** Pursues any route at all. */
  leaves: boolean;
  /** Whether the study route is a plan at all; false for a player working another route from the start. */
  studies: boolean;
  /** Leaves the study route for another formal route that can settle, once one is in reach. */
  prefersSettling: boolean;
  /** Formal routes beyond the study route that this player works toward. */
  otherRoutes: Id<"route">[];
  /** Takes the road's pitch when it comes. */
  takesRoad: boolean;
  /** Takes the Gulf agent's contract. */
  takesGulf: boolean;
  takesGroupLoan: boolean;
  /** Renews a status that can be renewed when it nears its end. */
  renews: boolean;
  /** Share of the money abroad over the buffer sent home each month. */
  remitShareBp: number;
  channel: "app" | "bank" | "informal";
  /** Comes home by choice once no lawful status is held. */
  homeWhenUnlawful: boolean;
  /** Keeps nothing abroad but the fare home: every month's money over it is sent home. */
  keepsFareOnly: boolean;
  buysCar: boolean;
  phoneContract: boolean;
  rentsFlat: boolean;
  /** Answers in the December scene, best first. */
  december: string[];
  /** Answers on the road, best first. */
  road: string[];
  /** Which allowed prologue answer is picked. */
  prologue: "first" | "last";
}

const CAREFUL_DECEMBER = ["stay", "none", "home", "plain", "small", "some"];
const SPENDING_DECEMBER = ["go", "big", "all", "outfit", "small", "some"];
const LEAVE_ROAD = ["turn-back", "exit"];
const STAY_ON_ROAD = ["go", "pay", "call-home"];

const FORMAL: Id<"route">[] = ["route.uk-care", "route.uk-skilled", "route.uk-talent", "route.canada-points"];

const PLAYED = {
  careful: {
    englishBeforeTest: 72,
    prep: 40,
    unexplainedMax: 2000,
    takesLoans: false,
    takesAgent: false,
    heldAtOnce: false,
    paysFamily: true,
    buysPounds: true,
    bufferMonths: 2,
    leaves: true,
    studies: true,
    prefersSettling: true,
    otherRoutes: FORMAL,
    takesRoad: false,
    takesGulf: false,
    takesGroupLoan: false,
    renews: true,
    remitShareBp: 2500,
    channel: "app",
    homeWhenUnlawful: true,
    keepsFareOnly: false,
    buysCar: false,
    phoneContract: true,
    rentsFlat: true,
    december: CAREFUL_DECEMBER,
    road: LEAVE_ROAD,
    prologue: "first",
  },
  borrower: {
    englishBeforeTest: 66,
    prep: 20,
    unexplainedMax: 10000,
    takesLoans: true,
    takesAgent: true,
    heldAtOnce: true,
    paysFamily: true,
    buysPounds: false,
    bufferMonths: 1,
    leaves: true,
    studies: true,
    prefersSettling: false,
    otherRoutes: [...FORMAL, GULF],
    takesRoad: false,
    takesGulf: true,
    takesGroupLoan: true,
    renews: true,
    remitShareBp: 5000,
    channel: "bank",
    homeWhenUnlawful: true,
    keepsFareOnly: false,
    buysCar: true,
    phoneContract: true,
    rentsFlat: true,
    december: SPENDING_DECEMBER,
    road: LEAVE_ROAD,
    prologue: "first",
  },
  risky: {
    englishBeforeTest: 58,
    prep: 0,
    unexplainedMax: 10000,
    takesLoans: false,
    takesAgent: true,
    heldAtOnce: false,
    paysFamily: false,
    buysPounds: false,
    bufferMonths: 1,
    leaves: true,
    studies: true,
    prefersSettling: false,
    otherRoutes: [GULF],
    takesRoad: true,
    takesGulf: true,
    takesGroupLoan: false,
    renews: false,
    remitShareBp: 10000,
    channel: "informal",
    homeWhenUnlawful: false,
    keepsFareOnly: false,
    buysCar: false,
    phoneContract: false,
    rentsFlat: false,
    december: SPENDING_DECEMBER,
    road: STAY_ON_ROAD,
    prologue: "last",
  },
  "honest-home": {
    englishBeforeTest: 100,
    prep: 0,
    unexplainedMax: 0,
    takesLoans: false,
    takesAgent: false,
    heldAtOnce: false,
    paysFamily: true,
    buysPounds: false,
    bufferMonths: 2,
    leaves: false,
    studies: true,
    prefersSettling: false,
    otherRoutes: [],
    takesRoad: false,
    takesGulf: false,
    takesGroupLoan: false,
    renews: false,
    remitShareBp: 0,
    channel: "app",
    homeWhenUnlawful: true,
    keepsFareOnly: false,
    buysCar: false,
    phoneContract: false,
    rentsFlat: false,
    december: CAREFUL_DECEMBER,
    road: LEAVE_ROAD,
    prologue: "first",
  },
  // The broke return (R-PLACE-005) needs the fare paid and little else left anywhere. The first fix batch made the
  // first months abroad survivable, so the borrowers come home with a buffer; this player keeps none abroad.
  spender: {
    englishBeforeTest: 66,
    prep: 20,
    unexplainedMax: 10000,
    takesLoans: true,
    takesAgent: true,
    heldAtOnce: true,
    paysFamily: true,
    buysPounds: false,
    bufferMonths: 0,
    leaves: true,
    studies: true,
    prefersSettling: false,
    otherRoutes: [...FORMAL, GULF],
    takesRoad: false,
    takesGulf: true,
    takesGroupLoan: true,
    renews: false,
    remitShareBp: 10000,
    channel: "app",
    homeWhenUnlawful: true,
    keepsFareOnly: true,
    buysCar: false,
    phoneContract: true,
    rentsFlat: true,
    december: SPENDING_DECEMBER,
    road: LEAVE_ROAD,
    prologue: "first",
  },
} satisfies Record<Exclude<StrategyName, "canada" | "road">, Habits>;

/**
 * The two recorded lives for the countries beyond the UK (tools/record-lives.ts, design page 15 section 7) play the careful
 * habits with Canada as the one settling route and no study plan, and the risky habits with the road as the one way out; neither is among
 * the sweeps' strategies (STRATEGY_NAMES), so the sweeps' figures stand.
 */
const HABITS: Record<StrategyName, Habits> = {
  ...PLAYED,
  canada: { ...PLAYED.careful, studies: false, otherRoutes: ["route.canada-points"] },
  road: { ...PLAYED.risky, studies: false, otherRoutes: [], takesGulf: false },
};

// ---------------------------------------------------------------------------
// Reading the view
// ---------------------------------------------------------------------------

function quality(view: PlayerView, id: string): number {
  return view.qualities.find((item) => item.id === id)?.value ?? 0;
}

function naira(view: PlayerView): number {
  return view.pockets.NGN.bank + view.pockets.NGN.cash;
}

/** What falls due each month in one currency. */
function monthlyDueIn(view: PlayerView, content: Content, currency: Currency): number {
  return view.obligations.reduce((sum, item) => sum + (content.obligation[item.entry]?.currency === currency ? item.due : 0), 0);
}

/** What falls due each month, in naira. */
function monthlyDue(view: PlayerView): number {
  return view.obligations.reduce((sum, item) => sum + item.due, 0);
}

function buffer(view: PlayerView, habits: Habits): number {
  return monthlyDue(view) * habits.bufferMonths;
}

function option(view: PlayerView, id: string) {
  return view.activities.find((item) => item.id === id);
}

/** R-ACTIVITY-015: a now-act is sent at once and fills no slot of the month. */
function takesMonth(view: PlayerView, id: string): boolean {
  return option(view, id)?.when !== "now";
}

/**
 * The room this player gives the month's picks: its free slots, less the now-acts already done this month. A now-act
 * fills no slot (R-ACTIVITY-015), but this player still spends the month's time on as many things as before.
 */
function monthRoom(view: PlayerView): number {
  return Math.max(0, view.freeSlots - view.activities.filter((item) => item.when === "now" && item.done).length);
}

/**
 * The month as commands (R-ACTIVITY-015): each now-act in the plan sent first as `activity/now`, then the month's end
 * with the picks that fill a slot. The run sends the first command accepted and asks again, and a now-act done this
 * month is no longer allowed, so the plan drops it the next time round.
 */
function monthCommands(view: PlayerView, picks: readonly SlotPick[]): Loose[] {
  const now: Loose[] = picks.filter((pick) => !takesMonth(view, pick.activity)).map((pick) => ({ type: "activity/now", activity: pick.activity, param: pick.param }));
  return [...now, { type: "turn/end", slots: picks.filter((pick) => takesMonth(view, pick.activity)) }];
}

function playable(view: PlayerView, id: string): boolean {
  const found = option(view, id);
  return found !== undefined && found.allowed && found.affordable;
}

function nairaCost(view: PlayerView, id: string): number {
  return (option(view, id)?.cost ?? []).reduce((sum, cost) => sum + (cost.currency === "NGN" ? cost.amount : 0), 0);
}

/** Playable, and leaves the buffer standing. Papers the route needs keep back only one month. */
function canSpendOn(view: PlayerView, id: string, habits: Habits, paper = false): boolean {
  const keep = paper ? monthlyDue(view) : buffer(view, habits);
  return playable(view, id) && naira(view) - nairaCost(view, id) >= keep;
}

const VISA_PAPERS = ["document.passport", "document.transcript", "document.english-test", "document.cas"];

/** Every paper the visa needs except the TB certificate is held and good for a few months more. */
function papersReady(view: PlayerView): boolean {
  return VISA_PAPERS.every((id) => {
    const held = documentState(view, id);
    return held?.state === "held" && (held.expiresMonth === null || held.expiresMonth > view.month + 3);
  });
}

function holdingFunds(view: PlayerView): boolean {
  return view.obligations.some((item) => item.entry.includes("held-funds"));
}

function route(view: PlayerView, id: Id<"route"> = UK) {
  return view.routes.find((item) => item.id === id);
}

function documentState(view: PlayerView, id: string) {
  return view.documents.find((item) => item.id === id);
}

/** A job's monthly pay in kobo, valued at the official rate. */
export function payOf(view: PlayerView, content: Content, job: string | null): number {
  if (job === null) return 0;
  const pay = content.activity[job as Id<"activity">]?.pay;
  if (pay === null || pay === undefined || typeof pay.amount !== "number") return 0;
  if (pay.currency === "NGN") return pay.amount;
  const rate = view.rates[pay.currency].official;
  return mulDiv(pay.amount, rate, 100);
}

/** Pence a pound pocket set needs before the deposit and fees can be paid in pounds. */
function poundsToKobo(view: PlayerView, pence: number): number {
  return mulDiv(pence, view.rates.GBP.official, 100);
}

/**
 * The gap between funds required and funds shown, in pence. Zero when covered.
 * The checklist's `funds` item is worked out every time the view is asked for;
 * the route's own figures only after a month-end check with a deposit paid.
 */
function fundsGap(view: PlayerView): number {
  const item = route(view)?.checklist.find((entry) => entry.id === "funds");
  if (item === undefined || item.have === null || item.need === null) return 0;
  return Math.max(0, item.need - item.have);
}

function varStart(content: Content, id: string): number {
  return content.var[id as Id<"var">]?.start ?? 0;
}

/** Naira the next big payment will take, by the stage the route is at. */
function nextBigPayment(view: PlayerView, content: Content): number {
  const uk = route(view);
  if (uk === undefined) return 0;
  if (uk.state === "granted") {
    const flight = content.tuning.route.flight;
    return typeof flight.amount === "number" ? flight.amount : 0;
  }
  const pounds = view.pockets.GBP.bank + view.pockets.GBP.cash;
  let pence = 0;
  if (uk.state === "known" && uk.school === null) {
    const offers = uk.schools.filter((school) => school.state === "offer");
    const school = offers.find((item) => item.id === NORTHGATE) ?? offers[0];
    if (school !== undefined) pence = content.school[school.id]?.deposit ?? 0;
  } else if (uk.state === "known") pence = varStart(content, "var.uk-visa-fee") + varStart(content, "var.uk-surcharge");
  const owed = poundsToKobo(view, Math.max(0, pence - pounds));
  return owed + mulDiv(owed, 150, 10000);
}

/** A formal route other than the study one that this player can see a way through. */
function settlingRouteInReach(view: PlayerView, habits: Habits): boolean {
  return view.routes.some((item) => {
    if (!habits.otherRoutes.includes(item.id) || item.id === GULF) return false;
    if (item.state !== "known" && item.state !== "applying" && item.state !== "granted") return false;
    if (item.window === "closed") return false;
    // R-POINTS-006: the clocks would invite now; the care cut-off counts only for a carer.
    if (item.gate?.gate === "points") return item.gate.invites;
    return true;
  });
}

/** Whether the study route is still the plan: always, except for a player who would rather settle and has a way to. */
function studyOn(view: PlayerView, habits: Habits): boolean {
  if (!habits.leaves || !habits.studies) return false;
  const uk = route(view);
  if (uk === undefined) return false;
  if (!habits.prefersSettling) return true;
  // Once money is down on the study route it is seen through.
  if (uk.school !== null || uk.state === "applying" || uk.state === "granted") return true;
  // R-ACTIVITY-015: the family meeting is held at once, so the pledge comes sooner; given on an offer held, it is money down too.
  if (uk.schools.some((school) => school.state === "offer") && quality(view, "quality.family-stake") > 0) return true;
  return !settlingRouteInReach(view, habits);
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

function choose(offer: OfferView, choice: string, amount?: number): Loose | null {
  const found = offer.choices.find((item) => item.id === choice);
  if (found === undefined || !found.allowed) return null;
  if (found.pick === null) return { type: "offer/choose", offer: offer.id, choice };
  const picked = Math.min(found.pick.max, Math.max(found.pick.min, amount ?? found.pick.min));
  return { type: "offer/choose", offer: offer.id, choice, amount: picked };
}

/** The first allowed of the choices named, in order. */
function chooseFirst(offer: OfferView, choices: string[]): Loose | null {
  for (const choice of choices) {
    const command = choose(offer, choice);
    if (command !== null) return command;
  }
  return null;
}

/** The naira a choice would pay out, from the content's effects, when plain. */
function choiceCost(content: Content, offer: OfferView, choice: string): number {
  const entry = content.offer[offer.entry];
  const found = entry?.choices.find((item) => item.id === choice);
  let cost = 0;
  for (const effect of found?.effects ?? []) {
    if (effect.type === "money/take" && typeof effect.amount === "number" && effect.currency === "NGN") cost += effect.amount;
  }
  return cost;
}

const FAMILY_ORDER: Record<string, string[]> = {
  "offer.nepa-bill": ["pay", "leave"],
  "offer.brother-fees": ["pay", "half", "no"],
  "offer.mum-shop": ["give", "half", "no"],
  "offer.aso-ebi": ["buy", "plain", "absent"],
  "offer.roof": ["pay", "half", "no"],
  "offer.harvest": ["give", "no"],
  "offer.uncle-burial": ["send", "token", "nothing"],
  "offer.send-off-party": ["go", "message"],
  "offer.laptop-fault": ["repair", "manage"],
  "offer.fuel-scarcity": ["pay", "trek"],
  "offer.recruiter-message": ["do-it", "ignore"],
  "offer.village-burial": ["go", "send-money", "absent"],
  "offer.parents-group-debt": ["pay", "no"],
};

const SPONSOR_OFFERS: Record<string, Id<"route">> = {
  "offer.sponsor-care-home": "route.uk-care",
  "offer.sponsor-trust": "route.uk-care",
  "offer.sponsor-tech-firm": "route.uk-skilled",
  "offer.sponsor-agency": "route.uk-skilled",
};

/** Signs a careful player reads as a sponsor selling its certificate. */
const BAD_SIGNS = ["pays-for-cos", "whatsapp-only"];

const SALARY_BAR: Record<string, string> = { "route.uk-care": "var.uk-care-salary", "route.uk-skilled": "var.uk-skilled-salary" };

const ROAD_PITCHES = ["offer.road-radio", "offer.road-park", "offer.road-cousin"];

/** What every player does with an offer that is the same at home and abroad, or null when the entry is not one of them. */
function commonOffer(view: PlayerView, content: Content, habits: Habits, offer: OfferView): Loose | null | undefined {
  const careful = habits.prep > 0;
  switch (offer.entry) {
    case "offer.illness":
      return chooseFirst(offer, careful ? ["hospital", "chemist", "ignore"] : ["ignore"]);
    case "offer.illness-worse":
      return chooseFirst(offer, ["hospital", "cannot"]);
    case "offer.court-date":
      return chooseFirst(offer, ["attend"]);
    case "offer.whip-round":
      return chooseFirst(offer, ["accept"]);
    case "offer.road-ransom-call":
      return chooseFirst(offer, ["pay", "cannot"]);
    case "offer.telco-promo":
      return chooseFirst(offer, careful ? ["ignore", "no"] : ["claim", "pay", "take"]);
    case "offer.group-loan":
      return habits.takesGroupLoan ? choose(offer, "take", Number.MAX_SAFE_INTEGER) : choose(offer, "no");
    case "offer.gulf-agent":
      return chooseFirst(offer, habits.takesGulf ? ["take", "walk-away"] : ["walk-away"]);
    case "offer.job": {
      const job = offer.terms.job;
      return choose(offer, typeof job === "string" && payOf(view, content, job) > payOf(view, content, view.job.id) ? "accept" : "decline");
    }
    default:
      break;
  }
  if (ROAD_PITCHES.includes(offer.entry)) return chooseFirst(offer, habits.takesRoad ? ["take", "ignore"] : ["ignore"]);
  const sponsored = SPONSOR_OFFERS[offer.entry];
  if (sponsored !== undefined) {
    if (!habits.leaves || !habits.otherRoutes.includes(sponsored)) return choose(offer, "decline");
    const salary = offer.terms.salary;
    const bar = varStart(content, SALARY_BAR[sponsored] ?? "");
    const looksBad = careful && offer.signs.some((sign) => BAD_SIGNS.includes(sign));
    if (looksBad || (typeof salary === "number" && salary < bar)) return choose(offer, "decline");
    return chooseFirst(offer, ["take", "decline"]);
  }
  return undefined;
}

function offerCommands(view: PlayerView, content: Content, habits: Habits): Loose[] {
  const commands: Loose[] = [];
  const spare = naira(view) - buffer(view, habits);
  const gapKobo = poundsToKobo(view, fundsGap(view));
  const study = studyOn(view, habits);
  for (const offer of view.offers) {
    const order = FAMILY_ORDER[offer.entry];
    if (order !== undefined) {
      const choices = habits.paysFamily ? order : order.slice(-1);
      for (const choice of choices) {
        const cost = choiceCost(content, offer, choice);
        if (cost > 0 && cost > spare) continue;
        const command = choose(offer, choice);
        if (command !== null) {
          commands.push(command);
          break;
        }
      }
      continue;
    }
    const common = commonOffer(view, content, habits, offer);
    if (common !== undefined) {
      if (common !== null) commands.push(common);
      continue;
    }
    let command: Loose | null = null;
    switch (offer.entry) {
      case "offer.family-pledge":
      case "offer.family-pledge-small":
        command = choose(offer, "accept");
        break;
      case "offer.land-buyer":
        command = choose(offer, gapKobo > 0 && study ? "sell" : "hold");
        break;
      case "offer.salary-loan":
        command = habits.takesLoans ? choose(offer, "take", Number.MAX_SAFE_INTEGER) : choose(offer, "no");
        break;
      case "offer.quick-loan":
        command = habits.takesLoans ? choose(offer, "take", Number.MAX_SAFE_INTEGER) : choose(offer, "ignore");
        break;
      case "offer.held-funds": {
        if (!study) command = choose(offer, "no");
        else if (habits.heldAtOnce) command = choose(offer, "take", Number.MAX_SAFE_INTEGER);
        else if (gapKobo > 0 && !holdingFunds(view) && papersReady(view) && quality(view, "quality.interview-prep") >= habits.prep) {
          // A little over the gap, since the naira keeps falling; and only with three months of interest in hand.
          const amount = gapKobo + mulDiv(gapKobo, 1000, 10000);
          const interest = mulDiv(amount, 1500, 10000);
          command = spare >= interest ? choose(offer, "take", amount) : null;
        }
        command ??= choose(offer, "no");
        break;
      }
      case "offer.held-funds-agent":
        command = study && habits.takesAgent && gapKobo > 0 ? choose(offer, "take", gapKobo + mulDiv(gapKobo, 1000, 10000)) : choose(offer, "walk-away");
        break;
      default:
        break;
    }
    if (command !== null) commands.push(command);
  }
  return commands;
}

// ---------------------------------------------------------------------------
// The month's slots at home
// ---------------------------------------------------------------------------

function bestJobParam(view: PlayerView, content: Content): string | null {
  const hunt = option(view, "activity.job-hunt");
  if (hunt === undefined || !hunt.allowed || hunt.params === null) return null;
  const current = payOf(view, content, view.job.id);
  let best: string | null = null;
  let bestPay = current;
  for (const job of hunt.params) {
    // A side job is hunted the same way and is not a better job (R-ACTIVITY-010).
    if (content.activity[job as Id<"activity">]?.slot !== "main") continue;
    const pay = payOf(view, content, job);
    if (pay > bestPay) {
      best = job;
      bestPay = pay;
    }
  }
  return best;
}

function englishHeld(view: PlayerView): number | null {
  const held = documentState(view, "document.english-test");
  if (held === undefined) return null;
  if (held.state === "pending") return Number.MAX_SAFE_INTEGER;
  // A result about to run out is as good as none: the visa needs it in date.
  if (held.expiresMonth !== null && held.expiresMonth <= view.month + 3) return null;
  return held.state === "held" ? held.value : null;
}

/** The slot that meets one unmet checklist item of a gate route, when there is one. */
const ITEM_ACTIVITY: Record<string, string> = {
  passport: "activity.get-passport",
  english: "activity.sit-english-test",
  tb: "activity.tb-test",
  eca: "activity.get-eca",
  verification: "activity.request-verification",
  licence: "activity.renew-licence",
  pool: "activity.enter-pool",
  endorsement: "activity.apply-endorsement",
  medical: "activity.gulf-medical",
  portfolio: "activity.build-portfolio",
  tech: "activity.learn-tech",
  network: "activity.meetup",
};

const APPLY: Record<string, string> = {
  "route.uk-care": "activity.apply-uk-care",
  "route.uk-skilled": "activity.apply-uk-skilled",
  "route.uk-talent": "activity.apply-uk-talent",
  "route.gulf-contract": "activity.apply-gulf-contract",
};

/** Slots that move the other routes this player works toward, the most advanced route first. */
function otherRoutePicks(view: PlayerView, habits: Habits): SlotPick[] {
  const picks: SlotPick[] = [];
  const add = (activity: string, param: string | null = null): void => {
    if (!picks.some((pick) => pick.activity === activity)) picks.push({ activity: activity as Id<"activity">, param });
  };
  const routes = view.routes
    .filter((item) => habits.otherRoutes.includes(item.id) && (item.state === "known" || item.state === "applying"))
    .sort((left, right) => (right.percent ?? 0) - (left.percent ?? 0));
  for (const item of routes) {
    if (item.state !== "known" || item.window === "closed") continue;
    const apply = APPLY[item.id];
    if (apply !== undefined && playable(view, apply)) add(apply);
    for (const entry of item.checklist) {
      if (entry.met) continue;
      if (entry.id === "sponsor" && playable(view, "activity.find-sponsor")) {
        const params = option(view, "activity.find-sponsor")?.params ?? [];
        if (params.includes(item.id)) add("activity.find-sponsor", item.id);
        continue;
      }
      // A player with no study plan never fetches the passport the study plan would, and the points table pays for the
      // band: so it gets the passport the test asks for, and practises to its usual mark before sitting.
      if (entry.id === "english" && !habits.studies) {
        const passport = documentState(view, "document.passport")?.state;
        if (passport !== "held" && passport !== "pending" && playable(view, "activity.get-passport")) add("activity.get-passport");
        else if (quality(view, "quality.english") < habits.englishBeforeTest) {
          if (playable(view, "activity.study-english")) add("activity.study-english");
        } else if (playable(view, "activity.sit-english-test")) add("activity.sit-english-test");
        continue;
      }
      if (entry.id === "english" && quality(view, "quality.english") < 50) {
        if (playable(view, "activity.study-english")) add("activity.study-english");
        continue;
      }
      const activity = ITEM_ACTIVITY[entry.id];
      if (activity !== undefined && playable(view, activity)) add(activity);
    }
  }
  return picks;
}

function slotPlan(view: PlayerView, content: Content, habits: Habits): SlotPick[] {
  const picks: SlotPick[] = [];
  const room = monthRoom(view);
  const add = (activity: string, param: string | null = null): void => {
    if (picks.length < room) picks.push({ activity: activity as Id<"activity">, param });
  };
  const uk = route(view);
  const study = studyOn(view, habits);
  const known = uk !== undefined && uk.state !== "unknown" && uk.state !== "heard";
  const prep = quality(view, "quality.interview-prep");
  const english = quality(view, "quality.english");
  const tech = quality(view, "quality.tech");
  const portfolio = quality(view, "quality.portfolio");
  const wellbeing = quality(view, "quality.wellbeing");
  const band = englishHeld(view);

  // The application is the point of it all.
  if (study && uk !== undefined && playable(view, "activity.apply-for-visa") && prep >= habits.prep && uk.unexplainedBp <= habits.unexplainedMax) {
    add("activity.apply-for-visa");
  }
  if (wellbeing < 30) add("activity.rest");
  if (habits.leaves && uk?.state === "heard" && playable(view, "activity.look-into-route")) add("activity.look-into-route", UK);

  const job = bestJobParam(view, content);
  if (job !== null) add("activity.job-hunt", job);

  if (known && study) {
    if (canSpendOn(view, "activity.get-passport", habits, true)) add("activity.get-passport");
    if (canSpendOn(view, "activity.get-transcript", habits, true)) add("activity.get-transcript");
    if ((band === null || band < 60) && english >= habits.englishBeforeTest && canSpendOn(view, "activity.sit-english-test", habits, true)) {
      add("activity.sit-english-test");
    }
    if (playable(view, "activity.apply-to-school")) {
      const params = option(view, "activity.apply-to-school")?.params ?? [];
      if (params.includes(NORTHGATE)) add("activity.apply-to-school", NORTHGATE);
      else if (params[0] !== undefined) add("activity.apply-to-school", params[0]);
    }
    if (playable(view, "activity.family-meeting")) add("activity.family-meeting");
    const offered = uk.schools.some((school) => school.state === "offer");
    if (uk.state === "known" && uk.school !== null && fundsGap(view) === 0 && canSpendOn(view, "activity.tb-test", habits, true)) add("activity.tb-test");
    if (offered && prep < habits.prep && playable(view, "activity.interview-prep")) add("activity.interview-prep");
    if ((band === null || band < 60) && english < habits.englishBeforeTest && canSpendOn(view, "activity.study-english", habits)) {
      add("activity.study-english");
    }
  }

  if (habits.leaves) {
    for (const heard of view.routes) {
      if (heard.id !== UK && heard.state === "heard" && habits.otherRoutes.includes(heard.id) && playable(view, "activity.look-into-route")) {
        const params = option(view, "activity.look-into-route")?.params ?? [];
        if (params.includes(heard.id)) add("activity.look-into-route", heard.id);
      }
    }
    for (const pick of otherRoutePicks(view, habits)) {
      if (!picks.some((held) => held.activity === pick.activity) && naira(view) - nairaCost(view, pick.activity) >= monthlyDue(view)) add(pick.activity, pick.param);
    }
    // The motor park is where the Gulf agents and the road's pitches are.
    const gulf = route(view, GULF);
    if ((habits.takesRoad || habits.takesGulf) && (gulf === undefined || gulf.state === "unknown") && view.month >= 3 && playable(view, "activity.ask-around")) {
      add("activity.ask-around");
    }
  }

  // What fills the rest: wellbeing first, then the skills that lead to better pay.
  for (let guard = 0; guard < 3 && picks.length < room; guard += 1) {
    if (wellbeing < 45) add("activity.rest");
    else if (tech >= 40 && portfolio < 3 && playable(view, "activity.build-portfolio")) add("activity.build-portfolio");
    else if (tech < 75 && canSpendOn(view, "activity.learn-tech", habits)) add("activity.learn-tech");
    else if (habits.leaves && habits.prefersSettling && tech >= 60 && playable(view, "activity.meetup")) add("activity.meetup");
    else if (playable(view, "activity.side-gig")) add("activity.side-gig");
    else if (playable(view, "activity.family-time")) add("activity.family-time");
    else add("activity.rest");
  }
  return picks;
}

// ---------------------------------------------------------------------------
// Money and the route's commands at home
// ---------------------------------------------------------------------------

function departures(view: PlayerView): Loose[] {
  const commands: Loose[] = [];
  const granted = view.routes.filter((item) => item.state === "granted");
  if (granted.length === 0) return commands;
  for (const owed of view.obligations) {
    if (owed.entry.includes("held-funds") && view.pockets.NGN.locked >= owed.outstanding) {
      commands.push({ type: "obligation/pay", obligation: owed.id, amount: owed.outstanding });
    }
  }
  for (const item of granted) commands.push({ type: "route/depart", route: item.id });
  return commands;
}

/** Naira kept in the bank while a route other than the study one is in play: the gate fees and the flight. */
const OTHER_ROUTE_NAIRA = 1200000000;

/** The agent and the road's pitches are paid from cash: bank money is moved there for a pitch this player takes. */
function cashForTerms(view: PlayerView, habits: Habits): Loose[] {
  let want = 0;
  for (const offer of view.offers) {
    if (habits.takesRoad && ROAD_PITCHES.includes(offer.entry) && typeof offer.terms.deposit === "number") want = Math.max(want, offer.terms.deposit);
    if (habits.takesGulf && offer.entry === "offer.gulf-agent" && typeof offer.terms.fee === "number") want = Math.max(want, offer.terms.fee);
  }
  const short = want - view.pockets.NGN.cash;
  if (short <= 0 || view.pockets.NGN.bank < short) return [];
  return [{ type: "wallet/move", currency: "NGN", amount: short, to: "cash" }];
}

function moneyCommands(view: PlayerView, content: Content, habits: Habits): Loose[] {
  const commands: Loose[] = [];
  const uk = route(view);
  const cash = view.pockets.NGN.cash;
  const due = monthlyDue(view);
  if (cash > due * 2 + 10000000) {
    commands.push({ type: "wallet/move", currency: "NGN", amount: Math.min(SAFE_CASH_MOVE, cash - due * 2), to: "bank" });
  }
  // Paying ahead on a loan whose next charge is more than the pockets hold.
  for (const owed of view.obligations) {
    if (owed.entry === "obligation.quick-loan" && naira(view) >= owed.outstanding + due && !habits.takesLoans) {
      commands.push({ type: "obligation/pay", obligation: owed.id, amount: owed.outstanding });
    }
  }
  if (!habits.leaves) return commands;
  // Dollars are sold for naira while another route is in play: its fees and the flight are paid from naira.
  const otherInPlay = view.routes.some((item) => item.id !== UK && habits.otherRoutes.includes(item.id) && item.state !== "unknown" && item.state !== "heard");
  if (otherInPlay && view.pockets.NGN.bank < OTHER_ROUTE_NAIRA && view.pockets.USD.bank > 0) {
    const cents = Math.min(view.pockets.USD.bank, mulDiv(OTHER_ROUTE_NAIRA - view.pockets.NGN.bank, 100, view.rates.USD.official) + 100);
    commands.push({ type: "wallet/convert", from: "USD", to: "NGN", amount: cents, via: "bank" });
  }
  commands.push(...departures(view));
  if (uk === undefined || uk.state === "granted") return commands;

  const big = nextBigPayment(view, content);
  // Dollars are sold for naira when the next big payment needs them: the fee rules never reach a dollar pocket.
  const short = big + buffer(view, habits) - view.pockets.NGN.bank;
  if (short > 0 && view.pockets.USD.bank > 0) {
    const cents = Math.min(view.pockets.USD.bank, mulDiv(short, 102, view.rates.USD.official) + 100);
    commands.push({ type: "wallet/convert", from: "USD", to: "NGN", amount: cents, via: "bank" });
  }
  if (!studyOn(view, habits)) return commands;

  if (uk.school === null && uk.state === "known") {
    const offers = uk.schools.filter((school) => school.state === "offer");
    const school = offers.find((item) => item.id === NORTHGATE) ?? offers[0];
    if (school !== undefined && view.pockets.NGN.bank - big >= buffer(view, habits)) {
      commands.push({ type: "route/pay-deposit", route: UK, school: school.id });
    }
  }

  // Buying pounds ahead, within the month's bank allowance.
  const knownish = uk.state === "known" || uk.state === "applying";
  if (habits.buysPounds && knownish && view.pockets.GBP.bank < POUND_TARGET && view.bankAllowanceLeft !== null && view.bankAllowanceLeft > 0 && view.queued.length === 0) {
    const most = mulDiv(view.bankAllowanceLeft, view.rates.USD.official, 100) - 100;
    const amount = Math.min(most, view.pockets.NGN.bank - buffer(view, habits) - due * 3);
    if (amount >= 1000000) commands.push({ type: "wallet/convert", from: "NGN", to: "GBP", amount, via: "bank" });
  }
  return commands;
}

// ---------------------------------------------------------------------------
// Set pieces and the prologue
// ---------------------------------------------------------------------------

function ranked(answers: string[], preferred: string[]): string[] {
  return [...preferred.filter((item) => answers.includes(item)), ...answers.filter((item) => !preferred.includes(item))];
}

function answer(view: PlayerView, habits: Habits): Loose[] {
  const setpiece = view.setpiece;
  const question = setpiece?.question;
  if (setpiece === null || question === undefined || question === null) return [];
  let order: string[];
  if (setpiece.entry === "setpiece.december") order = ranked(question.answers, habits.december);
  else if (setpiece.entry.startsWith("setpiece.road")) order = ranked(question.answers, habits.road);
  else if (habits.prep > 0) order = [...question.answers.filter((item) => !question.weak.includes(item)), ...question.answers];
  else order = question.answers;
  return order.map((item) => ({ type: "setpiece/answer", question: question.id, answer: item }));
}

function prologueAnswers(view: PlayerView, habits: Habits): Loose[] {
  const card = view.prologue;
  if (card === null) return [];
  const allowed = card.answers.filter((item) => item.allowed).map((item) => item.id);
  const order = habits.prologue === "first" ? allowed : [...allowed].reverse();
  return order.map((item) => ({ type: "prologue/choose", step: card.step, answer: item }));
}

// ---------------------------------------------------------------------------
// Abroad
// ---------------------------------------------------------------------------

function localCurrency(view: PlayerView, content: Content): ForeignCurrency | null {
  const country = view.place.country;
  if (country === null) return null;
  const currency = content.country[country]?.currency;
  return currency === undefined || currency === "NGN" ? null : currency;
}

/** The best job the hunt offers now under the status's work rule, if it pays more than the job held. */
function bestAbroadJob(view: PlayerView, content: Content): string | null {
  const hunt = option(view, "activity.job-hunt");
  if (hunt === undefined || !hunt.allowed || hunt.params === null) return null;
  let best: string | null = null;
  let bestPay = payOf(view, content, view.job.id);
  for (const job of hunt.params) {
    if (content.activity[job as Id<"activity">]?.slot !== "main") continue;
    const pay = payOf(view, content, job);
    if (pay > bestPay) {
      best = job;
      bestPay = pay;
    }
  }
  return best;
}

function abroadSlots(view: PlayerView, content: Content, habits: Habits, currency: ForeignCurrency): SlotPick[] {
  const picks: SlotPick[] = [];
  const room = monthRoom(view);
  const add = (activity: string, param: string | null = null): void => {
    if (picks.length < room && !picks.some((pick) => pick.activity === activity && activity !== "activity.rest")) {
      picks.push({ activity: activity as Id<"activity">, param });
    }
  };
  const byPrefix = (prefix: string): string | null => view.activities.find((item) => item.id.startsWith(prefix) && item.allowed && item.affordable)?.id ?? null;
  const wellbeing = quality(view, "quality.wellbeing");
  const pocket = view.pockets[currency];
  const dues = monthlyDueIn(view, content, currency);
  const spare = pocket.bank + pocket.cash - dues * (habits.bufferMonths + 1);
  if (wellbeing < 30) add("activity.rest");
  const job = bestAbroadJob(view, content);
  if (job !== null) add("activity.job-hunt", job);
  if (wellbeing < 20) add("activity.rest");
  const pick = (prefix: string): void => {
    const found = byPrefix(prefix);
    if (found !== null) add(found);
  };
  const holds = (part: string): boolean => view.obligations.some((owed) => owed.entry.includes(part));
  if (habits.phoneContract && !holds("phone")) pick("activity.phone-contract");
  if (habits.rentsFlat && spare > 0 && !holds("rent-flat")) pick("activity.rent-flat");
  if (habits.buysCar && !holds("obligation.car")) {
    pick("activity.buy-car-finance");
    if (spare > 0 && !view.documents.some((item) => item.id === "document.uk-licence" && item.state === "held")) pick("activity.driving-test");
  }
  if (habits.prefersSettling && spare > 0) pick("activity.nmc-tests");
  for (let guard = 0; guard < 3 && picks.length < room; guard += 1) {
    if (wellbeing < 50) add("activity.rest");
    else if (quality(view, "quality.standing") < 40 && byPrefix("activity.call-home") !== null) pick("activity.call-home");
    else if (view.job.id !== null && wellbeing >= 60 && byPrefix("activity.overtime") !== null) pick("activity.overtime");
    else if (spare > 0 && byPrefix("activity.community") !== null) pick("activity.community");
    else add("activity.rest");
  }
  return picks;
}

/** Basis points over a shortfall bought, for the bank's charge and the rounding. */
const BUY_MARGIN_BP = 10300;

/**
 * What the local pockets cannot meet of next month's dues, bought at the bank
 * from dollars and then naira: abroad the Lagos allowance does not bind (R-WALLET-005).
 */
function coverDues(view: PlayerView, currency: ForeignCurrency, dues: number): Loose[] {
  const pocket = view.pockets[currency];
  let short = mulDivCeil(dues - pocket.bank - pocket.cash, BUY_MARGIN_BP, 10000);
  if (short <= 0) return [];
  const commands: Loose[] = [];
  const rate = view.rates[currency].official;
  if (currency !== "USD") {
    const dollars = Math.min(view.pockets.USD.bank, mulDivCeil(short, rate, view.rates.USD.official));
    if (dollars >= 100) {
      commands.push({ type: "wallet/convert", from: "USD", to: currency, amount: dollars, via: "bank" });
      short -= mulDiv(dollars, view.rates.USD.official, rate);
    }
  }
  const kobo = Math.min(view.pockets.NGN.bank, mulDivCeil(short, rate, 100));
  if (short > 0 && kobo >= 10000) commands.push({ type: "wallet/convert", from: "NGN", to: currency, amount: kobo, via: "bank" });
  return commands;
}

function abroadMoney(view: PlayerView, content: Content, habits: Habits, currency: ForeignCurrency): Loose[] {
  const commands: Loose[] = [];
  const pocket = view.pockets[currency];
  const dues = monthlyDueIn(view, content, currency);
  commands.push(...coverDues(view, currency, dues));
  // Cash work pays into cash; the remittance and most fees read the bank pocket.
  if (pocket.cash > dues + 10000) commands.push({ type: "wallet/move", currency, amount: pocket.cash - dues, to: "bank" });
  const status = view.status;
  if (habits.renews && status?.renew !== null && status?.renew !== undefined && status.monthsLeft !== null && status.monthsLeft <= 3) {
    commands.push({ type: "status/renew" });
  }
  // Fees ahead: the renewal, and settling once the lawful months are near.
  let keep = dues * (habits.bufferMonths + 1);
  if (habits.renews && status?.renew !== null && status?.renew !== undefined) keep += status.renew.fee + status.renew.surcharge;
  if (habits.renews && status !== null && status.settleMonths !== null) keep += varStart(content, "var.uk-settle-fee") + varStart(content, "var.uk-citizen-fee");
  const fare = view.place.fareHome?.amount ?? 0;
  if (habits.keepsFareOnly) keep = 0;
  if (habits.homeWhenUnlawful) keep += fare;
  // What is owed at home is paid from the naira pockets, so enough is sent first to meet it.
  const homeDue = monthlyDueIn(view, content, "NGN") * (habits.bufferMonths + 1);
  const homeShort = homeDue - view.pockets.NGN.bank;
  if (habits.paysFamily && homeShort > 0) {
    const amount = Math.min(pocket.bank - dues, mulDiv(homeShort, 105, view.rates[currency].official) + 100);
    if (amount >= 1000) commands.push({ type: "wallet/remit", currency, amount, channel: "app" });
  }
  const over = pocket.bank - keep;
  if (habits.remitShareBp > 0 && over > 1000) {
    const amount = mulDiv(over, habits.remitShareBp, 10000);
    if (amount >= 1000) commands.push({ type: "wallet/remit", currency, amount, channel: habits.channel });
  }
  return commands;
}

/**
 * The savings spent: loans and debts at home paid off from the naira bank, and
 * the school's fees paid ahead from pounds bought with what naira is left, all
 * but the fare home kept.
 */
function spendSavings(view: PlayerView): Loose[] {
  const bank = view.pockets.NGN.bank;
  const commands: Loose[] = view.obligations
    .filter((owed) => (owed.entry.includes("loan") || owed.entry.includes("debt")) && owed.outstanding > 0 && bank > 0)
    .map((owed) => ({ type: "obligation/pay", obligation: owed.id, amount: Math.min(owed.outstanding, bank) }));
  const tuition = view.obligations.find((owed) => owed.entry === "obligation.tuition" && owed.outstanding > 0);
  if (tuition === undefined) return commands;
  const spare = view.pockets.GBP.bank - (view.place.fareHome?.amount ?? 0);
  if (spare > 0) commands.push({ type: "obligation/pay", obligation: tuition.id, amount: Math.min(tuition.outstanding, spare) });
  if (bank > 0) commands.push({ type: "wallet/convert", from: "NGN", to: "GBP", amount: bank, via: "bank" });
  return commands;
}

/** Whether a careful player goes home now: no lawful status, or a status about to end with nothing to follow it. */
function goesHome(view: PlayerView, habits: Habits): boolean {
  const status = view.status;
  if (!habits.homeWhenUnlawful) return false;
  if (status === null || status.work === "cash") return true;
  if (habits.prefersSettling && status.clock !== null && status.clock <= 1 && view.job.id === null) return true;
  return false;
}

function abroadCommands(view: PlayerView, content: Content, habits: Habits): Loose[] {
  const currency = localCurrency(view, content);
  const commands: Loose[] = [];
  for (const offer of view.offers) {
    const order = FAMILY_ORDER[offer.entry];
    if (order !== undefined) {
      const command = chooseFirst(offer, habits.paysFamily ? order : order.slice(-1));
      if (command !== null) commands.push(command);
      continue;
    }
    const common = commonOffer(view, content, habits, offer);
    if (common !== undefined && common !== null) commands.push(common);
    else if (common === undefined) {
      const first = offer.choices.find((choice) => choice.allowed && choice.pick === null);
      if (first !== undefined && offer.entry.startsWith("offer.sponsor-licence")) commands.push({ type: "offer/choose", offer: offer.id, choice: first.id });
    }
  }
  if (goesHome(view, habits)) commands.push({ type: "return/home" });
  if (habits.keepsFareOnly) commands.push(...spendSavings(view));
  if (currency !== null) commands.push(...abroadMoney(view, content, habits, currency));
  if (view.turns.banked > 0) {
    commands.push(...monthCommands(view, currency === null ? [] : abroadSlots(view, content, habits, currency)));
    commands.push({ type: "turn/end", slots: [] });
  }
  return commands;
}

/** A strategy from a set of habits: answer, settle offers, handle money, then end the month. */
export function strategyOf(name: StrategyName): Strategy {
  const habits = HABITS[name];
  return (view, content) => {
    if (view.ended) return [];
    if (view.prologue !== null) return prologueAnswers(view, habits);
    if (view.setpiece !== null) return answer(view, habits);
    if (view.place.where === "abroad") return abroadCommands(view, content, habits);
    if (view.place.where === "road") {
      const commands = view.offers.flatMap((offer) => {
        const command = commonOffer(view, content, habits, offer);
        return command === undefined || command === null ? [] : [command];
      });
      return view.turns.banked > 0 ? [...commands, { type: "turn/end", slots: [] }] : commands;
    }
    const commands = [...(habits.leaves ? cashForTerms(view, habits) : []), ...offerCommands(view, content, habits), ...moneyCommands(view, content, habits)];
    if (view.turns.banked > 0) {
      commands.push(...monthCommands(view, slotPlan(view, content, habits)));
      commands.push({ type: "turn/end", slots: [] });
    }
    return commands;
  };
}

export const strategies: Record<StrategyName, Strategy> = {
  careful: strategyOf("careful"),
  borrower: strategyOf("borrower"),
  risky: strategyOf("risky"),
  "honest-home": strategyOf("honest-home"),
  spender: strategyOf("spender"),
  canada: strategyOf("canada"),
  road: strategyOf("road"),
};

// ---------------------------------------------------------------------------
// The runner
// ---------------------------------------------------------------------------

export interface Decision {
  month: number;
  granted: boolean;
  reasons: string[];
  unexplainedBp: number;
  interviewScore: number;
  earlierRefusals: number;
  /** The chance of refusal the decision drew against, in basis points (R-ROUTE-016). */
  chanceBp: number;
}

/** How a run ends, read from the last state: brief m1-sweep, item 2. */
export type Ending = "settled" | "citizen" | "returned-by-choice" | "returned-broke" | "assisted-return" | "removed" | "road-lost" | "still-playing";

export const ENDINGS: Ending[] = ["settled", "citizen", "returned-by-choice", "returned-broke", "assisted-return", "removed", "road-lost", "still-playing"];

export type CarFate = "none" | "owned" | "paying" | "repossessed" | "handed-back" | "left-behind";

export interface RunRecord {
  strategy: StrategyName;
  life: Id<"scenario">;
  seed: string;
  months: number;
  /** The prologue's path and grade, for a life that plays one. */
  prologue: string | null;
  heard: number | null;
  known: number | null;
  offer: number | null;
  deposit: number | null;
  applied: number | null;
  decisions: Decision[];
  granted: number | null;
  departed: number | null;
  /** The route flown on first, or null. */
  flown: Id<"route"> | null;
  /** The status held at 12, 36 and 60 months after the first flight; null when not abroad then or not reached. */
  statusAt: Record<"12" | "36" | "60", Id<"status"> | null>;
  /** The month the character first set out on the road. */
  road: number | null;
  ending: Ending;
  /** The first month a settled or citizen status was held. */
  settledMonth: number | null;
  /** The job held when the visa was granted. */
  jobAtGrant: string | null;
  /** The first month the remote developer job was held. */
  remote: number | null;
  japacity: number | null;
  /** Month ends with less naira than offer.md's "broke", at home; abroad, with the local pockets under one month of what is due. */
  broke: number;
  /** Illnesses that opened. */
  ill: number;
  car: CarFate;
  /** The credit mark of the last country's file, or null for none. */
  creditEnd: number | null;
  goalsDone: number;
  chaptersClosed: number;
  /** Refusal reasons on every route and lapse reasons of every status, as `refused:<reason>` and `lapsed:<status>:<why>`. */
  reasons: string[];
  /** Months whose report carried at least one good line. */
  goodMonths: number;
  /** The longest run of months without a good line. */
  longestDry: number;
  /** Months whose report carried a good line beyond pay, gig money and skill gains. */
  winMonths: number;
  /** The longest run of months without such a line. */
  longestNoWin: number;
  /** Turns the authority had to grant because the bank ran dry. */
  grantedTurns: number;
  /** Times a turn was banked, no set piece was open, and neither a resting turn nor the legal list was there. */
  stuck: number;
  /** Turns built only from options the view called allowed and affordable that step rejected. */
  rejectedTurns: { month: number; code: string; detail: string }[];
  /** Commands a strategy built from the view that step refused, by type and code, for the findings. */
  refused: Record<string, number>;
  /** A step that threw instead of answering, with the month: a finding, and the end of the run. */
  crash: { month: number; message: string } | null;
}

/** Good lines that come with every ordinary month: pay, gig money and practice. */
export const ROUTINE_LINES = ["line.wallet.salary", "line.activity.salary", "line.quality.gain", "line.activity.gig", "line.wallet.gig"];

export interface RunOptions {
  months?: number;
  worldSeed?: string;
  /** Keeps the save, for the goldens. */
  keepSave?: boolean;
  /** Stops the run early once this holds after a turn. */
  stopWhen?: (game: Game, record: RunRecord) => boolean;
}

const SETTLED_STATUSES: Id<"status">[] = ["status.uk-settled", "status.ca-resident"];
const CITIZEN_STATUSES: Id<"status">[] = ["status.uk-citizen", "status.ca-citizen"];

function restingTurnAccepted(game: Game): boolean {
  const result = step(game.state, { type: "turn/end", slots: [], basedOn: game.state.v }, game.world(), game.content);
  return result.ok;
}

interface FileOnDay {
  unexplainedBp: number;
  interviewScore: number;
  chanceBp: number;
}

/** The visa file as the decision will weigh it, read from the authority's state. */
function fileOf(state: State, content: Content): FileOnDay {
  const held = state.route[UK];
  const visa = held?.visa;
  const file = {
    strictness: visa?.rules.strictness ?? 0,
    unexplainedBp: visa?.unexplainedBp ?? 0,
    refusals: held?.refusals ?? 0,
    interviewScore: visa?.interviewScore ?? 0,
    grade: state.quality["quality.edu-grade"] ?? 0,
  };
  return { unexplainedBp: file.unexplainedBp, interviewScore: file.interviewScore, chanceBp: refusalChanceBp(content.tuning.route, content.route[UK]?.refusalBaseBp ?? 0, file) };
}

/** The ending a run has reached, read from its state. */
export function endingOf(state: State): Ending {
  if (state.turn.ended) return "road-lost";
  const held = state.place.where === "abroad" ? (state.status.current?.entry ?? null) : (state.place.heldAbroad?.status ?? null);
  if (held !== null && CITIZEN_STATUSES.includes(held)) return "citizen";
  if (held !== null && SETTLED_STATUSES.includes(held)) return "settled";
  const last = state.place.returns[state.place.returns.length - 1];
  if (state.place.where !== "home" || last === undefined) return "still-playing";
  switch (last.shape) {
    case "with-papers":
    case "by-choice":
      return "returned-by-choice";
    case "broke":
      return "returned-broke";
    case "assisted":
      return "assisted-return";
    case "removed":
      return "removed";
    default: {
      const never: never = last.shape;
      return never;
    }
  }
}

function carFate(state: State, events: BaseEvent[], fate: CarFate): CarFate {
  for (const event of events) {
    if ((event as { entry?: string }).entry !== "obligation.car") continue;
    switch (event.type) {
      case "obligation/opened":
        fate = "paying";
        break;
      case "obligation/repossessed":
        fate = "repossessed";
        break;
      case "obligation/handed-back":
        fate = "handed-back";
        break;
      case "obligation/owned":
        fate = "owned";
        break;
      default:
        break;
    }
  }
  if (fate === "paying" && !Object.values(state.obligation.items).some((item) => item.entry === "obligation.car")) fate = "left-behind";
  return fate;
}

function readEvents(events: BaseEvent[], record: RunRecord): void {
  for (const event of events) {
    const fields = event as BaseEvent & Record<string, unknown>;
    if (event.type === "route/refused" && Array.isArray(fields.reasons)) for (const reason of fields.reasons as string[]) record.reasons.push(`refused:${reason}`);
    if (event.type === "status/lapsed") record.reasons.push(`lapsed:${String(fields.status)}:${String(fields.why)}`);
    if (event.type === "offer/opened" && (fields.item as { entry?: string } | undefined)?.entry === "offer.illness") record.ill += 1;
  }
}

function prologuePath(state: State): string | null {
  if (state.scenario !== "scenario.prologue") return null;
  const choices = state.prologue.choices;
  const path = choices["after-school"] ?? "none";
  return `${path}, grade ${String(state.quality["quality.edu-grade"] ?? 0)}`;
}

/** Plays one life with one strategy until the months run out or the life ends. */
export function runLife(
  name: StrategyName,
  life: Id<"scenario">,
  seed: string,
  content: Content,
  options: RunOptions = {},
): { record: RunRecord; game: Game } {
  const months = options.months ?? 60;
  const game = start({ scenario: life, seed, worldSeed: options.worldSeed ?? `world-${seed}`, content });
  const strategy = strategies[name];
  const record: RunRecord = {
    strategy: name,
    life,
    seed,
    months: 0,
    prologue: null,
    heard: null,
    known: null,
    offer: null,
    deposit: null,
    applied: null,
    decisions: [],
    granted: null,
    departed: null,
    flown: null,
    statusAt: { "12": null, "36": null, "60": null },
    road: null,
    ending: "still-playing",
    settledMonth: null,
    jobAtGrant: null,
    remote: null,
    japacity: null,
    broke: 0,
    ill: 0,
    car: "none",
    creditEnd: null,
    goalsDone: 0,
    chaptersClosed: 0,
    reasons: [],
    goodMonths: 0,
    longestDry: 0,
    winMonths: 0,
    longestNoWin: 0,
    grantedTurns: 0,
    stuck: 0,
    rejectedTurns: [],
    refused: {},
    crash: null,
  };
  let dry = 0;
  let noWin = 0;
  let sentThisMonth = 0;
  let lastFile: FileOnDay = { unexplainedBp: 0, interviewScore: 0, chanceBp: 0 };
  while (!game.state.turn.ended && game.state.turn.month < months) {
    try {
      if (!playMonthPart()) break;
    } catch (error) {
      record.crash = { month: game.state.turn.month, message: error instanceof Error ? error.message : String(error) };
      break;
    }
  }
  /** One command of the run; false when the run should stop. */
  function playMonthPart(): boolean {
    let view = game.view();
    if (view.turns.banked === 0 && view.setpiece === null && view.prologue === null) {
      game.grant(1);
      record.grantedTurns += 1;
      view = game.view();
    }
    if (view.setpiece === null && view.prologue === null && (!restingTurnAccepted(game) || legalCommands(view).length === 0)) record.stuck += 1;
    const before = game.state;
    const wanted = sentThisMonth > 12 && view.setpiece === null && view.prologue === null ? [{ type: "turn/end", slots: [] } as Loose] : strategy(view, content);
    let sent: Loose | null = null;
    let events: BaseEvent[] = [];
    for (const command of wanted) {
      const result = game.send(command);
      if (result.ok) {
        sent = command;
        events = result.events;
        break;
      }
      if (command.type === "turn/end" && command.slots.length > 0) {
        record.rejectedTurns.push({ month: view.month, code: result.code, detail: result.detail });
      } else if (command.type !== "turn/end") {
        const key = `${command.type} ${result.code}`;
        record.refused[key] = (record.refused[key] ?? 0) + 1;
      }
    }
    if (sent === null) {
      record.stuck += 1;
      const rest = game.send({ type: "turn/end", slots: [] });
      if (!rest.ok) throw new Error(`${name} on ${life} seed ${seed} is stuck in month ${String(view.month)}: ${rest.code} ${rest.detail}`);
      sent = { type: "turn/end", slots: [] };
      events = rest.events;
    }
    readEvents(events, record);
    const after = game.state;
    record.car = carFate(after, events, record.car);
    const was = before.route[UK];
    const now = after.route[UK];
    if (now?.visa !== null && now?.visa !== undefined) lastFile = fileOf(after, content);
    if (was !== undefined && now !== undefined) {
      if (record.heard === null && now.state !== "unknown") record.heard = after.turn.month;
      if (record.known === null && now.knownMonth !== null) record.known = after.turn.month;
      if (record.offer === null && Object.values(now.schools).some((school) => school.state === "offer")) record.offer = after.turn.month;
      if (record.deposit === null && now.school !== null) record.deposit = after.turn.month;
      if (record.applied === null && now.state === "applying") record.applied = after.turn.month;
      if (was.state === "applying" && now.state !== "applying") {
        const granted = now.state === "granted";
        record.decisions.push({
          month: after.turn.month,
          granted,
          reasons: granted ? [] : (now.lastRefusal?.reasons ?? []),
          ...lastFile,
          earlierRefusals: was.refusals,
        });
        if (granted) {
          record.granted ??= after.turn.month;
          record.jobAtGrant ??= after.activity.job;
        }
      }
    }
    if (record.granted === null) {
      const grantedNow = Object.entries(after.route).find(([id, held]) => id !== ROAD && held.state === "granted" && before.route[id as Id<"route">]?.state !== "granted");
      if (grantedNow !== undefined) {
        record.granted = after.turn.month;
        record.jobAtGrant = after.activity.job;
      }
    }
    if (record.departed === null && before.place.where === "home" && after.place.where === "abroad") {
      record.departed = after.turn.month;
      record.flown = (Object.entries(after.route).find(([, held]) => held.state === "departed")?.[0] as Id<"route"> | undefined) ?? null;
    }
    if (record.road === null && after.place.where === "road") record.road = after.turn.month;
    if (record.remote === null && after.activity.job === "activity.job-remote-dev") record.remote = after.turn.month;
    const current = after.status.current?.entry ?? null;
    if (record.settledMonth === null && current !== null && (SETTLED_STATUSES.includes(current) || CITIZEN_STATUSES.includes(current))) record.settledMonth = after.turn.month;
    if (record.departed !== null) {
      for (const mark of ["12", "36", "60"] as const) {
        if (after.turn.month - record.departed === Number(mark)) record.statusAt[mark] = after.place.where === "abroad" ? current : null;
      }
    }
    if (sent.type === "turn/end") {
      sentThisMonth = 0;
      const shown = game.view();
      const good = shown.report?.lines.some((line) => line.tone === "good") ?? false;
      if (good) {
        record.goodMonths += 1;
        dry = 0;
      } else {
        dry += 1;
        record.longestDry = Math.max(record.longestDry, dry);
      }
      const win = shown.report?.lines.some((line) => line.tone === "good" && !ROUTINE_LINES.includes(line.key)) ?? false;
      if (win) {
        record.winMonths += 1;
        noWin = 0;
      } else {
        noWin += 1;
        record.longestNoWin = Math.max(record.longestNoWin, noWin);
      }
      if (isBroke(shown, content)) record.broke += 1;
      if (options.stopWhen?.(game, record) === true) return false;
    } else sentThisMonth += 1;
    return true;
  }
  const end = game.state;
  record.months = end.turn.month;
  record.japacity = end.turn.ended ? null : game.view().japacity.percent;
  record.ending = endingOf(end);
  record.prologue = prologuePath(end);
  record.goalsDone = Object.keys(end.goal.done).length;
  record.chaptersClosed = end.chapter.done.length;
  const country = end.place.country ?? end.place.returns[end.place.returns.length - 1]?.country ?? null;
  record.creditEnd = country === null ? null : (end.credit.byCountry[country]?.mark ?? null);
  return { record, game };
}

function isBroke(view: PlayerView, content: Content): boolean {
  if (view.place.where !== "abroad") return naira(view) < BROKE_BELOW;
  const currency = localCurrency(view, content);
  if (currency === null) return false;
  const pocket = view.pockets[currency];
  return pocket.bank + pocket.cash < monthlyDueIn(view, content, currency);
}
