// Carrying one life's accepted command into the record and the other life
// (people.md R-PEOPLE-002, R-PEOPLE-003, R-PEOPLE-014, R-PEOPLE-016,
// R-PEOPLE-043; pair.md R-PAIR-004, R-PAIR-005; interview.md R-INTERVIEW-001,
// 004, 006), in the same transaction. Only a player's or a stand-in's
// command is carried; the authority's own commands are the carrying.
import type { BaseEvent, Id, InterviewResult, Moment, PairRecord, Proposal, Rejection, Sender, State } from "@japacity/sim";
import { agreed, factsOf, flip, mirror, side, stableJson } from "@japacity/sim";
import { pairIds } from "@japacity/store";

import type { Live } from "../authority/load";
import type { Turn } from "../authority/transaction";
import type { ServerDeps } from "../deps";
import type { Book } from "./book";
import { shareFamily } from "./family";
import { openBond, sendFacts, sendTo, sideLive } from "./step";

/** The events of the people and interview kinds this file reads, as they are recorded (people.events.ts, interview.events.ts). */
type Carried =
  | { type: "people/courted"; bond: string }
  | { type: "people/moment-added"; bond: string; moment: Moment }
  | { type: "people/proposed"; bond: string; proposal: Proposal }
  | { type: "people/answered"; bond: string; step: Proposal["step"]; yes: boolean }
  | { type: "people/withdrawn"; bond: string }
  | { type: "people/consented"; bond: string; countFunds: boolean; standInMay: boolean }
  | { type: "people/ended"; bond: string; by: "me" | "them" | "absence" | "block" | "drift" }
  | { type: "people/gossip-spread"; bond: string; about: string }
  | { type: "interview/opened"; pair: string; route: Id<"route">; questions: { id: string; options: string[] }[]; thin: boolean }
  | { type: "interview/closed"; pair: string };

const CARRIED: ReadonlySet<string> = new Set<Carried["type"]>([
  "people/courted",
  "people/moment-added",
  "people/proposed",
  "people/answered",
  "people/withdrawn",
  "people/consented",
  "people/ended",
  "people/gossip-spread",
  "interview/opened",
  "interview/closed",
]);

function isCarried(event: BaseEvent): boolean {
  return CARRIED.has(event.type);
}

/** The pair an event is about in this life, or null when it is about a computer. */
function pairOf(state: State, event: Carried): string | null {
  if (event.type === "interview/opened" || event.type === "interview/closed") return event.pair.includes("~") ? event.pair : null;
  const bond = state.people.bonds[event.bond];
  return bond?.with.kind === "player" ? bond.with.pair : null;
}

const reject = (code: Rejection["code"], detail: string): Rejection => ({ ok: false, code, detail });

/** What a carry is given: the transaction's records and its lives. */
export interface Scope {
  book: Book;
  turn: Turn;
  lives: readonly Live[];
}

/** The number a moment takes in a life: one after the last it holds with the pair. */
function nextN(state: State, pair: string): number {
  const found = openBond(state, pair);
  const ns = found === null ? [] : found[1].moments.map((moment) => moment.n);
  return ns.length === 0 ? 1 : Math.max(...ns) + 1;
}

/** R-PEOPLE-014, R-PEOPLE-015: a moment sent into a life, numbered after its own. */
export function momentInto(scope: Scope, to: Live, pair: string, moment: Omit<Moment, "n">): Rejection | null {
  const sent = sendTo(scope.turn, to, { type: "people/moments", pair, moments: [{ ...moment, n: nextN(to.state, pair) }] });
  return sent.ok ? null : sent;
}

/**
 * R-PAIR-005, R-PEOPLE-003: when both sides hold the same step, each life
 * gets the other's fresh facts, then `people/agreed` in its own terms, and
 * the record clears both proposals. A wedding's moment is the one side a's
 * life staged.
 */
function agreeBoth(scope: Scope, pair: string): Rejection | null {
  const record = scope.book.get(pair);
  const deal = record === null ? null : agreed(record);
  if (record === null || deal === null) return null;
  const facts = sendFacts(scope.turn, scope.lives, record, scope.turn.world);
  if (facts !== null) return facts;
  let wedding: Moment | null = null;
  for (const at of ["a", "b"] as const) {
    const to = sideLive(scope.lives, record, at);
    if (to === null) continue;
    const terms = at === "a" ? deal : mirror(deal);
    const sent = sendTo(scope.turn, to, {
      type: "people/agreed",
      pair,
      step: terms.step,
      ...(terms.route === null ? {} : { route: terms.route }),
      ...(terms.lead === null ? {} : { lead: terms.lead }),
    });
    if (!sent.ok) return sent;
    const staged = sent.events.find((event) => event.type === "people/moment-added") as { moment: Moment } | undefined;
    wedding ??= staged?.moment.kind === "wedding" ? staged.moment : null;
  }
  scope.book.write(pair, "a", { type: "pair/agreed", tick: scope.turn.world.tick });
  // each life draws its own wedding spot; the record keeps side a's.
  if (wedding !== null) scope.book.write(pair, "a", { type: "pair/moment-added", kind: "wedding", spot: wedding.spot, what: wedding.what, tick: wedding.tick });
  return null;
}

/** R-INTERVIEW-006: both sets of answers in, each life gets the other's and works out the same result. */
function scoreBoth(scope: Scope, pair: string): Rejection | null {
  const record = scope.book.get(pair);
  const interview = record?.interview ?? null;
  if (record === null || interview === null || interview.answers.a === null || interview.answers.b === null || interview.result !== null) return null;
  let result: InterviewResult | null = null;
  for (const at of ["a", "b"] as const) {
    const to = sideLive(scope.lives, record, at);
    const theirs = interview.answers[flip(at)];
    if (to === null || theirs === null) continue;
    const sent = sendTo(scope.turn, to, { type: "interview/scored", pair, theirs });
    if (!sent.ok) return sent;
    const scored = sent.events.find((event) => event.type === "interview/scored") as { result: InterviewResult } | undefined;
    result ??= scored?.result ?? null;
  }
  if (result !== null) scope.book.write(pair, "a", { type: "pair/interview-scored", result });
  return null;
}

/** One carried event of the acting life, for the pair it is about. */
function carryOne(scope: Scope, live: Live, record: PairRecord, event: Carried, forFacts: Set<string>): Rejection | null {
  const pair = record.id;
  const mine = side(record, live.id);
  const other = sideLive(scope.lives, record, flip(mine));
  const tick = scope.turn.world.tick;
  const send = (order: Parameters<typeof sendTo>[2]): Rejection | null => {
    if (other === null) return null;
    const sent = sendTo(scope.turn, other, order);
    return sent.ok ? null : sent;
  };
  switch (event.type) {
    case "people/courted":
      // Lifting a block or an end restores nothing: a new invite relinks the pair (R-PAIR-015).
      if (record.ended !== null) return reject("not-legal", "This pair has ended. A new invite is needed to court again.");
      scope.book.write(pair, mine, { type: "pair/courted", tick });
      return null;
    case "people/moment-added": {
      if (event.moment.by !== "me" || event.moment.kind === "wedding") return null;
      const { kind, spot, what } = event.moment;
      scope.book.write(pair, mine, { type: "pair/moment-added", kind, spot, what, tick: event.moment.tick });
      return other === null ? null : momentInto(scope, other, pair, { by: "them", kind, spot, what, tick: event.moment.tick });
    }
    case "people/proposed": {
      scope.book.write(pair, mine, { type: "pair/proposed", proposal: event.proposal });
      return send({ type: "people/proposal", pair, proposal: mirror(event.proposal) }) ?? agreeBoth(scope, pair);
    }
    case "people/answered":
      scope.book.write(pair, mine, { type: "pair/answered", step: event.step, yes: event.yes });
      // R-PEOPLE-034, decision 0009: a no reaches the proposer's life as people/declined.
      return event.yes ? agreeBoth(scope, pair) : send({ type: "people/declined", pair, step: event.step });
    case "people/withdrawn": {
      // R-PEOPLE-034, decision 0009: the other life's waiting proposal is withdrawn too.
      const step = record.pending[mine]?.step ?? null;
      scope.book.write(pair, mine, { type: "pair/withdrawn" });
      return step === null ? null : send({ type: "people/withdrawn", pair, step });
    }
    case "people/consented":
      scope.book.write(pair, mine, { type: "pair/consented", countFunds: event.countFunds, standInMay: event.standInMay });
      forFacts.add(pair);
      return null;
    case "people/ended":
      if (event.by === "me") {
        scope.book.write(pair, mine, { type: "pair/ended", absence: false, tick });
        return send({ type: "people/ended", pair, why: "them" });
      }
      if (event.by === "absence") {
        scope.book.write(pair, mine, { type: "pair/ended", absence: true, tick });
        return send({ type: "people/ended", pair, why: "absence" });
      }
      return null;
    case "people/gossip-spread":
      // R-PEOPLE-041: the partner hears, never with whom.
      return send({ type: "people/gossip", pair });
    case "interview/opened":
      scope.book.write(pair, mine, { type: "pair/interview-opened", route: event.route, questions: event.questions });
      return send({ type: "interview/open", pair, route: event.route, questions: event.questions, thin: event.thin });
    case "interview/closed": {
      const open = live.state.interview.open;
      if (open === null || open.pair !== pair) return null;
      scope.book.write(pair, mine, { type: "pair/interview-answered", answers: open.answers, standIn: open.standIn });
      return scoreBoth(scope, pair);
    }
    default: {
      const never: never = event;
      throw new Error(`Unknown carried event ${JSON.stringify(never)}.`);
    }
  }
}

/** The slot a life made from a sibling invite holds for the inviter (R-PEOPLE-011, people.family.ts). */
const INVITER_SLOT = "sibling-1";

/**
 * R-PEOPLE-011, decision 0009: a life made with the inviter's family waits
 * with its first sibling slot as an invited card. The simulation refuses
 * `people/link` while the prologue is open, so the link is sent the moment
 * the prologue closes, with the inviter's facts.
 * the first plan asked for the link at the accept; the kind refuses it there with prologue-open.
 */
function siblingLink(scope: Scope, live: Live, before: State): Rejection | null {
  if (!before.prologue.open || live.state.prologue.open || live.state.people.slots[INVITER_SLOT]?.state !== "invited") return null;
  for (const key of scope.book.keys()) {
    const record = scope.book.get(key);
    if (record === null || record.ended !== null || record.role !== "sibling" || (record.a !== live.id && record.b !== live.id) || openBond(live.state, key) !== null) continue;
    const other = sideLive(scope.lives, record, flip(side(record, live.id)));
    if (other === null) continue;
    const linked = sendTo(scope.turn, live, { type: "people/link", slot: INVITER_SLOT, pair: key, facts: factsOf(other.state, other.content, scope.turn.world) });
    return linked.ok ? null : linked;
  }
  return null;
}

/**
 * R-PAIR-004, R-PEOPLE-002, R-PEOPLE-003, R-PEOPLE-043: what one accepted
 * command of `live` (from its player or its stand-in) does to every record
 * it shares and every other life. Then, if its facts changed, each bonded
 * life gets them; and a player's own command clears a stand-in on its side.
 * A rejection from the other life refuses the whole command.
 */
export function carry(scope: Scope, live: Live, before: State, events: readonly BaseEvent[], sender: Sender): Rejection | null {
  const forFacts = new Set<string>();
  for (const event of events) {
    if (!isCarried(event)) continue;
    const carried = event as unknown as Carried;
    const pair = pairOf(live.state, carried);
    const record = pair === null ? null : scope.book.get(pair);
    // Only an ended record is left out of the locks; lifting an end restores nothing (R-PAIR-015).
    if (pair !== null && record === null && carried.type === "people/courted") return reject("not-legal", "This pair has ended. A new invite is needed to court again.");
    if (record === null || (record.a !== live.id && record.b !== live.id)) continue;
    const failed = carryOne(scope, live, record, carried, forFacts);
    if (failed !== null) return failed;
  }
  const waiting = siblingLink(scope, live, before);
  if (waiting !== null) return waiting;
  shareFamily(scope, live, events);
  for (const [id, bond] of Object.entries(live.state.people.bonds)) {
    if (bond.with.kind === "player" && bond.stage !== "ended" && scope.book.get(bond.with.pair) === null) {
      return reject("stale", `The bond ${id} is with a life this command did not hold. Send it again.`);
    }
  }
  const world = scope.turn.world;
  const moved = stableJson(factsOf(before, live.content, world)) !== stableJson(factsOf(live.state, live.content, world));
  for (const key of scope.book.keys()) {
    const record = scope.book.get(key);
    if (record === null || record.ended !== null || (record.a !== live.id && record.b !== live.id)) continue;
    const mine = side(record, live.id);
    const other = sideLive(scope.lives, record, flip(mine));
    if ((moved || forFacts.has(key)) && other !== null && openBond(live.state, key) !== null) {
      const sent = sendTo(scope.turn, other, { type: "people/facts", pair: key, facts: factsOf(live.state, live.content, world) });
      if (!sent.ok) return sent;
    }
    if (sender === "player" && record.standIn[mine] !== null) {
      scope.book.write(key, mine, { type: "pair/stand-in-changed", stage: null });
      if (other !== null) {
        const sent = sendTo(scope.turn, other, { type: "people/stand-in", pair: key, stage: null });
        if (!sent.ok) return sent;
      }
    }
  }
  return null;
}

/** R-PEOPLE-002: the characters bonded with `character` through a record still open, so a command of its own can reach them in one transaction. */
export async function bondedWith(deps: ServerDeps, character: string): Promise<string[]> {
  const others: string[] = [];
  for (const key of await deps.stores.invite.pairsOf(character)) {
    const row = await deps.stores.pair.get(key);
    const record = row === null ? null : (row.record as PairRecord);
    const ids = pairIds(key);
    if (record === null || record.ended !== null || ids === null) continue;
    others.push(ids.a === character ? ids.b : ids.a);
  }
  return others;
}
