// Rows for the contract suites. The stores never read inside a state, a world
// or a command, so these only need to be the right shape and easy to tell apart.
import type { Command, LotteryResult, State, World } from "@japacity/sim";

import type { LogRow, NewCharacter, SnapshotRow, StoreResult } from "../types";

/** Unwraps an accepted result, and fails the test with the refusal otherwise. */
export function must<T>(result: StoreResult<T>): T {
  if (!result.ok) throw new Error(`Expected the store to accept, and it refused with ${result.code}: ${result.detail}`);
  return result.value;
}


/**
 * A stand-in state. A store keeps a state as opaque JSON and never looks
 * inside, so a marked object is enough to prove a round trip.
 */
export function stateAt(character: string, v: number, mark = "base"): State {
  return { character, v, mark, nested: { list: [1, 2, 3], none: null } } as unknown as State;
}

export function newCharacter(id: string, account = `account-of-${id}`): NewCharacter {
  return {
    id,
    account,
    refilledAt: 1_000,
    content: "content-1",
    start: { scenario: "scenario.graduate", seed: `seed-${id}`, worldSeed: "world-seed" },
    state: stateAt(id, 0),
  };
}

export function grant(basedOn: number): Command {
  return { basedOn, type: "turns/grant", count: 1 };
}

export function logRow(character: string, v: number): LogRow {
  return { character, v, tick: 10 + v, sender: "authority", command: grant(v - 1), hash: `hash-${character}-${String(v)}`, at: 5_000 + v };
}

export function logRows(character: string, from: number, to: number): LogRow[] {
  const rows: LogRow[] = [];
  for (let v = from; v <= to; v++) rows.push(logRow(character, v));
  return rows;
}

export function snapshot(character: string, v: number, segment = 0): SnapshotRow {
  return { character, v, segment, content: "content-1", state: stateAt(character, v, `snapshot-${String(segment)}`) };
}

export function world(tick: number, mark = 0): World {
  const rate = { official: 150_000 + mark, street: 160_000 + mark };
  return {
    tick,
    rates: { GBP: rate, USD: rate, CAD: rate, AED: rate, EUR: rate },
    vars: { "var.season-december": 0 },
    placeNames: {},
    news: [{ id: "news.sample", stage: "rumour", since: tick }],
    era: null,
    lottery: null,
  };
}

export function lotteryResult(draw: number): LotteryResult {
  return {
    draw,
    revealed: "ab".repeat(32),
    beaconRound: 7,
    beaconRandomness: "cd".repeat(32),
    listHash: "ef".repeat(32),
    count: 3,
    pot: 60_000,
    fund: 33_000,
    winners: [{ tier: "jackpot", tickets: [2], amount: 13_200 }],
  };
}
