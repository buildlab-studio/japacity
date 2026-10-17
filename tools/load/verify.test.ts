import type { Command, Id, Loose, State, World } from "@japacity/sim";
import { hashState, legalCommands } from "@japacity/sim";
import { start } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { content } from "../../packages/content/src/index";
import { latestSnapshotV, ledgerProblems, snapshotShare, verifyCharacter, versionProblems } from "./verify";
import type { CharacterRows, Counts } from "./verify";

const EVERY = 20;
const SCENARIO = "scenario.ada" as Id<"scenario">;

/** A life played the way the server plays it, kept as the rows the load route hands over. */
function played(commands: number): { rows: CharacterRows; worlds: Map<number, World> } {
  const game = start({ content, scenario: SCENARIO, seed: "verify-seed", worldSeed: "verify-world" });
  const worlds = new Map<number, World>();
  const log: CharacterRows["log"] = [];
  const hashes = new Map<number, string>([[0, hashState(game.state)]]);
  const keep = (command: Loose, sender: "player" | "authority") => {
    const tick = game.tick;
    worlds.set(tick, game.world());
    const result = game.accept(command, sender);
    hashes.set(result.state.v, hashState(result.state));
    log.push({ v: result.state.v, tick, sender, command: { ...command, basedOn: result.state.v - 1 }, hash: hashState(result.state), at: 0 });
  };
  while (log.length < commands) {
    if (game.state.turn.banked < 1) keep({ type: "turns/grant", count: content.tuning.turn.cap - game.state.turn.banked }, "authority");
    const legal = legalCommands(game.view());
    const next = legal.find((command) => command.type !== "turn/end") ?? legal[0];
    if (next === undefined) break;
    keep(log.length % 3 === 0 ? next : (legal.find((command) => command.type === "turn/end") ?? next), "player");
  }
  const v = game.state.v;
  const snapshotV = latestSnapshotV(v, 0, EVERY);
  return {
    worlds,
    rows: {
      character: { id: "character-1", account: "load-1", v, segment: 0 },
      segments: [{ segment: 0, fromV: 0, content: content.version, start: { scenario: SCENARIO, seed: "verify-seed", worldSeed: "verify-world" } }],
      log,
      snapshot: { v: snapshotV, segment: 0, hash: hashes.get(snapshotV) ?? "" },
    },
  };
}

const life = played(45);

describe("the verifier", () => {
  test("[R-LOAD-010] given a life's rows as the server stored them, when it is replayed from its seed, then it reaches every stored hash and nothing is wrong", () => {
    expect(life.rows.log.length).toBeGreaterThanOrEqual(45);
    expect(verifyCharacter(life.rows, content, life.worlds, EVERY).problems).toEqual([]);
  });

  test("[R-LOAD-010] given one stored hash changed, when it is replayed, then that version is named", () => {
    const log = life.rows.log.map((row) => (row.v === 17 ? { ...row, hash: "0".repeat(row.hash.length) } : row));
    const problems = verifyCharacter({ ...life.rows, log }, content, life.worlds, EVERY).problems;
    expect(problems).toContain("Version 17 replays to another hash than the one stored.");
  });

  test("[R-LOAD-010] given a command logged twice at one version, when it is checked, then it is named as accepted twice", () => {
    const [first, second] = life.rows.log;
    if (first === undefined || second === undefined) throw new Error("No rows.");
    expect(versionProblems([1, 2, 2, 3])).toEqual(["Two commands were accepted at version 2.", "Version 3 is stored where 4 belongs."]);
    expect(versionProblems([1, 3])).toEqual(["Version 3 is stored where 2 belongs."]);
    expect(versionProblems([])).toEqual([]);
    const doubled = verifyCharacter({ ...life.rows, log: [first, { ...second, v: 1 }, ...life.rows.log.slice(1)] }, content, life.worlds, EVERY);
    expect(doubled.problems).toContain("Two commands were accepted at version 1.");
  });

  test("[R-LOAD-010] given a log row the replay rejects, when it is replayed, then the version and the code are named", () => {
    const zero: Command = { type: "wallet/convert", from: "NGN", to: "GBP", amount: 0, via: "bank", basedOn: 4 };
    const log = life.rows.log.map((row) => (row.v === 5 ? { ...row, command: zero } : row));
    const problems = verifyCharacter({ ...life.rows, log }, content, life.worlds, EVERY).problems;
    expect(problems.some((problem) => problem.startsWith("Version 5 (wallet/convert) is rejected on replay"))).toBe(true);
  });

  test("[R-LOAD-010] given the row's version ahead of the log, when it is checked, then the gap is named", () => {
    const problems = verifyCharacter({ ...life.rows, character: { ...life.rows.character, v: life.rows.character.v + 1 } }, content, life.worlds, EVERY).problems;
    expect(problems).toContain(`The log ends at version ${String(life.rows.character.v)}, the row says ${String(life.rows.character.v + 1)}.`);
  });

  test("[R-LOAD-010] given the latest snapshot at the wrong version or with another state, when it is checked, then it is named", () => {
    const { snapshot } = life.rows;
    expect(verifyCharacter({ ...life.rows, snapshot: { ...snapshot, v: snapshot.v - 1 } }, content, life.worlds, EVERY).problems).toContain(
      `The latest snapshot is at version ${String(snapshot.v - 1)}, not ${String(snapshot.v)}.`,
    );
    expect(verifyCharacter({ ...life.rows, snapshot: { ...snapshot, hash: "x" } }, content, life.worlds, EVERY).problems).toContain(`The snapshot at version ${String(snapshot.v)} differs from the replay.`);
    expect(latestSnapshotV(39, 0, 20)).toBe(20);
    expect(latestSnapshotV(40, 0, 20)).toBe(40);
    expect(latestSnapshotV(19, 0, 20)).toBe(0);
    expect(latestSnapshotV(45, 43, 20)).toBe(43);
  });

  test("[R-LOAD-010] given a segment under content this server does not bundle, when it is replayed, then it is named", () => {
    const segments = life.rows.segments.map((segment) => ({ ...segment, content: "m-old" }));
    expect(verifyCharacter({ ...life.rows, segments }, content, life.worlds, EVERY).problems).toEqual([`Segment 0 ran under content m-old, not ${content.version}.`]);
  });

  test("[R-LOAD-010] given pockets that hold more than the ledger booked, when the ledger is checked, then that currency is named; a played life balances", () => {
    const game = start({ content, scenario: SCENARIO, seed: "ledger" });
    game.endTurn();
    expect(ledgerProblems(game.state)).toEqual([]);
    const pockets = game.state.wallet.pockets;
    const off: State = { ...game.state, wallet: { ...game.state.wallet, pockets: { ...pockets, GBP: { ...pockets.GBP, bank: pockets.GBP.bank + 1 } } } };
    expect(ledgerProblems(off)).toEqual([`GBP: the pockets hold ${String(pockets.GBP.bank + pockets.GBP.cash + pockets.GBP.locked + 1)}, the ledger says ${String(pockets.GBP.bank + pockets.GBP.cash + pockets.GBP.locked)}.`]);
  });

  test("[R-LOAD-010] given the rows and snapshots written during a run, when the share is judged, then within one point of 1 in 20 passes and past it fails", () => {
    const counts = (rows: number, snapshots: number): Counts => ({ rows, snapshots, rowBytes: 0, snapshotBytes: 0, characters: 0 });
    const before = counts(1000, 100);
    expect(snapshotShare(before, counts(3000, 200), EVERY)).toEqual({ ok: true, measuredBp: 500, targetBp: 500 });
    expect(snapshotShare(before, counts(3000, 180), EVERY).ok).toBe(true);
    expect(snapshotShare(before, counts(3000, 179), EVERY).ok).toBe(false);
    expect(snapshotShare(before, counts(3000, 220), EVERY).ok).toBe(true);
    expect(snapshotShare(before, counts(3000, 221), EVERY).ok).toBe(false);
    expect(snapshotShare(before, before, EVERY).ok).toBe(false);
  });
});
