// Layer 5 of docs/design/02-quality-and-testing.md, small enough for every
// run: the simulated players from each life to the flight, asserting only
// what the design promises. The whole life and its endings are in
// endings.test.ts; a full 300-seed run is too long for the suite.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { mulDiv } from "../engine/int";
import type { Id } from "../engine/types";
import type { RunRecord, StrategyName } from "./players";
import { runLife } from "./players";
import { cleanFile } from "./report";

const FIXED: Id<"scenario">[] = ["scenario.graduate", "scenario.banker", "scenario.developer", "scenario.nurse"];
// Thirty-two careful seeds: under decision 0014 the risky players can pay for an agent's papers from the bank, so their files are not clean.
// A careful player leaves the study route once a settling way is in reach, so most clean study decisions come from players who made the
// master's the plan.
const CAREFUL_SEEDS = 32;
const OTHER_SEEDS = 8;
const MASTERS_SEEDS = 16;
const MONTHS = 60;

function runs(strategy: StrategyName, seeds: number): RunRecord[] {
  const records: RunRecord[] = [];
  for (const life of FIXED) for (let index = 0; index < seeds; index += 1) records.push(runLife(strategy, life, `test-${String(index)}`, content, { months: MONTHS }).record);
  return records;
}

const careful = runs("careful", CAREFUL_SEEDS);
const others = [...runs("borrower", OTHER_SEEDS), ...runs("risky", OTHER_SEEDS), ...runs("honest-home", 2), ...runs("careful-masters", MASTERS_SEEDS)];

describe("simulated players to the flight on the real content", () => {
  test.each(FIXED.map((life) => [life] as const))("[route:grant-moves-to-granted] given %s, when the seeds are run, then some strategy reaches a grant", (life: Id<"scenario">) => {
    expect([...careful, ...others].some((record) => record.life === life && record.granted !== null)).toBe(true);
  });

  test.each(FIXED.map((life) => [life] as const))("[route:grant-moves-to-granted] [route-gates:departure-grants-status] given %s played carefully, when the seeds are run, then some seed is granted a visa and flies", (life) => {
    expect(careful.some((record) => record.life === life && record.departed !== null)).toBe(true);
  });

  test("[route:visa-refusal-chance] given every player with a clean file on the study route, when the visas are decided, then the chance of refusal they face sits between 3% and 15%, and the share refused is within reach of it", () => {
    const decisions = [...careful, ...others].flatMap((record) => record.decisions).filter(cleanFile);
    expect(decisions.length).toBeGreaterThanOrEqual(20);
    const chance = mulDiv(
      decisions.reduce((sum, decision) => sum + decision.chanceBp, 0),
      1,
      decisions.length,
    );
    expect(chance).toBeGreaterThanOrEqual(300);
    expect(chance).toBeLessThanOrEqual(1500);
    // A sample this small can fall under 3% by chance, so the share refused is held only to twice the chance plus five.
    const refused = decisions.filter((decision) => !decision.granted).length;
    expect(refused).toBeLessThanOrEqual(mulDiv(decisions.length, chance * 2, 10000) + 5);
  });

  test("[engine:player-never-stuck] given every strategy from every fixed life, when played for up to 60 months, then a resting turn or a legal command was always there while a turn was banked and no set piece was open, no turn built from allowed options was rejected and no step threw", () => {
    const all = [...careful, ...others];
    expect(all.reduce((sum, record) => sum + record.stuck, 0)).toBe(0);
    expect(all.flatMap((record) => record.rejectedTurns)).toEqual([]);
    expect(all.flatMap((record) => (record.crash === null ? [] : [`${record.strategy} ${record.life} ${record.seed}: ${record.crash.message}`]))).toEqual([]);
  });

  test("[place:departure-moves-abroad] given the honest-home player, who never departs, when it plays, then it is never anywhere but home", () => {
    expect(others.filter((record) => record.strategy === "honest-home" && (record.departed !== null || record.road !== null))).toEqual([]);
  });
});
