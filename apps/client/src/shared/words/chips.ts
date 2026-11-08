// Chips earn their place (docs/design/09-the-games-look.md section 2): a chip says only
// what is not obvious. A price shows only where there is one; "Free" only on an act a player would expect to pay for (a
// meal, a ride), never on sleep, a bath or water; the time only when it is more than a morning. What an act changes is a tag
// (shared/words/facts.ts), at most two gains.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";

import { timeWordsOf } from "./acts";
import { say } from "./text";

/** True when a free act is one a player would expect to pay for, a meal: then, and only then, it says Free. */
export function freeShown(activity: string): boolean {
  const entry = content.activity[activity as Id<"activity">];
  if (entry === undefined) return false;
  const fills = entry.effects.some((effect) => effect.type === "quality/add" && effect.quality === "quality.belly" && effect.amount > 0);
  return fills || entry.cost.some((part) => part.reason === "food");
}

/** The time an act takes as a chip, only when it is more than a morning; null otherwise. `halfDays`: the view's own, when a thing owned changes it. */
export function chipTimeOf(activity: string, halfDays?: number): string | null {
  const time = timeWordsOf(activity, halfDays);
  return time === null || time === say("ui.world.time.morning") ? null : time;
}
