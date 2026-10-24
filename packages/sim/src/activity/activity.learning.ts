// Learning tech at home, read from the state: quality:skill-bands-slow-gains, activity:study-days-capped,
// activity:free-path-keeps-a-streak, activity:paid-tech-courses and activity:bootcamp-paid-after-a-job. Pure: the slots,
// the now-acts and the view all read the same figures.
import { divFloor } from "../engine/int";
import type { ActivityEntry, Id, ReadCtx, State } from "../engine/types";

const TECH: Id<"quality"> = "quality.tech";
/** The day's coding class: capped at `tuning.turn.studyDaysCap` a month, each day a share of the free path's month. */
export const LEARN_TECH: Id<"activity"> = "activity.learn-tech";
/** The free path: a month-act with a streak of months. */
export const FREE_PATH: Id<"activity"> = "activity.learn-free";
/** The full-time bootcamp: once a life, holding the main slot, paid after a developer job. */
export const BOOTCAMP: Id<"activity"> = "activity.bootcamp";
/** The developer jobs whose first start opens the bootcamp's loan (activity:bootcamp-paid-after-a-job). */
export const DEVELOPER_JOBS: readonly Id<"activity">[] = ["activity.job-junior-developer", "activity.job-mid-developer", "activity.job-remote-developer"];
/** The hunt the bootcamp helps for a while after it (activity:paid-tech-courses). */
export const JUNIOR_DEVELOPER: Id<"activity"> = "activity.job-junior-developer";
/** The ceiling a certificate's tech never passes (activity:free-path-keeps-a-streak). */
const CERTIFICATE_UNTIL = 69;

/** quality:skill-bands-slow-gains: the band a tech figure is in, counted from the first of `techBands`. */
export function techBand(bands: readonly number[], tech: number): number {
  let band = 0;
  bands.forEach((lowest, index) => {
    if (tech >= lowest) band = index;
  });
  return band;
}

function techOf(state: State): number {
  return state.quality[TECH] ?? 0;
}

/**
 * quality:skill-bands-slow-gains: an entry's gain a month at the band the character is in now: nothing for a band it names no figure for,
 * and never past its `bandUntil` (activity:paid-tech-courses). quality:high-skills-gain-slower halves what is left where the quality kind applies it.
 */
export function bandGain(read: ReadCtx, entry: ActivityEntry): number {
  if (entry.bandGains === undefined) return 0;
  const tech = techOf(read.state);
  const figure = entry.bandGains[techBand(read.content.tuning.quality.techBands, tech)] ?? 0;
  const room = entry.bandUntil === undefined ? figure : entry.bandUntil - tech;
  return Math.max(0, Math.min(figure, room));
}

/**
 * activity:study-days-capped: the nth day of class this month gives the month's figure times n over the cap, rounded down, less what the
 * earlier days gave, so the cap's days together give the free path's month at the band.
 */
export function dayGain(read: ReadCtx, entry: ActivityEntry, day: number): number {
  const month = bandGain(read, entry);
  const cap = read.content.tuning.turn.studyDaysCap;
  return Math.max(0, divFloor(month * day, cap) - divFloor(month * (day - 1), cap));
}

/** activity:study-days-capped: the days of class taken now this month. */
export function classDaysNow(state: State): number {
  return (state.activity.now ?? []).filter((pick) => pick.activity === LEARN_TECH).length;
}

/** activity:paid-tech-courses: the entry is the path held now. */
export function holdsCourse(state: State, entry: Pick<ActivityEntry, "id">): boolean {
  return state.activity.study?.activity === entry.id;
}

/**
 * activity:paid-tech-courses, activity:study-days-capped and activity:free-path-keeps-a-streak: one tech study at a time. While a path is
 * held, the day's class, the free path and every other path are refused.
 */
export function onCourse(state: State, entry: ActivityEntry): boolean {
  const held = state.activity.study;
  if (held === undefined) return false;
  if (entry.course !== undefined) return held.activity !== entry.id;
  return entry.id === LEARN_TECH || entry.id === FREE_PATH;
}

/** activity:paid-tech-courses: the bootcamp is once a life, so one started and left, or finished, is never begun again. */
export function bootcampTaken(state: State, entry: Pick<ActivityEntry, "id">): boolean {
  return entry.id === BOOTCAMP && !holdsCourse(state, entry) && (state.activity.played[BOOTCAMP] ?? 0) > 0;
}

/** activity:paid-tech-courses: the bootcamp held keeps every main job off the board, since no job is held meanwhile. */
export function onBootcamp(state: State): boolean {
  return state.activity.study?.activity === BOOTCAMP;
}

/**
 * activity:paid-tech-courses: a path whose fees are an obligation (the diploma) is behind while one of its instalments is missed; a month
 * behind gives nothing and does not count.
 */
export function behindOnFees(read: ReadCtx, entry: ActivityEntry): boolean {
  const fees = (entry.onMonth ?? []).flatMap((step) => step.effects).flatMap((effect) => (effect.type === "obligation/open" ? [effect.obligation] : []));
  return Object.values(read.state.obligation.items).some((item) => fees.includes(item.entry) && item.missed > 0);
}

/** activity:paid-tech-courses: the bootcamp's help to the junior developer's hunt, while its months after it run. */
export function bootcampHelpBp(read: ReadCtx, job: Id<"activity">): number {
  const done = read.state.activity.bootcampDone;
  const { bootcampHireBp, bootcampHireMonths } = read.content.tuning.activity;
  return job === JUNIOR_DEVELOPER && done !== undefined && read.state.turn.month - done < bootcampHireMonths ? bootcampHireBp : 0;
}

/** activity:free-path-keeps-a-streak: what a certificate adds to tech: its figure, never past 69. */
export function certificateTech(read: ReadCtx): number {
  return Math.max(0, Math.min(read.content.tuning.activity.freeCertTech, CERTIFICATE_UNTIL - techOf(read.state)));
}
