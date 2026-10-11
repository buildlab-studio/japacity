// When the plan stretches the character (docs/rules/world.md R-WORLD-030): a job held and two things
// beside it that tire, a side job among them or two commitments that carry on. The Calendar says it in one
// line with no figure; what it costs is the simulation's, as it already is. The study done act by act
// (decision 0035, R-ACTIVITY-019) answers at once and carries nothing on, so it never stretches the day here.
import { content } from "@japacity/content";
import type { Id, PlayerView, SlotPick } from "@japacity/sim";

import { plannable } from "../words/acts";
import { hasWords, say } from "../words/text";
import { isMonthAct } from "./days";

const WELLBEING = "quality.wellbeing";

/** True for an act that gives wellbeing back (rest, time with family, the run): it never stretches anyone. */
export function restores(activity: string): boolean {
  const entry = content.activity[activity as Id<"activity">];
  return entry?.effects.some((effect) => effect.type === "quality/add" && effect.quality === WELLBEING && effect.amount > 0) ?? false;
}

function shortName(activity: string): string {
  const key = `ui.days.short.${activity}`;
  return hasWords(key) ? say(key) : say(`${activity}.name`).toLowerCase();
}

/** The stretched line for this plan, or null when the plan does not stretch the character. */
export function stretchedWords(view: Pick<PlayerView, "job">, plan: readonly (SlotPick | null)[]): string | null {
  if (view.job.id === null) return null;
  const tiring = plan.flatMap((pick) => (pick !== null && plannable(pick.activity) && isMonthAct(pick.activity) && !restores(pick.activity) ? [pick.activity] : []));
  const beside = [...tiring, ...(view.job.side === null ? [] : [view.job.side])];
  const first = beside[0];
  const last = beside.at(-1);
  if (beside.length < 2 || first === undefined || last === undefined) return null;
  return say("ui.days.stretched", { first: shortName(first), second: shortName(last) });
}
