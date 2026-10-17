// What the sweep's tests share about the simulated players' runs: the lives they play and what a clean
// decision file is.
import type { Id } from "../engine/types";
import type { RunRecord } from "./players";

/** The five fixed lives and the prologue's. */
export const LIVES: Id<"scenario">[] = ["scenario.ada", "scenario.tunde", "scenario.zainab", "scenario.ngozi", "scenario.aniekan", "scenario.prologue"];

/** A decision with no earlier refusal and an unexplained share of 20% or less. */
export function cleanFile(decision: RunRecord["decisions"][number]): boolean {
  return decision.earlierRefusals === 0 && decision.unexplainedBp <= 2000;
}
