// Layer 5 of docs/design/02-quality-and-testing.md over the whole life: the
// simulated players from the prologue to an ending, asserting only what the
// design promises. Runs are searched seed by seed and kept, so each ending is
// found with as few lives played as the seeds allow.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { mulDiv } from "../engine/int";
import type { Id } from "../engine/types";
import type { Ending, RunRecord, StrategyName } from "./players";
import { ENDINGS, runLife } from "./players";
import { LIVES } from "./report";

const MONTHS = 120;
const STRATEGIES: StrategyName[] = ["careful", "borrower", "risky", "honest-home"];

const played = new Map<string, RunRecord>();

function run(strategy: StrategyName, life: Id<"scenario">, index: number): RunRecord {
  const key = `${strategy} ${life} ${String(index)}`;
  let record = played.get(key);
  if (record === undefined) {
    record = runLife(strategy, life, `end-${String(index)}`, content, { months: MONTHS }).record;
    played.set(key, record);
  }
  return record;
}

/** The first run, seed by seed across every strategy and life, that passes; null within `seeds` seeds. */
function find(ok: (record: RunRecord) => boolean, seeds: number, strategies: StrategyName[] = STRATEGIES, lives: Id<"scenario">[] = LIVES): RunRecord | null {
  for (let index = 0; index < seeds; index += 1) {
    for (const strategy of strategies) {
      for (const life of lives) {
        const record = run(strategy, life, index);
        if (ok(record)) return record;
      }
    }
  }
  return null;
}

/** Players who take the road's pitch, each run cut short once the road is over or a flight is taken. */
function roadRuns(seeds: number): RunRecord[] {
  const records: RunRecord[] = [];
  for (let index = 0; index < seeds; index += 1) {
    const life = LIVES[index % LIVES.length]!;
    const { record } = runLife("risky", life, `road-${String(index)}`, content, {
      months: 60,
      stopWhen: (game, sofar) => (sofar.road !== null && game.state.place.where !== "road") || sofar.departed !== null,
    });
    if (record.road !== null) records.push(record);
  }
  return records;
}

const ROAD_SEEDS = 700;
const roads = roadRuns(ROAD_SEEDS);

/**
 * The first broke return (R-PLACE-005) by the spender, each run cut at its first return home. The first fix batch
 * made the far shore's return assisted (R-ROAD-009) and the first months abroad survivable, so the borrowers and the
 * risky come home with their savings; the spender pays its debts and the school ahead from them and keeps only the fare.
 */
const spent: RunRecord[] = [];
function brokeReturn(seeds: number): RunRecord | null {
  for (let index = 0; index < seeds; index += 1) {
    for (const life of LIVES) {
      const { record } = runLife("spender", life, `end-${String(index)}`, content, {
        months: MONTHS,
        stopWhen: (game) => game.state.place.where === "home" && game.state.place.returns.length > 0,
      });
      spent.push(record);
      if (record.ending === "returned-broke") return record;
    }
  }
  return null;
}

describe("simulated players to an ending on the real content", () => {
  test.each(ENDINGS.filter((ending) => ending !== "road-lost").map((ending) => [ending] as const))(
    "[R-PLACE-005] [R-STATUS-007] [R-STATUS-008] given the four strategies from every life, when they play up to 120 months, then some strategy on some seed ends %s",
    (ending: Ending) => {
      const found = ending === "returned-broke" ? brokeReturn(40) : find((record) => record.ending === ending, 12);
      expect(found?.ending).toBe(ending);
    },
  );

  test("[R-ROAD-006] [R-ROAD-008] given players who take the road's pitch, when the seeds are run, then the road's loss is reached on some seed and stays about 2 in 100 of those who set out", () => {
    const lost = roads.filter((record) => record.ending === "road-lost").length;
    expect(roads.length).toBeGreaterThanOrEqual(50);
    expect(lost).toBeGreaterThanOrEqual(1);
    // About 2 in 100: a sample this small is held to twice that and three more.
    expect(lost).toBeLessThanOrEqual(mulDiv(roads.length, 400, 10000) + 3);
  });

  test.each(LIVES.map((life) => [life] as const))("[R-STATUS-007] given %s played carefully, when the seeds are run, then some seed reaches a settled status", (life) => {
    expect(find((record) => record.settledMonth !== null, 30, ["careful"], [life])?.life).toBe(life);
  });

  test("[R-ENGINE-011] given every run played here, when each month was ended, then a resting turn was always there, no turn built from allowed options was rejected and no step threw", () => {
    const all = [...played.values(), ...roads, ...spent];
    expect(all.reduce((sum, record) => sum + record.stuck, 0)).toBe(0);
    expect(all.flatMap((record) => record.rejectedTurns)).toEqual([]);
    expect(all.flatMap((record) => (record.crash === null ? [] : [`${record.strategy} ${record.life} ${record.seed}: ${record.crash.message}`]))).toEqual([]);
  });
});
