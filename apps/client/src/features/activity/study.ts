// How long study takes to lift the English test's chance (docs/rules/world.md R-WORLD-006). The months are counted as the simulation adds English, so the card never promises
// what one month cannot do.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { int } from "@japacity/sim";

import { countWords } from "../../shared/words/count";
import { chanceBand, jobsWords } from "../../shared/words/jobs";
import { bandChanceBp, bandNeeded, type BandView, englishOf, STUDY_ENGLISH, testChance } from "../../shared/words/test";

const ENGLISH = "quality.english";
const BP_WHOLE = 10_000;
/** The furthest the card counts: past a year it says so instead of a figure. */
export const STUDY_MONTHS_MAX = 12;

/** The English one month of study adds on top of `english`, as the simulation applies a skill's gain (R-QUALITY-005, R-ACTIVITY-010). */
function gainFrom(english: number, sideJob: boolean): number {
  const entry = content.quality[ENGLISH];
  const amount = (content.activity[STUDY_ENGLISH]?.effects ?? []).reduce((sum, effect) => (effect.type === "quality/add" && effect.quality === ENGLISH ? sum + effect.amount : sum), 0);
  if (entry === undefined || amount <= 0) return 0;
  const numbers = content.tuning.quality;
  const skill = entry.group === "skills";
  const soft = skill && english >= numbers.skillSoftAt ? int.mulDivCeil(amount, numbers.skillSoftBp, BP_WHOLE) : amount;
  const asked = skill && sideJob ? int.mulDivCeil(soft, numbers.sideJobSkillBp, BP_WHOLE) : soft;
  return int.clamp(english + asked, entry.min, entry.max) - english;
}

/**
 * The study a month holds: an act that repeats is done a day at a time, and a month of it is the times a slot runs it
 * (R-ACTIVITY-019, decision 0035: three of them a month give what the month's slot gave); one that fills the month, once.
 */
function studiesAMonth(): number {
  return content.activity[STUDY_ENGLISH]?.repeat === true ? content.tuning.turn.repeatPerSlot : 1;
}

/** The months of study before one sitting stops being a long shot, or null when a year of it does not get there. */
export function studyMonths(view: Pick<PlayerView, "qualities" | "job"> & BandView): number | null {
  const needed = bandNeeded(view);
  let english = englishOf(view);
  for (let months = 1; months <= STUDY_MONTHS_MAX; months += 1) {
    for (let time = 0; time < studiesAMonth(); time += 1) {
      const gain = gainFrom(english, view.job.side !== null);
      if (gain <= 0) return null;
      english += gain;
    }
    if (chanceBand(bandChanceBp(english, needed)) !== "long") return months;
  }
  return null;
}

/** The card's advice on a long shot: how many months of study lift the chance. Null when the chance is not a long shot. */
export function studyWords(view: Pick<PlayerView, "qualities" | "job"> & BandView): string | null {
  const plain = testChance(view).study;
  if (plain === null) return null;
  const months = studyMonths(view);
  if (months === 1) return plain;
  if (months === null) return jobsWords("activity.sit-english-test.study-year");
  return jobsWords("activity.sit-english-test.study-months", { count: countWords(months) });
}
