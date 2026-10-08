// The sponsor's checks: docs/rules/undertaking.md R-UNDERTAKING-002 to 005,
// judged in the sponsor's own life when they agree to sponsor (R-UNDERTAKING-001),
// and the month the five-year bar lifts (R-UNDERTAKING-004, 012). Pure readings
// of one state: the people kind calls them when a joint with this life as
// sponsor is proposed or answered, and `factsOf` reports the floor as
// `meetsFloor` (R-UNDERTAKING-003). Nothing here writes a slice.
import { jobTerms, MONTHS_PER_YEAR, paidYearly } from "../activity/activity.pay";
import { resolveAmount, worldVar } from "../engine/check";
import type { Content, Id, ReadCtx, RouteEntry } from "../engine/types";
import { isSponsorUndertaking } from "../obligation/undertaking";

/** The check that failed, for the rejection's detail (R-UNDERTAKING-001). */
export type SponsorCheck = "status" | "floor" | "bar" | "default" | "running";

function partnerRoute(content: Content, route: Id<"route">): RouteEntry & { partner: NonNullable<RouteEntry["partner"]> } {
  const entry = content.route[route];
  if (entry?.partner === undefined) throw new Error(`${route} is not a route on the partner gate.`);
  return entry as RouteEntry & { partner: NonNullable<RouteEntry["partner"]> };
}

function currencyOf(content: Content, country: Id<"country"> | null): string | null {
  return country === null ? null : (content.country[country]?.currency ?? null);
}

/**
 * R-UNDERTAKING-003: the pay a year from the job held, gross, in the currency of
 * `country`. A job marked `cash` cannot be shown and counts as none; so does a
 * job paid in another currency, or a sponsor's job with no salary recorded.
 */
export function payAYear(read: ReadCtx, country: Id<"country"> | null): number {
  const job = read.state.activity.job;
  const entry = job === null ? undefined : read.content.activity[job];
  if (entry === undefined || entry.pay === null || entry.cash === true) return 0;
  if (entry.pay.currency !== currencyOf(read.content, country)) return 0;
  const terms = jobTerms(read);
  const { amount } = entry.pay;
  if (typeof amount === "object" && "term" in amount && typeof terms[amount.term] !== "number") return 0;
  const figure = resolveAmount(read, amount, terms);
  return paidYearly(entry) ? figure : figure * MONTHS_PER_YEAR;
}

/** R-UNDERTAKING-003: the floor of a partner route met by the sponsor's own pay. A route with no floor is always met. */
export function meetsFloor(read: ReadCtx, route: Id<"route">): boolean {
  const entry = partnerRoute(read.content, route);
  if (entry.partner.floorVar === null) return true;
  return payAYear(read, entry.country) >= worldVar(read, entry.partner.floorVar);
}

/** `meetsFloor` for every partner route, as `factsOf` reports it (R-UNDERTAKING-003, R-PEOPLE-005). */
export function floorsMet(read: ReadCtx): Partial<Record<Id<"route">, boolean>> {
  const met: Partial<Record<Id<"route">, boolean>> = {};
  for (const entry of Object.values(read.content.route)) if (entry.partner !== undefined) met[entry.id] = meetsFloor(read, entry.id);
  return met;
}

/** R-UNDERTAKING-002: abroad in the route's country, holding one of its `sponsorStatuses`. */
export function holdsSponsorStatus(read: ReadCtx, route: Id<"route">): boolean {
  const entry = partnerRoute(read.content, route);
  const { place, status } = read.state;
  return place.where === "abroad" && place.country === entry.country && status.current !== null && entry.partner.sponsorStatuses.includes(status.current.entry);
}

/**
 * R-UNDERTAKING-004: the month the bar lifts, for a character who arrived on a
 * partner route into a country with a `partnerBarMonths`, while that month is
 * still to come. Null: no bar now. The people view shows it as `barUntilMonth`.
 * the view's figure is the later of this and R-INTERVIEW-010's bar,
 * which the interview kind keeps; the people kind takes the later of the two.
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

/** R-UNDERTAKING-004: the bar stands against a route into the same country as the arrival. */
function barred(read: ReadCtx, route: Id<"route">): boolean {
  const arrived = read.state.people.arrived;
  if (arrived === null || barUntilMonth(read) === null) return false;
  return read.content.route[arrived.route]?.country === partnerRoute(read.content, route).country;
}

/**
 * R-UNDERTAKING-005: an undertaking in default bars every sponsorship; one
 * still running bars a new one into its own country. an undertaking
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
 * R-UNDERTAKING-002 to 005, in that order: the first check that fails, or null
 * when the character may agree to sponsor on `route`. A rejection names it.
 */
export function sponsorCheck(read: ReadCtx, route: Id<"route">): SponsorCheck | null {
  if (!holdsSponsorStatus(read, route)) return "status";
  if (!meetsFloor(read, route)) return "floor";
  if (barred(read, route)) return "bar";
  return undertakingBars(read, route);
}
