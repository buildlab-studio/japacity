// What following the chapter's step opens (docs/rules/world.md R-WORLD-003): the step's own card when it
// has one and its thing stands here, else the thing's acts; the Month sheet when the
// step is the month's end; else the map with the step's stop picked (none when the player stands there).
import type { StepWay } from "./nudge";

export type StepOpen = { kind: "act"; activity: string } | { kind: "thing"; thing: string } | { kind: "month" } | { kind: "map"; stop: string | null };

/** `thing`: the step's thing standing here, if any. `offered`: the activities the view offers now. `here`: the place the player stands in. */
export function stepOpen(way: StepWay, thing: string | null, offered: readonly string[], here: string): StepOpen {
  if (thing !== null) return way.opens !== undefined && offered.includes(way.opens) ? { kind: "act", activity: way.opens } : { kind: "thing", thing };
  if (way.go === null) return { kind: "month" };
  return { kind: "map", stop: way.go === here ? null : way.go };
}
