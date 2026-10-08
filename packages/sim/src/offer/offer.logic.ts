// Offers: docs/rules/offer.md. Anything that comes to the character with
// choices and a date: a family request, a job, a loan, a man who says he can
// arrange things. Whether an offer is a fraud is fixed when it opens and kept
// in `secret`, which the view never carries (R-OFFER-006, R-ENGINE-007).
import { check, checkWith, resolveAmount } from "../engine/check";
import { BP_WHOLE, bp, clamp, divFloor, valueInKobo } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
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
import { routePercent } from "../japacity/japacity.logic";
import { appliesHere } from "../place/place.logic";
import type { OfferEvent } from "./offer.events";
import { luckTerms, markedChanceBp, rescueDue, WHIP_ROUND } from "./offer.luck";

/**
 * The groups that are rolled, in the order R-OFFER-001 takes them. `job` is
 * never rolled. Life abroad and coming home follow family; the road comes last
 * (R-ROAD-002).
 */
const ROLL_ORDER: readonly OfferEntry["group"][] = ["money", "life", "family", "abroad", "return", "road"];


/** Judges one requirement with the terms in hand. Inside a step it is `ctx.check`; outside, the engine's `check`. */
type Judge = (requirement: Requirement, terms: Terms) => RequirementResult;

const readOf = (ctx: Ctx): ReadCtx => ({ state: ctx.state, world: ctx.world, content: ctx.content });

function entryOf(content: Content, id: Id<"offer">): OfferEntry {
  const entry = content.offer[id];
  if (entry === undefined) throw new Error(`There is no offer ${id} in content.`);
  return entry;
}

function record(ctx: Ctx, event: OfferEvent): BaseEvent[] {
  return emit(ctx, "offer", [event]);
}

/** The instance number of an engine id such as `offer-12`, or null for any other shape. */
function instanceNumber(id: string): number | null {
  const match = /-(\d+)$/.exec(id);
  return match === null ? null : Number(match[1]);
}

/** Oldest first: by the month opened, then by instance number, so `offer-10` comes after `offer-9`. */
function oldestFirst(a: OfferState, b: OfferState): number {
  if (a.openedMonth !== b.openedMonth) return a.openedMonth - b.openedMonth;
  const na = instanceNumber(a.id);
  const nb = instanceNumber(b.id);
  if (na !== null && nb !== null && na !== nb) return na - nb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function openItems(state: State): OfferState[] {
  return Object.values(state.offer.items).sort(oldestFirst);
}

function roadGroup(read: ReadCtx, item: OfferState): boolean {
  return entryOf(read.content, item.entry).group === "road";
}

function isOpen(state: State, entry: Id<"offer">): boolean {
  return Object.values(state.offer.items).some((item) => item.entry === entry);
}

function reachedLimit(state: State, entry: OfferEntry): boolean {
  return entry.maxTimes !== null && (state.offer.timesOpened[entry.id] ?? 0) >= entry.maxTimes;
}

// ---------------------------------------------------------------------------
// Terms: R-OFFER-002
// ---------------------------------------------------------------------------

/** The monthly pay of the job held, in naira kobo. A pay in another currency is valued at the official rate. */
function payInNaira(read: ReadCtx): number {
  const job = read.state.activity.job;
  if (job === null) return 0;
  const pay = read.content.activity[job]?.pay ?? null;
  if (pay === null) return 0;
  const amount = resolveAmount(read, pay.amount);
  if (pay.currency === "NGN") return amount;
  const official = {} as Record<ForeignCurrency, number>;
  for (const currency of Object.keys(read.world.rates) as ForeignCurrency[]) official[currency] = read.world.rates[currency].official;
  return valueInKobo(amount, pay.currency, official);
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
 * R-ABROAD-007: the family expects more once a relative is abroad. A request
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
 * Opens an offer (R-OFFER-002): terms, expiry, the hidden fraud on the `fraud`
 * stream, then each sign on the `offer` stream by the chance for what the
 * offer really is. `extra` terms come with the effect that opened it
 * (R-OFFER-007) and are added to the offer's own.
 */
function openOffer(ctx: Ctx, entry: OfferEntry, extra: Terms): BaseEvent[] {
  const own: Terms = {};
  for (const [name, spec] of Object.entries(entry.terms)) own[name] = fixTerm(ctx, spec);
  if (entry.group === "family" && ctx.state.place.where === "abroad") scaleAsked(entry, own, ctx.content.tuning.remit.abroadBp);
  const fraud = ctx.random.chance("fraud", entry.fraudBp);
  const signs = entry.signs.filter((sign) => ctx.random.chance("offer", fraud ? sign.fraudBp : sign.honestBp)).map((sign) => sign.key);
  const month = ctx.state.turn.month;
  const item: OfferState = {
    id: ctx.nextId("offer"),
    entry: entry.id,
    openedMonth: month,
    expiresMonth: month + entry.expiresAfter,
    // a term handed over by the effect wins over one of the same name. None clash in content.
    // A luck offer's payment is read from the tuning as a term (R-LUCK-002, 007).
    terms: { ...own, ...luckTerms(readOf(ctx), entry.id), ...extra },
    signs,
    secret: { fraud },
  };
  return record(ctx, { type: "offer/opened", item });
}

// ---------------------------------------------------------------------------
// Whether a choice can be taken: R-OFFER-003
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
 * the first plan says to judge with `money/can-pay`, which counts cash and
 * bank together. That is used for `any` debits and foreign fees; a debit that
 * names one pocket is judged with `money/min` on that pocket, or the agent's
 * cash-only fee could pass with the money in the bank and then not be taken. Debits from one
 * pocket are added up, so two that could each be paid alone but not together
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
 * amount comes first because the conditions and debits read it. 
 * debits are judged on the ordinary effects, never the fraud ones, so whether
 * a choice is allowed never gives a fraud away (R-OFFER-006).
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
  if (!debitsPayable(read, judge, choice.effects, terms)) return { code: "cannot-afford", detail: `${choice.id} cannot be paid now.` };
  return null;
}

/** Carries out a choice (R-OFFER-003, R-OFFER-004). The source names the offer and the choice. */
function takeChoice(ctx: Ctx, item: OfferState, choice: OfferChoice, amount: number | null): void {
  const effects = item.secret.fraud && choice.fraudEffects !== null ? choice.fraudEffects : choice.effects;
  const cause: Cause = { source: `${item.entry}.${choice.id}`, param: null, terms: { ...choiceTerms(item, amount), ...roadKind(ctx, item, choice) } };
  ctx.apply(effects, cause);
}

/**
 * R-HEALTH-006: an entry with `lockNext` locks slots from next month when a
 * choice is taken. the field is on the entry, so every choice locks;
 * `offer.village-burial` on the page locks on `go` alone. A lapse is not a
 * choice taken and locks nothing.
 */
function lockAfter(ctx: Ctx, item: OfferState, choice: OfferChoice): void {
  const lock = entryOf(ctx.content, item.entry).lockNext;
  if (lock === undefined) return;
  ctx.apply([{ type: "turn/lock", slots: lock.slots, months: lock.months, why: lock.why }], { source: `${item.entry}.${choice.id}`, param: null, terms: item.terms });
}

/**
 * R-ROAD-003: taking a pitch decides, hidden, what it really is. The fraud
 * share is the offer's own fraud, drawn when it opened so its signs follow it
 * (R-OFFER-006); taking an honest one splits the rest between real-ish and
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
  const item = typeof command.offer === "string" ? ctx.state.offer.items[command.offer] : undefined;
  if (item === undefined) return reject("unknown-id", `There is no open offer ${String(command.offer)}.`);
  const choice = entryOf(ctx.content, item.entry).choices.find((candidate) => candidate.id === command.choice);
  if (choice === undefined) return reject("not-legal", `${item.entry} has no choice ${String(command.choice)}.`);
  const problem = choiceProblem(readOf(ctx), judgeIn(ctx), item, choice, command.amount);
  if (problem !== null) return reject(problem.code, problem.detail);
  takeChoice(ctx, item, choice, choice.pick === null ? null : (command.amount ?? null));
  lockAfter(ctx, item, choice);
  return record(ctx, { type: "offer/taken", id: item.id, entry: item.entry, choice: choice.id });
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/**
 * R-OFFER-005: an offer whose month has come is removed. Its lapse choice is
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
    // "can be taken" means what offer/choose would accept: its conditions hold and its debits can be paid.
    if (choice !== undefined && choice.pick === null && choiceProblem(readOf(ctx), judgeIn(ctx), item, choice, undefined) === null) {
      takeChoice(ctx, item, choice, null);
      applied = choice.id;
    }
    events.push(...record(ctx, { type: "offer/lapsed", id: item.id, entry: item.entry, choice: applied }));
  }
  return events;
}

/** The entries rolled each month, in the order R-OFFER-001 takes them. */
export function rollOrder(content: Content): OfferEntry[] {
  return ROLL_ORDER.flatMap((group) =>
    Object.values(content.offer)
      .filter((entry) => entry.group === group && entry.chanceBp > 0)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  );
}

/** R-ROAD-001: the content switch turns the road's whole pool off. */
function switchedOff(content: Content, entry: OfferEntry): boolean {
  return entry.group === "road" && !content.tuning.road.enabled;
}

/**
 * R-ROAD-002: the pitch's chance with the character's situation, between 0
 * and 10000. the page's lines (standing under 30, age over 30, a
 * route figure of 60) have no field in content beside the entry's `pressure`
 * figures, so they are here.
 */
const PRESSURE_STANDING_UNDER = 30;
const PRESSURE_AGE_YEARS = 30;
const PRESSURE_STRONG_ROUTE = 60;
const MONTHS_A_YEAR = 12;

export function pressureChanceBp(read: ReadCtx, entry: OfferEntry, judge: (requirement: Requirement) => RequirementResult): number {
  const pressure = entry.pressure;
  if (pressure === undefined) return entry.chanceBp;
  const { state, content } = read;
  const refusals = Object.values(state.route).reduce((sum, held) => sum + held.refusals, 0);
  const defaulted = Object.values(state.obligation.items).some((item) => item.state === "defaulted");
  const standing = state.quality["quality.standing"] ?? 0;
  const yearsOver = Math.max(0, divFloor(state.quality["quality.age-months"] ?? 0, MONTHS_A_YEAR) - PRESSURE_AGE_YEARS);
  const strong = Object.values(content.route).some((route) => route.gate !== "road" && (routePercent(read, route.id, judge) ?? 0) >= PRESSURE_STRONG_ROUTE);
  const chance =
    entry.chanceBp +
    pressure.refusalBp * refusals +
    (defaulted ? pressure.defaultBp : 0) +
    (standing < PRESSURE_STANDING_UNDER ? pressure.lowStandingBp : 0) +
    pressure.perYearOver30Bp * yearsOver -
    (strong ? pressure.strongRouteBp : 0);
  return clamp(chance, 0, BP_WHOLE);
}

/**
 * R-RETURN-003: the returnee group is in the pool for the tuning's months
 * after the last return, and its entries' `when` is judged against that
 * return alone. the record is narrowed to the last return for the
 * judging, so `place/returned` in such a `when` reads the shape of the last
 * return, not of any earlier one. Null: outside the window.
 */
function lastReturnRead(ctx: Ctx): ReadCtx | null {
  const { place, turn } = ctx.state;
  const last = place.returns[place.returns.length - 1];
  if (last === undefined || turn.month - last.month > ctx.content.tuning.return.offerMonths) return null;
  return { state: { ...ctx.state, place: { ...place, returns: [last] } }, world: ctx.world, content: ctx.content };
}

/** An entry's conditions: where it applies (R-PLACE-003), then its `when`, the returnee group's against the last return. */
function conditionsHold(ctx: Ctx, entry: OfferEntry, terms: Terms): boolean {
  if (!appliesHere(entry, ctx.state)) return false;
  if (entry.group !== "return") return entry.when.every((requirement) => ctx.check(requirement, terms).met);
  const read = lastReturnRead(ctx);
  return read !== null && entry.when.every((requirement) => checkWith(read, requirement, terms).met);
}

/** Whether an entry is rolled this month (R-OFFER-001): conditions, not open, cooldown passed, under its limit. */
function mayRoll(ctx: Ctx, entry: OfferEntry): boolean {
  if (switchedOff(ctx.content, entry)) return false;
  if (isOpen(ctx.state, entry.id) || reachedLimit(ctx.state, entry)) return false;
  const last = ctx.state.offer.lastOpened[entry.id];
  if (last !== undefined && ctx.state.turn.month - last < entry.cooldown) return false;
  return conditionsHold(ctx, entry, {});
}

/** The chance an entry rolls at this month: the road's pressure, then the luck marks and the dry spell (R-LUCK-003, 004). */
function rollChanceBp(ctx: Ctx, entry: OfferEntry): number {
  const read = readOf(ctx);
  return markedChanceBp(read, entry, pressureChanceBp(read, entry, (requirement) => ctx.check(requirement)));
}

/**
 * R-LUCK-002: the whip-round is opened by its rule, never rolled, after the
 * month's rolls so it moves none of them. It respects its entry's place, its
 * `when` and its limit of one, and none of the monthly limits.
 */
function whipRound(ctx: Ctx): BaseEvent[] {
  const entry = ctx.content.offer[WHIP_ROUND];
  if (entry === undefined || isOpen(ctx.state, entry.id) || reachedLimit(ctx.state, entry)) return [];
  if (!rescueDue(readOf(ctx)) || !conditionsHold(ctx, entry, {})) return [];
  return openOffer(ctx, entry, {});
}

function comeUp(ctx: Ctx): BaseEvent[] {
  const { maxNewPerMonth, maxOpen } = ctx.content.tuning.offer;
  const events: BaseEvent[] = [];
  let opened = 0;
  for (const entry of rollOrder(ctx.content)) {
    // Checked before each roll: an offer opened this month counts toward both limits.
    if (opened >= maxNewPerMonth || Object.keys(ctx.state.offer.items).length >= maxOpen) break;
    if (!mayRoll(ctx, entry) || !ctx.random.chance("offer", rollChanceBp(ctx, entry))) continue;
    events.push(...openOffer(ctx, entry, {}));
    opened += 1;
  }
  events.push(...whipRound(ctx));
  return events;
}

// ---------------------------------------------------------------------------
// The effect: R-OFFER-007
// ---------------------------------------------------------------------------

function openEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "offer/open") throw new Error(`offer/open cannot carry out ${effect.type}.`);
  const entry = entryOf(ctx.content, effect.offer);
  if (switchedOff(ctx.content, entry)) return [];
  if (!conditionsHold(ctx, entry, cause.terms)) return [];
  if (reachedLimit(ctx.state, entry)) return [];
  // R-OFFER-007: the entry already open closes unanswered, with no lapse effects, and the new one
  // opens, so a job landed while an earlier job offer waits is the one on the table.
  const waiting = Object.values(ctx.state.offer.items).find((item) => item.entry === entry.id);
  const events = waiting === undefined ? [] : record(ctx, { type: "offer/replaced", id: waiting.id, entry: waiting.entry });
  return [...events, ...openOffer(ctx, entry, cause.terms)];
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
      return {
        items: { ...slice.items, [item.id]: item },
        lastOpened: { ...slice.lastOpened, [item.entry]: item.openedMonth },
        timesOpened: { ...slice.timesOpened, [item.entry]: (slice.timesOpened[item.entry] ?? 0) + 1 },
      };
    }
    case "offer/taken":
    case "offer/lapsed":
    case "offer/replaced":
      return without(slice, event.id);
    default: {
      const never: never = event;
      throw new Error(`Unknown offer event ${JSON.stringify(never)}.`);
    }
  }
}

function line(key: string, params: ReportLine["params"], attention: boolean): ReportLine {
  return { key, params, tone: "plain", attention, counts: [] };
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
export function offerView(read: ReadCtx, item: OfferState): OfferView {
  const judge: Judge = (requirement, terms) => check(read, requirement, terms);
  return {
    id: item.id,
    entry: item.entry,
    openedMonth: item.openedMonth,
    expiresMonth: item.expiresMonth,
    terms: item.terms,
    signs: item.signs,
    choices: entryOf(read.content, item.entry).choices.map((choice) => {
      const pick = pickRange(item, choice);
      const allowed = choiceProblem(read, judge, item, choice, pick?.min) === null;
      return { id: choice.id, allowed, pick };
    }),
  };
}

export const offerKind: RegisteredKind<OfferSlice, OfferEvent> = {
  kind: "offer",
  initial: () => ({ items: {}, lastOpened: {}, timesOpened: {} }),
  commands: { "offer/choose": choose },
  effects: { "offer/open": openEffect },
  phases: { expire, "come-up": comeUp },
  evolve,
  lines,
  invariants,
  // R-ROAD-012: the road's pitches sit under every other offer.
  view: (read) => ({ offers: [...openItems(read.state)].sort((a, b) => Number(roadGroup(read, a)) - Number(roadGroup(read, b))).map((item) => offerView(read, item)) }),
};

/** R-LUCK-001: for the content check. */
export { luckReadsMoney } from "./offer.luck";
