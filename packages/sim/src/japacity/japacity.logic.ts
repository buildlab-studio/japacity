// Japacity: docs/rules/japacity.md. Derived, never stored: every figure here
// is worked out from the state, the world and the content each time it is
// asked for (japacity:figure-derived-each-time), so it has no slice, no events and no lines.
import { check, worldVar } from "../engine/check";
import { clamp, mulDiv } from "../engine/int";
import type { ChecklistItemView, Id, ReadCtx, Requirement, RequirementResult, RouteEntry, RouteStateName } from "../engine/types";

/**
 * Judges one requirement. Outside a step it is the engine's `check`; a test
 * may pass one that judges through its own registry, as the activity kind's
 * `paramsFor` allows.
 */
export type Judge = (requirement: Requirement) => RequirementResult;

/** States that have a figure at all: a checklist is shown from known on (route:looking-into-makes-known, japacity:heard-routes-have-no-figure). */
const FIGURED: readonly RouteStateName[] = ["known", "applying", "refused"];

/** States whose figure is whole: the route has worked (japacity:granted-route-scores-full). */
const DONE: readonly RouteStateName[] = ["granted", "departed"];

/** States past the window: once applied, the world closing it no longer matters (japacity:best-open-route-is-japacity). */
const SENT: readonly RouteStateName[] = ["applying", "granted", "departed"];

/** A window var at this or more is not closed: 2 open, 1 narrowing, 0 closed (rate.md). */
const WINDOW_NOT_CLOSED = 1;

const FULL = 100;

function entryOf(read: ReadCtx, route: Id<"route">): RouteEntry {
  const entry = read.content.route[route];
  if (entry === undefined) throw new Error(`The content has no route ${route}.`);
  return entry;
}

function stateOf(read: ReadCtx, route: Id<"route">): RouteStateName {
  return read.state.route[route]?.state ?? "unknown";
}

/**
 * What a slow item has earned while unmet: its weight times have over need,
 * rounded down (japacity:figure-sums-checklist-items).
 *
 * `have` is held between 0 and `need`, so an unmet item never earns more than
 * its weight or less than nothing, whatever a judge reports. An unmet item
 * whose `have` reaches `need` earns its whole weight: the funds item, covered
 * now but not yet held at a month end, is one. An unmet slow item whose judge
 * gives no `have` or `need`, or a need of 0 or less, earns nothing: there is
 * no share to show.
 */
function partEarned(weight: number, result: RequirementResult): number {
  const { have, need } = result;
  if (have === undefined || need === undefined || need <= 0) return 0;
  return mulDiv(weight, clamp(have, 0, need), need);
}

/**
 * Each checklist item of a route as the player sees it, judged now. The route
 * kind's view can use this for `RouteView.checklist`. `have` and `need` are
 * given on slow items only, which is where the view shows how far along.
 */
export function checklistView(read: ReadCtx, route: Id<"route">, judge: Judge = (requirement) => check(read, requirement)): ChecklistItemView[] {
  return entryOf(read, route).checklist.map((item): ChecklistItemView => {
    const result = judge(item.requirement);
    const earned = result.met ? item.weight : item.partial ? partEarned(item.weight, result) : 0;
    return {
      id: item.id,
      weight: item.weight,
      met: result.met,
      have: item.partial ? (result.have ?? null) : null,
      need: item.partial ? (result.need ?? null) : null,
      earned,
    };
  });
}

/**
 * One route's figure, 0 to 100, or null when it has none: 100 once granted or
 * departed (japacity:granted-route-scores-full), the checklist's sum from known on
 * (japacity:figure-sums-checklist-items), and none while unknown or only heard of (japacity:heard-routes-have-no-figure).
 *
 * `refused`, the state a ban holds a route in (route-gates:deception-bans-country),
 * still has its checklist figure, so the route page can show what was built.
 * It never counts toward japacity (japacity:best-open-route-is-japacity).
 */
export function routePercent(read: ReadCtx, route: Id<"route">, judge: Judge = (requirement) => check(read, requirement)): number | null {
  entryOf(read, route);
  const state = stateOf(read, route);
  if (DONE.includes(state)) return FULL;
  if (!FIGURED.includes(state)) return null;
  return checklistEarned(read, route, judge);
}

/** The checklist's earned weights, whatever the route's state, kept between 0 and 100. */
export function checklistEarned(read: ReadCtx, route: Id<"route">, judge: Judge = (requirement) => check(read, requirement)): number {
  const sum = checklistView(read, route, judge).reduce((total, item) => total + item.earned, 0);
  // japacity:figure-is-whole-percent: the content check holds the weights to 100, so this never cuts.
  return clamp(sum, 0, FULL);
}

/** True when the route's figure counts toward japacity (japacity:best-open-route-is-japacity). */
function counts(read: ReadCtx, entry: RouteEntry): boolean {
  // road:road-route-has-no-figure: the road never counts, whatever state its route is in.
  if (entry.gate === "road") return false;
  const state = stateOf(read, entry.id);
  if (SENT.includes(state)) return true;
  // A route with no window (the road, road:road-route-has-no-figure) never counts.
  if (entry.window === null) return false;
  return state === "known" && worldVar(read, entry.window) >= WINDOW_NOT_CLOSED;
}

/**
 * The character's japacity: the highest figure among the routes that count
 * (japacity:best-open-route-is-japacity). Routes are walked in content order and only a higher
 * figure replaces the best so far, so a tie goes to the route first in
 * content. Empty when no route counts.
 */
export function japacity(
  read: ReadCtx,
  judge: Judge = (requirement) => check(read, requirement),
): { percent: number | null; route: Id<"route"> | null } {
  let best: { percent: number | null; route: Id<"route"> | null } = { percent: null, route: null };
  for (const entry of Object.values(read.content.route)) {
    if (!counts(read, entry)) continue;
    const percent = routePercent(read, entry.id, judge);
    if (percent === null) continue;
    if (best.percent === null || percent > best.percent) best = { percent, route: entry.id };
  }
  return best;
}
