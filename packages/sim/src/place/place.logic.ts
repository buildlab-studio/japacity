// Place: docs/rules/place.md, R-PLACE-001 to 009, and the mechanics of coming
// home in return.md. A character is at home, abroad in one country, or on the road.
import { bp, convertMinor, divFloor } from "../engine/int";
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
  MoneyParam,
  ObligationType,
  PlaceSlice,
  PlayerView,
  ReadCtx,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  ReturnShape,
  State,
  WhereEntry,
} from "../engine/types";
import { countryEntry, isKept, isOverstayer, removalBanMonths, statusEntry } from "../status/status.logic";
import type { PlaceEvent } from "./place.events";

const STANDING: Id<"quality"> = "quality.standing";
const SEASON_DECEMBER: Id<"var"> = "var.season-december";
const DECEMBER: Id<"setpiece"> = "setpiece.december";
/** R-RETURN-004 names one token that lapses with time away. */
const RESIDENT: Id<"status"> = "status.ca-resident";
/** R-ROAD-009: the status the road's far shore gives. */
const IRREGULAR: Id<"status"> = "status.eu-irregular";
/** R-PLACE-002: what the family house stops charging for while you are away. */
const HOME_TYPES: readonly ObligationType[] = ["upkeep", "support"];
/**
 * R-RETURN-006: what closes on the way home. The car is handed back by the
 * obligation kind (R-CAR-004), which opens any shortfall at home in naira; the
 * agent's debt follows you home (R-ROAD-007).
 */
const ABROAD_TYPES: readonly ObligationType[] = ["upkeep", "support", "rent", "phone", "surcharge", "tuition", "car"];
const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD", "CAD", "AED", "EUR"];

/** An entry that may be tied to a place: activities, offers, obligations, routes, goals. */
export interface Placed {
  /** Missing means home. */
  where?: WhereEntry;
  /** Abroad: the country it belongs to. Null or missing means every country. */
  country?: Id<"country"> | null;
}

/**
 * R-PLACE-003: whether an entry applies where the character is. `any` applies
 * everywhere, the road included; `home` and `abroad` apply only there; an
 * abroad entry with a country applies only in that country.
 */
export function appliesHere(entry: Placed, state: State): boolean {
  const where = entry.where ?? "home";
  if (where === "any") return true;
  if (where !== state.place.where) return false;
  if (where === "abroad" && entry.country !== undefined && entry.country !== null) return entry.country === state.place.country;
  return true;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** A world variable the mini content may not carry: missing reads as 0. */
function varOr(read: ReadCtx, id: Id<"var">): number {
  return (read.world.vars as Record<string, number | undefined>)[id] ?? 0;
}

function officialRates(read: ReadCtx): Record<ForeignCurrency, number> {
  const official = {} as Record<ForeignCurrency, number>;
  for (const currency of Object.keys(read.world.rates) as ForeignCurrency[]) official[currency] = read.world.rates[currency].official;
  return official;
}

/** R-PLACE-006: the fare home from the country the character is in, or null when not abroad. */
export function fareHome(read: ReadCtx): MoneyParam | null {
  const { where, country } = read.state.place;
  if (where !== "abroad" || country === null) return null;
  const entry = countryEntry(read.content, country);
  const december = varOr(read, SEASON_DECEMBER) === 1;
  return { currency: entry.currency, amount: december ? bp(entry.fare, entry.decemberFactorBp) : entry.fare };
}

/** R-PLACE-004: no status at all, or only the country's overstayer status, which is no permission to be there. */
export function holdsNoStatus(read: ReadCtx): boolean {
  const current = read.state.status.current;
  return current === null || isOverstayer(read.content, current.entry);
}

/** Bank and cash in every currency, in kobo at the official rate (R-PLACE-005). */
export function wealthInNaira(read: ReadCtx): number {
  const rates = officialRates(read);
  let kobo = 0;
  for (const currency of CURRENCIES) {
    const pocket = read.state.wallet.pockets[currency];
    kobo += convertMinor(pocket.bank + pocket.cash, currency, "NGN", rates);
  }
  return kobo;
}

/**
 * R-PLACE-005, first match wins. a removal "followed" is one recorded
 * this month for the country being left, and the broke line is read after the
 * fare is paid.
 */
export function returnShape(read: ReadCtx, farePaid: boolean): ReturnShape {
  const { place, status, turn } = read.state;
  if (status.removals.some((removal) => removal.country === place.country && removal.month === turn.month)) return "removed";
  if (holdsNoStatus(read) && !farePaid) return "assisted";
  if (farePaid && wealthInNaira(read) < read.content.tuning.place.brokeLine) return "broke";
  if (status.current !== null && isKept(read.content, status.current.entry)) return "with-papers";
  return "by-choice";
}

/** R-RETURN-002: +1 for each step of naira in the bank above the broke line, capped. */
export function capitalBonus(read: ReadCtx): number {
  const numbers = read.content.tuning.return;
  const above = read.state.wallet.pockets.NGN.bank - read.content.tuning.place.brokeLine;
  return above <= 0 ? 0 : Math.min(numbers.capitalCap, divFloor(above, numbers.capitalPer));
}

/**
 * R-PLACE-008, for the route kind: the last month of the ban on a country's
 * routes, or null when there is none. the contract has no route
 * effect for a ban, so nothing is applied; the route kind reads this, which
 * reads `status.removals` and `place.returns`.
 */
export function bannedUntil(read: ReadCtx, country: Id<"country">): number | null {
  const removed = read.state.status.removals.filter((removal) => removal.country === country);
  if (removed.length === 0) return null;
  const months = removalBanMonths(read.content, country);
  return Math.max(...removed.map((removal) => removal.month + months));
}

// ---------------------------------------------------------------------------
// Carrying out
// ---------------------------------------------------------------------------

function record(ctx: Ctx, events: PlaceEvent[]): BaseEvent[] {
  return emit(ctx, "place", events);
}

function closeObligations(ctx: Ctx, types: readonly ObligationType[], cause: Cause): BaseEvent[] {
  return ctx.apply(
    types.map((obligationType): Effect => ({ type: "obligation/close", obligationType })),
    cause,
  );
}

/** The starting life's obligations of the given types, as `obligation/open` effects at the given share of their amount. */
function fromStartingLife(read: ReadCtx, types: readonly ObligationType[], shareBp: number): Effect[] {
  const scenario = read.content.scenario[read.state.scenario];
  if (scenario === undefined) return [];
  return scenario.obligations.flatMap((owed): Effect[] => {
    const entry = read.content.obligation[owed.obligation];
    if (entry === undefined || !types.includes(entry.type)) return [];
    return [{ type: "obligation/open", obligation: owed.obligation, amount: bp(owed.amount, shareBp) }];
  });
}

/**
 * R-PLACE-002, R-ABROAD-003 and 007. `home-support` reopens abroad at
 * the remit factor; its entry is `where: "any"` so it may.
 */
function arrive(ctx: Ctx, country: Id<"country">, cause: Cause): BaseEvent[] {
  const entry = countryEntry(ctx.content, country);
  const month = ctx.state.turn.month;
  const events = record(ctx, [{ type: "place/moved", to: "abroad", country, month }]);
  const token = ctx.state.place.heldAbroad;
  if (token !== null && statusEntry(ctx.content, token.status).country === country) {
    events.push(...record(ctx, [{ type: "place/token-used", status: token.status }]));
  }
  closeObligations(ctx, HOME_TYPES, cause);
  const opens: Effect[] = [];
  if (entry.upkeep !== null) opens.push({ type: "obligation/open", obligation: entry.upkeep });
  if (entry.rentRoom !== null) opens.push({ type: "obligation/open", obligation: entry.rentRoom });
  opens.push(...fromStartingLife(ctx, ["support"], ctx.content.tuning.remit.abroadBp));
  ctx.apply(opens, cause);
  return events;
}

/**
 * R-PLACE-004, 005 and 007, R-RETURN-002, 004 and 006. The record is written
 * while the country is still known, then the character is home and every
 * status closes.
 */
function comeHome(ctx: Ctx, shape: ReturnShape, cause: Cause): BaseEvent[] {
  const { country } = ctx.state.place;
  if (country === null) throw new Error("A return needs a country to come home from.");
  const current = ctx.state.status.current;
  const kept = shape === "with-papers" && current !== null && isKept(ctx.content, current.entry) ? current.entry : null;
  const month = ctx.state.turn.month;
  const events = record(ctx, [
    { type: "place/returned", shape, country, month, kept },
    { type: "place/moved", to: "home", country: null, month },
  ]);
  ctx.apply([{ type: "status/lose" }], cause);
  closeObligations(ctx, ABROAD_TYPES, cause);
  // R-PLACE-007: the family house takes you back at the starting life's amounts.
  ctx.apply(fromStartingLife(ctx, HOME_TYPES, 10000), cause);
  const standing = ctx.content.tuning.return.standing[shape];
  const bonus = capitalBonus(ctx);
  const gains: Effect[] = [];
  if (standing !== 0) gains.push({ type: "quality/add", quality: STANDING, amount: standing });
  if (bonus !== 0) gains.push({ type: "quality/add", quality: STANDING, amount: bonus });
  ctx.apply(gains, cause);
  return events;
}

/** R-PLACE-002 for `abroad`; a move home that no command paid for (a removal, R-STATUS-008) is a return with no fare. */
function move(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "place/move") throw new Error(`place/move cannot carry out ${effect.type}.`);
  const { place } = ctx.state;
  switch (effect.to) {
    case "abroad":
      if (effect.country === null) throw new Error("A move abroad needs a country.");
      if (place.where === "abroad" && place.country === effect.country) return [];
      return arrive(ctx, effect.country, cause);
    case "home":
      if (place.where !== "abroad") return place.where === "home" ? [] : record(ctx, [{ type: "place/moved", to: "home", country: null, month: ctx.state.turn.month }]);
      return comeHome(ctx, returnShape(ctx, false), cause);
    case "road":
      if (place.where === "road") return [];
      return record(ctx, [{ type: "place/moved", to: "road", country: null, month: ctx.state.turn.month }]);
    default: {
      const never: never = effect.to;
      throw new Error(`Unknown place ${String(never)}.`);
    }
  }
}

/** How the fare is paid now: from the country's currency, or from naira as a foreign fee (R-PLACE-006). Null: it cannot be. */
function farePayment(ctx: Ctx, fare: MoneyParam): Effect | null {
  const { currency, amount } = fare;
  if (ctx.check({ type: "money/min", currency, amount }).met) return { type: "money/take", currency, pocket: "any", amount, reason: "fare" };
  if (!ctx.content.tuning.place.fareFromNaira || currency === "NGN") return null;
  if (!ctx.check({ type: "money/can-pay", currency, amount }).met) return null;
  return { type: "money/pay-fee", currency, amount, reason: "fare" };
}

/**
 * R-PLACE-004. R-STATUS-009 adds an exit fee to a Gulf worker's fare
 * while the contract runs, and the content has no figure for it, so the fare
 * alone is charged.
 */
function returnHome(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "return/home") throw new Error(`return/home cannot handle ${command.type}.`);
  const fare = fareHome(ctx);
  if (fare === null) return reject("not-legal", "Only a character abroad can come home.");
  const payment = farePayment(ctx, fare);
  if (payment === null && !holdsNoStatus(ctx)) {
    return reject("cannot-afford", `The fare home is ${String(fare.amount)} in ${fare.currency} and cannot be paid.`);
  }
  const cause: Cause = { source: command.type, param: ctx.state.place.country, terms: {} };
  // R-ROAD-009: from the far shore the only way home is the assisted scheme, with no fare.
  if (ctx.state.status.current?.entry === IRREGULAR) return comeHome(ctx, "assisted", cause);
  if (payment !== null) ctx.apply([payment], cause);
  return comeHome(ctx, returnShape(ctx, payment !== null), cause);
}

/**
 * R-ROAD-007 and R-STATUS-008: the authority's way home, as `return/home`
 * does for the given shape with no fare. Abroad it is the same return. From
 * the road it is the assisted return: the family house takes the character
 * back and standing moves by the shape and the capital (R-PLACE-007,
 * R-RETURN-002); obligations of the road, the agent's debt among them, stay.
 * a return is recorded with the country left, and the road has none
 * (the route entry's `country` is null, place.md has no country for it), so a
 * return from the road is not written to the record and the road's own line
 * tells it. That leaves R-RETURN-003's returnee offers, which read the record,
 * closed to it. The record needs `country: Id<"country"> | null`, or content a
 * stylised country for the road.
 */
function returnEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "place/return") throw new Error(`place/return cannot carry out ${effect.type}.`);
  const where = ctx.state.place.where;
  switch (where) {
    case "abroad":
      return comeHome(ctx, effect.shape, cause);
    case "road": {
      // R-ROAD-007: the return is on record with no country; the road is not one.
      const month = ctx.state.turn.month;
      const events = record(ctx, [
        { type: "place/returned", shape: effect.shape, country: null, month, kept: null },
        { type: "place/moved", to: "home", country: null, month },
      ]);
      ctx.apply(fromStartingLife(ctx, HOME_TYPES, 10000), cause);
      const standing = ctx.content.tuning.return.standing[effect.shape];
      const bonus = capitalBonus(ctx);
      const gains: Effect[] = [];
      if (standing !== 0) gains.push({ type: "quality/add", quality: STANDING, amount: standing });
      if (bonus !== 0) gains.push({ type: "quality/add", quality: STANDING, amount: bonus });
      ctx.apply(gains, cause);
      return events;
    }
    case "home":
      return [];
    default: {
      const never: never = where;
      throw new Error(`Unknown place ${String(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/** R-RETURN-004: a resident token lapses after the months away the tuning gives. */
function tokenLapse(ctx: Ctx): BaseEvent[] {
  const token = ctx.state.place.heldAbroad;
  if (token?.status !== RESIDENT) return [];
  const away = ctx.state.turn.month - token.sinceMonth;
  if (away < ctx.content.tuning.return.residentLapseMonths) return [];
  return record(ctx, [{ type: "place/token-lapsed", status: token.status, months: away }]);
}

/**
 * R-RETURN-005. in the tick the director makes December, a
 * character abroad gets the December set piece, opened with no route so that
 * nothing is scored (R-SETPIECE-006). The variable is 1 for one tick a game
 * year, so it opens once a year.
 */
function december(ctx: Ctx): BaseEvent[] {
  if (ctx.state.place.where !== "abroad" || varOr(ctx, SEASON_DECEMBER) !== 1) return [];
  if (ctx.content.setpiece[DECEMBER] === undefined || ctx.state.setpiece.open !== null) return [];
  // A second turn in the same December tick does not open it twice (R-PLACE-009).
  if (ctx.state.place.decemberMonth === ctx.world.tick) return [];
  ctx.apply([{ type: "setpiece/open", setpiece: DECEMBER, route: null }], { source: DECEMBER, param: null, terms: {} });
  if (ctx.state.setpiece.open?.entry !== DECEMBER) return [];
  // `decemberMonth` holds the world tick, the world's month while one tick passes per month played; the
  // character's month cannot tell a second turn in one December tick from a first turn a year on. Online a December
  // spans many ticks, so the visit can open once in each tick of it that a turn ends in.
  return record(ctx, [{ type: "place/december-opened", tick: ctx.world.tick }]);
}

function month(ctx: Ctx): BaseEvent[] {
  return [...tokenLapse(ctx), ...december(ctx)];
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

function judgeIs(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "place/is") throw new Error(`place/is cannot judge ${requirement.type}.`);
  const { place } = read.state;
  return { met: place.where === requirement.where && (requirement.country === undefined || place.country === requirement.country) };
}

function judgeReturned(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "place/returned") throw new Error(`place/returned cannot judge ${requirement.type}.`);
  const have = read.state.place.returns.filter((back) => requirement.shapes.includes(back.shape)).length;
  return { met: have > 0, have, need: 1 };
}

function judgeMonthsHere(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "place/months-here") throw new Error(`place/months-here cannot judge ${requirement.type}.`);
  const { place, turn } = read.state;
  const here = place.where === requirement.where;
  const have = here ? turn.month - place.movedMonth : 0;
  return { met: here && have >= requirement.months, have, need: requirement.months };
}

// ---------------------------------------------------------------------------
// Evolve, lines, view
// ---------------------------------------------------------------------------

function evolve(slice: PlaceSlice, event: PlaceEvent): PlaceSlice {
  switch (event.type) {
    case "place/moved":
      return { ...slice, where: event.to, country: event.country, movedMonth: event.month };
    case "place/returned":
      return {
        ...slice,
        returns: [...slice.returns, { month: event.month, shape: event.shape, country: event.country }],
        heldAbroad: event.kept === null ? slice.heldAbroad : { status: event.kept, sinceMonth: event.month },
      };
    case "place/token-used":
    case "place/token-lapsed":
      return { ...slice, heldAbroad: null };
    case "place/december-opened":
      return { ...slice, decemberMonth: event.tick };
    default: {
      const never: never = event;
      throw new Error(`Unknown place event ${JSON.stringify(never)}.`);
    }
  }
}

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention: boolean): ReportLine {
  return { key: `line.place.${key}`, params, tone, attention, counts: [] };
}

const RETURN_TONE: Record<ReturnShape, ReportLine["tone"]> = {
  "with-papers": "good",
  "by-choice": "plain",
  broke: "bad",
  assisted: "bad",
  removed: "bad",
};

function lines(event: PlaceEvent): ReportLine[] {
  switch (event.type) {
    case "place/moved":
      // Coming home is told by the return line; a move abroad or onto the road is told here.
      if (event.to === "home") return [];
      return event.country === null ? [line("on-road", {}, "plain", true)] : [line("arrived", { country: event.country }, "good", true)];
    case "place/returned":
      if (event.country === null) return [line("returned-road", {}, RETURN_TONE[event.shape], true)];
      return [line(`returned-${event.shape}`, { country: event.country }, RETURN_TONE[event.shape], true)];
    case "place/token-used":
      return [line("token-used", { status: event.status }, "good", false)];
    case "place/token-lapsed":
      return [line("token-lapsed", { status: event.status, months: event.months }, "bad", true)];
    // The set piece's own line tells the visit.
    case "place/december-opened":
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown place event ${JSON.stringify(never)}.`);
    }
  }
}

/** R-PLACE-009 and R-RETURN-001: the record newest first. */
function view(read: ReadCtx): Pick<PlayerView, "place"> {
  const { state } = read;
  return {
    place: {
      where: state.place.where,
      country: state.place.country,
      monthsHere: state.turn.month - state.place.movedMonth,
      returns: [...state.place.returns].reverse(),
      heldAbroad: state.place.heldAbroad?.status ?? null,
      fareHome: fareHome(read),
    },
  };
}

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  const { where, country, movedMonth, returns, heldAbroad } = state.place;
  if ((where === "abroad") !== (country !== null)) problems.push(`The character is ${where} with the country ${String(country)}.`);
  if (country !== null && content.country[country] === undefined) problems.push(`The country ${country} is not in content.`);
  if (!Number.isSafeInteger(movedMonth) || movedMonth < 0 || movedMonth > state.turn.month) problems.push(`The last move was in month ${String(movedMonth)}.`);
  for (const back of returns) {
    if (back.month > state.turn.month) problems.push(`A return is recorded in month ${String(back.month)}, after this one.`);
  }
  if (heldAbroad !== null && content.status[heldAbroad.status] === undefined) problems.push(`The token ${heldAbroad.status} is not a status in content.`);
  return problems;
}

export const placeKind: RegisteredKind<PlaceSlice, PlaceEvent> = {
  kind: "place",
  // R-PLACE-001.
  initial: () => ({ where: "home", country: null, movedMonth: 0, returns: [], heldAbroad: null, decemberMonth: null }),
  commands: { "return/home": returnHome },
  effects: {
    "place/move": move,
    // R-ROAD-007 and R-STATUS-008: the authority's way home.
    "place/return": returnEffect,
  },
  phases: { month },
  evolve,
  lines,
  requirements: { "place/is": judgeIs, "place/returned": judgeReturned, "place/months-here": judgeMonthsHere },
  invariants,
  view,
};
