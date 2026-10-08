// Test support for the partner and dependant gates, the points with people, the
// undertaking and the couch: a life with the people routes in its content, and
// the people and interview slices set as those kinds' events would set them,
// so a gate test need not play a courtship first; everything else is played
// through `step`. Nothing in the simulation imports this file.
import type { Registry } from "../../engine/kind";
import { stepWith } from "../../engine/step";
import type { Bond, Cause, Content, Effect, Id, InterviewResult, Moment, PeopleSlice, PersonFacts, ReadCtx, ReportLine, Terms } from "../../engine/types";
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

/** Ada with her papers. */
export function life(base: Content, options: LifeOptions = {}): Game {
  return readyLife(base, { quiet: true, ...options });
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

/** Meetings enough, and months enough together, that the record is not thin (R-INTERVIEW-002). */
function deepRecord(game: Game): Partial<Bond> {
  const { thinMoments, thinMonths } = game.content.tuning.interview;
  const moments: Moment[] = Array.from({ length: thinMoments }, (_unused, index) => ({ n: index + 1, by: index % 2 === 0 ? "me" : "them", kind: "met", spot: "beach", what: "talked", tick: 0 }));
  const since = game.state.turn.month - thinMonths;
  return { moments, firstMonth: since, partnerMonth: since, marriedMonth: since };
}

/**
 * A bond `BOND` with these facts, and a joint on `route` with `lead` leading.
 * The record is deep unless `other` says otherwise, so a dependant
 * application opens no interview of its own (R-INTERVIEW-002).
 */
export function joint(game: Game, route: Id<"route">, lead: "me" | "them", other: Partial<Bond> = {}): void {
  setPeople(game, (slice) => ({
    ...slice,
    bonds: { ...slice.bonds, [BOND]: bond({ ...deepRecord(game), ...other }) },
    joint: { bond: BOND, route, lead, countFunds: false, standInMay: false, scores: { mine: null, theirs: null } },
  }));
}

/** This side answers every question of the open interview with its first option, as a player would, and then waits for the other (R-INTERVIEW-004, 011). */
export function answerInterview(game: Game): void {
  for (let open = game.state.interview.open; open !== null && open.answers.length < open.questions.length; open = game.state.interview.open) {
    const asked = open.questions[open.answers.length]!;
    game.accept({ type: "interview/answer", question: asked.id, option: asked.options[0]! });
  }
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
  game.state = { ...game.state, interview: { ...game.state.interview, open: { pair: "pair-1", route, questions: [], answers: [], standIn: false, thin: false } } };
}

/** Carries out effects through the engine's routing under a cause of our choosing, as another kind's handler would. */
export function applyAs(game: Game, effects: Effect[], cause: Partial<Cause> = {}, terms: Terms = {}): ReportLine[] {
  const kinds: Registry = registry().map((kind) =>
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
