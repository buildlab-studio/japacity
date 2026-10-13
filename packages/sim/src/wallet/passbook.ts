// The passbook (the design; docs/design/12-the-lived-month-and-the-files.md section 2, item 4): the
// Bank's first page as the simulation works it. The money held for the road against the plan's whole cost, the stamps on
// the way, the pace the last three months kept, and the roads that shorten it, each with what it needs and the months it
// would leave. Every figure is whole kobo at the official rate; the client words them and works none of them out.
import { bookedPay } from "../activity/activity.pay";
import { planOf } from "../chapter/chapter.logic";
import { check, resolveAmount } from "../engine/check";
import { divCeil, divFloor, valueInKobo } from "../engine/int";
import type {
  ActivityEntry,
  Effect,
  ForeignCurrency,
  Id,
  OfferEntry,
  PassbookRoad,
  PassbookRoadKind,
  PassbookView,
  ReadCtx,
  Requirement,
  RouteStateName,
  State,
  TermSpec,
  Terms,
  World,
} from "../engine/types";
import { fundsCurrency, fundsRequired } from "../route/route.logic";
import { CURRENCIES, officialRates } from "./wallet.rates";

/** The street's savings circle (luck.md R-LUCK-009), the road the passbook names as the ajo. */
const AJO_OFFER: Id<"offer"> = "offer.join-ajo";
/** The family's road: the meeting for the master's (offer.md, the pledges), else the family's loan asked for by anyone. */
const FAMILY_ACTS: readonly Id<"activity">[] = ["activity.family-meeting", "activity.ask-family-loan"];
/** A scholarship that lands as money for the way it names (luck.md R-LUCK-010). */
const SCHOLARSHIP_OFFERS: readonly Id<"offer">[] = ["offer.scholarship-round"];
/** How many closed months the pace reads. */
const PACE_MONTHS = 3;

/** The states before an application: the funds still have to be shown on the decision day. */
const BEFORE_APPLYING: readonly RouteStateName[] = ["unknown", "heard", "known"];
/** The states a plan is counted from: its way looked into or further on, so its checklist and its costs are read. */
const UNCOUNTED: readonly RouteStateName[] = ["unknown", "heard"];

function rates(world: World): Record<ForeignCurrency, number> {
  return officialRates(world);
}

/** The money held for the road: every pocket that can pay, bank and cash, in kobo at the official rate. Locked money is the lender's. */
export function heldForRoad(state: State, world: World): number {
  const official = rates(world);
  return CURRENCIES.reduce((sum, currency) => {
    const pocket = state.wallet.pockets[currency];
    return sum + valueInKobo(pocket.bank + pocket.cash, currency, official);
  }, 0);
}

/** True while the passbook stands: at home, the prologue closed, the life going on. */
export function passbookOpen(state: State): boolean {
  return state.place.where === "home" && !state.prologue.open && !state.turn.ended;
}

/** The plan's way once looked into or further on, else null: the passbook counts a cost only once its page is read. */
export function passbookRoute(read: ReadCtx): Id<"route"> | null {
  if (!passbookOpen(read.state)) return null;
  const route = planOf(read.state.route, read.content, read.state.chapter.chosen ?? null);
  if (route === null) return null;
  const held = read.state.route[route];
  return held === undefined || UNCOUNTED.includes(held.state) ? null : route;
}

/** What an act costs now, every price in kobo at the official rate. */
function actCost(read: ReadCtx, entry: ActivityEntry): number {
  const official = rates(read.world);
  return entry.cost.reduce((sum, cost) => sum + valueInKobo(resolveAmount(read, cost.amount), cost.currency, official), 0);
}

/** The papers a way's checklist asks to be held. */
function papersAsked(read: ReadCtx, route: Id<"route">): Id<"document">[] {
  return (read.content.route[route]?.checklist ?? []).flatMap((item) => (item.requirement.type === "document/held" ? [item.requirement.document] : []));
}

/** True when a paper is held or on its way. */
function paperIn(state: State, document: Id<"document">): boolean {
  const held = state.document[document];
  return held !== undefined && (held.state === "held" || held.state === "pending");
}

/**
 * The fees still ahead on a way, in kobo, in every money: each act at home with a price that sends its application or asks
 * for a paper, among the acts that count toward it and those asking for a paper its checklist wants, less what is done
 * (the application sent, the paper held or on its way). An act done over and over (a day's study) is the living, not a fee.
 */
function feesAhead(read: ReadCtx, route: Id<"route">, state: RouteStateName): number {
  const sent = !BEFORE_APPLYING.includes(state);
  const papers = papersAsked(read, route);
  let sum = 0;
  for (const entry of Object.values(read.content.activity)) {
    if (entry === undefined || entry.cost.length === 0 || entry.repeat === true || entry.where === "abroad") continue;
    const applies = entry.effects.some((effect) => effect.type === "route/apply" && effect.route === route);
    const asked = entry.effects.flatMap((effect) => (effect.type === "document/request" ? [effect.document] : []));
    const counts = entry.counts.includes(route) && (applies || asked.length > 0);
    if (!counts && !asked.some((paper) => papers.includes(paper))) continue;
    if (applies && sent) continue;
    if (asked.length > 0 && asked.some((paper) => paperIn(read.state, paper))) continue;
    sum += actCost(read, entry);
  }
  return sum;
}

/**
 * The funds still to show, in kobo: what the decision day asks the bank to show, less what already counts toward it and is
 * not the character's to spend (locked money and the family's support). Nothing once the application is sent.
 */
function fundsToShow(read: ReadCtx, route: Id<"route">, state: RouteStateName): number {
  if (!BEFORE_APPLYING.includes(state)) return 0;
  const official = rates(read.world);
  const need = valueInKobo(fundsRequired(read, route), fundsCurrency(read, route), official);
  if (need === 0) return 0;
  const locked = CURRENCIES.reduce((sum, currency) => sum + valueInKobo(read.state.wallet.pockets[currency].locked, currency, official), 0);
  const support = read.state.route[route]?.support ?? null;
  const backed = support === null ? 0 : valueInKobo(support.amount, support.currency, official);
  return Math.max(0, need - locked - backed);
}

/** The flight, in kobo, unless the employer pays it or it is flown. */
function flightOf(read: ReadCtx, route: Id<"route">, state: RouteStateName): number {
  const entry = read.content.route[route];
  if (entry === undefined || entry.flightPaidByEmployer || state === "departed") return 0;
  const { flight } = read.content.tuning.route;
  return valueInKobo(resolveAmount(read, flight.amount), flight.currency, rates(read.world));
}

/** The plan's whole cost: the funds still to show, the fees ahead, the flight. Null with no plan to count. */
export function roadTarget(read: ReadCtx): PassbookView["target"] {
  const route = passbookRoute(read);
  if (route === null) return null;
  const state = read.state.route[route]?.state ?? "unknown";
  const funds = fundsToShow(read, route, state);
  const fees = feesAhead(read, route, state);
  const flight = flightOf(read, route, state);
  const total = funds + fees + flight;
  return total === 0 ? null : { route, total, funds, fees, flight };
}

/** What the last closed months kept for the road, a month, rounded down; null before any closed. */
export function paceOf(state: State): number | null {
  const nets = state.wallet.nets ?? [];
  if (nets.length === 0) return null;
  return divFloor(
    nets.reduce((sum, net) => sum + net, 0),
    nets.length,
  );
}

/** The nets kept after one more month closes: the last three, oldest first. */
export function netsAfter(nets: readonly number[] | undefined, kept: number): number[] {
  return [...(nets ?? []), kept].slice(-PACE_MONTHS);
}

/** Whole months to close `gap` at `rate` a month after `lump` at once: 0 when the lump covers it, null when nothing closes it. */
function monthsTo(gap: number, rate: number, lump: number): number | null {
  const left = gap - lump;
  if (left <= 0) return 0;
  return rate <= 0 ? null : divCeil(left, rate);
}

/** A job's month as the wallet books it, in kobo at the official rate; 0 when it pays nothing that can be read. */
function payKobo(read: ReadCtx, entry: ActivityEntry, held: boolean): number {
  const pay = held ? bookedPay(read, entry) : bookedPay(read, entry, {});
  return pay === null ? 0 : valueInKobo(pay.amount, pay.currency, rates(read.world));
}

function unmetOf(read: ReadCtx, requirements: readonly Requirement[]): Requirement[] {
  return requirements.filter((requirement) => !check(read, requirement).met);
}

/** The jobs at home a life may hunt: main work, paid, never abroad. */
function homeJobs(read: ReadCtx, slot: "main" | "side"): ActivityEntry[] {
  return Object.values(read.content.activity).filter((entry): entry is ActivityEntry => entry !== undefined && entry.slot === slot && entry.pay !== null && entry.where !== "abroad");
}

/** The candidate of a list the life is nearest to: every requirement met first, then the fewest unmet, then the best pay. */
function nearest(read: ReadCtx, entries: readonly ActivityEntry[], pay: (entry: ActivityEntry) => number): ActivityEntry | null {
  const ranked = entries
    .map((entry) => ({ entry, unmet: unmetOf(read, entry.requires).length, pay: pay(entry) }))
    .sort((a, b) => a.unmet - b.unmet || b.pay - a.pay || (a.entry.id < b.entry.id ? -1 : 1));
  return ranked[0]?.entry ?? null;
}

type RoadDraft = Omit<PassbookRoad, "months">;

/**
 * The ladder's next rung: a job at home whose tenure asks for months in the job held, paying more, the lowest of them; with
 * none, the job paying more that the life is nearest to. With no job, the job the life is nearest to.
 */
function ladderRoad(read: ReadCtx): RoadDraft | null {
  const heldId = read.state.activity.job;
  const held = heldId === null ? undefined : read.content.activity[heldId];
  const jobs = homeJobs(read, "main").filter((entry) => entry.id !== heldId);
  const heldPay = held === undefined ? 0 : payKobo(read, held, true);
  const pay = (entry: ActivityEntry) => payKobo(read, entry, false);
  let rung: ActivityEntry | null;
  if (held === undefined) rung = nearest(read, jobs, pay);
  else {
    const better = jobs.filter((entry) => pay(entry) > heldPay);
    const rungs = better.filter((entry) => entry.requires.some((requirement) => requirement.type === "activity/tenure" && requirement.activities.includes(held.id))).sort((a, b) => pay(a) - pay(b));
    rung = rungs[0] ?? nearest(read, better, pay);
  }
  if (rung === null) return null;
  const needs = unmetOf(read, rung.requires);
  return { road: "ladder", via: rung.id, state: needs.length === 0 ? "open" : "shut", needs, offer: null, monthly: Math.max(0, pay(rung) - heldPay), lump: 0 };
}

/** A side job (R-ACTIVITY-010): the one held, else the best-paying the life can hunt now, else the one it is nearest to. */
function sideRoad(read: ReadCtx): RoadDraft | null {
  const heldId = read.state.activity.side;
  const held = heldId === null ? undefined : read.content.activity[heldId];
  if (held !== undefined) return { road: "side", via: held.id, state: "taken", needs: [], offer: null, monthly: payKobo(read, held, false), lump: 0 };
  const side = nearest(read, homeJobs(read, "side"), (entry) => payKobo(read, entry, false));
  if (side === null) return null;
  const needs = unmetOf(read, side.requires);
  return { road: "side", via: side.id, state: needs.length === 0 ? "open" : "shut", needs, offer: null, monthly: payKobo(read, side, false), lump: 0 };
}

/** An offer's instance standing open now, or null. */
function openOffer(state: State, entry: Id<"offer">): string | null {
  return Object.entries(state.offer.items).find(([, item]) => item.entry === entry)?.[0] ?? null;
}

/** What an offer's `when` still asks, leaving out the guards that only keep it from coming twice. */
function offerNeeds(read: ReadCtx, entry: OfferEntry): Requirement[] {
  return unmetOf(read, entry.when.filter((requirement) => requirement.type !== "not"));
}

/**
 * The street's circle (R-LUCK-009): in it while its circle runs, open while the street's ask stands, else waiting on what it
 * asks and on the street to ask. Its pot is what was paid in, so it moves no month of the pace: the win is the timing.
 */
function ajoRoad(read: ReadCtx): RoadDraft | null {
  const entry = read.content.offer[AJO_OFFER];
  if (entry === undefined) return null;
  const inCircle = Object.values(read.state.obligation.items).some((item) => read.content.obligation[item.entry]?.type === "ajo");
  if (inCircle) return { road: "ajo", via: AJO_OFFER, state: "taken", needs: [], offer: null, monthly: 0, lump: 0 };
  const offer = openOffer(read.state, AJO_OFFER);
  return { road: "ajo", via: AJO_OFFER, state: offer === null ? "shut" : "open", needs: offer === null ? offerNeeds(read, entry) : [], offer, monthly: 0, lump: 0 };
}

/** A term as the offer will roll it, where it can be read before: a figure, or a quality times a figure; a range at its least. */
function termValue(read: ReadCtx, spec: TermSpec): number {
  if (typeof spec === "number") return spec;
  switch (spec.from) {
    case "quality":
      return (read.state.quality[spec.quality] ?? 0) * spec.times;
    case "range":
      return spec.min;
    case "pay":
      return 0;
    default: {
      const never: never = spec;
      throw new Error(`Unknown term ${JSON.stringify(never)}.`);
    }
  }
}

/** The terms an offer would come with: its instance's own while it stands, else read from content. */
function termsOf(read: ReadCtx, entry: OfferEntry, instance: string | null): Terms {
  const standing = instance === null ? undefined : read.state.offer.items[instance];
  if (standing !== undefined) return standing.terms;
  return Object.fromEntries(Object.entries(entry.terms).map(([name, spec]) => [name, termValue(read, spec)]));
}

/** What taking an offer brings toward the target at once, in kobo: money in, and support counted toward the plan's funds, at most the funds. */
function offerLump(read: ReadCtx, entry: OfferEntry, instance: string | null, route: Id<"route"> | null, funds: number): number {
  const terms = termsOf(read, entry, instance);
  const official = rates(read.world);
  const take = entry.choices.find((choice) => choice.effects.some((effect) => effect.type === "money/add" || effect.type === "route/support"));
  let money = 0;
  let backed = 0;
  for (const effect of take?.effects ?? ([] as Effect[])) {
    if (effect.type === "money/add") money += valueInKobo(resolveAmount(read, effect.amount, terms), effect.currency, official);
    if (effect.type === "route/support" && effect.route === route) backed += valueInKobo(resolveAmount(read, effect.amount, terms), effect.currency, official);
  }
  return money + Math.min(backed, funds);
}

/** The offers an act opens. */
function opensOffers(entry: ActivityEntry): Id<"offer">[] {
  return entry.effects.flatMap((effect) => (effect.type === "offer/open" ? [effect.offer] : []));
}

/**
 * The family's road: the act the family is asked by (the meeting for the master's, the loan for anyone), the first of them
 * that counts toward the plan or toward no way at all. Open while its ask stands, or while the act can be done; the lump is
 * what the offer it opens would bring.
 */
function familyRoad(read: ReadCtx, route: Id<"route"> | null, funds: number): RoadDraft | null {
  const act = FAMILY_ACTS.map((id) => read.content.activity[id]).find((entry): entry is ActivityEntry => entry !== undefined && (entry.counts.length === 0 || (route !== null && entry.counts.includes(route))));
  if (act === undefined) return null;
  const offers = opensOffers(act).flatMap((id) => {
    const entry = read.content.offer[id];
    return entry === undefined ? [] : [{ id, entry, instance: openOffer(read.state, id) }];
  });
  const standing = offers.find((offer) => offer.instance !== null);
  if (standing !== undefined) return { road: "family", via: standing.id, state: "open", needs: [], offer: standing.instance, monthly: 0, lump: offerLump(read, standing.entry, standing.instance, route, funds) };
  // The ask the act would open: the first whose own bar the life meets now, else the first.
  const asked = offers.find((offer) => unmetOf(read, offer.entry.when).length === 0) ?? offers[0];
  const needs = unmetOf(read, act.requires);
  return { road: "family", via: act.id, state: needs.length === 0 && asked !== undefined ? "open" : "shut", needs, offer: null, monthly: 0, lump: asked === undefined ? 0 : offerLump(read, asked.entry, null, route, funds) };
}

/** A scholarship for the plan's way (luck.md R-LUCK-010): open while its offer stands, else waiting on what it asks and on the round. */
function scholarshipRoad(read: ReadCtx, route: Id<"route"> | null, funds: number): RoadDraft | null {
  if (route === null) return null;
  for (const id of SCHOLARSHIP_OFFERS) {
    const entry = read.content.offer[id];
    if (entry === undefined) continue;
    const forRoute = entry.when.some((requirement) => (requirement.type === "route/state" || requirement.type === "route/offer") && requirement.route === route);
    if (!forRoute) continue;
    const offer = openOffer(read.state, id);
    return { road: "scholarship", via: id, state: offer === null ? "shut" : "open", needs: offer === null ? offerNeeds(read, entry) : [], offer, monthly: 0, lump: offerLump(read, entry, offer, route, funds) };
  }
  return null;
}

/** The passbook, as the view carries it. Null away from home, in the prologue, or once the life has ended. */
export function passbookView(read: ReadCtx): PassbookView | null {
  if (!passbookOpen(read.state)) return null;
  const held = heldForRoad(read.state, read.world);
  const target = roadTarget(read);
  const pace = paceOf(read.state);
  const gap = target === null ? null : target.total - held;
  const atPace = gap === null ? null : monthsTo(gap, pace ?? 0, 0);
  const route = target?.route ?? null;
  const funds = target?.funds ?? 0;
  const drafts = [ladderRoad(read), sideRoad(read), ajoRoad(read), familyRoad(read, route, funds), scholarshipRoad(read, route, funds)].filter((road): road is RoadDraft => road !== null);
  const roads: PassbookRoad[] = drafts.map((road) => ({
    ...road,
    // A road held is in the pace already.
    months: gap === null ? null : road.state === "taken" ? atPace : monthsTo(gap, (pace ?? 0) + road.monthly, road.lump),
  }));
  let best: PassbookRoadKind | null = null;
  let soonest = atPace;
  for (const road of roads) {
    if (road.state === "taken" || road.months === null) continue;
    if (soonest === null || road.months < soonest) {
      best = road.road;
      soonest = road.months;
    }
  }
  const reached = read.state.wallet.stamps ?? [];
  const fixed = read.content.tuning.wallet.stamps.flatMap((at) => {
    const stamp = reached.find((each) => each.target !== true && each.at === at);
    // A fixed stamp past the road's own figure is no milestone on the way, unless it was reached.
    if (stamp === undefined && target !== null && at >= target.total) return [];
    return [{ at, month: stamp?.month ?? null, target: false }];
  });
  const ready = reached.find((each) => each.target === true);
  const last = ready !== undefined ? [{ at: ready.at, month: ready.month, target: true }] : target === null ? [] : [{ at: target.total, month: null, target: true }];
  const stamps = [...fixed, ...last].sort((a, b) => a.at - b.at || Number(a.target) - Number(b.target));
  return { held, target, stamps, pace, months: atPace, roads, best };
}
