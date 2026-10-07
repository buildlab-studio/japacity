// The simulated players' summary for the playtest report. Pure:
// it plays the lives and returns Markdown; a one-line driver writes the file.
import { divFloor, mulDiv } from "../engine/int";
import type { Content, Id } from "../engine/types";
import type { RunRecord, StrategyName } from "./players";
import { runLife } from "./players";

export const STRATEGIES: StrategyName[] = ["careful", "borrower", "risky"];
export const LIVES: Id<"scenario">[] = ["scenario.ada", "scenario.tunde", "scenario.zainab"];

/** Every strategy from every life over `seeds` seeds. */
export function runMany(content: Content, seeds: number, months = 60): RunRecord[] {
  const records: RunRecord[] = [];
  for (const strategy of STRATEGIES) {
    for (const life of LIVES) {
      for (let i = 0; i < seeds; i += 1) records.push(runLife(strategy, life, `sim-${String(i)}`, content, { months }).record);
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
  const sorted = [...values].sort((a, b) => a - b);
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

export const STAGES = ["heard", "known", "offer", "deposit", "applied", "decided", "granted", "departed"] as const;
export type Stage = (typeof STAGES)[number];

export function reached(record: RunRecord, stage: Stage): boolean {
  switch (stage) {
    case "heard":
      return record.heard !== null;
    case "known":
      return record.known !== null;
    case "offer":
      return record.offer !== null;
    case "deposit":
      return record.deposit !== null;
    case "applied":
      return record.applied !== null;
    case "decided":
      return record.decisions.length > 0;
    case "granted":
      return record.granted !== null;
    case "departed":
      return record.departed !== null;
    default: {
      const never: never = stage;
      return never;
    }
  }
}

/** A decision with no earlier refusal and an unexplained share of 20% or less. */
export function cleanFile(decision: RunRecord["decisions"][number]): boolean {
  return decision.earlierRefusals === 0 && decision.unexplainedBp <= 2000;
}

export interface Stall {
  strategy: StrategyName;
  life: Id<"scenario">;
  stage: Stage;
  share: string;
  before: string;
}

/** For each strategy and life, the first stage fewer than 30% of runs reach. */
export function stalls(records: RunRecord[]): Stall[] {
  const found: Stall[] = [];
  for (const strategy of STRATEGIES) {
    for (const life of LIVES) {
      const runs = records.filter((record) => record.strategy === strategy && record.life === life);
      if (runs.length === 0) continue;
      let before = "100.0%";
      for (const stage of STAGES) {
        const count = runs.filter((record) => reached(record, stage)).length;
        if (mulDiv(count, 100, runs.length) < 30) {
          found.push({ strategy, life, stage, share: percent(count, runs.length), before });
          break;
        }
        before = percent(count, runs.length);
      }
    }
  }
  return found;
}

export function summarise(records: RunRecord[], seeds: number, months: number): string {
  const out: string[] = [];
  const groups = STRATEGIES.flatMap((strategy) => LIVES.map((life) => ({ strategy, life, runs: records.filter((r) => r.strategy === strategy && r.life === life) })));

  out.push(`## Reach by stage`, "", `Share of ${String(seeds)} runs per row that reached each stage within ${String(months)} months.`, "");
  out.push(`| Strategy | Life | ${STAGES.join(" | ")} | Median final japacity | Broke months a run | Turns granted a run |`);
  out.push(`|---|---|${STAGES.map(() => "---|").join("")}---|---|---|`);
  for (const { strategy, life, runs } of groups) {
    const cells = STAGES.map((stage) => percent(runs.filter((record) => reached(record, stage)).length, runs.length));
    const japacity = quantile(runs.map((record) => record.japacity ?? 0), 1, 2);
    const broke = mean(runs.reduce((sum, record) => sum + record.broke, 0), runs.length);
    const grants = mean(runs.reduce((sum, record) => sum + record.grantedTurns, 0), runs.length);
    out.push(`| ${strategy} | ${lifeName(life)} | ${cells.join(" | ")} | ${show(japacity)} | ${broke} | ${grants} |`);
  }

  out.push("", "## Months to the send-off, careful players", "", "Month of departure among careful runs that departed.", "");
  out.push("| Life | Departed | Quarter | Median | Three quarters |", "|---|---|---|---|---|");
  for (const life of LIVES) {
    const months = records.filter((r) => r.strategy === "careful" && r.life === life && r.departed !== null).map((r) => r.departed ?? 0);
    const runs = records.filter((r) => r.strategy === "careful" && r.life === life).length;
    out.push(`| ${lifeName(life)} | ${percent(months.length, runs)} | ${show(quantile(months, 1, 4))} | ${show(quantile(months, 1, 2))} | ${show(quantile(months, 3, 4))} |`);
  }
  const allCareful = records.filter((r) => r.strategy === "careful" && r.departed !== null).map((r) => r.departed ?? 0);
  out.push(`| all | ${percent(allCareful.length, records.filter((r) => r.strategy === "careful").length)} | ${show(quantile(allCareful, 1, 4))} | ${show(quantile(allCareful, 1, 2))} | ${show(quantile(allCareful, 3, 4))} |`);

  out.push("", "## Months between stages, careful players", "", "Median months from one stage to the next, among careful runs that reached both.", "");
  const gaps: [string, (record: RunRecord) => number | null, (record: RunRecord) => number | null][] = [
    ["heard to known", (r) => r.heard, (r) => r.known],
    ["known to a school's offer", (r) => r.known, (r) => r.offer],
    ["offer to deposit", (r) => r.offer, (r) => r.deposit],
    ["deposit to visa sent", (r) => r.deposit, (r) => r.applied],
    ["visa sent to grant", (r) => r.applied, (r) => r.granted],
    ["grant to flight", (r) => r.granted, (r) => r.departed],
  ];
  out.push(`| Stage | ${LIVES.map(lifeName).join(" | ")} |`, `|---|${LIVES.map(() => "---|").join("")}`);
  for (const [label, from, to] of gaps) {
    const cells = LIVES.map((life) => {
      const spans = records
        .filter((r) => r.strategy === "careful" && r.life === life)
        .flatMap((r) => {
          const a = from(r);
          const b = to(r);
          return a === null || b === null ? [] : [b - a];
        });
      return show(quantile(spans, 1, 2));
    });
    out.push(`| ${label} | ${cells.join(" | ")} |`);
  }

  out.push("", "## What pays for the flight", "", "The job held on the day the visa was granted, among granted runs.", "");
  const jobs = new Map<string, number>();
  const granted = records.filter((r) => r.granted !== null);
  for (const record of granted) jobs.set(record.jobAtGrant ?? "none", (jobs.get(record.jobAtGrant ?? "none") ?? 0) + 1);
  out.push("| Job | Granted runs | Share |", "|---|---|---|");
  for (const [job, count] of [...jobs.entries()].sort((a, b) => b[1] - a[1])) out.push(`| \`${job}\` | ${String(count)} | ${percent(count, granted.length)} |`);
  const remoteMonths = records.filter((r) => r.strategy === "careful" && r.remote !== null).map((r) => r.remote ?? 0);
  out.push("", `Careful runs that held the remote developer job at some point: ${percent(remoteMonths.length, records.filter((r) => r.strategy === "careful").length)}, first held in month ${show(quantile(remoteMonths, 1, 2))} at the median.`);

  out.push("", "## Refusals by strategy", "", "Every visa decision counts once. A clean file has no earlier refusal and an unexplained share of 20% or less on the day it was sent.", "");
  out.push("| Strategy | Decisions | Refused | Clean-file decisions | Clean files refused | Mean chance faced, clean files | First applications refused |", "|---|---|---|---|---|---|---|");
  for (const strategy of STRATEGIES) {
    const decisions = records.filter((r) => r.strategy === strategy).flatMap((r) => r.decisions);
    const refused = decisions.filter((d) => !d.granted).length;
    const clean = decisions.filter(cleanFile);
    const first = decisions.filter((d) => d.earlierRefusals === 0);
    const chance = clean.length === 0 ? "n/a" : percent(clean.reduce((sum, d) => sum + d.chanceBp, 0), clean.length * 10000);
    out.push(
      `| ${strategy} | ${String(decisions.length)} | ${percent(refused, decisions.length)} | ${String(clean.length)} | ${percent(clean.filter((d) => !d.granted).length, clean.length)} | ${chance} | ${percent(first.filter((d) => !d.granted).length, first.length)} |`,
    );
  }

  const reasons = new Map<string, number>();
  const refusals = records.flatMap((r) => r.decisions).filter((d) => !d.granted);
  for (const decision of refusals) for (const reason of decision.reasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  const topReasons = [...reasons.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  out.push("", "## The most common refusal reasons", "", `Across all ${String(refusals.length)} refusals; a refusal can carry more than one reason.`, "");
  out.push("| Reason | Refusals naming it | Share |", "|---|---|---|");
  for (const [reason, count] of topReasons.slice(0, 3)) out.push(`| \`${reason}\` | ${String(count)} | ${percent(count, refusals.length)} |`);

  out.push("", "## Where players stall", "", "For each strategy and life, the first stage fewer than 30% of runs reach.", "");
  out.push("| Strategy | Life | Stalls at | Reached it | Reached the stage before |", "|---|---|---|---|---|");
  for (const stall of stalls(records)) out.push(`| ${stall.strategy} | ${lifeName(stall.life)} | ${stall.stage} | ${stall.share} | ${stall.before} |`);

  out.push("", "## Good lines, careful players", "");
  out.push("| Life | Months played | Months with a good line | Longest run without one | Months with a win | Longest run without a win |", "|---|---|---|---|---|---|");
  for (const life of LIVES) {
    const runs = records.filter((r) => r.strategy === "careful" && r.life === life);
    const played = runs.reduce((sum, r) => sum + r.months, 0);
    out.push(
      `| ${lifeName(life)} | ${String(played)} | ${percent(runs.reduce((s, r) => s + r.goodMonths, 0), played)} | ${show(Math.max(0, ...runs.map((r) => r.longestDry)))} | ${percent(runs.reduce((s, r) => s + r.winMonths, 0), played)} | median ${show(quantile(runs.map((r) => r.longestNoWin), 1, 2))}, worst ${show(Math.max(0, ...runs.map((r) => r.longestNoWin)))} |`,
    );
  }
  out.push("");
  return out.join("\n");
}
