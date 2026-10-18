// Place: docs/rules/place.md, R-PLACE-001 to 012, and the mechanics of coming
// home in return.md. A character is at home, abroad in one country, or on the road.
import { check, worldVarOr } from "../engine/check";
import { QUALITY, SETPIECE, STATUS, VAR } from "../engine/ids";
import { bp, BP_WHOLE, convertMinor, divFloor, isqrt, mulDiv, roundUpTo } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  AbroadWay,
  BaseEvent,
  Cause,
  Command,
  Content,
  CountryRides,
  Currency,
  Ctx,
  Effect,
  Id,
  MoneyParam,
  ObligationType,
  PlaceEntry,
  PlaceSlice,
  PlayerView,
  ReadCtx,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  ReturnShape,
  RideFigures,
  RideWay,
  RideWayView,
  State,
  WayHome,
  WhereEntry,
} from "../engine/types";
import { countryEntry, isKept, isOverstayer, removalBanMonths, statusEntry } from "../status/status.logic";
import { FAMILY_HOUSE, homeCharges } from "../home/home.logic";
import { drives } from "../thing/thing.logic";
import type { PlaceEvent } from "./place.events";
import { feeInNaira, walletAfter } from "../wallet/wallet.logic";
import type { Payment } from "../wallet/wallet.logic";
import { CURRENCIES, officialRates } from "../wallet/wallet.rates";

/** R-RETURN-005: the least gap between two December visits, in the character's months. */
const MONTHS_A_YEAR = 12;
/** R-RETURN-004 names one token that lapses with time away. */
const RESIDENT: Id<"status"> = "status.ca-resident";
/** R-PLACE-007: what the family house charges for again when you come back. */
const HOME_TYPES: readonly ObligationType[] = ["upkeep", "support"];
/** R-PLACE-002: what closes on a flight: the family house's charges, and a room's rent at home, let go (R-HOME-010). */
const LEFT_TYPES: readonly ObligationType[] = ["upkeep", "support", "rent"];
/**
 * R-RETURN-006: what closes on the way home. The car is handed back by the
 * obligation kind (R-CAR-004), which opens any shortfall at home in naira; the
 * agent's debt follows you home (R-ROAD-007).
 */
const ABROAD_TYPES: readonly ObligationType[] = ["upkeep", "support", "rent", "phone", "surcharge", "tuition", "car"];

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

/** R-PLACE-006: the fare home from the country the character is in, or null when not abroad. */
export function fareHome(read: ReadCtx): MoneyParam | null {
  const { where, country } = read.state.place;
  if (where !== "abroad" || country === null) return null;
  const entry = countryEntry(read.content, country);
  const december = worldVarOr(read.world, VAR.seasonDecember) === 1;
  return { currency: entry.currency, amount: december ? bp(entry.fare, entry.decemberFactorBp) : entry.fare };
}

/** R-PLACE-004: no status at all, or only the country's overstayer status, which is no permission to be there. */
function holdsNoStatus(read: ReadCtx): boolean {
  const current = read.state.status.current;
  return current === null || isOverstayer(read.content, current.entry);
}

/** Bank and cash in every currency, in kobo at the official rate (R-PLACE-005). */
export function wealthInNaira(read: ReadCtx): number {
  const rates = officialRates(read.world);
  let kobo = 0;
  for (const currency of CURRENCIES) {
    const pocket = read.state.wallet.pockets[currency];
    kobo += convertMinor(pocket.bank + pocket.cash, currency, "NGN", rates);
  }
  return kobo;
}

/**
 * R-PLACE-005, first match wins. A removal "followed" is one recorded
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
 * routes, or null when there is none. The contract has no route
 * effect for a ban, so nothing is applied; the route kind reads this, which
 * reads `status.removals` and `place.returns`.
 */
export function bannedUntil(read: ReadCtx, country: Id<"country">): number | null {
  const removed = read.state.status.removals.filter((removal) => removal.country === country);
  if (removed.length === 0) return null;
  const months = removalBanMonths(read.content, country);
  return Math.max(...removed.map((removal) => removal.month + months));
}

/** R-PLACE-008: whether a removal's ban holds on the country this month. It lifts in the month `bannedUntil` gives. */
export function bannedNow(read: ReadCtx, country: Id<"country">): boolean {
  const until = bannedUntil(read, country);
  return until !== null && read.state.turn.month < until;
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

/** The starting life's obligations of the given types, at the given share of their amount: the home kind's one answer (R-HOME-009). */
function fromStartingLife(read: ReadCtx, types: readonly ObligationType[], shareBp: number): Effect[] {
  return homeCharges(read, types, shareBp);
}

/**
 * R-PLACE-002, R-ABROAD-003 and 007. `home-support` reopens abroad at
 * the remit factor; its entry is `where: "any"` so it may.
 */
function arrive(ctx: Ctx, country: Id<"country">, cause: Cause): BaseEvent[] {
  const entry = countryEntry(ctx.content, country);
  const month = ctx.state.turn.month;
  // R-PLACE-002: leaving Lagos, what is owned is sold as the room is let go.
  if (ctx.state.place.where === "home") ctx.apply([{ type: "things/sell-off" }], cause);
  const events = record(ctx, [{ type: "place/moved", to: "abroad", country, month }]);
  const token = ctx.state.place.heldAbroad;
  if (token !== null && statusEntry(ctx.content, token.status).country === country) {
    events.push(...record(ctx, [{ type: "place/token-used", status: token.status }]));
  }
  // The move comes only from Lagos or the road (R-PLACE-002: no flight leaves from abroad), so a room's rent is let go.
  closeObligations(ctx, LEFT_TYPES, cause);
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
    { type: "place/returned", shape, country, month, kept, keptMonths: kept === null || current === null ? null : { monthsHeld: current.monthsHeld, lawfulMonths: current.lawfulMonths } },
    { type: "place/moved", to: "home", country: null, month },
  ]);
  ctx.apply([{ type: "status/lose" }], cause);
  closeObligations(ctx, ABROAD_TYPES, cause);
  // R-PLACE-007: the family house takes you back at the starting life's amounts.
  ctx.apply(fromStartingLife(ctx, HOME_TYPES, 10000), cause);
  const standing = ctx.content.tuning.return.standing[shape];
  const bonus = capitalBonus(ctx);
  const gains: Effect[] = [];
  if (standing !== 0) gains.push({ type: "quality/add", quality: QUALITY.standing, amount: standing });
  if (bonus !== 0) gains.push({ type: "quality/add", quality: QUALITY.standing, amount: bonus });
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
      // Leaving Lagos by the road, what is owned is sold as on a flight.
      if (place.where === "home") ctx.apply([{ type: "things/sell-off" }], cause);
      return record(ctx, [{ type: "place/moved", to: "road", country: null, month: ctx.state.turn.month }]);
    default: {
      const never: never = effect.to;
      throw new Error(`Unknown place ${String(never)}.`);
    }
  }
}

/** How the fare is paid now: from the country's currency, or from naira as a foreign fee (R-PLACE-006). Null: it cannot be. */
function farePayment(read: ReadCtx, fare: MoneyParam): Payment | null {
  const { currency, amount } = fare;
  if (check(read, { type: "money/min", currency, amount }).met) return { type: "money/take", currency, pocket: "transfer", amount, reason: "fare" };
  if (!read.content.tuning.place.fareFromNaira || currency === "NGN") return null;
  if (!check(read, { type: "money/can-pay", currency, amount }).met) return null;
  return { type: "money/pay-fee", currency, amount, reason: "fare" };
}

/** R-ROAD-009: from the far shore the only way home is the assisted scheme, with no fare. */
function fromFarShore(read: ReadCtx): boolean {
  return read.state.status.current?.entry === STATUS.euIrregular;
}

/**
 * R-PLACE-011: the way home today, as `returnHome` would take it, for the view: the fare and where it comes from, the
 * shape by `returnShape` read after the fare is paid as the wallet pays it, and the standing by the shape and the
 * capital. From the far shore the return is assisted with no fare (R-ROAD-009). Null when not abroad.
 */
function wayHomeOf(read: ReadCtx): WayHome | null {
  const fare = fareHome(read);
  const country = read.state.place.country;
  if (fare === null || country === null) return null;
  const entry = countryEntry(read.content, country);
  const offPeak: MoneyParam = { currency: entry.currency, amount: entry.fare };
  const naira = fare.currency === "NGN" ? fare.amount : feeInNaira(read, fare.currency, fare.amount);
  const standing = (after: ReadCtx, shape: ReturnShape): number => read.content.tuning.return.standing[shape] + capitalBonus(after);
  const payment = farePayment(read, fare);
  // The command's own order: a fare that cannot be paid by one who holds a status is refused before the far shore is read.
  if (payment === null && !holdsNoStatus(read)) return { fare, offPeak, paidFrom: null, naira, shape: null, standing: 0 };
  if (fromFarShore(read)) return { fare, offPeak, paidFrom: null, naira, shape: "assisted", standing: standing(read, "assisted") };
  if (payment === null) {
    const shape = returnShape(read, false);
    return { fare, offPeak, paidFrom: null, naira, shape, standing: standing(read, shape) };
  }
  const wallet = walletAfter(read, payment);
  if (wallet === null) return { fare, offPeak, paidFrom: null, naira, shape: null, standing: 0 };
  const after: ReadCtx = { ...read, state: { ...read.state, wallet } };
  const shape = returnShape(after, true);
  return { fare, offPeak, paidFrom: payment.type === "money/take" ? "local" : "naira", naira, shape, standing: standing(after, shape) };
}

/**
 * R-PLACE-004, R-STATUS-009: the fare alone, for a Gulf worker too, whether
 * the contract has ended or not.
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
  if (fromFarShore(ctx)) return comeHome(ctx, "assisted", cause);
  if (payment !== null) ctx.apply([payment], cause);
  return comeHome(ctx, returnShape(ctx, payment !== null), cause);
}

/**
 * Metres on the ground for one thousandth of a degree of latitude, everywhere; longitude's figure is the country's
 * (R-PLACE-010), since a degree of longitude shrinks toward the poles. Near Lagos the two agree.
 */
const METRES_PER_E3 = 111;

/**
 * Whether two positions in thousandths of a degree are within `metres` of each other, in whole numbers:
 * the two legs in metres and their squares against the square of the limit, so no root is taken.
 */
export function withinMetres(from: { latE3: number; lonE3: number }, to: { latE3: number; lonE3: number }, metres: number, lonMetresPerE3: number = METRES_PER_E3): boolean {
  const dx = Math.abs(to.lonE3 - from.lonE3) * lonMetresPerE3;
  const dy = Math.abs(to.latE3 - from.latE3) * METRES_PER_E3;
  return dx * dx + dy * dy <= metres * metres;
}

/** A ride's fare at home is said in fifties of naira. */
const FARE_STEP_KOBO = 5000;

/** Metres in a straight line between two positions in thousandths of a degree, in whole numbers (no root beyond the integer one). */
export function metresApart(from: { latE3: number; lonE3: number }, to: { latE3: number; lonE3: number }, lonMetresPerE3: number = METRES_PER_E3): number {
  const dx = Math.abs(to.lonE3 - from.lonE3) * lonMetresPerE3;
  const dy = Math.abs(to.latE3 - from.latE3) * METRES_PER_E3;
  return isqrt(dx * dx + dy * dy);
}

/**
 * What `rideFare` prices from: the flag-down figure, the figure a kilometre and the step the fare is rounded up to, in one
 * currency's smallest unit, and the metres a thousandth of a degree of longitude is worth in that country.
 */
export interface RideFare {
  fare: number;
  farePerKm: number;
  step: number;
  lonMetresPerE3: number;
}

/** The ways a country abroad may list, in the order the ride sheet shows them. */
const ABROAD_WAYS: readonly AbroadWay[] = ["bus", "train", "taxi"];

/** Home's figures for a way, from the tuning; null for a way only a country abroad lists. */
function homeFigures(content: Pick<Content, "tuning">, way: RideWay): RideFigures | null {
  switch (way) {
    case "drive": {
      const { fareKobo, farePerKmKobo, metresPerMinute } = content.tuning.thing.drive;
      return { fare: fareKobo, farePerKm: farePerKmKobo, metresPerMinute };
    }
    case "danfo":
    case "keke":
    case "okada":
    case "walk": {
      const { fareKobo, farePerKmKobo, metresPerMinute } = content.tuning.city.ride;
      return { fare: fareKobo[way], farePerKm: farePerKmKobo[way], metresPerMinute: metresPerMinute[way] };
    }
    case "bus":
    case "train":
    case "taxi":
      return null;
    default: {
      const never: never = way;
      throw new Error(`Unknown way ${String(never)}.`);
    }
  }
}

/** A country's figures for a way it lists; undefined for a way it does not list, and for every way of Lagos. */
function abroadFigures(rides: CountryRides, way: RideWay): RideFigures | undefined {
  switch (way) {
    case "bus":
    case "train":
    case "taxi":
      return rides.ways[way];
    case "danfo":
    case "keke":
    case "okada":
    case "walk":
    case "drive":
      return undefined;
    default: {
      const never: never = way;
      throw new Error(`Unknown way ${String(never)}.`);
    }
  }
}

function priced(figures: RideFare, from: { latE3: number; lonE3: number } | null, to: { latE3: number; lonE3: number } | null, fareBp: number): number {
  if (figures.fare === 0 && figures.farePerKm === 0) return 0;
  const metres = from === null || to === null ? 0 : metresApart(from, to, figures.lonMetresPerE3);
  return bp(roundUpTo(figures.fare + mulDiv(figures.farePerKm, metres, 1000), figures.step), fareBp);
}

/**
 * R-PLACE-010 (decision 0017): a farther place costs more. A way's fare is its flag-down figure plus its figure a
 * kilometre times the straight-line distance between the two places, rounded up to the step (fifty naira at home, the country's step abroad), then the month's factor. A place
 * with no position stands at its flag-down figure. On foot nothing. Given the figures and the step, it prices any
 * country's way, as the view's `place.ways` carries them; given content and a way, it prices a way of Lagos.
 */
export function rideFare(figures: RideFare, from: { latE3: number; lonE3: number } | null, to: { latE3: number; lonE3: number } | null, fareBp?: number): number;
export function rideFare(content: Pick<Content, "tuning">, from: { latE3: number; lonE3: number } | null, to: { latE3: number; lonE3: number } | null, way: RideWay, fareBp?: number): number;
export function rideFare(
  first: RideFare | Pick<Content, "tuning">,
  from: { latE3: number; lonE3: number } | null,
  to: { latE3: number; lonE3: number } | null,
  fourth?: RideWay | number,
  fifth: number = BP_WHOLE,
): number {
  if (!("tuning" in first)) return priced(first, from, to, typeof fourth === "number" ? fourth : BP_WHOLE);
  if (typeof fourth !== "string") throw new Error("A fare read from content needs its way.");
  // The car of your own: its fuel is its fare, by distance as the rides are, and the scarcity raises it the same.
  const figures = homeFigures(first, fourth);
  if (figures === null) throw new Error(`The way ${fourth} is not a way of Lagos.`);
  return priced({ ...figures, step: FARE_STEP_KOBO, lonMetresPerE3: first.tuning.city.ride.lonMetresPerE3 }, from, to, fifth);
}

/** The room abroad: the home there, so a walk to it is always accepted (R-PLACE-010). */
const ROOM: Id<"place"> = "place.the-room";

/**
 * R-PLACE-012 (decision 0017): the act that buys a country's pass, the country's own now-act at its
 * station's machine. Only a country whose rides carry a `pass` figure has one; Italy has none.
 */
export const PASS_ACT: Readonly<Partial<Record<Id<"country">, Id<"activity">>>> = {
  "country.uk": "activity.bus-pass-uk",
  "country.canada": "activity.transit-pass-ca",
  "country.uae": "activity.transit-pass-uae",
};

/** A country's rides, or null when it lists no way: a ride there is refused. */
function countryRides(content: Pick<Content, "tuning">, country: Id<"country">): CountryRides | null {
  const rides = content.tuning.city.ride.abroad[country];
  if (rides === undefined) return null;
  return ABROAD_WAYS.some((way) => rides.ways[way] !== undefined) ? rides : null;
}

/** R-PLACE-012: the month's pass is bought in the country the character is in, read from the month's played acts. */
function passHeld(read: ReadCtx): boolean {
  const { where, country } = read.state.place;
  if (where !== "abroad" || country === null) return false;
  const act = PASS_ACT[country];
  const pass = read.content.tuning.city.ride.abroad[country]?.pass;
  if (act === undefined || pass === undefined || pass === null) return false;
  return check(read, { type: "activity/played", activity: act }).met;
}

/** R-PLACE-012 (decision 0017): a way the country's pass covers, in a month it is bought. */
function passCovers(read: ReadCtx, rides: CountryRides, way: RideWay): boolean {
  return (rides.passWays as readonly RideWay[]).includes(way) && passHeld(read);
}

/**
 * R-PLACE-013 (decision 0017): a ride by bus to or from a place the employer's shuttle serves (the labour bus to the
 * site, the gangmaster's van to the fields) asks no fare in any month. Every other way is priced, and no other stop is
 * covered. The ride sheet reads the same from the view's `place.shuttles`.
 */
export function shuttleRide(from: Pick<PlaceEntry, "shuttle">, to: Pick<PlaceEntry, "shuttle">, way: RideWay): boolean {
  return way === "bus" && (from.shuttle || to.shuttle);
}

/** R-PLACE-013: the stops of the character's country the employer's shuttle serves, for the view; none at home or on the road. */
function shuttlesHere(read: ReadCtx): Id<"place">[] {
  const { where, country } = read.state.place;
  if (where !== "abroad" || country === null) return [];
  return Object.values(read.content.place)
    .filter((place) => place.shuttle && ofCountry(place, country))
    .map((place) => place.id);
}

/** A place of the country: an abroad place of that country, or a country-less abroad place such as the room. */
function ofCountry(place: Pick<PlaceEntry, "where" | "country">, country: Id<"country">): boolean {
  return place.where === "abroad" && (place.country === null || place.country === country);
}

/**
 * R-PLACE-010: the ways a ride may take where the character is, with their figures, so the ride
 * sheet prices with `rideFare` what the command takes. At home the four ways of Lagos, and the car while it stands at
 * home; abroad the country's ways and on foot; nothing on the road or in a country with no ways.
 */
function waysHere(read: ReadCtx): RideWayView[] {
  const { where, country } = read.state.place;
  const walk = homeFigures(read.content, "walk");
  if (walk === null) throw new Error("On foot has no figures.");
  if (where === "home") {
    const ways: RideWay[] = ["danfo", "keke", "okada", "walk", ...(drives(read) ? (["drive"] as const) : [])];
    return ways.map((way): RideWayView => {
      const figures = homeFigures(read.content, way) ?? walk;
      return { way, currency: "NGN", ...figures, step: FARE_STEP_KOBO, lonMetresPerE3: read.content.tuning.city.ride.lonMetresPerE3, passed: false };
    });
  }
  if (where !== "abroad" || country === null) return [];
  const rides = countryRides(read.content, country);
  if (rides === null) return [];
  const currency: Currency = countryEntry(read.content, country).currency;
  const listed = ABROAD_WAYS.flatMap((way): RideWayView[] => {
    const figures = rides.ways[way];
    return figures === undefined ? [] : [{ way, currency, ...figures, step: rides.step, lonMetresPerE3: rides.lonMetresPerE3, passed: passCovers(read, rides, way) }];
  });
  // On foot at the country's own pace (design page 15 section 4: the Gulf's heat slows a walk).
  return [...listed, { way: "walk", currency, ...walk, metresPerMinute: rides.walkMetresPerMinute, step: rides.step, lonMetresPerE3: rides.lonMetresPerE3, passed: false }];
}

/** The fare taken from the currency, cash first and the bank for the rest, and the ride on record (R-PLACE-010). */
function payRide(ctx: Ctx, command: Extract<Command, { type: "place/ride" }>, fare: number, currency: Currency): BaseEvent[] | Rejection {
  const { from, to, way } = command;
  const cause: Cause = { source: command.type, param: to, terms: { way } };
  if (fare > 0) {
    if (!ctx.check({ type: "money/min", currency, amount: fare }).met) {
      return reject("cannot-afford", `The ${way} fare is ${String(fare)} in ${currency} and cannot be paid.`);
    }
    ctx.apply([{ type: "money/take", currency, pocket: "any", amount: fare, reason: "fare" }], cause);
  }
  return record(ctx, [{ type: "place/rode", from, to, way, fare, currency }]);
}

/**
 * R-PLACE-010 (decision 0017), R-PLACE-012 and R-PLACE-013 (decision 0017): a ride abroad,
 * between two places of the character's country, on the country's ways or on foot. The scarcity factor is Lagos's and
 * is not applied; a way the pass covers asks nothing in a month it is bought, and the bus to or from a shuttle's stop
 * asks nothing in any month.
 */
function rideAbroad(ctx: Ctx, command: Extract<Command, { type: "place/ride" }>, country: Id<"country">): BaseEvent[] | Rejection {
  const { from, to, way } = command;
  const rides = countryRides(ctx.content, country);
  if (rides === null) return reject("not-legal", "No ride is drawn in this country yet.");
  const start = ctx.content.place[from];
  const end = ctx.content.place[to];
  if (start === undefined || end === undefined) throw new Error("A ride's places were looked up before.");
  if (!ofCountry(start, country) || !ofCountry(end, country)) return reject("not-legal", "A ride abroad stays in the country.");
  const currency = countryEntry(ctx.content, country).currency;
  if (way === "walk") {
    if (to !== ROOM && start.position !== null && end.position !== null && !withinMetres(start.position, end.position, ctx.content.tuning.city.ride.walkMetres, rides.lonMetresPerE3)) {
      return reject("not-legal", "Too far to walk.");
    }
    return payRide(ctx, command, 0, currency);
  }
  const figures = abroadFigures(rides, way);
  if (figures === undefined) return reject("not-legal", `There is no ${way} here.`);
  const free = passCovers(ctx, rides, way) || shuttleRide(start, end, way);
  const fare = free ? 0 : rideFare({ ...figures, step: rides.step, lonMetresPerE3: rides.lonMetresPerE3 }, start.position, end.position);
  return payRide(ctx, command, fare, currency);
}

/**
 * R-PLACE-010 (decision 0017): a ride between two places of the city, at home or in the
 * country the character is in. On foot there is no fare, so a character with nothing can always move. The simulation
 * keeps no place of the city, so nothing here moves; the client moves once the ride is accepted.
 */
function ride(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "place/ride") throw new Error(`place/ride cannot handle ${command.type}.`);
  const { from, to, way } = command;
  const { where, country } = ctx.state.place;
  if (where === "road") return reject("not-legal", "A ride inside a city is for a character at home or abroad.");
  const start = ctx.content.place[from];
  const end = ctx.content.place[to];
  if (start === undefined) return reject("unknown-id", `No place ${from}.`);
  if (end === undefined) return reject("unknown-id", `No place ${to}.`);
  if (from === to) return reject("not-legal", "A ride goes somewhere else.");
  if (where === "abroad") return country === null ? reject("not-legal", "Abroad with no country.") : rideAbroad(ctx, command, country);
  if (start.where !== "home" || end.where !== "home") return reject("not-legal", "A ride inside the city stays in the city.");
  if (homeFigures(ctx.content, way) === null) return reject("not-legal", `There is no ${way} in Lagos.`);
  // Drive is a way only while the life's car stands at home.
  if (way === "drive" && !drives(ctx)) return reject("not-legal", "No car stands at home to drive.");
  // On foot only within walking distance: past it a fare is the only way, so a fare is a real cost.
  // A life may always walk home, however far: the long walk is its cost.
  const home = ctx.state.home.place ?? FAMILY_HOUSE;
  if (way === "walk" && to !== home && start.position !== null && end.position !== null && !withinMetres(start.position, end.position, ctx.content.tuning.city.ride.walkMetres, ctx.content.tuning.city.ride.lonMetresPerE3)) {
    return reject("not-legal", "Too far to walk.");
  }
  return payRide(ctx, command, rideFare(ctx.content, start.position, end.position, way, fareBpOf(ctx)), "NGN");
}

/**
 * R-ROAD-007 and R-STATUS-008: the authority's way home, as `return/home`
 * does for the given shape with no fare. Abroad it is the same return. From
 * the road it is the assisted return: the family house takes the character
 * back and standing moves by the shape and the capital (R-PLACE-007,
 * R-RETURN-002); obligations of the road, the agent's debt among them, stay.
 * A return from the road is written to the record with no country, since the
 * road has none (R-ROAD-007).
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
        { type: "place/returned", shape: effect.shape, country: null, month, kept: null, keptMonths: null },
        { type: "place/moved", to: "home", country: null, month },
      ]);
      ctx.apply(fromStartingLife(ctx, HOME_TYPES, 10000), cause);
      const standing = ctx.content.tuning.return.standing[effect.shape];
      const bonus = capitalBonus(ctx);
      const gains: Effect[] = [];
      if (standing !== 0) gains.push({ type: "quality/add", quality: QUALITY.standing, amount: standing });
      if (bonus !== 0) gains.push({ type: "quality/add", quality: QUALITY.standing, amount: bonus });
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
 * R-RETURN-005. In a tick the director makes December, a character
 * abroad gets the December set piece, opened with no route so that nothing is
 * scored (R-SETPIECE-006). At most once in twelve months of
 * the character's own time, read from `decemberMonth` (R-PLACE-009), so a
 * December that spans many ticks online opens it once.
 */
function december(ctx: Ctx): BaseEvent[] {
  if (ctx.state.place.where !== "abroad" || worldVarOr(ctx.world, VAR.seasonDecember) !== 1) return [];
  if (ctx.content.setpiece[SETPIECE.december] === undefined || ctx.state.setpiece.open !== null) return [];
  const last = ctx.state.place.decemberMonth;
  if (last !== null && ctx.state.turn.month - last < MONTHS_A_YEAR) return [];
  ctx.apply([{ type: "setpiece/open", setpiece: SETPIECE.december, route: null }], { source: SETPIECE.december, param: null, terms: {} });
  if (!decemberOpen(ctx.state)) return [];
  return record(ctx, [{ type: "place/december-opened", month: ctx.state.turn.month }]);
}

/** The visit may find nothing to ask and stay shut (R-SETPIECE-001). */
function decemberOpen(state: State): boolean {
  return state.setpiece.open?.entry === SETPIECE.december;
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

/** R-PLACE-008, R-PEOPLE-026: the ban read as an application's condition, so a partner application is refused before it is paid. */
function judgeBanned(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "place/banned") throw new Error(`place/banned cannot judge ${requirement.type}.`);
  return { met: bannedNow(read, requirement.country) };
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
        heldAbroad: event.kept === null ? slice.heldAbroad : { status: event.kept, sinceMonth: event.month, monthsHeld: event.keptMonths?.monthsHeld ?? 0, lawfulMonths: event.keptMonths?.lawfulMonths ?? 0 },
      };
    case "place/token-used":
    case "place/token-lapsed":
      return { ...slice, heldAbroad: null };
    case "place/december-opened":
      return { ...slice, decemberMonth: event.month };
    // R-PLACE-010: the simulation keeps no place of the city, so a ride changes nothing here.
    case "place/rode":
      return slice;
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
    // R-WORLD-017: arrival is a toast on the screen, and the fare's own ledger line tells the money.
    case "place/rode":
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
      fareBp: fareBpOf(read),
      wayHome: wayHomeOf(read),
      ways: waysHere(read),
      shuttles: shuttlesHere(read),
    },
  };
}

/** The fuel scarcity's ask, which doubles the city's fares for the month it is on. */
const FUEL_SCARCITY = "offer.fuel-scarcity" as const;

/**
 * R-PLACE-010: the month's fares as basis points of the flat fares. The month the fuel scarcity opens
 * (answered or not: `lastOpened` keeps the month), every ride at home costs `tuning.city.ride.scarcityBp` of
 * its fare; any other month, and abroad, the fare as it stands.
 */
function fareBpOf(read: Pick<ReadCtx, "state" | "content">): number {
  // The scarcity is Lagos's (R-PLACE-010): abroad, even in the month a flight follows it, fares stand.
  if (read.state.place.where !== "home") return BP_WHOLE;
  return read.state.offer.lastOpened[FUEL_SCARCITY] === read.state.turn.month ? read.content.tuning.city.ride.scarcityBp : BP_WHOLE;
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
  commands: { "return/home": returnHome, "place/ride": ride },
  effects: {
    "place/move": move,
    // R-ROAD-007 and R-STATUS-008: the authority's way home.
    "place/return": returnEffect,
  },
  phases: { month },
  evolve,
  lines,
  requirements: { "place/is": judgeIs, "place/returned": judgeReturned, "place/months-here": judgeMonthsHere, "place/banned": judgeBanned },
  invariants,
  view,
};
