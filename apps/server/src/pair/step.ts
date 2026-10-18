// The pair transaction (person.md R-PEOPLE-002, R-PEOPLE-003, pair.md
// R-PAIR-004, R-PAIR-005): both characters locked in sorted id order, fresh
// facts sent to each life first when the step reads both, the step's
// authority commands, and the record written with the version it was read at.
import type { Bond, Command, PairRecord, Rejection, Sender, State, StepResult, World } from "@japacity/sim";
import { factsOf, side } from "@japacity/sim";
import { pairIds } from "@japacity/store";
import type { Refusal } from "@japacity/store";

import type { Answer } from "../authority/answer";
import { refusal } from "../authority/answer";
import { afterCommit, queueDiverged } from "../authority/commit";
import type { Diverged, Live } from "../authority/load";
import type { Turn } from "../authority/transaction";
import { transact } from "../authority/transaction";
import type { ServerDeps } from "../deps";
import type { Book } from "./book";
import { bookOf } from "./book";
import type { PairRejection } from "./codes";

type WithoutBase<T> = T extends unknown ? Omit<T, "basedOn"> : never;

/** A command as the authority sends it: the version it is based on is the life's own, filled in at sending. */
export type Order = WithoutBase<Command>;

/** Sends one command to a held life, based on its current version. */
export function sendTo(turn: Turn, live: Live, order: Order, sender: Sender = "authority"): StepResult {
  return turn.send(live, { ...order, basedOn: live.state.v }, sender);
}

/** The bond a life holds with the pair: the open one, else none. */
export function openBond(state: State, pair: string): [string, Bond] | null {
  for (const [id, bond] of Object.entries(state.people.bonds)) {
    if (bond.with.kind === "player" && bond.with.pair === pair && bond.stage !== "ended") return [id, bond];
  }
  return null;
}

/** The life on `at` of the record, when it is held, can take a command, and keeps an open bond with the pair. */
export function sideLive(lives: readonly Live[], record: PairRecord, at: "a" | "b"): Live | null {
  const id = record[at];
  if (id === "") return null;
  const live = lives.find((each) => each.id === id);
  // A life in its prologue or over takes no command but the grant (R-PROLOGUE-001, R-ENGINE-010).
  if (live === undefined || live.state.prologue.open || live.state.turn.ended) return null;
  return openBond(live.state, record.id) !== null ? live : null;
}

/** R-PEOPLE-003: each life with an open bond gets the other's facts as they are now. */
export function sendFacts(turn: Turn, lives: readonly Live[], record: PairRecord, world: World): Rejection | null {
  for (const at of ["a", "b"] as const) {
    const to = sideLive(lives, record, at);
    const about = lives.find((each) => each.id === record[at === "a" ? "b" : "a"]);
    if (to === null || about === undefined) continue;
    const sent = sendTo(turn, to, { type: "people/facts", pair: record.id, facts: factsOf(about.state, about.content, world) });
    if (!sent.ok) return sent;
  }
  return null;
}

/** What a pair step's work is given. */
interface PairCtx {
  key: string;
  lives: Live[];
  turn: Turn;
  book: Book;
  /** The held life of a character, or null. */
  live: (character: string) => Live | null;
}

export type PairWork<T> = (ctx: PairCtx) => { ok: true; value: T } | Rejection | PairRejection;

export type PairOutcome<T> =
  | { kind: "done"; value: T; lives: Live[]; world: World; at: number }
  | { kind: "rejected"; rejection: Rejection | PairRejection }
  | { kind: "diverged"; diverged: Diverged }
  | { kind: "refused"; refusal: Refusal };

/**
 * R-PEOPLE-003, R-PAIR-004: runs `work` for the pair `key` under the locks of
 * both characters (or of `ids` when given, for a record not made yet). With
 * `facts`, each life with an open bond first gets the other's fresh facts.
 * Every changed record is written with the version it was read at; a refusal
 * writes nothing. Every life the step moved is nudged after the commit.
 */
export async function pairStep<T>(deps: ServerDeps, key: string, work: PairWork<T>, options: { facts?: boolean; ids?: string[] } = {}): Promise<PairOutcome<T>> {
  const ids = options.ids ?? Object.values(pairIds(key) ?? {});
  if (ids.length === 0) throw new Error(`${key} is not a pair key.`);
  let failed: Rejection | PairRejection | null = null;
  const outcome = await transact<T>(deps, ids, (lives, turn) => {
    const book = bookOf(turn);
    const live = (character: string) => lives.find((each) => each.id === character) ?? null;
    const record = book.get(key);
    if (options.facts === true && record !== null) {
      const sent = sendFacts(turn, lives, record, turn.world);
      if (sent !== null) return sent;
    }
    const done = work({ key, lives, turn, book, live });
    if (!done.ok) {
      failed = done;
      return { ok: false, code: "not-legal", detail: done.detail };
    }
    book.flush();
    return done;
  });
  switch (outcome.kind) {
    case "done":
      await afterCommit(deps, outcome.lives, "authority");
      return { kind: "done", value: outcome.value, lives: outcome.lives, world: outcome.world, at: outcome.at };
    case "rejected":
      return { kind: "rejected", rejection: failed ?? outcome.rejection };
    case "diverged":
      await queueDiverged(deps, outcome.diverged);
      return outcome;
    case "refused":
      return outcome;
    default: {
      const never: never = outcome;
      throw new Error(`Unknown outcome ${String(never)}.`);
    }
  }
}

/** The answer a route gives for a step that did not run: a divergence or a character the store does not hold. */
export function unusual(outcome: { kind: "diverged" } | { kind: "refused"; refusal: Refusal }): Answer<never> {
  if (outcome.kind === "diverged") return refusal(409, "diverged", "A character in this pair is being checked. Try again once it is mended.");
  return refusal(404, "no-character", outcome.refusal.detail);
}

/** The side of the record a character is, or null. */
export function sideOf(record: PairRecord, character: string): "a" | "b" | null {
  return record.a === character || record.b === character ? side(record, character) : null;
}
