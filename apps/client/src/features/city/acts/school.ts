// The sheet that sends papers to one university (world:one-action-one-sheet; route:applying-to-a-school,
// route:school-answers-by-grade): the chance of an offer in the jobs' chance words, when it answers and the deposit it asks if it
// says yes, as chips, and the grade it takes as a mark, under a building.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { int, qualityIn } from "@japacity/sim";

import { formatMoney } from "../../../shared/words/format";
import { chanceBand } from "../../../shared/words/jobs";
import { type ActFacts, type Fact } from "../../../shared/words/facts";
import { blurbOf, say, sayCount } from "../../../shared/words/text";

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

/**
 * The sheet for one school as pieces (world:one-action-one-sheet, text:show-then-tell): its line the school's own blurb; its facts the
 * chance of an offer in the jobs' words, when it answers, and the deposit it asks if it says yes; its need the grade it takes, ticked
 * when held (route:applying-to-a-school).
 */
export function schoolFacts(view: Pick<PlayerView, "qualities">, school: string): ActFacts {
  const entry = (content.school as Record<string, (typeof content.school)[keyof typeof content.school] | undefined>)[school];
  if (entry === undefined) return { line: null, facts: [], changes: [], needs: [] };
  const [soonest, latest] = entry.answerMonths;
  const answers = soonest === latest ? sayCount("ui.fact.answers-in", soonest, { count: soonest }) : say("ui.fact.answers-between", { from: soonest, to: latest });
  const facts: Fact[] = [
    { kind: "chance", band: chanceBand(offerChance(view, school)) },
    { kind: "when", words: answers },
    { kind: "bill", words: say("ui.fact.deposit-if-yes", { amount: formatMoney(entry.deposit, "GBP") }) },
  ];
  const held = qualityIn(view, GRADE) >= entry.minGrade;
  return { line: blurbOf(school), facts, changes: [], needs: [{ state: held ? "done" : "failed", words: say(`${GRADE}.value.${String(entry.minGrade)}`), id: "grade" }] };
}
