// Health: docs/rules/health.md. Illness while run down (R-HEALTH-002), its
// relapse and its worse turn (R-HEALTH-003), and the gap and the cap that keep
// forced months apart (R-HEALTH-005). The offer kind's roll calls
// `healthComeUp` once, after the month's other offers; opening an offer stays
// the offer kind's own work, handed in as `open`.
//
// What the illness leaves behind is kept in the hidden `quality.illness-course`,
// which the choices' own effects move: the chemist and ignoring each mark a
// relapse to draw, and either answer to the worse turn marks it answered.
import { readOf } from "../engine/kind";
import type { BaseEvent, Ctx, Effect, Id, OfferEntry, ReadCtx, State, Terms } from "../engine/types";
import { FORCED_WAIT, runDownSinceWarning } from "../quality/quality.logic";

const ILLNESS: Id<"offer"> = "offer.illness";
const ILLNESS_WORSE: Id<"offer"> = "offer.illness-worse";
export const COURSE: Id<"quality"> = "quality.illness-course";
const WELLBEING: Id<"quality"> = "quality.wellbeing";

/** Where the last illness stands, as `quality.illness-course` holds it. */
export const COURSE_STEP = { none: 0, chemist: 1, ignored: 2, worse: 3, answered: 4 } as const;
type CourseStep = keyof typeof COURSE_STEP;

/** The source named on what the health roll does by itself. */
const HEALTH_SOURCE = "health";

/** Opens an offer with terms that win over the entry's own: the offer kind's `openOffer`. */
export type OpenOffer = (entry: OfferEntry, terms: Terms) => BaseEvent[];

function stepOf(value: number): CourseStep {
  const found = (Object.keys(COURSE_STEP) as CourseStep[]).find((step) => COURSE_STEP[step] === value);
  if (found === undefined) throw new Error(`${COURSE} is ${String(value)}, which is no step of an illness.`);
  return found;
}

function courseOf(read: ReadCtx): CourseStep {
  return stepOf(read.state.quality[COURSE] ?? COURSE_STEP.none);
}

/** An offer of this entry stands open now. */
export function isOpen(state: State, entry: Id<"offer">): boolean {
  return Object.values(state.offer.items).some((item) => item.entry === entry);
}

/**
 * The prices come from `tuning.health`, so an overlay of the tuning moves them
 * (R-ENGINE-017). health.md gives no place for illness, so it is rolled
 * abroad too, at the naira prices; the page gives no prices abroad.
 */
function illnessTerms(read: ReadCtx): Terms {
  return { hospital: read.content.tuning.health.hospital, chemist: read.content.tuning.health.chemist };
}

function worseTerms(read: ReadCtx): Terms {
  return { hospital: read.content.tuning.health.hospitalWorse };
}


function addQuality(ctx: Ctx, quality: Id<"quality">, amount: number): BaseEvent[] {
  if (amount === 0) return [];
  const effect: Effect = { type: "quality/add", quality, amount };
  return ctx.apply([effect], { source: HEALTH_SOURCE, param: null, terms: {} });
}

function setCourse(ctx: Ctx, step: CourseStep): BaseEvent[] {
  return addQuality(ctx, COURSE, COURSE_STEP[step] - (ctx.state.quality[COURSE] ?? COURSE_STEP.none));
}

/**
 * The last month an illness could have closed: the month it opened and its
 * time to lapse. The offer kind keeps when an offer opened, not when it was
 * answered, so the gap is counted from the latest the illness could
 * have closed, which is never earlier than it really did.
 */
function lastIllnessClosed(read: ReadCtx): number | null {
  let last: number | null = null;
  for (const id of [ILLNESS, ILLNESS_WORSE]) {
    const opened = read.state.offer.lastOpened[id];
    const entry = read.content.offer[id];
    if (opened === undefined || entry === undefined) continue;
    const closed = opened + entry.expiresAfter;
    last = last === null ? closed : Math.max(last, closed);
  }
  return last;
}

/**
 * Whether illness may be rolled this month: run down since a month before
 * (R-HEALTH-001, R-HEALTH-002), nothing of the last illness pending, past the
 * gap since it closed and no forced month in the last twelve (R-HEALTH-005).
 * Never on the road, where the month is the chain's own (R-ROAD-005).
 */
function mayFallIll(read: ReadCtx): boolean {
  const { state, content } = read;
  if (state.place.where === "road" || !runDownSinceWarning(read)) return false;
  if (isOpen(read.state, ILLNESS) || isOpen(read.state, ILLNESS_WORSE) || courseOf(read) !== "none") return false;
  if ((state.quality[FORCED_WAIT] ?? 0) > 0) return false;
  const closed = lastIllnessClosed(read);
  return closed === null || state.turn.month - closed >= content.tuning.health.gapMonths;
}

/** R-HEALTH-002: the relapse after the chemist or after ignoring it, drawn at the first come-up once the illness is closed. */
function relapse(ctx: Ctx, worse: OfferEntry, step: "chemist" | "ignored", open: OpenOffer): BaseEvent[] {
  const { relapseChemistBp, relapseIgnoreBp } = ctx.content.tuning.health;
  if (!ctx.random.chance("health", step === "chemist" ? relapseChemistBp : relapseIgnoreBp)) return setCourse(ctx, "none");
  const marked = setCourse(ctx, "worse");
  return [...marked, ...open(worse, worseTerms(readOf(ctx)))];
}

/**
 * R-HEALTH-003: either way wellbeing returns to the entry's `wellbeing` term,
 * once the worse turn is over. This happens at the first come-up after it
 * closes, a month of rest or nursing later. Left unanswered when the
 * hospital could have been paid, its lapse choice (`cannot`) fails its
 * condition and the offer kind applies nothing; it is applied here all the
 * same, since the family nursed you whether or not there was money.
 */
function recover(ctx: Ctx, worse: OfferEntry, answered: boolean): BaseEvent[] {
  const events: BaseEvent[] = [];
  const lapse = worse.choices.find((choice) => choice.id === worse.onExpire);
  if (!answered && lapse !== undefined) {
    events.push(...ctx.apply(lapse.effects, { source: `${worse.id}.${lapse.id}`, param: null, terms: worseTerms(readOf(ctx)) }));
  }
  const mark = worse.terms.wellbeing;
  if (typeof mark === "number") events.push(...addQuality(ctx, WELLBEING, mark - (ctx.state.quality[WELLBEING] ?? 0)));
  return [...events, ...setCourse(ctx, "none")];
}

/** What the last illness leaves to do this month. */
function afterIllness(ctx: Ctx, worse: OfferEntry, open: OpenOffer): BaseEvent[] {
  const step = courseOf(readOf(ctx));
  switch (step) {
    case "none":
      return [];
    case "chemist":
    case "ignored":
      return isOpen(ctx.state, ILLNESS) ? [] : relapse(ctx, worse, step, open);
    case "worse":
    case "answered":
      return isOpen(ctx.state, ILLNESS_WORSE) ? [] : recover(ctx, worse, step === "answered");
    default: {
      const never: never = step;
      throw new Error(`Unknown step of an illness ${String(never)}.`);
    }
  }
}

/**
 * The health roll in the `come-up` phase, every draw on the stream `health`
 * (R-HEALTH-002): first what the last illness leaves (a relapse, or the
 * recovery from the worse turn), then a new illness at
 * `tuning.health.illnessBp` when it may come. The illness is not counted
 * against the month's limits on new and open offers (R-OFFER-001),
 * since it is no offer the character could have avoided by having others open.
 * The illness is marked `bad` but rolls at the full `illnessBp` (R-LUCK-003):
 * halving it would always apply, since wellbeing is under 30 whenever it rolls.
 */
export function healthComeUp(ctx: Ctx, open: OpenOffer): BaseEvent[] {
  const illness = ctx.content.offer[ILLNESS];
  const worse = ctx.content.offer[ILLNESS_WORSE];
  if (illness === undefined || worse === undefined || ctx.content.quality[COURSE] === undefined) return [];
  const events = afterIllness(ctx, worse, open);
  if (!mayFallIll(readOf(ctx)) || !ctx.random.chance("health", ctx.content.tuning.health.illnessBp)) return events;
  return [...events, ...open(illness, illnessTerms(readOf(ctx)))];
}
