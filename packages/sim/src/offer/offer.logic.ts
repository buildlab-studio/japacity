// Offers: docs/rules/offer.md. Anything that comes to the character with
// choices and a date: a family request, a job, a loan, a man who says he can
// arrange things. Whether an offer is a fraud is fixed when it opens and kept
// in `secret`, which the view never carries (offer:fraud-hidden-signs-shown, engine:view-holds-no-hidden-field).
import { check, checkWith, resolveAmount, worldVar } from "../engine/check";
import { QUALITY } from "../engine/ids";
import { BP_WHOLE, bp, clamp, divFloor, valueInKobo } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit, oldestFirst, readOf } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  Cause,
  Command,
  Content,
  Ctx,
  Currency,
  Effect,
  ForeignCurrency,
  Id,
  OfferChoice,
  OfferEntry,
  OfferSlice,
  OfferState,
  OfferView,
  ReadCtx,
  Rejection,
  RejectionCode,
  ReportLine,
  Requirement,
  RequirementResult,
  State,
  TermSpec,
  Terms,
} from "../engine/types";
import { bookedPay, monthlyPay } from "../activity/activity.pay";
import { routePercent } from "../japacity/japacity.logic";
import { healthComeUp, isOpen } from "./offer.health";
import { appliesHere } from "../place/place.logic";
import { evictedThisMonth } from "../home/home.logic";
import type { OfferEvent } from "./offer.events";
import { luckTerms, markedChanceBp, rescueDue, WHIP_ROUND } from "./offer.luck";
import { bridgeTerms } from "./offer.street";
import { birthdayMonth, PARCEL, parcelHolds, parcelTerms } from "./offer.parcel";
import { HASTEN_TERM } from "../document/document.logic";
import type { AgentKind, Look, Pitch } from "./offer.agent";
import { handedTerms, inFamily, isLook, kindOf, lookFinds, openAgent, paperToMove, pitchMonths, PROMISE, shownTerms, standsAsAgent, tellsSeen } from "./offer.agent";
import { officialRates } from "../wallet/wallet.rates";

/**
 * The groups that are rolled, in the order offer:come-up-rolls-in-order takes them. `job` is
 * never rolled. Life abroad and coming home follow family; the road comes last
 * (road:pitch-rises-with-pressure).
 */
const ROLL_ORDER: readonly OfferEntry["group"][] = ["money", "life", "family", "abroad", "return", "road"];

/** Offers whose chance a month adds a world variable the director moves (director.md, the sponsor story). */
const CHANCE_VARS: Partial<Record<Id<"offer">, Id<"var">>> = { "offer.sponsor-licence-lost": "var.uk-care-sponsor-risk" };

/** Judges one requirement with the terms in hand. Inside a step it is `ctx.check`; outside, the engine's `check`. */
type Judge = (requirement: Requirement, terms: Terms) => RequirementResult;

function entryOf(content: Content, id: Id<"offer">): OfferEntry {
  const entry = content.offer[id];
  if (entry === undefined) throw new Error(`There is no offer ${id} in content.`);
  return entry;
}

function record(ctx: Ctx, event: OfferEvent): BaseEvent[] {
  return emit(ctx, "offer", [event]);
}

function openItems(state: State): OfferState[] {
  return Object.values(state.offer.items).sort(oldestFirst);
}

function roadGroup(read: ReadCtx, item: OfferState): boolean {
  return entryOf(read.content, item.entry).group === "road";
}

function reachedLimit(state: State, entry: OfferEntry): boolean {
  return entry.maxTimes !== null && (state.offer.timesOpened[entry.id] ?? 0) >= entry.maxTimes;
}

// ---------------------------------------------------------------------------
// Terms: offer:opening-fixes-terms-and-fraud
// ---------------------------------------------------------------------------

/**
 * The monthly pay of the job held, in naira kobo: the month the activity kind
 * pays, from the job's own terms (a job paid a year pays it over twelve, and a
 * salary no route has recorded pays nothing). A pay in another currency is
 * valued at the official rate.
 */
function payInNaira(read: ReadCtx): number {
  const job = read.state.activity.job;
  const entry = job === null ? undefined : read.content.activity[job];
  const pay = entry === undefined ? null : monthlyPay(read, entry);
  if (pay === null) return 0;
  if (pay.currency === "NGN") return pay.amount;
  return valueInKobo(pay.amount, pay.currency, officialRates(read.world));
}

function fixTerm(ctx: Ctx, spec: TermSpec): number {
  if (typeof spec === "number") return spec;
  switch (spec.from) {
    case "range": {
      // One draw in whole steps, both ends included.
      const steps = divFloor(spec.max - spec.min, spec.step);
      return spec.min + spec.step * ctx.random.between("offer", 0, steps);
    }
    case "quality":
      return (ctx.state.quality[spec.quality] ?? 0) * spec.times;
    case "pay":
      return Math.min(spec.cap, payInNaira(readOf(ctx)) * spec.times);
    default: {
      const never: never = spec;
      throw new Error(`Unknown term ${JSON.stringify(never)}.`);
    }
  }
}

/**
 * abroad-money:family-asks-more-abroad: the family expects more once a relative is abroad. A request
 * names what it asks in its terms, and every term a `money/take` of its
 * choices reads is scaled by the factor when it opens abroad, so the view, the
 * check that it can be paid and the payment all read the same figure.
 */
function scaleAsked(entry: OfferEntry, terms: Terms, factorBp: number): void {
  const asked = new Set<string>();
  for (const choice of entry.choices) {
    for (const effect of [...choice.effects, ...(choice.fraudEffects ?? [])]) {
      if (effect.type === "money/take" && typeof effect.amount === "object" && "term" in effect.amount) asked.add(effect.amount.term);
    }
  }
  // Each term once, however many choices read it.
  for (const name of asked) {
    const value = terms[name];
    if (typeof value === "number") terms[name] = bp(value, factorBp);
  }
}

/**
 * Opens an offer (offer:opening-fixes-terms-and-fraud): terms, expiry, the hidden fraud on the `fraud`
 * stream, then each sign on the `offer` stream by the chance for what the
 * offer really is. `extra` terms come with the effect that opened it
 * (offer:effect-opens-named-offer) and are added to the offer's own.
 */
function openOffer(ctx: Ctx, entry: OfferEntry, extra: Terms, rolled = false): BaseEvent[] {
  const own: Terms = {};
  for (const [name, spec] of Object.entries(entry.terms)) own[name] = fixTerm(ctx, spec);
  // advice:agent-kind-drawn-on-offer, advice:scams-show-their-tells: an agent's kind, fee and tells; offer:fraud-hidden-signs-shown's draws do not apply.
  if (standsAsAgent(entry)) return record(ctx, { type: "offer/opened", item: openAgent(ctx, entry, own, extra) });
  if (entry.group === "family" && ctx.state.place.where === "abroad") scaleAsked(entry, own, ctx.content.tuning.remit.abroadBp);
  const fraud = ctx.random.chance("fraud", entry.fraudBp);
  const signs = entry.signs.filter((sign) => ctx.random.chance("offer", fraud ? sign.fraudBp : sign.honestBp)).map((sign) => sign.key);
  // streets:sleeping-under-the-bridge: the theft takes the cash as it opens, so this comes before the offer is recorded.
  const bridge = bridgeTerms(ctx, entry);
  // Things shipped home: who sent it and the thing in it, drawn on `offer`.
  const parcel = parcelTerms(readOf(ctx), ctx.random, entry);
  const month = ctx.state.turn.month;
  const item: OfferState = {
    id: ctx.nextId("offer"),
    entry: entry.id,
    openedMonth: month,
    expiresMonth: month + entry.expiresAfter,
    // A term handed over by the effect wins over one of the same name. None clash in content.
    // A luck offer's payment is read from the tuning as a term (luck:whip-round-once-per-life, luck:telco-promo-may-be-fraud).
    terms: { ...own, ...luckTerms(readOf(ctx), entry.id), ...bridge, ...parcel, ...extra },
    signs,
    secret: { fraud },
  };
  return record(ctx, rolled ? { type: "offer/opened", item, rolled: true } : { type: "offer/opened", item });
}

// ---------------------------------------------------------------------------
// Whether a choice can be taken: offer:choice-needs-conditions-and-funds
// ---------------------------------------------------------------------------

interface Problem {
  code: RejectionCode;
  detail: string;
}

/** The two ends of a choice's amount, read from the offer's terms. */
function pickRange(item: OfferState, choice: OfferChoice): { min: number; max: number } | null {
  if (choice.pick === null) return null;
  const min = item.terms[choice.pick.minTerm];
  const max = item.terms[choice.pick.maxTerm];
  if (typeof min !== "number" || typeof max !== "number") {
    throw new Error(`${item.entry}.${choice.id} picks between ${choice.pick.minTerm} and ${choice.pick.maxTerm}, which are not number terms.`);
  }
  return { min, max };
}

/** The terms the choice's effects read: the offer's own, plus the amount picked. */
function choiceTerms(item: OfferState, amount: number | null): Terms {
  return amount === null ? item.terms : { ...item.terms, amount };
}

function add(totals: Map<string, number>, key: string, amount: number): void {
  totals.set(key, (totals.get(key) ?? 0) + amount);
}

/**
 * True when every debit among the effects could be paid now.
 * `money/can-pay`, which counts cash and bank together, judges `any` debits
 * and foreign fees. A debit that names one pocket is judged with `money/min`
 * on that pocket, or the agent's cash-only fee could pass with the money in
 * the bank and then not be taken. Debits from one pocket are added up, so two that could each be paid alone but not together
 * do not pass. A debit named for cash or the bank is judged against that
 * pocket alone, since the wallet takes it from nowhere else.
 */
function debitsPayable(read: ReadCtx, judge: Judge, effects: readonly Effect[], terms: Terms): boolean {
  const named = new Map<string, number>();
  const spendable = new Map<Currency, number>();
  const fees = new Map<ForeignCurrency, number>();
  for (const effect of effects) {
    if (effect.type === "money/take") {
      const amount = resolveAmount(read, effect.amount, terms);
      add(named, `${effect.currency}/${effect.pocket}`, amount);
      // Cash and bank debits also come out of what cash and bank hold together.
      if (effect.pocket !== "locked") spendable.set(effect.currency, (spendable.get(effect.currency) ?? 0) + amount);
    }
    if (effect.type === "money/pay-fee") fees.set(effect.currency, (fees.get(effect.currency) ?? 0) + resolveAmount(read, effect.amount, terms));
  }
  for (const [key, amount] of named) {
    const [currency, pocket] = key.split("/") as [Currency, "bank" | "cash" | "any" | "locked"];
    if (pocket === "locked" && read.state.wallet.pockets[currency].locked < amount) return false;
    if ((pocket === "bank" || pocket === "cash") && !judge({ type: "money/min", currency, amount, pocket }, terms).met) return false;
  }
  for (const [currency, amount] of spendable) {
    const requirement: Requirement = currency === "NGN" ? { type: "money/can-pay", currency, amount } : { type: "money/min", currency, amount };
    if (!judge(requirement, terms).met) return false;
  }
  for (const [currency, amount] of fees) {
    if (!judge({ type: "money/can-pay", currency, amount }, terms).met) return false;
  }
  return true;
}

/**
 * Why a choice may not be taken with this amount, or null when it may. The
 * amount comes first because the conditions and debits read it. The
 * debits are judged on the ordinary effects, never the fraud ones, so whether
 * a choice is allowed never gives a fraud away (offer:fraud-hidden-signs-shown).
 */
function choiceProblem(read: ReadCtx, judge: Judge, item: OfferState, choice: OfferChoice, amount: unknown): Problem | null {
  const range = pickRange(item, choice);
  let picked: number | null = null;
  if (range !== null) {
    if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < range.min || amount > range.max) {
      return { code: "bad-amount", detail: `Pick a whole amount from ${String(range.min)} to ${String(range.max)}.` };
    }
    picked = amount;
  }
  const terms = choiceTerms(item, picked);
  if (!choice.requires.every((requirement) => judge(requirement, terms).met)) {
    return { code: "not-legal", detail: `The conditions for ${choice.id} do not hold.` };
  }
  if (!parcelHolds(item, choice)) return { code: "not-legal", detail: `The parcel does not hold ${choice.id}.` };
  if (!debitsPayable(read, judge, choice.effects, terms)) return { code: "cannot-afford", detail: `${choice.id} cannot be paid now.` };
  if (inFamily(item.entry) && !floorKept(read, judge, choice.effects, terms)) {
    return { code: "cannot-afford", detail: `${choice.id} would take the last of the cash an agent may never take.` };
  }
  if (isLook(choice.id) && item.signs.includes(choice.id)) return { code: "not-legal", detail: `${choice.id} is already done.` };
  return null;
}

/**
 * advice:agent-loss-is-the-fee: an agent's fee never takes the last `floorNaira` of the naira. The naira the choice
 * takes (cash first, then the bank, decision 0014) must leave the floor behind in cash and bank together.
 */
function floorKept(read: ReadCtx, judge: Judge, effects: readonly Effect[], terms: Terms): boolean {
  let taken = 0;
  for (const effect of effects) {
    if (effect.type === "money/take" && effect.currency === "NGN" && (effect.pocket === "cash" || effect.pocket === "any")) taken += resolveAmount(read, effect.amount, terms);
  }
  if (taken === 0) return true;
  return judge({ type: "money/min", currency: "NGN", amount: taken + read.content.tuning.advice.floorNaira }, terms).met;
}

/** Carries out a choice (offer:choice-needs-conditions-and-funds, offer:fraud-effects-replace-ordinary). The source names the offer and the choice. */
function takeChoice(ctx: Ctx, item: OfferState, choice: OfferChoice, amount: number | null): void {
  const effects = item.secret.fraud && choice.fraudEffects !== null ? choice.fraudEffects : choice.effects;
  const cause: Cause = { source: `${item.entry}.${choice.id}`, param: null, terms: { ...choiceTerms(item, amount), ...roadKind(ctx, item, choice) } };
  ctx.apply(effects, cause);
}

/** The agent's choice that pays him (advice:agent-kind-drawn-on-offer). */
const TAKE = "take";

/** advice:chaser-runs-around-cheaper: what an honest agent does for his fee; the others do nothing for it. */
function honestWork(kind: AgentKind): Pitch | null {
  switch (kind) {
    case "fixer":
      return "insider";
    case "chaser":
      return "chaser";
    case "overpromiser":
    case "scammer":
      return null;
    default: {
      const never: never = kind;
      throw new Error(`Unknown agent kind ${String(never)}.`);
    }
  }
}

/**
 * advice:agent-kind-drawn-on-offer, advice:chaser-runs-around-cheaper, after the fee: a fixer brings the next paper forward by
 * his months, a chaser the next paper she follows up by hers, an overpromiser
 * leaves his promise on the table, a scammer's fake papers come from the
 * content's fraud effects. The next appointment (a school's answer, a visa
 * decision) has no effect to move it, so only a paper moves.
 */
function agentPaid(ctx: Ctx, item: OfferState): BaseEvent[] {
  const kind: AgentKind = kindOf(item);
  const cause: Cause = { source: `${item.entry}.${TAKE}`, param: null, terms: {} };
  const work = honestWork(kind);
  const paper = work === null ? null : paperToMove(ctx.state, ctx.content, work);
  const fee = typeof item.terms["fee"] === "number" ? item.terms["fee"] : 0;
  const agent = typeof item.terms["agent"] === "string" ? item.terms["agent"] : item.entry;
  const events = record(ctx, { type: "offer/agent-paid", id: item.id, entry: item.entry, kind, agent, fee, seen: tellsSeen(item), paper });
  if (paper !== null && work !== null) ctx.apply([{ type: "document/request", document: paper }], { ...cause, terms: { [HASTEN_TERM]: pitchMonths(work, ctx.content.tuning.advice) } });
  if (kind === "overpromiser") ctx.apply([{ type: "offer/open", offer: PROMISE }], { ...cause, terms: { agent } });
  return events;
}

/** advice:scams-show-their-tells: a look costs nothing and finds every tell it would find. The offer stays open. */
function look(ctx: Ctx, item: OfferState, choice: Look): BaseEvent[] {
  const found = lookFinds(entryOf(ctx.content, item.entry), item, choice, ctx.content.tuning.advice);
  return record(ctx, { type: "offer/looked", id: item.id, entry: item.entry, look: choice, found });
}

/**
 * road:taking-pitch-pays-deposit: taking a pitch decides, hidden, what it really is. The fraud
 * share is the offer's own fraud, drawn when it opened so its signs follow it
 * (offer:fraud-hidden-signs-shown); taking an honest one splits the rest between real-ish and
 * the road by the entry's `kinds`, one draw on `road`, handed on as the term
 * `kind`. Only a choice with fraud effects is a take.
 */
function roadKind(ctx: Ctx, item: OfferState, choice: OfferChoice): Terms {
  const kinds = entryOf(ctx.content, item.entry).kinds;
  if (kinds === undefined || choice.fraudEffects === null || item.secret.fraud) return {};
  return { kind: ctx.random.int("road", kinds.realish + kinds.road) < kinds.realish ? "realish" : "road" };
}

const judgeIn =
  (ctx: Ctx): Judge =>
  (requirement, terms) =>
    ctx.check(requirement, terms);

// ---------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------

function choose(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "offer/choose") throw new Error(`offer/choose cannot handle ${command.type}.`);
  // person:stand-in-acts-narrowly: a stand-in never spends.
  if (ctx.sender === "stand-in") return reject("not-legal", "A stand-in never spends.");
  // A name the player sent may be a built-in object key; only the slice's own items are offers.
  const item = typeof command.offer === "string" && Object.hasOwn(ctx.state.offer.items, command.offer) ? ctx.state.offer.items[command.offer] : undefined;
  if (item === undefined) return reject("unknown-id", `There is no open offer ${String(command.offer)}.`);
  const choice = entryOf(ctx.content, item.entry).choices.find((candidate) => candidate.id === command.choice);
  if (choice === undefined) return reject("not-legal", `${item.entry} has no choice ${String(command.choice)}.`);
  const problem = choiceProblem(readOf(ctx), judgeIn(ctx), item, choice, command.amount);
  if (problem !== null) return reject(problem.code, problem.detail);
  if (inFamily(item.entry) && isLook(choice.id)) return look(ctx, item, choice.id);
  // advice:agent-kind-drawn-on-offer: waiting on a promise changes nothing and keeps it open; the month passing tells the rest.
  if (item.entry === PROMISE && choice.id === "wait") return [];
  takeChoice(ctx, item, choice, choice.pick === null ? null : (command.amount ?? null));
  const paid = standsAsAgent(entryOf(ctx.content, item.entry)) && choice.id === TAKE ? agentPaid(ctx, item) : [];
  return [...paid, ...record(ctx, { type: "offer/taken", id: item.id, entry: item.entry, choice: choice.id })];
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/**
 * offer:lapsed-offer-removed: an offer whose month has come is removed. Its lapse choice is
 * applied first if it can be taken. A choice that asks for an amount has none
 * to lapse with, so it is never applied.
 */
function expire(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  for (const id of openItems(ctx.state).map((item) => item.id)) {
    const item = ctx.state.offer.items[id];
    if (item === undefined || item.expiresMonth > ctx.state.turn.month) continue;
    const entry = entryOf(ctx.content, item.entry);
    const choice = entry.onExpire === null ? undefined : entry.choices.find((candidate) => candidate.id === entry.onExpire);
    let applied: string | null = null;
    // advice:agent-kind-drawn-on-offer: the overpromiser's month has come and nothing moved.
    if (item.entry === PROMISE) {
      const agent = typeof item.terms["agent"] === "string" ? item.terms["agent"] : item.entry;
      events.push(...record(ctx, { type: "offer/promise-broken", id: item.id, agent, month: item.expiresMonth }));
    }
    // "Can be taken" means what offer/choose would accept: its conditions hold and its debits can be paid.
    if (choice !== undefined && choice.pick === null && choiceProblem(readOf(ctx), judgeIn(ctx), item, choice, undefined) === null) {
      takeChoice(ctx, item, choice, null);
      applied = choice.id;
    }
    events.push(...record(ctx, { type: "offer/lapsed", id: item.id, entry: item.entry, choice: applied }));
  }
  return events;
}

/** The entries rolled each month, in the order offer:come-up-rolls-in-order takes them. */
export function rollOrder(content: Content): OfferEntry[] {
  return ROLL_ORDER.flatMap((group) =>
    Object.values(content.offer)
      .filter((entry) => entry.group === group && (entry.chanceBp > 0 || CHANCE_VARS[entry.id] !== undefined))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  );
}

/** road:road-route-has-no-figure: the content switch turns the road's whole pool off. */
function switchedOff(content: Content, entry: OfferEntry): boolean {
  return entry.group === "road" && !content.tuning.road.enabled;
}

const MONTHS_A_YEAR = 12;

/** road:pitch-rises-with-pressure: the pitch's chance with the character's situation, between 0 and 10000. */
export function pressureChanceBp(read: ReadCtx, entry: OfferEntry, judge: (requirement: Requirement) => RequirementResult): number {
  const pressure = entry.pressure;
  if (pressure === undefined) return entry.chanceBp;
  const { state, content } = read;
  const refusals = Object.values(state.route).reduce((sum, held) => sum + held.refusals, 0);
  const defaulted = Object.values(state.obligation.items).some((item) => item.state === "defaulted");
  const standing = state.quality[QUALITY.standing] ?? 0;
  const lines = content.tuning.road;
  const yearsOver = Math.max(0, divFloor(state.quality[QUALITY.age] ?? 0, MONTHS_A_YEAR) - lines.pressureAgeOver);
  const strong = Object.values(content.route).some((route) => route.gate !== "road" && (routePercent(read, route.id, judge) ?? 0) >= lines.pressureStrongRoute);
  const chance =
    entry.chanceBp +
    pressure.refusalBp * refusals +
    (defaulted ? pressure.defaultBp : 0) +
    (standing < lines.pressureStandingUnder ? pressure.lowStandingBp : 0) +
    pressure.perYearOver30Bp * yearsOver -
    (strong ? pressure.strongRouteBp : 0);
  return clamp(chance, 0, BP_WHOLE);
}

/**
 * return:returnee-offers-for-a-year: the returnee group is in the pool for the tuning's months
 * after the last return, and its entries' `when` is judged against that
 * return alone. The record is narrowed to the last return for the
 * judging, so `place/returned` in such a `when` reads the shape of the last
 * return, not of any earlier one. Null: outside the window.
 */
function lastReturnRead(ctx: Ctx): ReadCtx | null {
  const { place, turn } = ctx.state;
  const last = place.returns[place.returns.length - 1];
  if (last === undefined || turn.month - last.month > ctx.content.tuning.return.offerMonths) return null;
  return { state: { ...ctx.state, place: { ...place, returns: [last] } }, world: ctx.world, content: ctx.content };
}

/** An entry's conditions: where it applies (place:entries-legal-by-where), then its `when`, the returnee group's against the last return. */
function conditionsHold(ctx: Ctx, entry: OfferEntry, terms: Terms): boolean {
  if (!appliesHere(entry, ctx.state)) return false;
  if (entry.group !== "return") return entry.when.every((requirement) => ctx.check(requirement, terms).met);
  const read = lastReturnRead(ctx);
  return read !== null && entry.when.every((requirement) => checkWith(read, requirement, terms).met);
}

/** Whether an entry is rolled this month (offer:come-up-rolls-in-order): conditions, not open, cooldown passed, under its limit. */
function mayRoll(ctx: Ctx, entry: OfferEntry): boolean {
  if (switchedOff(ctx.content, entry)) return false;
  // road:road-truth-asks-more: on the road the month is the chain's own; nothing from home reaches it.
  if (ctx.state.place.where === "road" && entry.group !== "road") return false;
  if (isOpen(ctx.state, entry.id) || reachedLimit(ctx.state, entry)) return false;
  const last = ctx.state.offer.lastOpened[entry.id];
  if (last !== undefined && ctx.state.turn.month - last < entry.cooldown) return false;
  return conditionsHold(ctx, entry, {});
}

/** The chance an entry rolls at this month: the road's pressure, then the luck marks and the dry spell (luck:no-kicking-while-down, luck:dry-spell-raises-luck). */
function rollChanceBp(ctx: Ctx, entry: OfferEntry): number {
  const read = readOf(ctx);
  const risk = CHANCE_VARS[entry.id];
  const added = risk === undefined ? 0 : worldVar(read, risk);
  return markedChanceBp(read, entry, clamp(pressureChanceBp(read, entry, (requirement) => ctx.check(requirement)) + added, 0, BP_WHOLE));
}

/**
 * luck:whip-round-once-per-life: the whip-round is opened by its rule, never rolled, after the
 * month's rolls so it moves none of them. It respects its entry's place, its
 * `when` and its limit of one, and none of the monthly limits.
 */
function whipRound(ctx: Ctx): BaseEvent[] {
  const entry = ctx.content.offer[WHIP_ROUND];
  if (entry === undefined || isOpen(ctx.state, entry.id) || reachedLimit(ctx.state, entry)) return [];
  if (!rescueDue(readOf(ctx)) || !conditionsHold(ctx, entry, {})) return [];
  return openOffer(ctx, entry, {});
}

/**
 * Things shipped home: on a birthday month, with a relative abroad in the story, the parcel opens
 * by its own rule, after the month's rolls so it moves none of them, outside the monthly limits as
 * the whip-round is. It respects its entry's place, its `when` and its limit of times, and a parcel
 * still waiting is never shipped again.
 */
function parcelShipped(ctx: Ctx): BaseEvent[] {
  const entry = ctx.content.offer[PARCEL];
  if (entry === undefined || isOpen(ctx.state, entry.id) || reachedLimit(ctx.state, entry)) return [];
  if (!birthdayMonth(ctx.state) || !conditionsHold(ctx, entry, {})) return [];
  return openOffer(ctx, entry, {});
}

/** The offers opened by roll this month so far, at the day's arrivals and the close together (offer:come-up-rolls-in-order, offer:day-arrivals-roll-offers). */
function rolledThisMonth(state: State): number {
  return state.offer.rolledMonth === state.turn.month ? state.offer.rolled : 0;
}

/**
 * The month's roll (offer:come-up-rolls-in-order): the groups in order, each entry rolled where it may be, inside the month's cap of rolled
 * offers and the cap of open ones; at most `max` of them this time. The day's arrivals (offer:day-arrivals-roll-offers) roll one at a time
 * as the month's time is lived; the close rolls what the cap still allows.
 */
function roll(ctx: Ctx, max: number): BaseEvent[] {
  const { maxNewPerMonth, maxOpen } = ctx.content.tuning.offer;
  const events: BaseEvent[] = [];
  let opened = 0;
  // home:makoko-eviction-draw: the month the settlement is cleared, no other blow comes up beside it.
  const cleared = evictedThisMonth(ctx.state);
  for (const entry of rollOrder(ctx.content)) {
    // Checked before each roll: an offer opened by roll this month counts toward the month's cap, an open one toward the other.
    if (opened >= max || rolledThisMonth(ctx.state) >= maxNewPerMonth || Object.keys(ctx.state.offer.items).length >= maxOpen) break;
    if (cleared && entry.bad === true) continue;
    if (!mayRoll(ctx, entry) || !ctx.random.chance("offer", rollChanceBp(ctx, entry))) continue;
    events.push(...openOffer(ctx, entry, {}, true));
    opened += 1;
  }
  return events;
}

/** offer:day-arrivals-roll-offers: the effect `offer/come-up`, the roll alone, at most `max` offers. */
function comeUpEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "offer/come-up") throw new Error(`offer/come-up cannot carry out ${effect.type}.`);
  return roll(ctx, effect.max);
}

function comeUp(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = roll(ctx, ctx.content.tuning.offer.maxNewPerMonth);
  // health:illness-rolls-when-run-down, health:worse-illness-locks-slots: illness, its relapse and its worse turn, on the stream `health`.
  events.push(...healthComeUp(ctx, (entry, terms) => openOffer(ctx, entry, terms)));
  events.push(...whipRound(ctx));
  events.push(...parcelShipped(ctx));
  return events;
}

// ---------------------------------------------------------------------------
// The effect: offer:effect-opens-named-offer
// ---------------------------------------------------------------------------

function openEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "offer/open") throw new Error(`offer/open cannot carry out ${effect.type}.`);
  const entry = entryOf(ctx.content, effect.offer);
  if (switchedOff(ctx.content, entry)) return [];
  const handed = handedTerms(entry, inFamily(entry.id) && cause.param !== null ? { ...cause.terms, route: cause.param } : cause.terms);
  if (!conditionsHold(ctx, entry, handed)) return [];
  if (reachedLimit(ctx.state, entry)) return [];
  // advice:agent-kind-drawn-on-offer: an agent already on the table stays; going back to him does not draw him again.
  if (standsAsAgent(entry) && isOpen(ctx.state, entry.id)) return [];
  // offer:effect-opens-named-offer: the entry already open closes unanswered, with no lapse effects, and the new one
  // opens, so a job landed while an earlier job offer waits is the one on the table.
  const waiting = Object.values(ctx.state.offer.items).find((item) => item.entry === entry.id);
  const events = waiting === undefined ? [] : record(ctx, { type: "offer/replaced", id: waiting.id, entry: waiting.entry });
  return [...events, ...openOffer(ctx, entry, handed)];
}

/**
 * The effect `offer/close` (person:family-requests-shared): the open offer of the named entry
 * closes unanswered, with no choice recorded and nothing paid. offer:effect-opens-named-offer
 * keeps one open offer to an entry, so there is at most one.
 * An offer that is not open does nothing, since the other life's handling may
 * arrive after this copy lapsed or was answered.
 */
function closeEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "offer/close") throw new Error(`offer/close cannot carry out ${effect.type}.`);
  const open = Object.values(ctx.state.offer.items).find((item) => item.entry === effect.offer);
  return open === undefined ? [] : record(ctx, { type: "offer/closed", id: open.id, entry: open.entry });
}

// ---------------------------------------------------------------------------
// Evolve, lines, invariants, view
// ---------------------------------------------------------------------------

function without(slice: OfferSlice, id: string): OfferSlice {
  const items = { ...slice.items };
  delete items[id];
  return { ...slice, items };
}

function evolve(slice: OfferSlice, event: OfferEvent): OfferSlice {
  switch (event.type) {
    case "offer/opened": {
      const { item } = event;
      // offer:come-up-rolls-in-order: the month's rolled count, kept across the day's arrivals and the close.
      const sameMonth = slice.rolledMonth === item.openedMonth;
      const rolled = event.rolled === true ? (sameMonth ? slice.rolled + 1 : 1) : sameMonth ? slice.rolled : 0;
      return {
        items: { ...slice.items, [item.id]: item },
        lastOpened: { ...slice.lastOpened, [item.entry]: item.openedMonth },
        timesOpened: { ...slice.timesOpened, [item.entry]: (slice.timesOpened[item.entry] ?? 0) + 1 },
        rolled,
        rolledMonth: event.rolled === true || sameMonth ? item.openedMonth : slice.rolledMonth,
      };
    }
    case "offer/taken":
    case "offer/lapsed":
    case "offer/replaced":
    case "offer/closed":
      return without(slice, event.id);
    case "offer/looked": {
      const item = slice.items[event.id];
      if (item === undefined) throw new Error(`${event.id} was looked at but is not open.`);
      const signs = [...item.signs, ...event.found.filter((key) => !item.signs.includes(key)), event.look];
      return { ...slice, items: { ...slice.items, [event.id]: { ...item, signs } } };
    }
    case "offer/agent-paid":
    case "offer/promise-broken":
      return slice;
    default: {
      const never: never = event;
      throw new Error(`Unknown offer event ${JSON.stringify(never)}.`);
    }
  }
}

function line(key: string, params: ReportLine["params"], attention: boolean): ReportLine {
  return { key, params, tone: "plain", attention, counts: [] };
}

/** advice:bad-news-told-straight: a scam told straight, naming the agent, the fee gone and every tell the player saw. */
function agentLines(event: Extract<OfferEvent, { type: "offer/agent-paid" }>): ReportLine[] {
  const amount = { currency: "NGN" as const, amount: event.fee };
  switch (event.kind) {
    case "scammer":
      return [
        { ...line("line.offer.agent-scam", { agent: event.agent, amount }, true), tone: "bad" },
        ...event.seen.map((tell): ReportLine => ({ ...line("line.offer.agent-scam-tell", { tell: `advice.tell.${tell}` }, false), tone: "bad" })),
      ];
    case "fixer":
      return [line(event.paper === null ? "line.offer.agent-paid-nothing-waiting" : "line.offer.agent-paid", { agent: event.agent, amount }, false)];
    // advice:chaser-runs-around-cheaper: her own words, since the friend's chaser is a woman and the men at the stop are not.
    case "chaser":
      return [line(event.paper === null ? "line.offer.agent-chaser-paid-nothing-waiting" : "line.offer.agent-chaser-paid", { agent: event.agent, amount }, false)];
    case "overpromiser":
      return [line("line.offer.agent-paid", { agent: event.agent, amount }, false)];
    default: {
      const never: never = event.kind;
      throw new Error(`Unknown agent kind ${String(never)}.`);
    }
  }
}

function lines(event: OfferEvent): ReportLine[] {
  switch (event.type) {
    case "offer/opened":
      // The entry id lets the interface show the title and body.
      return [line("line.offer.opened", { offer: event.item.entry }, true)];
    case "offer/taken":
      return [line("line.offer.taken", { offer: event.entry, choice: event.choice }, false)];
    case "offer/lapsed":
      return [line("line.offer.lapsed", event.choice === null ? { offer: event.entry } : { offer: event.entry, choice: event.choice }, false)];
    case "offer/replaced":
      return [line("line.offer.replaced", { offer: event.entry }, false)];
    case "offer/closed":
      return [line("line.offer.closed", { offer: event.entry }, false)];
    case "offer/looked":
      return event.found.length === 0
        ? [line(`line.offer.${event.look}-nothing`, { offer: event.entry }, false)]
        : event.found.map((tell) => line(`line.offer.${event.look}-found`, { offer: event.entry, tell: `advice.tell.${tell}` }, true));
    case "offer/agent-paid":
      return agentLines(event);
    case "offer/promise-broken":
      return [{ ...line("line.offer.agent-promise-broken", { agent: event.agent, month: event.month }, true), tone: "bad" }];
    default: {
      // Tests that stand in for this kind send events of their own through these lines, so an
      // unknown event says nothing rather than throwing.
      const never: never = event;
      void never;
      return [];
    }
  }
}

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const [id, item] of Object.entries(state.offer.items)) {
    if (item.id !== id) problems.push(`Offer ${id} is stored under the wrong key.`);
    if (content.offer[item.entry] === undefined) problems.push(`Offer ${id} names ${item.entry}, which is not in content.`);
    if (item.expiresMonth < item.openedMonth) problems.push(`Offer ${id} lapses in month ${String(item.expiresMonth)}, before it opened.`);
    if (seen.has(item.entry)) problems.push(`${item.entry} is open twice.`);
    seen.add(item.entry);
  }
  for (const [entry, times] of Object.entries(state.offer.timesOpened)) {
    if (content.offer[entry as Id<"offer">] === undefined) problems.push(`The record names ${entry}, which is not an offer in content.`);
    if (!Number.isSafeInteger(times) || times < 1) problems.push(`${entry} has opened ${String(times)} times.`);
  }
  return problems;
}

/**
 * An open offer as the player sees it. `allowed` is judged at the
 * smallest amount a choice may take, so a larger amount may still be refused
 * with cannot-afford.
 */
/** wallet:view-carries-month-pay: what the job an offer names would pay a month as the wallet will book it, or nothing when it names none. */
function offeredPay(read: ReadCtx, item: OfferState): Pick<OfferView, "pay"> {
  const job = item.terms["job"];
  const entry = typeof job === "string" ? read.content.activity[job as Id<"activity">] : undefined;
  const pay = entry === undefined ? null : bookedPay(read, entry);
  return pay === null ? {} : { pay };
}

function offerView(read: ReadCtx, item: OfferState): OfferView {
  const judge: Judge = (requirement, terms) => check(read, requirement, terms);
  return {
    ...offeredPay(read, item),
    id: item.id,
    entry: item.entry,
    openedMonth: item.openedMonth,
    expiresMonth: item.expiresMonth,
    // engine:view-holds-no-hidden-field: an agent's kind is never shown.
    terms: shownTerms(item.terms),
    signs: item.signs,
    // A parcel shows only the thing in it.
    choices: entryOf(read.content, item.entry).choices.filter((choice) => parcelHolds(item, choice)).map((choice) => {
      const pick = pickRange(item, choice);
      const allowed = choiceProblem(read, judge, item, choice, pick?.min) === null;
      return { id: choice.id, allowed, pick };
    }),
  };
}

export const offerKind: RegisteredKind<OfferSlice, OfferEvent> = {
  kind: "offer",
  initial: () => ({ items: {}, lastOpened: {}, timesOpened: {}, rolled: 0, rolledMonth: 0 }),
  commands: { "offer/choose": choose },
  effects: { "offer/open": openEffect, "offer/close": closeEffect, "offer/come-up": comeUpEffect },
  phases: { expire, "come-up": comeUp },
  evolve,
  lines,
  invariants,
  // road:pitch-reaches-anyone-at-home: the road's pitches sit under every other offer.
  view: (read) => ({ offers: [...openItems(read.state)].sort((a, b) => Number(roadGroup(read, a)) - Number(roadGroup(read, b))).map((item) => offerView(read, item)) }),
};
