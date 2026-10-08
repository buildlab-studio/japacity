// Layer 5 of docs/design/02-quality-and-testing.md, small enough for every
// run: the simulated players from each life, asserting only what the design
// promises. The full 300-seed run is a playtest.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { mulDiv } from "../engine/int";
import type { Id } from "../engine/types";
import type { RunRecord, StrategyName } from "./players";
import { runLife } from "./players";
import { cleanFile, LIVES } from "./report";

const CAREFUL_SEEDS = 40;
const OTHER_SEEDS = 12;

function runs(strategy: StrategyName, seeds: number): RunRecord[] {
  const records: RunRecord[] = [];
  for (const life of LIVES) for (let i = 0; i < seeds; i += 1) records.push(runLife(strategy, life, `test-${String(i)}`, content).record);
  return records;
}

const careful = runs("careful", CAREFUL_SEEDS);
const others = [...runs("borrower", OTHER_SEEDS), ...runs("risky", OTHER_SEEDS)];

describe("simulated players on the real content", () => {
  test.each(LIVES.map((life) => [life] as const))("[R-ROUTE-017] given %s, when the seeds are run, then some strategy reaches a grant", (life: Id<"scenario">) => {
    expect([...careful, ...others].some((record) => record.life === life && record.granted !== null)).toBe(true);
  });

  // Tunde is the borrower: a bank officer's pay cannot show the funds, so his way is the pledge and the held funds (scenario.md).
  test.each([["scenario.ada"], ["scenario.zainab"]] as const)("[R-ROUTE-017] given %s played carefully, when the seeds are run, then some seed reaches a grant by saving alone", (life) => {
    expect(careful.some((record) => record.life === life && record.granted !== null)).toBe(true);
  });

  test("[R-ROUTE-016] given careful players with a clean file, when their visas are decided, then the chance of refusal they face sits between 3% and 15%, and the share refused is within reach of it", () => {
    const decisions = careful.flatMap((record) => record.decisions).filter(cleanFile);
    expect(decisions.length).toBeGreaterThanOrEqual(CAREFUL_SEEDS);
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

  test("[R-ENGINE-011] given every strategy from every life, when played for up to 60 months, then a resting turn or a legal command was always there while a turn was banked and no set piece was open, and no turn built from allowed options was rejected", () => {
    const all = [...careful, ...others];
    expect(all.reduce((sum, record) => sum + record.stuck, 0)).toBe(0);
    expect(all.flatMap((record) => record.rejectedTurns)).toEqual([]);
  });
});
