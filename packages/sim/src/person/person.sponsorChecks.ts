// The sponsor's checks: undertaking:agreeing-to-sponsor, undertaking:sponsor-settled-in-country, undertaking:sponsor-earnings-floor, undertaking:sponsored-arrivals-wait-to-sponsor, undertaking:defaults-bar-sponsoring and undertaking:view-lists-undertaking.
// Pure readings of one state, called by the people kind. Nothing here writes a slice.
import { jobTerms, MONTHS_PER_YEAR, paidYearly } from "../activity/activity.pay";
import { resolveAmount, worldVar } from "../engine/check";
import type { Content, Id, Money, ReadCtx, RouteEntry } from "../engine/types";
import { isSponsorUndertaking } from "../obligation/obligation.undertaking";

/** The check that failed, for the rejection's detail (undertaking:agreeing-to-sponsor). */
export type SponsorCheck = "status" | "floor" | "bar" | "default" | "running";

function partnerRoute(content: Content, route: Id<"route">): RouteEntry & { partner: NonNullable<RouteEntry["partner"]> } {
  const entry = content.route[route];
  if (entry?.partner === undefined) throw new Error(`${route} is not a route on the partner gate.`);
  return entry as RouteEntry & { partner: NonNullable<RouteEntry["partner"]> };
}

function currencyOf(content: Content, country: Id<"country"> | null): string | null {
  return country === null ? null : (content.country[country]?.currency ?? null);
}

/** A yearly gross figure in a currency. */
export interface YearlyPay {
  currency: Money["currency"];
  amount: number;
}

/**
 * undertaking:sponsor-earnings-floor: the pay a year from the job held, gross. A job marked
 * `cash` cannot be shown and counts as none; so does a sponsor's job with no
 * salary recorded.
 */
export function ownPayAYear(read: ReadCtx): YearlyPay | null {
  const job = read.state.activity.job;
  const entry = job === null ? undefined : read.content.activity[job];
  if (entry === undefined || entry.pay === null || entry.cash === true) return null;
  const terms = jobTerms(read);
  const { amount } = entry.pay;
  if (typeof amount === "object" && "term" in amount && typeof terms[amount.term] !== "number") return null;
  const figure = resolveAmount(read, amount, terms);
  return { currency: entry.pay.currency, amount: paidYearly(entry) ? figure : figure * MONTHS_PER_YEAR };
}

/** undertaking:sponsor-earnings-floor: a yearly figure in the currency of `country`; pay in another currency counts as none. */
function inCurrencyOf(content: Content, pay: YearlyPay | null, country: Id<"country"> | null): number {
  return pay !== null && pay.currency === currencyOf(content, country) ? pay.amount : 0;
}

/** undertaking:sponsor-earnings-floor: a partner route's floor met by this yearly pay. A route with no floor is always met. */
function floorMetBy(read: ReadCtx, entry: RouteEntry & { partner: NonNullable<RouteEntry["partner"]> }, pay: YearlyPay | null): boolean {
  if (entry.partner.floorVar === null) return true;
  return inCurrencyOf(read.content, pay, entry.country) >= worldVar(read, entry.partner.floorVar);
}

/** undertaking:sponsor-earnings-floor: the floor of a partner route met by the sponsor's own pay. */
export function meetsFloor(read: ReadCtx, route: Id<"route">): boolean {
  return floorMetBy(read, partnerRoute(read.content, route), ownPayAYear(read));
}

/**
 * `meetsFloor` for every partner route, as the facts report it (undertaking:sponsor-earnings-floor,
 * person:facts-function-is-pure): from the character's own pay, or from a computer's profile pay.
 */
export function floorsMet(read: ReadCtx, pay: YearlyPay | null = ownPayAYear(read)): Partial<Record<Id<"route">, boolean>> {
  const met: Partial<Record<Id<"route">, boolean>> = {};
  for (const entry of Object.values(read.content.route)) if (entry.partner !== undefined) met[entry.id] = floorMetBy(read, partnerRoute(read.content, entry.id), pay);
  return met;
}

/** undertaking:sponsor-settled-in-country: abroad in the route's country, holding one of its `sponsorStatuses`. */
function holdsSponsorStatus(read: ReadCtx, route: Id<"route">): boolean {
  const entry = partnerRoute(read.content, route);
  const { place, status } = read.state;
  return place.where === "abroad" && place.country === entry.country && status.current !== null && entry.partner.sponsorStatuses.includes(status.current.entry);
}

/**
 * undertaking:sponsored-arrivals-wait-to-sponsor: the month the bar lifts, for a character who arrived on a
 * partner route into a country with a `partnerBarMonths`, while that month is
 * still to come. Null: no bar now. The people view shows it as `barUntilMonth`.
 * The view shows the later of this and interview:caught-sponsor-carries-bar's bar (`sponsorBarUntil`).
 */
export function barUntilMonth(read: ReadCtx): number | null {
  const arrived = read.state.people.arrived;
  if (arrived === null) return null;
  const entry = read.content.route[arrived.route];
  if (entry?.gate !== "partner" || entry.country === null) return null;
  const months = read.content.country[entry.country]?.partnerBarMonths ?? 0;
  const until = arrived.month + months;
  return months > 0 && until > read.state.turn.month ? until : null;
}

/** undertaking:sponsored-arrivals-wait-to-sponsor: the bar stands against a route into the same country as the arrival. */
function barred(read: ReadCtx, route: Id<"route">): boolean {
  const arrived = read.state.people.arrived;
  if (arrived === null || barUntilMonth(read) === null) return false;
  return read.content.route[arrived.route]?.country === partnerRoute(read.content, route).country;
}

/**
 * interview:caught-sponsor-carries-bar: a sponsor whose interview was caught carries the applicant's
 * ban as a bar on sponsoring into that country: the month it lifts while it is
 * still to come, else null.
 */
function interviewBarUntil(read: ReadCtx): { country: Id<"country">; until: number } | null {
  const last = read.state.interview.last;
  if (last === null || last.result !== "caught") return null;
  const country = read.content.route[last.route]?.country ?? null;
  if (country === null) return null;
  const until = last.month + (read.content.country[country]?.deceptionBanMonths ?? 0);
  return until > read.state.turn.month ? { country, until } : null;
}

/** undertaking:view-lists-undertaking, interview:caught-sponsor-carries-bar: the later of the two bars, as the people view shows it. */
export function sponsorBarUntil(read: ReadCtx): number | null {
  const bars = [barUntilMonth(read), interviewBarUntil(read)?.until ?? null].filter((month): month is number => month !== null);
  return bars.length === 0 ? null : Math.max(...bars);
}

/**
 * undertaking:defaults-bar-sponsoring: an undertaking in default bars every sponsorship; one
 * still running bars a new one into its own country. An undertaking
 * names no country, so it is the country whose currency it is owed in.
 */
function undertakingBars(read: ReadCtx, route: Id<"route">): SponsorCheck | null {
  const currency = currencyOf(read.content, partnerRoute(read.content, route).country);
  let running = false;
  for (const item of Object.values(read.state.obligation.items)) {
    const entry = read.content.obligation[item.entry];
    if (entry === undefined || !isSponsorUndertaking(entry)) continue;
    if (item.state === "defaulted") return "default";
    if (entry.currency === currency) running = true;
  }
  return running ? "running" : null;
}

/**
 * undertaking:sponsor-settled-in-country, undertaking:sponsor-earnings-floor, undertaking:sponsored-arrivals-wait-to-sponsor and undertaking:defaults-bar-sponsoring, in that order: the first check that fails, or null
 * when the character may agree to sponsor on `route`. A rejection names it.
 */
export function sponsorCheck(read: ReadCtx, route: Id<"route">): SponsorCheck | null {
  if (!holdsSponsorStatus(read, route)) return "status";
  if (!meetsFloor(read, route)) return "floor";
  if (barred(read, route)) return "bar";
  const interviewBar = interviewBarUntil(read);
  if (interviewBar !== null && interviewBar.country === partnerRoute(read.content, route).country) return "bar";
  return undertakingBars(read, route);
}
