// Learning tech in words (quality:skill-bands-slow-gains, activity:study-days-capped, activity:free-path-keeps-a-streak,
// activity:paid-tech-courses, activity:bootcamp-paid-after-a-job): what a study gives a month at the band the character is in,
// how long a course runs and what it ends with, what it costs when the cost is not a price paid now, and why one waits.
// Read from the view and content only, as the act's card and sheet say it before the tap.
import { content } from "@japacity/content";
import type { ActivityOption, Effect, Id, PlayerView } from "@japacity/sim";
import { qualityIn } from "@japacity/sim";

import { formatMoney } from "./format";
import { nameOf, say, sayCount } from "./text";

const TECH = "quality.tech";
const BOOTCAMP = "activity.bootcamp";
const BOOTCAMP_LOAN = "obligation.bootcamp";

/** The groups of quality a course's closing gain is said for: a skill or a proof ("+1 Portfolio"). */
const SAID: ReadonlySet<string> = new Set(["skills", "proof", "people"]);

/** The band of `quality.tech` a figure is in, counted from the first of `tuning.quality.techBands` (quality:skill-bands-slow-gains). */
function bandOf(tech: number): number {
  let band = 0;
  content.tuning.quality.techBands.forEach((lowest, index) => {
    if (tech >= lowest) band = index;
  });
  return band;
}

/**
 * quality:skill-bands-slow-gains: what a tech study gives a month at the band the character is in now, never past its `bandUntil`
 * (activity:paid-tech-courses); null for an entry not read by band.
 */
export function bandGainNow(view: Pick<PlayerView, "qualities">, activity: string): number | null {
  const entry = content.activity[activity as Id<"activity">];
  if (entry?.bandGains === undefined) return null;
  const tech = qualityIn(view, TECH);
  const figure = entry.bandGains[bandOf(tech)] ?? 0;
  const room = entry.bandUntil === undefined ? figure : entry.bandUntil - tech;
  return Math.max(0, Math.min(figure, room));
}

/**
 * What a study by band does, on one line: "+3 Tech skill a month" for a month's study, "+1 Tech skill" for a day of class, or that it has
 * taught what it can at this level (quality:skill-bands-slow-gains). Null for an entry not read by band.
 */
export function studyDoesWords(view: Pick<PlayerView, "qualities">, activity: string): string | null {
  const gain = bandGainNow(view, activity);
  if (gain === null) return null;
  if (gain === 0) return say("ui.act.does.taught");
  const entry = content.activity[activity as Id<"activity">];
  // activity:study-days-capped: a day of class gives a third of the month's figure, so it says the month's three days together.
  if (entry?.repeat === true) return say("ui.act.does.days", { amount: gain, skill: nameOf(TECH) });
  return say("ui.act.does.skill-month", { amount: gain, skill: nameOf(TECH) });
}

function gainsOf(effects: readonly Effect[]): string[] {
  return effects.flatMap((effect) => (effect.type === "quality/add" && effect.amount > 0 && SAID.has(content.quality[effect.quality]?.group ?? "") ? [say("ui.act.does.skill", { amount: effect.amount, skill: nameOf(effect.quality) })] : []));
}

/** activity:paid-tech-courses: a course's months and what it ends with, "Three months. It ends with +1 Portfolio."; null for no course. */
export function courseWords(activity: string): string | null {
  const course = content.activity[activity as Id<"activity">]?.course;
  if (course === undefined) return null;
  const months = sayCount("ui.act.course.months", course.months, { count: course.months });
  const gains = gainsOf(course.effects);
  return gains.length === 0 ? say("ui.act.course.only", { months }) : say("ui.act.course.ends", { months, gains: gains.join(", ") });
}

/** activity:paid-tech-courses: a course's months and what it ends with, as words for chips: "3 months", ["+1 Portfolio"]; null for no course. */
export function courseParts(activity: string): { months: string; gains: string[] } | null {
  const course = content.activity[activity as Id<"activity">]?.course;
  if (course === undefined) return null;
  return { months: sayCount("ui.act.course.months", course.months, { count: course.months }), gains: gainsOf(course.effects) };
}

/**
 * What a study costs when it is not a price paid now: the diploma's fees a month as a bill (activity:paid-tech-courses), the bootcamp's
 * fee once a developer job is held (activity:bootcamp-paid-after-a-job). Null for any other.
 */
export function studyPaysWords(activity: string): string | null {
  const entry = content.activity[activity as Id<"activity">];
  if (entry === undefined) return null;
  if (activity === BOOTCAMP) {
    const term = content.obligation[BOOTCAMP_LOAN as Id<"obligation">]?.term ?? 0;
    return say("ui.act.course.after-job", { amount: formatMoney(content.tuning.activity.bootcampFee, "NGN"), months: term });
  }
  for (const milestone of entry.onMonth ?? []) {
    for (const effect of milestone.effects) {
      if (effect.type !== "obligation/open" || typeof effect.principal !== "number") continue;
      const bill = content.obligation[effect.obligation];
      if (bill === undefined || bill.term === null || bill.term <= 0) continue;
      return say("ui.act.course.monthly", { amount: formatMoney(Math.floor(effect.principal / bill.term), bill.currency), months: bill.term });
    }
  }
  return null;
}

/**
 * Why a study waits, said where its button was (activity:study-days-capped, activity:paid-tech-courses): the month's days of class are
 * taken, or another study path is held. Null when neither holds it back.
 */
export function heldBackWords(option: Pick<ActivityOption, "capped" | "onCourse">): string | null {
  if (option.capped === true) return say("ui.act.capped");
  if (option.onCourse === true) return say("ui.act.on-course");
  return null;
}

/**
 * activity:capital-opens-own-work: an act that opens own work with its capital, paid under `goods` and starting the job; the capital is not
 * given back when the work ends, so its sheet says so before the tap (world:costly-acts-confirmed).
 */
export function ownWorkCapital(activity: string): boolean {
  const entry = content.activity[activity as Id<"activity">];
  return entry !== undefined && entry.cost.some((part) => part.reason === "goods") && entry.effects.some((effect) => effect.type === "activity/start-job");
}
