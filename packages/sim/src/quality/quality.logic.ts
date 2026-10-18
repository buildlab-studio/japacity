// Qualities: docs/rules/quality.md. Every change, from any kind and from the
// month itself, goes through `change`, so every event has the same shape.
import type { RegisteredKind } from "../engine/kind";
import { readOf } from "../engine/kind";
import { sideJobHeld } from "../activity/activity.logic";
import { BP_WHOLE, clamp, mulDivCeil } from "../engine/int";
import { PROLOGUE_SOURCE } from "../prologue/prologue.logic";
import type {
  Ctx,
  Id,
  PlayerView,
  QualityEntry,
  QualitySlice,
  ReadCtx,
  ReportLine,
  Requirement,
  RequirementResult,
  Tuning,
} from "../engine/types";
import type { QualityEvent } from "./quality.events";

const AGE: Id<"quality"> = "quality.age-months";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
/** Months in a row under the run-down line at the `month` phase (R-HEALTH-001). Hidden. */
const RUN_DOWN: Id<"quality"> = "quality.run-down-months";
/** Months before another forced month may come (R-HEALTH-005). Hidden. */
export const FORCED_WAIT: Id<"quality"> = "quality.forced-wait";

/** The source named on the events of the `month` phase. */
const MONTH_SOURCE = "month";

/**
 * What a change of `amount` really applies to a quality at `current`: a skill
 * gain at or above the soft cap keeps its share of the gain, rounding up
 * (R-QUALITY-005), and then the result stops at either end of the range
 * (R-QUALITY-001). The share comes first so a cut gain still reaches the top
 * when it can.
 */
export function appliedAmount(entry: QualityEntry, current: number, amount: number, numbers: Tuning["quality"], halved = false): number {
  const cut = entry.group === "skills" && amount > 0 && current >= numbers.skillSoftAt;
  const soft = cut ? mulDivCeil(amount, numbers.skillSoftBp, BP_WHOLE) : amount;
  // R-ACTIVITY-010: a side job cuts skill gains, rounding up, so a gain of 1 still arrives.
  const asked = halved && entry.group === "skills" && soft > 0 ? mulDivCeil(soft, numbers.sideJobSkillBp, BP_WHOLE) : soft;
  return clamp(current + asked, entry.min, entry.max) - current;
}

function entryOf(content: ReadCtx["content"], quality: Id<"quality">): QualityEntry {
  const entry = content.quality[quality];
  if (entry === undefined) throw new Error(`There is no quality ${quality} in content.`);
  return entry;
}

/** A quality's value as a view lists it; 0 when the list does not hold it. */
export function qualityIn(holder: { qualities?: readonly { id: string; value: number }[] }, id: string): number {
  return holder.qualities?.find((quality) => quality.id === id)?.value ?? 0;
}

function valueOf(state: ReadCtx["state"], quality: Id<"quality">): number {
  const value = state.quality[quality];
  if (value === undefined) throw new Error(`The state holds no value for ${quality}.`);
  return value;
}

/** The one way a quality changes. A change that applies nothing records nothing (R-QUALITY-002). */
function change(ctx: Ctx, quality: Id<"quality">, amount: number, source: string): QualityEvent[] {
  const entry = entryOf(ctx.content, quality);
  const applied = appliedAmount(entry, valueOf(ctx.state, quality), amount, ctx.content.tuning.quality, sideJobHeld(readOf(ctx)));
  if (applied === 0) return [];
  return [{ type: "quality/changed", quality, amount: applied, source }];
}

/**
 * The run-down counter's two marks, read from its range. The counter
 * stops one past the warning, so its top is the month after the warning and
 * the month before it is the warning itself: with the range 0 to 3 the warning
 * comes at two months in a row (R-HEALTH-001) and illness may roll from three
 * (R-HEALTH-002). "Two months in a row" has no tuning field, so the range in
 * content carries it.
 */
function runDownMarks(content: ReadCtx["content"]): { warning: number; after: number } | null {
  const entry = content.quality[RUN_DOWN];
  return entry === undefined ? null : { warning: entry.max - 1, after: entry.max };
}

/** True while the run-down warning stands: two months or more in a row under the line (R-HEALTH-001, R-HEALTH-007). */
function runDownWarned(read: ReadCtx): boolean {
  const marks = runDownMarks(read.content);
  return marks !== null && valueOf(read.state, RUN_DOWN) >= marks.warning;
}

/** True from the month after the warning while wellbeing stays under the line: illness may roll (R-HEALTH-002). */
export function runDownSinceWarning(read: ReadCtx): boolean {
  const marks = runDownMarks(read.content);
  if (marks === null) return false;
  const wellbeing = read.state.quality[WELLBEING] ?? 0;
  return valueOf(read.state, RUN_DOWN) >= marks.after && wellbeing < read.content.tuning.health.runDownBelow;
}

/**
 * R-HEALTH-001: wellbeing is judged as the month phase leaves it, after the
 * drift, so the figure the report shows is the one that counts. Under the
 * line, the counter goes up one and stops at its top; at or over it, it is
 * back to zero.
 */
function runDown(ctx: Ctx, wellbeing: number): QualityEvent[] {
  const entry = ctx.content.quality[RUN_DOWN];
  if (entry === undefined) return [];
  const months = valueOf(ctx.state, RUN_DOWN);
  const next = wellbeing < ctx.content.tuning.health.runDownBelow ? Math.min(months + 1, entry.max) : 0;
  return change(ctx, RUN_DOWN, next - months, MONTH_SOURCE);
}

/** R-HEALTH-005: the wait before another forced month runs down one each month. */
function forcedWait(ctx: Ctx): QualityEvent[] {
  if (ctx.content.quality[FORCED_WAIT] === undefined || valueOf(ctx.state, FORCED_WAIT) === 0) return [];
  return change(ctx, FORCED_WAIT, -1, MONTH_SOURCE);
}

/** Age goes up a month (R-QUALITY-003), wellbeing drifts toward its resting point (R-QUALITY-004), and the health counters move (R-HEALTH-001, R-HEALTH-005). */
function month(ctx: Ctx): QualityEvent[] {
  const events: QualityEvent[] = [];
  if (ctx.content.quality[AGE] !== undefined) events.push(...change(ctx, AGE, 1, MONTH_SOURCE));
  if (ctx.content.quality[WELLBEING] !== undefined) {
    const { wellbeingDrift, wellbeingDriftTo } = ctx.content.tuning.quality;
    const gap = wellbeingDriftTo - valueOf(ctx.state, WELLBEING);
    // Never a full step past the target: it stops there.
    const toward = gap > 0 ? Math.min(wellbeingDrift, gap) : -Math.min(wellbeingDrift, -gap);
    const drift = change(ctx, WELLBEING, toward, MONTH_SOURCE);
    events.push(...drift);
    // The returned events are applied after the phase, so the drift is added here, and the body's hits land on it.
    const afterDrift = valueOf(ctx.state, WELLBEING) + drift.reduce((sum, event) => sum + event.amount, 0);
    const hits = body(ctx, afterDrift);
    events.push(...hits);
    const after = afterDrift + hits.filter((event) => event.quality === WELLBEING).reduce((sum, event) => sum + event.amount, 0);
    events.push(...runDown(ctx, after));
  } else events.push(...body(ctx, null));
  events.push(...forcedWait(ctx));
  return events;
}

const BELLY: Id<"quality"> = "quality.belly";
const ENERGY: Id<"quality"> = "quality.energy";

/**
 * R-QUALITY-007 (decision 0011): the body at the month's turn. A month that ends hungry or spent takes it out of
 * wellbeing; then the night's rest and the family's pot bring the belly and the energy back toward their resting point.
 */
function body(ctx: Ctx, wellbeing: number | null): QualityEvent[] {
  const events: QualityEvent[] = [];
  const { body: rule } = ctx.content.tuning.turn;
  // The phase's events land after it, so each hit on wellbeing is clamped against the running figure, never a stale one.
  let running = wellbeing;
  for (const [quality, cost] of [[BELLY, rule.hungryWellbeing], [ENERGY, rule.spentWellbeing]] as const) {
    if (ctx.content.quality[quality] === undefined) continue;
    const have = valueOf(ctx.state, quality);
    if (have < rule.lowBelow && running !== null) {
      const hit = Math.min(cost, Math.max(0, running - entryOf(ctx.content, WELLBEING).min));
      if (hit > 0) {
        events.push({ type: "quality/changed", quality: WELLBEING, amount: -hit, source: MONTH_SOURCE });
        running -= hit;
      }
    }
    const gap = rule.restTo - have;
    const toward = gap > 0 ? Math.min(rule.restBy, gap) : -Math.min(rule.restBy, -gap);
    if (toward !== 0) events.push(...change(ctx, quality, toward, MONTH_SOURCE));
  }
  return events;
}

function judgeMin(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "quality/min") throw new Error(`quality/min cannot judge ${requirement.type}.`);
  const have = valueOf(read.state, requirement.quality);
  return { met: have >= requirement.value, have, need: requirement.value };
}

function judgeMax(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "quality/max") throw new Error(`quality/max cannot judge ${requirement.type}.`);
  const have = valueOf(read.state, requirement.quality);
  return { met: have <= requirement.value, have, need: requirement.value };
}

function lineKey(event: QualityEvent, content: ReadCtx["content"]): { key: string; tone: ReportLine["tone"] } {
  if (event.source === MONTH_SOURCE) return { key: "line.quality.drift", tone: "plain" };
  const gain = event.amount > 0;
  // A job wears on you every month. Said quietly, so the report is not a wall of red.
  if (!gain && content.activity[event.source as Id<"activity">]?.slot === "main") return { key: "line.quality.worn", tone: "plain" };
  return gain ? { key: "line.quality.gain", tone: "good" } : { key: "line.quality.loss", tone: "bad" };
}

/** R-HEALTH-001: the warning, given once as the counter reaches its mark. It names wellbeing, never the hidden counter. */
function runDownLine(event: QualityEvent, state: ReadCtx["state"], content: ReadCtx["content"]): ReportLine[] {
  const marks = runDownMarks(content);
  if (marks === null || event.amount <= 0 || valueOf(state, RUN_DOWN) !== marks.warning) return [];
  return [
    {
      key: "line.quality.run-down",
      params: { quality: WELLBEING, value: valueOf(state, WELLBEING), below: content.tuning.health.runDownBelow },
      tone: "bad",
      attention: true,
      counts: [],
    },
  ];
}

function lines(event: QualityEvent, state: ReadCtx["state"], content: ReadCtx["content"]): ReportLine[] {
  switch (event.type) {
    case "quality/changed": {
      if (event.quality === RUN_DOWN) return runDownLine(event, state, content);
      const entry = content.quality[event.quality];
      // Age moves every month and says nothing new. A hidden quality must not show itself through the report.
      if (entry === undefined || !entry.shown || event.quality === AGE) return [];
      const { key, tone } = lineKey(event, content);
      return [
        {
          key,
          // The cause rides with the line, so the words say what the act did to the person, never the quality's name (R-TEXT-005).
          params: { quality: event.quality, points: Math.abs(event.amount), value: valueOf(state, event.quality), source: event.source },
          tone,
          attention: false,
          // R-QUALITY-006: a gain shows the routes it counts toward, the month's own gains too.
          counts: event.amount > 0 ? entry.counts : [],
        },
      ];
    }
    default: {
      const never: never = event.type;
      throw new Error(`Unknown quality event ${String(never)}.`);
    }
  }
}

function evolve(slice: QualitySlice, event: QualityEvent): QualitySlice {
  switch (event.type) {
    case "quality/changed":
      return { ...slice, [event.quality]: (slice[event.quality] ?? 0) + event.amount };
    default: {
      const never: never = event.type;
      throw new Error(`Unknown quality event ${String(never)}.`);
    }
  }
}

export const qualityKind: RegisteredKind<QualitySlice, QualityEvent> = {
  kind: "quality",
  // Every quality in content, at the scenario's value or else the bottom of its range.
  initial(scenario, content) {
    const slice: QualitySlice = {};
    for (const entry of Object.values(content.quality)) slice[entry.id] = scenario.qualities[entry.id] ?? entry.start ?? entry.min;
    return slice;
  },
  effects: {
    "quality/add": (ctx, effect, cause) => {
      if (effect.type !== "quality/add") throw new Error(`The quality kind cannot carry out ${effect.type}.`);
      // R-QUALITY-003: only the month moves age, except the prologue's steps (R-PROLOGUE-004).
      if (effect.quality === AGE && cause.source !== PROLOGUE_SOURCE) return [];
      return change(ctx, effect.quality, effect.amount, cause.source);
    },
  },
  phases: { month },
  evolve,
  lines,
  requirements: { "quality/min": judgeMin, "quality/max": judgeMax },
  invariants(state, content) {
    const problems: string[] = [];
    for (const [id, value] of Object.entries(state.quality)) {
      const entry = content.quality[id as Id<"quality">];
      if (entry === undefined) problems.push(`The state holds ${id}, which is not a quality in content.`);
      else if (!Number.isSafeInteger(value) || value < entry.min || value > entry.max) {
        problems.push(`${id} is ${String(value)}, not a whole number from ${String(entry.min)} to ${String(entry.max)} (R-QUALITY-001).`);
      }
    }
    for (const id of Object.keys(content.quality)) {
      if (!(id in state.quality)) problems.push(`The state holds no value for ${id}.`);
    }
    return problems;
  },
  view: (read) => {
    const { state, content } = read;
    const part: Pick<PlayerView, "qualities" | "runDown"> = {
      // R-QUALITY-007: the body is hidden from the profile but said on the screen in words, so the view carries it too.
      qualities: Object.values(content.quality)
        .filter((entry) => entry.shown || entry.id === BELLY || entry.id === ENERGY)
        .map((entry) => ({ id: entry.id, value: state.quality[entry.id] ?? entry.min })),
      // R-HEALTH-007: the warning shows as a banner while it stands.
      runDown: runDownWarned(read),
    };
    return part;
  },
};

