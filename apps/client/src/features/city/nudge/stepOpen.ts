// What following the chapter's step opens (docs/rules/world.md R-WORLD-003): the phone's app with the step's card
// when the step is taken on the phone (a paper asked for by a call, R-WORLD-019); the step's own card when it
// has one and its thing stands here, else the thing's acts; the Calendar when the
// step is the month's end; else the map with the step's stop picked (none when the player stands there).
import { hasWords } from "../../../shared/words/text";
import type { Nudge } from "../../../shared/world/contract";
import type { StepWay } from "./nudge";

export type StepOpen = { kind: "act"; activity: string; param?: string } | { kind: "thing"; thing: string } | { kind: "month" } | { kind: "map"; stop: string | null } | { kind: "app"; app: string; act: string | null };

/** `thing`: the step's thing standing here, if any. `offered`: the activities the view offers now. `here`: the place the player stands in. */
export function stepOpen(way: StepWay, thing: string | null, offered: readonly string[], here: string): StepOpen {
  if (way.app !== undefined) return { kind: "app", app: way.app, act: way.opens !== undefined && offered.includes(way.opens) ? way.opens : null };
  if (thing !== null) return way.opens !== undefined && offered.includes(way.opens) ? { kind: "act", activity: way.opens, ...(way.param === undefined ? {} : { param: way.param }) } : { kind: "thing", thing };
  if (way.go === null) return { kind: "month" };
  return { kind: "map", stop: way.go === here ? null : way.go };
}

/**
 * The nudge as it reads where the player stands: a step's words that name its place give way to the
 * story's `.here` words once the step's thing stands here: "Ask at
 * the hub in Yaba" in the hub reads "Find a job on the board".
 */
export function nudgeHere<Shown extends Nudge>(nudge: Shown, thing: string | null): Shown {
  const here = `${nudge.key}.here`;
  return thing !== null && nudge.key.endsWith(".nudge") && hasWords(here) ? { ...nudge, key: here } : nudge;
}
