// The simulated players' summary for the playtest report. Pure:
// it plays the lives and returns Markdown; a driver writes the file.
import { divFloor, mulDiv } from "../engine/int";
import type { Content, Id } from "../engine/types";
import type { Ending, RunRecord, StrategyName } from "./players";
import { ENDINGS, runLife, STRATEGY_NAMES } from "./players";

export const STRATEGIES: StrategyName[] = STRATEGY_NAMES;
/** The four fixed lives and the prologue's. */
export const LIVES: Id<"scenario">[] = ["scenario.ada", "scenario.tunde", "scenario.zainab", "scenario.ngozi", "scenario.prologue"];

/** Every strategy from every life over `seeds` seeds. */
export function runMany(content: Content, seeds: number, months = 120, lives: Id<"scenario">[] = LIVES): RunRecord[] {
  const records: RunRecord[] = [];
  for (const strategy of STRATEGIES) {
    for (const life of lives) {
      for (let index = 0; index < seeds; index += 1) records.push(runLife(strategy, life, `sim-${String(index)}`, content, { months }).record);
    }
  }
  return records;
}

/** A share as a percent with one decimal place, from whole numbers. */
export function percent(count: number, total: number): string {
  if (total === 0) return "n/a";
  const tenths = mulDiv(count, 1000, total);
  return `${String(divFloor(tenths, 10))}.${String(tenths % 10)}%`;
}

/** The lower median, and the quartiles the same way. Null for no values. */
export function quantile(values: number[], numerator: number, denominator: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[mulDiv(sorted.length - 1, numerator, denominator)] ?? null;
}

/** A mean with one decimal place, from whole numbers. */
export function mean(sum: number, count: number): string {
  if (count === 0) return "n/a";
  const tenths = mulDiv(sum, 10, count);
  return `${String(divFloor(tenths, 10))}.${String(tenths % 10)}`;
}

function show(value: number | null): string {
  return value === null ? "n/a" : String(value);
}

function lifeName(life: Id<"scenario">): string {
  return life.replace("scenario.", "");
}

/** A decision with no earlier refusal and an unexplained share of 20% or less. */
export function cleanFile(decision: RunRecord["decisions"][number]): boolean {
  return decision.earlierRefusals === 0 && decision.unexplainedBp <= 2000;
}

const OVERSTAYERS = ["status.uk-overstayer", "status.ca-overstayer", "status.uae-irregular", "status.eu-irregular"];

function lawfulAt(record: RunRecord, mark: "12" | "36" | "60"): boolean {
  const held = record.statusAt[mark];
  return held !== null && !OVERSTAYERS.includes(held);
}

/** The stages of a whole life, in order: brief m1-sweep, item 2. */
export const STAGES = ["granted", "departed", "lawful-12", "lawful-36", "lawful-60", "settled"] as const;
export type Stage = (typeof STAGES)[number];

export function reached(record: RunRecord, stage: Stage): boolean {
  switch (stage) {
    case "granted":
      return record.granted !== null;
    case "departed":
      return record.departed !== null;
    case "lawful-12":
      return lawfulAt(record, "12");
    case "lawful-36":
      return lawfulAt(record, "36");
    case "lawful-60":
      return lawfulAt(record, "60");
    case "settled":
      return record.settledMonth !== null;
    default: {
      const never: never = stage;
      return never;
    }
  }
}

/** Whether a run had the months to reach a stage at all: a stage abroad needs that many months after the flight. */
function hadTime(record: RunRecord, stage: Stage): boolean {
  if (record.departed === null) return true;
  const after = record.months - record.departed;
  switch (stage) {
    case "lawful-12":
      return after >= 12;
    case "lawful-36":
      return after >= 36;
    case "lawful-60":
      return after >= 60;
    case "granted":
    case "departed":
    case "settled":
      return true;
    default: {
      const never: never = stage;
      return never;
    }
  }
}

export interface Stall {
  strategy: StrategyName;
  life: Id<"scenario">;
  stage: Stage;
  /** Runs that reached the stage before and had the time for this one. */
  could: number;
  made: number;
}

/** Every stage, by strategy and life, reached by under 30% of the runs that reached the stage before it and had the time, the worst first. */
export function stalls(records: RunRecord[]): Stall[] {
  const found: Stall[] = [];
  for (const strategy of STRATEGIES) {
    for (const life of LIVES) {
      const runs = records.filter((record) => record.strategy === strategy && record.life === life);
      for (let index = 1; index < STAGES.length; index += 1) {
        const stage = STAGES[index]!;
        const before = STAGES[index - 1]!;
        const could = runs.filter((record) => reached(record, before) && hadTime(record, stage));
        const made = could.filter((record) => reached(record, stage)).length;
        if (could.length >= 10 && mulDiv(made, 100, could.length) < 30) found.push({ strategy, life, stage, could: could.length, made });
      }
    }
  }
  return found.sort((left, right) => mulDiv(left.made, 10000, left.could) - mulDiv(right.made, 10000, right.could) || right.could - left.could);
}

function count<T extends string>(values: T[]): [T, number][] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

export function summarise(records: RunRecord[], seeds: number, months: number): string {
  const out: string[] = [];
  const groups = STRATEGIES.flatMap((strategy) => LIVES.map((life) => ({ strategy, life, runs: records.filter((record) => record.strategy === strategy && record.life === life) })));

  out.push("## Endings", "", `Share of the ${String(seeds)} runs in each row that end each way after ${String(months)} months. The ending is read from the last state.`, "");
  out.push(`| Strategy | Life | ${ENDINGS.join(" | ")} |`, `|---|---|${ENDINGS.map(() => "---|").join("")}`);
  for (const { strategy, life, runs } of groups) {
    out.push(`| ${strategy} | ${lifeName(life)} | ${ENDINGS.map((ending) => percent(runs.filter((record) => record.ending === ending).length, runs.length)).join(" | ")} |`);
  }
  out.push("", "By strategy, every life together:", "");
  out.push(`| Strategy | ${ENDINGS.join(" | ")} |`, `|---|${ENDINGS.map(() => "---|").join("")}`);
  for (const strategy of STRATEGIES) {
    const runs = records.filter((record) => record.strategy === strategy);
    out.push(`| ${strategy} | ${ENDINGS.map((ending: Ending) => percent(runs.filter((record) => record.ending === ending).length, runs.length)).join(" | ")} |`);
  }

  out.push("", "## The flight", "", "Runs that flew, the route flown first, and the months to the flight among those that flew.", "");
  out.push("| Strategy | Life | Flew | Routes flown | Quarter | Median months to flight | Three quarters | Set out on the road |", "|---|---|---|---|---|---|---|---|");
  for (const { strategy, life, runs } of groups) {
    const flew = runs.filter((record) => record.departed !== null);
    const months = flew.map((record) => record.departed ?? 0);
    const routes = count(flew.map((record) => (record.flown ?? "none").replace("route.", "")))
      .map(([id, number]) => `${id} ${String(number)}`)
      .join(", ");
    out.push(
      `| ${strategy} | ${lifeName(life)} | ${percent(flew.length, runs.length)} | ${routes === "" ? "none" : routes} | ${show(quantile(months, 1, 4))} | ${show(quantile(months, 1, 2))} | ${show(quantile(months, 3, 4))} | ${percent(runs.filter((record) => record.road !== null).length, runs.length)} |`,
    );
  }
  const allFlights = records.filter((record) => record.departed !== null).map((record) => record.departed ?? 0);
  out.push("", `Median months to the flight over every run that flew: ${show(quantile(allFlights, 1, 2))}.`);

  out.push("", "## Settling", "", "Runs that held a settled or citizen status at some point, and the status held 12, 36 and 60 months after the flight among runs that flew.", "");
  out.push("| Strategy | Life | Settled | Median month settled | Lawful at 12 | Lawful at 36 | Lawful at 60 |", "|---|---|---|---|---|---|---|");
  for (const { strategy, life, runs } of groups) {
    const settled = runs.filter((record) => record.settledMonth !== null);
    const flew = runs.filter((record) => record.departed !== null);
    const lawful = (mark: "12" | "36" | "60"): string => percent(flew.filter((record) => lawfulAt(record, mark)).length, flew.length);
    out.push(`| ${strategy} | ${lifeName(life)} | ${percent(settled.length, runs.length)} | ${show(quantile(settled.map((record) => record.settledMonth ?? 0), 1, 2))} | ${lawful("12")} | ${lawful("36")} | ${lawful("60")} |`);
  }
  const everyone = records.filter((record) => record.strategy !== "honest-home");
  out.push("", `Share of every run that leaves home by intent (all but honest-home) that settles: ${percent(everyone.filter((record) => record.settledMonth !== null).length, everyone.length)}.`);

  out.push("", "## Where players stall", "", "A stage reached by under 30% of the runs that reached the stage before it and had the months to reach it (10 such runs or more), the worst first.", "");
  const found = stalls(records);
  if (found.length === 0) out.push("No stage falls under 30%.");
  else {
    out.push("| Strategy | Life | Stage | Could | Made it | Share |", "|---|---|---|---|---|---|");
    for (const stall of found) out.push(`| ${stall.strategy} | ${lifeName(stall.life)} | ${stall.stage} | ${String(stall.could)} | ${String(stall.made)} | ${percent(stall.made, stall.could)} |`);
  }

  const reasons = count(records.flatMap((record) => record.reasons));
  out.push("", "## The most common refusal and lapse reasons", "", "Every route's refusals and every status lapse, over every run.", "");
  out.push("| Reason | Times |", "|---|---|");
  for (const [reason, times] of reasons.slice(0, 5)) out.push(`| \`${reason}\` | ${String(times)} |`);

  out.push("", "## Money, health, the car, the file, goals and chapters", "");
  out.push("| Strategy | Life | Broke months a run | Illnesses a run | Car: paying, owned, repossessed, handed back, left behind | Median credit mark at the end | Goals done a run | Chapters closed a run | Turns granted a run |", "|---|---|---|---|---|---|---|---|---|");
  for (const { strategy, life, runs } of groups) {
    const cars = ["paying", "owned", "repossessed", "handed-back", "left-behind"].map((fate) => String(runs.filter((record) => record.car === fate).length)).join(", ");
    const marks = runs.flatMap((record) => (record.creditEnd === null ? [] : [record.creditEnd]));
    out.push(
      `| ${strategy} | ${lifeName(life)} | ${mean(runs.reduce((sum, record) => sum + record.broke, 0), runs.length)} | ${mean(runs.reduce((sum, record) => sum + record.ill, 0), runs.length)} | ${cars} | ${show(quantile(marks, 1, 2))} | ${mean(runs.reduce((sum, record) => sum + record.goalsDone, 0), runs.length)} | ${mean(runs.reduce((sum, record) => sum + record.chaptersClosed, 0), runs.length)} | ${mean(runs.reduce((sum, record) => sum + record.grantedTurns, 0), runs.length)} |`,
    );
  }

  const prologues = count(records.flatMap((record) => (record.prologue === null ? [] : [record.prologue])));
  out.push("", "## The prologue's outcomes", "", "| Path after school, grade | Runs |", "|---|---|");
  for (const [path, times] of prologues) out.push(`| ${path} | ${String(times)} |`);

  const roads = records.filter((record) => record.road !== null);
  out.push("", "## The road", "", `Runs that set out on the road: ${String(roads.length)}. Lost: ${String(roads.filter((record) => record.ending === "road-lost").length)} (${percent(roads.filter((record) => record.ending === "road-lost").length, roads.length)}).`);

  const refused = count(records.flatMap((record) => Object.entries(record.refused).flatMap(([key, times]) => Array.from({ length: times }, () => key))));
  out.push("", "## Commands the players built that step refused", "", "A strategy reads only the view; these are the commands it sent that were refused, with the code. They are not stuck states: the next command in its list was taken.", "");
  out.push("| Command and code | Times |", "|---|---|");
  for (const [key, times] of refused.slice(0, 8)) out.push(`| ${key} | ${String(times)} |`);
  const stuck = records.reduce((sum, record) => sum + record.stuck, 0);
  const rejected = records.reduce((sum, record) => sum + record.rejectedTurns.length, 0);
  out.push("", `Stuck states (R-ENGINE-011): ${String(stuck)}. Turns built from allowed options and rejected: ${String(rejected)}.`, "");
  return out.join("\n");
}
