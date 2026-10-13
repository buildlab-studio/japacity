// Chips earn their place (docs/design/13-the-lively-layer.md section 2, the amendment of 12 Oct 2026): a chip says only
// what is not obvious. A price shows only where there is one; "Free" only on an act a player would expect to pay for (a
// meal, a ride), never on sleep, a bath or water; the time only when it is more than a morning; at most two effect chips.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";

import { effectWordsOf, timeWordsOf } from "./acts";
import { say } from "./text";

/** The most effect chips a card carries. */
export const EFFECTS_MAX = 2;

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

/** What an act does as chips, at most two, in the order the act's words give them. */
export function chipEffectsOf(activity: string): string[] {
  const line = effectWordsOf(activity);
  if (line === null) return [];
  const parts = line.split(", ").slice(0, EFFECTS_MAX);
  return parts.map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)));
}

/** The effects as one line, at most two of them, as the sheets print it. */
export function chipEffectsLine(activity: string): string | null {
  const parts = chipEffectsOf(activity);
  if (parts.length === 0) return null;
  return parts.map((part, index) => (index === 0 ? part : part.charAt(0).toLowerCase() + part.slice(1))).join(", ");
}
