// What one life knows of another person: docs/rules/people.md R-PEOPLE-001,
// R-PEOPLE-005 and R-PEOPLE-046 to 048. Pure: the server, the kind and the
// tests all read the same facts, and none of it reads the seed or a secret.
import { resolveAmount } from "../engine/check";
import type { Content, Id, PeopleSlice, PersonEntry, PersonFacts, ReadCtx, RouteStateName, State, World } from "../engine/types";
import { fundsCurrency, fundsShown } from "../route/route.logic";
import { floorsMet } from "./sponsor-checks";

export const AGE: Id<"quality"> = "quality.age-months";
const EDUCATION: Id<"quality"> = "quality.edu-level";
const ENGLISH: Id<"document"> = "document.english-test";

/** The route this life holds for its joint: the lead route when leading, else the one it follows on. */
export function jointRouteOf(slice: PeopleSlice, content: Content): Id<"route"> | null {
  const { joint } = slice;
  if (joint === null) return null;
  if (joint.lead === "me") return joint.route;
  return content.route[joint.route]?.dependants ?? joint.route;
}

/**
 * R-PEOPLE-005: this character's facts as the server hands them to another life.
 * `funds` only under consent (R-PEOPLE-004), valued as R-ROUTE-010 values them
 * for the joint route; pay only as `meetsFloor`.
 */
export function factsOf(state: State, content: Content, world: World): PersonFacts {
  const read: ReadCtx = { state, content, world };
  const month = state.turn.month;
  const current = state.status.current;
  const abroad = state.place.where === "abroad";
  const english = state.document[ENGLISH];
  const { joint } = state.people;
  const jointRoute = jointRouteOf(state.people, content);
  const jointState: RouteStateName | null = jointRoute === null ? null : (state.route[jointRoute]?.state ?? "unknown");
  const funds = joint !== null && joint.countFunds && state.route[joint.route] !== undefined ? { currency: fundsCurrency(read, joint.route), amount: fundsShown(read, joint.route) } : null;
  return {
    label: "player",
    ageMonths: state.quality[AGE] ?? 0,
    where: state.place.where,
    country: state.place.country,
    status: current?.entry ?? null,
    statusMonthsLeft: current?.expiresMonth === null || current === null ? null : Math.max(0, current.expiresMonth - month),
    monthsInCountry: abroad ? Math.max(0, month - state.place.movedMonth) : 0,
    job: state.activity.job,
    meetsFloor: floorsMet(read),
    eduLevel: state.quality[EDUCATION] ?? 0,
    englishBand: english?.state === "held" ? english.value : null,
    // A fixed life has no family draw, and the fixed lives all start in the city.
    home: state.prologue.draw?.town ?? "city",
    joint: jointRoute === null || jointState === null ? null : { route: jointRoute, state: jointState },
    funds,
    assistanceTaken: state.people.assistanceTaken,
    sponsorReady: state.people.sponsoring?.route ?? null,
  };
}

/** Where a computer character is at the character's month (R-PEOPLE-047). */
function abroadAt(entry: PersonEntry, month: number): boolean {
  const { country, abroadFromMonth } = entry.profile;
  return country !== null && abroadFromMonth !== null && month >= abroadFromMonth;
}

/**
 * R-PEOPLE-046 to 048: a computer character's facts, built from its entry at
 * the character's month. Its age is kept on the bond and moves with the months.
 * A computer's status never runs out, so `statusMonthsLeft` is null.
 */
export function computerFacts(read: ReadCtx, entry: PersonEntry, ageMonths: number, month: number): PersonFacts {
  const { profile } = entry;
  const abroad = abroadAt(entry, month);
  const settled = abroad && profile.settledStatus !== null && profile.settledFromMonth !== null && month >= profile.settledFromMonth;
  const status = !abroad ? null : settled ? profile.settledStatus : profile.status;
  const job = profile.job === null ? undefined : read.content.activity[profile.job];
  const pay = profile.pay === null || job?.cash === true ? null : { currency: profile.pay.currency, amount: resolveAmount(read, profile.pay.amount) };
  const country = abroad ? profile.country : null;
  const sponsorReady = Object.values(read.content.route).find((route) => {
    const sponsorStatuses = route.partner?.sponsorStatuses ?? [];
    return route.country === country && status !== null && sponsorStatuses.includes(status);
  });
  const meetsFloor = floorsMet(read, pay);
  return {
    label: "computer",
    ageMonths,
    where: abroad ? "abroad" : "home",
    country,
    status,
    statusMonthsLeft: null,
    monthsInCountry: abroad ? month - (profile.abroadFromMonth ?? 0) : 0,
    job: abroad || profile.country === null ? profile.job : null,
    meetsFloor,
    eduLevel: profile.eduLevel,
    englishBand: profile.englishBand,
    home: profile.home,
    joint: null,
    funds: null,
    assistanceTaken: 0,
    sponsorReady: sponsorReady !== undefined && meetsFloor[sponsorReady.id] === true ? sponsorReady.id : null,
  };
}
