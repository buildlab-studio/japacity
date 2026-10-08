// Test support for the partner and dependant gates, the points with people, the
// undertaking and the couch: a life with the people routes joined to its content,
// and the people and interview slices set as those kinds' events would set them.
// The people and interview kinds are other agents' and still answer every
// command with `not-legal`, so their slices are written here; everything else
// is played through `step`. Nothing in the simulation imports this file.
import type { Registry } from "../../engine/kind";
import { stepWith } from "../../engine/step";
import type { Bond, Cause, Content, Effect, Id, InterviewResult, PeopleSlice, PersonFacts, ReadCtx, ReportLine, Requirement, RequirementResult, Terms } from "../../engine/types";
import { registry } from "../../kinds";
import type { Game } from "../../testing/play";
import type { LifeOptions } from "../route.journey";
import { readyLife } from "../route.journey";

export const UK_PARTNER: Id<"route"> = "route.uk-partner";
export const CA_SPOUSE: Id<"route"> = "route.ca-spouse";
export const UK_DEPENDANT: Id<"route"> = "route.uk-dependant";
export const CA_ACCOMPANY: Id<"route"> = "route.ca-accompany";
export const SKILLED: Id<"route"> = "route.uk-skilled";
export const CANADA: Id<"route"> = "route.canada-points";
export const BOND = "bond-1";

/** What the people kind's `people/bond` will judge, read from the bonds' facts, until that kind is built. */
function judgeBond(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "people/bond") throw new Error(`The stand-in judges people/bond, not ${requirement.type}.`);
  const met = Object.values(read.state.people.bonds).some((bond) => {
    const facts = bond.facts;
    if (bond.role !== requirement.role || !requirement.stages.includes(bond.stage)) return false;
    if (requirement.where !== undefined && facts?.where !== requirement.where) return false;
    if (requirement.country !== undefined && facts?.country !== requirement.country) return false;
    return requirement.statuses === undefined || (facts?.status !== null && facts?.status !== undefined && requirement.statuses.includes(facts.status));
  });
  return { met };
}

/** The real registry with `people/bond` judged from the facts, so a partner route is heard through its own `hearIf`. */
export function peopleJudged(): Registry {
  return registry().map((kind) => (kind.kind !== "people" ? kind : { ...kind, requirements: { ...kind.requirements, "people/bond": judgeBond } }));
}

/** Ada with her papers, from a content with the people routes joined, and `people/bond` judged from the facts. */
export function life(base: Content, options: LifeOptions = {}): Game {
  return readyLife(base, { quiet: true, kinds: peopleJudged(), ...options });
}

export function facts(over: Partial<PersonFacts> = {}): PersonFacts {
  return {
    label: "player",
    ageMonths: 360,
    where: "home",
    country: null,
    status: null,
    statusMonthsLeft: null,
    monthsInCountry: 0,
    job: null,
    meetsFloor: {},
    eduLevel: 3,
    englishBand: 70,
    home: "city",
    joint: null,
    funds: null,
    assistanceTaken: 0,
    sponsorReady: null,
    ...over,
  };
}

export function bond(over: Partial<Bond> = {}): Bond {
  return {
    with: { kind: "player", pair: "pair-1" },
    role: "partner",
    stage: "married",
    firstMonth: 0,
    partnerMonth: 0,
    marriedMonth: 0,
    lastMomentMonth: 0,
    moments: [],
    facts: null,
    pending: { mine: null, theirs: null },
    standIn: null,
    ended: null,
    cooldownUntil: null,
    ...over,
  };
}

/** The people slice changed as the people kind's events would change it. */
export function setPeople(game: Game, change: (slice: PeopleSlice) => PeopleSlice): void {
  game.state = { ...game.state, people: change(game.state.people) };
}

/** A bond `BOND` with these facts, and a joint on `route` with `lead` leading. */
export function joint(game: Game, route: Id<"route">, lead: "me" | "them", other: Partial<Bond> = {}): void {
  setPeople(game, (slice) => ({
    ...slice,
    bonds: { ...slice.bonds, [BOND]: bond(other) },
    joint: { bond: BOND, route, lead, countFunds: false, standInMay: false },
  }));
}

/** The facts on `BOND` replaced, as `people/facts` would replace them. */
export function setFacts(game: Game, change: (now: PersonFacts) => PersonFacts): void {
  setPeople(game, (slice) => {
    const held = slice.bonds[BOND];
    if (held === undefined) throw new Error("No bond to change the facts of.");
    return { ...slice, bonds: { ...slice.bonds, [BOND]: { ...held, facts: change(held.facts ?? facts()) } } };
  });
}

/** A sibling bond with these facts. */
export function sibling(game: Game, id: string, over: Partial<PersonFacts>): void {
  setPeople(game, (slice) => ({ ...slice, bonds: { ...slice.bonds, [id]: bond({ role: "sibling", stage: "connected", facts: facts(over) }) } }));
}

/** The interview's last result, as `interview/scored` would record it (R-INTERVIEW-009). */
export function scored(game: Game, route: Id<"route">, result: InterviewResult): void {
  game.state = { ...game.state, interview: { ...game.state.interview, open: null, last: { route, result, matched: 0, asked: 5, month: game.state.turn.month } } };
}

/** An interview open on `route`, as `interview/open` would open it. */
export function interviewOpen(game: Game, route: Id<"route">): void {
  game.state = { ...game.state, interview: { ...game.state.interview, open: { pair: "pair-1", route, questions: [], answers: [], standIn: false } } };
}

/** Carries out effects through the engine's routing under a cause of our choosing, as another kind's handler would. */
export function applyAs(game: Game, effects: Effect[], cause: Partial<Cause> = {}, terms: Terms = {}): ReportLine[] {
  const kinds: Registry = peopleJudged().map((kind) =>
    kind.kind !== "offer" ? kind : { ...kind, commands: { ...kind.commands, "offer/choose": (ctx) => ctx.apply(effects, { source: "test", param: null, terms, ...cause }) } },
  );
  const result = stepWith(kinds, game.state, { type: "offer/choose", offer: "x", choice: "y", basedOn: game.state.v }, game.world(), game.content);
  if (!result.ok) throw new Error(`The effects were rejected with ${result.code}: ${result.detail}`);
  game.state = result.state;
  return result.lines;
}

export function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}
