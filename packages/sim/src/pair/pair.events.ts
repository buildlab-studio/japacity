import type { Id, InterviewResult, PairMoment, Proposal } from "../engine/types";

/** One side of a pair record. */
export type Side = "a" | "b";

/**
 * What the server writes into a pair record (pair:only-server-writes-record),
 * each from an accepted command or its events in one of the two lives. The
 * side passed with a write is the side it comes from; for `pair/stand-in-changed`
 * and `pair/deleted` it is the absent or deleted side.
 */
export type PairWrite =
  | { type: "pair/linked"; tick: number }
  | { type: "pair/courted"; tick: number }
  | { type: "pair/moment-added"; kind: PairMoment["kind"]; spot: string | null; what: string; tick: number }
  | { type: "pair/proposed"; proposal: Proposal }
  | { type: "pair/answered"; step: Proposal["step"]; yes: boolean }
  | { type: "pair/agreed"; tick: number }
  | { type: "pair/withdrawn" }
  | { type: "pair/consented"; countFunds: boolean; standInMay: boolean }
  | { type: "pair/ended"; absence: boolean; tick: number }
  | { type: "pair/blocked"; tick: number }
  | { type: "pair/unblocked" }
  | { type: "pair/stand-in-changed"; stage: "warned" | "on" | null }
  | { type: "pair/interview-opened"; route: Id<"route">; questions: { id: string; options: string[] }[] }
  | { type: "pair/interview-answered"; answers: string[]; standIn: boolean }
  | { type: "pair/interview-scored"; result: InterviewResult }
  | { type: "pair/deleted"; tick: number }
  | { type: "pair/held" }
  | { type: "pair/released" };
