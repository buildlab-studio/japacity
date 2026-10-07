// Qualities: docs/rules/quality.md. Every change, from any kind and from the
// month itself, goes through `change`, so every event has the same shape.
import type { RegisteredKind } from "../engine/kind";
import { clamp, divCeil } from "../engine/int";
import type {
  Ctx,
  Id,
  QualityEntry,
  QualitySlice,
  ReadCtx,
  ReportLine,
  Requirement,
  RequirementResult,
} from "../engine/types";
import type { QualityEvent } from "./quality.events";

const AGE: Id<"quality"> = "quality.age-months";
const WELLBEING: Id<"quality"> = "quality.wellbeing";

/** The source named on the events of the `month` phase. */
export const MONTH_SOURCE = "month";

/**
 * What a change of `amount` really applies to a quality at `current`: a skill
 * gain at or above the soft cap is halved, rounding up (R-QUALITY-005), and
 * then the result stops at either end of the range (R-QUALITY-001). Halving
 * comes first so a halved gain still reaches the top when it can.
 */
export function appliedAmount(entry: QualityEntry, current: number, amount: number, softAt: number): number {
  const asked = entry.group === "skills" && amount > 0 && current >= softAt ? divCeil(amount, 2) : amount;
  return clamp(current + asked, entry.min, entry.max) - current;
}

function entryOf(content: ReadCtx["content"], quality: Id<"quality">): QualityEntry {
  const entry = content.quality[quality];
  if (entry === undefined) throw new Error(`There is no quality ${quality} in content.`);
  return entry;
}

function valueOf(state: ReadCtx["state"], quality: Id<"quality">): number {
  const value = state.quality[quality];
  if (value === undefined) throw new Error(`The state holds no value for ${quality}.`);
  return value;
}

/** The one way a quality changes. A change that applies nothing records nothing (R-QUALITY-002). */
function change(ctx: Ctx, quality: Id<"quality">, amount: number, source: string): QualityEvent[] {
  const entry = entryOf(ctx.content, quality);
  const applied = appliedAmount(entry, valueOf(ctx.state, quality), amount, ctx.content.tuning.quality.skillSoftAt);
  if (applied === 0) return [];
  return [{ type: "quality/changed", quality, amount: applied, source }];
}

/** Age goes up a month (R-QUALITY-003) and wellbeing drifts toward its resting point (R-QUALITY-004). */
function month(ctx: Ctx): QualityEvent[] {
  const events: QualityEvent[] = [];
  if (ctx.content.quality[AGE] !== undefined) events.push(...change(ctx, AGE, 1, MONTH_SOURCE));
  if (ctx.content.quality[WELLBEING] !== undefined) {
    const { wellbeingDrift, wellbeingDriftTo } = ctx.content.tuning.quality;
    const gap = wellbeingDriftTo - valueOf(ctx.state, WELLBEING);
    // Never a full step past the target: it stops there.
    const toward = gap > 0 ? Math.min(wellbeingDrift, gap) : -Math.min(wellbeingDrift, -gap);
    events.push(...change(ctx, WELLBEING, toward, MONTH_SOURCE));
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

function lines(event: QualityEvent, state: ReadCtx["state"], content: ReadCtx["content"]): ReportLine[] {
  switch (event.type) {
    case "quality/changed": {
      const entry = content.quality[event.quality];
      // Age moves every month and says nothing new. A hidden quality must not show itself through the report.
      if (entry === undefined || !entry.shown || event.quality === AGE) return [];
      const { key, tone } = lineKey(event, content);
      return [
        {
          key,
          params: { quality: event.quality, points: Math.abs(event.amount), value: valueOf(state, event.quality) },
          tone,
          attention: false,
          // R-QUALITY-006: a gain shows the routes it counts toward.
          counts: event.amount > 0 && event.source !== MONTH_SOURCE ? entry.counts : [],
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
    for (const entry of Object.values(content.quality)) slice[entry.id] = scenario.qualities[entry.id] ?? entry.min;
    return slice;
  },
  effects: {
    "quality/add": (ctx, effect, cause) => {
      if (effect.type !== "quality/add") throw new Error(`The quality kind cannot carry out ${effect.type}.`);
      // R-QUALITY-003: only the month moves age.
      if (effect.quality === AGE) return [];
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
  view: ({ state, content }) => ({
    qualities: Object.values(content.quality)
      .filter((entry) => entry.shown)
      .map((entry) => ({ id: entry.id, value: state.quality[entry.id] ?? entry.min })),
  }),
};
