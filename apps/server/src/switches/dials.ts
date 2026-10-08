// The dials' readers (docs/rules/server.md R-SERVER-030): the city shell, the
// people kind's server side and the draw service ask here, never the store.
// Each falls back to the content's number, overlay applied, when the dial is unset.
import type { Content } from "@japacity/sim";

import type { Contents, ServerDeps } from "../deps";
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

/**
 * R-PEOPLE-060, R-SERVER-024: how a dial the simulation reads reaches a
 * character and stays replayable. A transaction runs under the current content
 * with `computerAfterMonths` set to the dial, and that content's overlay name
 * gains `~computerAfterMonths=<n>`; the segment opened under it records the
 * name, so a replay rebuilds the same content from the bundled one, whatever
 * the dial says by then. A dial at the content's own value changes nothing.
 */
export const COMPUTER_DIAL = "~computerAfterMonths=";

/** The dialed contents of each bundled content, by months, and the bundled content each came from. */
const dialedOf = new WeakMap<Content, Map<number, Content>>();
const baseOf = new WeakMap<Content, Content>();

/** `base` with the partner dial at `months`, named by its overlay; `base` itself when the value is the same. */
export function withComputerAfterMonths(base: Content, months: number): Content {
  if (base.tuning.people.computerAfterMonths === months) return base;
  const held = dialedOf.get(base) ?? new Map<number, Content>();
  dialedOf.set(base, held);
  const known = held.get(months);
  if (known !== undefined) return known;
  const made: Content = { ...base, tuning: { ...base.tuning, people: { ...base.tuning.people, computerAfterMonths: months } }, overlay: `${base.overlay ?? ""}${COMPUTER_DIAL}${String(months)}` };
  held.set(months, made);
  baseOf.set(made, base);
  return made;
}

/** The contents a transaction runs under: the current one with the partner dial applied. */
export async function dialedContents(deps: Reads): Promise<Contents> {
  const current = withComputerAfterMonths(deps.contents.current, await computerAfterMonths(deps));
  return current === deps.contents.current ? deps.contents : { current, previous: deps.contents.previous };
}

/**
 * R-SERVER-023, R-SERVER-024: the content a segment or snapshot names: the
 * current or the one before, or one of them under a partner dial rebuilt from
 * the name. Null when the server bundles none of them.
 */
export function namedContent(contents: Contents, version: string, overlay: string | undefined): Content | null {
  const bundled = [contents.current, contents.previous].flatMap((content) => (content === null ? [] : [content, baseOf.get(content) ?? content]));
  const exact = bundled.find((content) => content.version === version && content.overlay === overlay);
  if (exact !== undefined) return exact;
  const at = overlay?.lastIndexOf(COMPUTER_DIAL) ?? -1;
  if (overlay === undefined || at < 0) return null;
  const months = overlay.slice(at + COMPUTER_DIAL.length);
  if (!/^(0|[1-9]\d{0,8})$/.test(months)) return null;
  const baseOverlay = overlay.slice(0, at) === "" ? undefined : overlay.slice(0, at);
  const base = bundled.find((content) => content.version === version && content.overlay === baseOverlay);
  if (base === undefined) return null;
  const rebuilt = withComputerAfterMonths(base, Number(months));
  return rebuilt.overlay === overlay ? rebuilt : null;
}
