// The sheet that sends papers to one university (world:one-action-one-sheet; route:applying-to-a-school,
// route:school-answers-by-grade): it names the school, the deposit it asks if it says yes, and the chance
// of an offer, in the jobs' chance words, under a building.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { int, qualityIn } from "@japacity/sim";

import { formatMoney } from "../../../shared/words/format";
import { chanceBand } from "../../../shared/words/jobs";
import { nameOf, say } from "../../../shared/words/text";

export const APPLY_TO_SCHOOL = "activity.apply-to-school";
/** The sheet's corner: a building with columns, a university. */
export const SCHOOL_ICON = "landmark";
const GRADE = "quality.education-grade";

/** The chance of an offer from this school at the character's grade, as the school's answer draws it (route:school-answers-by-grade). */
export function offerChance(view: Pick<PlayerView, "qualities">, school: string): number {
  const entry = (content.school as Record<string, (typeof content.school)[keyof typeof content.school] | undefined>)[school];
  if (entry === undefined) return 0;
  const grade = qualityIn(view, GRADE);
  const numbers = content.tuning.route;
  return int.clamp(entry.offerBp + numbers.offerPerGradeBp * (grade - entry.minGrade), 0, numbers.offerMaxBp);
}

/** The sheet's line for one school: where the papers go, the deposit if it says yes, and the chance of an offer. */
export function schoolSheetLine(view: Pick<PlayerView, "qualities">, school: string): string {
  const entry = (content.school as Record<string, (typeof content.school)[keyof typeof content.school] | undefined>)[school];
  const chance = say(`jobs.chance.${chanceBand(offerChance(view, school))}`).toLowerCase();
  return say("ui.route.apply-sheet", { school: nameOf(school), deposit: formatMoney(entry?.deposit ?? 0, "GBP"), chance });
}
