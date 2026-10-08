// The dials' readers (docs/rules/server.md R-SERVER-030): the city shell, the
// people kind's server side and the draw service ask here, never the store.
// Each falls back to the content's number, overlay applied, when the dial is unset.
import type { ServerDeps } from "../deps";
import { readSwitches } from "./switches";

type Reads = Pick<ServerDeps, "config" | "stores" | "now" | "contents">;

/** R-CITY-032: the target headcount of a place. Throws for a place the content does not hold. */
export async function placeTarget(deps: Reads, place: string): Promise<number> {
  const entry = deps.contents.current.place[place as keyof typeof deps.contents.current.place];
  if (entry === undefined) throw new Error(`No place ${place}.`);
  const dial = (await readSwitches(deps)).dials.placeTargets[place];
  // The content check keeps a target at or under `high`; a dial set before `high` was lowered must too.
  return dial === undefined ? entry.crowd.target : Math.min(dial, entry.crowd.high);
}

/** R-PEOPLE-060: months the partner slot waits empty before computer candidates are listed. */
export async function computerAfterMonths(deps: Reads): Promise<number> {
  return (await readSwitches(deps)).dials.computerAfterMonths ?? deps.contents.current.tuning.people.computerAfterMonths;
}

/** R-LOTTERY-021: the tickets the house tops a draw's pot up to, read once when the draw opens. */
export async function topUpTickets(deps: Reads): Promise<number> {
  return (await readSwitches(deps)).dials.topUpTickets ?? deps.contents.current.tuning.lottery.topUpTickets;
}

/** True when `value` may be set as the target of `place`: a place the content holds, at or under its `high`. */
export function placeTargetFits(deps: Pick<ServerDeps, "contents">, place: string, value: number): boolean {
  const entry = deps.contents.current.place[place as keyof typeof deps.contents.current.place];
  return entry !== undefined && value <= entry.crowd.high;
}
