import { describe, expect, test } from "vitest";

import { registry } from "../kinds";
import type { TurnEvent } from "../turn/turn.events";
import { miniContent } from "../testing/miniContent";
import { start } from "../testing/play";
import type { Loose } from "../testing/play";
import { standInWorld } from "../world/standIn";
import { hashState, stableJson } from "./hash";
import { checkInvariants } from "./invariants";
import { PHASES } from "./kind";
import type { Registry } from "./kind";
import { replay, savedCommands } from "./replay";
import { applyEventWith, newState } from "./state";
import { step, stepWith } from "./step";
import type { BaseEvent, Command, Ctx, Phase, State } from "./types";
import { hiddenPaths, viewFor, viewWith } from "./view";

const world = (tick: number) => standInWorld("world-1", tick, miniContent);

function withBasedOn(state: State, loose: Loose): Command {
  return { ...loose, basedOn: state.v };
}

describe("the step function", () => {
  test("[R-ENGINE-001] given the same state, world and command, when stepped twice, then the results are equal", () => {
    const state = newState("scenario.plain", "seed-1", miniContent);
    const command = withBasedOn(state, { type: "turn/end", slots: [{ activity: "activity.rest", param: null }] });
    const a = step(state, command, world(0), miniContent);
    const b = step(state, command, world(0), miniContent);
    expect(a).toEqual(b);
    expect(stableJson(a)).toBe(stableJson(b));
  });

  test("[R-ENGINE-001] given two seeds, when a life is played the same way, then the states differ only through draws", () => {
    const a = start({ seed: "a" });
    const b = start({ seed: "b" });
    a.endTurn();
    b.endTurn();
    const strip = (state: State) => ({ ...state, seed: "" });
    // One turn of this life draws nothing, so the lives are the same apart from the seed itself.
    expect(strip(a.state)).toEqual(strip(b.state));
    expect(a.state.seed).not.toBe(b.state.seed);
  });

  test("[R-ENGINE-002] given a command that is rejected, when stepped, then the state is untouched and no event is recorded", () => {
    const state = newState("scenario.plain", "seed-1", miniContent);
    const before = stableJson(state);
    const rest = { activity: "activity.rest" as const, param: null };
    const result = step(state, withBasedOn(state, { type: "turn/end", slots: [rest, rest, rest, rest] }), world(0), miniContent);
    expect(result.ok).toBe(false);
    expect(stableJson(state)).toBe(before);
    expect("events" in result).toBe(false);
  });

  test("[R-ENGINE-002] given an accepted command, when stepped, then the input state is not mutated", () => {
    const state = newState("scenario.plain", "seed-1", miniContent);
    const before = stableJson(state);
    const result = step(state, withBasedOn(state, { type: "turn/end", slots: [] }), world(0), miniContent);
    expect(result.ok).toBe(true);
    expect(stableJson(state)).toBe(before);
  });

  test("[R-ENGINE-003] given a command based on an old version, when stepped, then it is rejected with stale", () => {
    const game = start();
    game.endTurn();
    expect(game.state.v).toBe(1);
    const result = step(game.state, { type: "turn/end", slots: [], basedOn: 0 }, world(1), miniContent);
    expect(result).toMatchObject({ ok: false, code: "stale" });
    const ahead = step(game.state, { type: "turn/end", slots: [], basedOn: 2 }, world(1), miniContent);
    expect(ahead).toMatchObject({ ok: false, code: "stale" });
  });

  test("[R-ENGINE-003] given accepted commands, when stepped, then each raises the version by exactly one", () => {
    const game = start();
    expect(game.state.v).toBe(0);
    game.endTurn();
    expect(game.state.v).toBe(1);
    game.grant(1);
    expect(game.state.v).toBe(2);
    game.expectRejected({ type: "turns/grant", count: 1 }, "not-yours");
    expect(game.state.v).toBe(2);
  });

  test("[R-ENGINE-004] given a turn, when it resolves, then every phase runs in the order of engine.md section 4, and each sees the state the one before left", () => {
    const seen: Phase[] = [];
    const sawWellbeing: Partial<Record<Phase, number>> = {};
    const kinds: Registry = registry().map((kind) => {
      // The activity kind's slots phase rests through quality/add, which would
      // hide the one-per-phase count this test watches. Only the phases matter here.
      if (kind.kind === "activity") {
        const { phases: _dropped, ...rest } = kind;
        void _dropped;
        return rest;
      }
      if (kind.kind !== "quality") {
        return kind;
      }
      const phases: Partial<Record<Phase, (ctx: Ctx) => BaseEvent[]>> = {};
      for (const phase of PHASES) {
        phases[phase] = (ctx) => {
          seen.push(phase);
          sawWellbeing[phase] = ctx.state.quality["quality.wellbeing"] ?? -1;
          return [{ type: "quality/changed", quality: "quality.wellbeing", amount: 1, source: phase }];
        };
      }
      return {
        ...kind,
        phases,
        evolve: (slice: Record<string, number>, event: BaseEvent) => {
          const changed = event as unknown as { quality: string; amount: number };
          return { ...slice, [changed.quality]: (slice[changed.quality] ?? 0) + changed.amount };
        },
      };
    });
    const state = newState("scenario.plain", "seed-1", miniContent);
    const result = stepWith(kinds, state, withBasedOn(state, { type: "turn/end", slots: [] }), world(0), miniContent);
    if (!result.ok) throw new Error(result.detail);
    expect(seen).toEqual([...PHASES]);
    // Phase n sees n changes already applied: 70, 71, 72, ...
    PHASES.forEach((phase, index) => expect(sawWellbeing[phase]).toBe(70 + index));
    expect(result.state.quality["quality.wellbeing"]).toBe(70 + PHASES.length);
  });

  test("[R-ENGINE-006] given a new life, when its wallet is read, then no pocket is below zero and every opening balance has a reason", () => {
    const state = newState("scenario.worker", "seed-1", miniContent);
    for (const pocket of Object.values(state.wallet.pockets)) {
      expect(pocket.bank).toBeGreaterThanOrEqual(0);
      expect(pocket.cash).toBeGreaterThanOrEqual(0);
      expect(pocket.locked).toBeGreaterThanOrEqual(0);
    }
    expect(state.wallet.totals.in.opening).toEqual({ NGN: 105000000, GBP: 50000 });
    expect(checkInvariants(state, miniContent)).toEqual([]);
  });

  test("[R-ENGINE-007] given a view, when walked, then it holds no key named seed, draws or secret", () => {
    const game = start({ scenario: "scenario.worker" });
    game.endTurn();
    const view = game.view();
    expect(hiddenPaths(view)).toEqual([]);
    expect(stableJson(view)).not.toContain(game.state.seed);
  });

  test("[R-ENGINE-007] given a planted hidden field, when walked, then the walker finds it", () => {
    expect(hiddenPaths({ a: { secret: { fraud: true } }, list: [{ draws: {} }], seed: "x" })).toEqual(["a.secret", "list[0].draws", "seed"]);
  });

  test("[R-ENGINE-007] given a kind that gives no part of the view, when the view is joined, then it throws naming the missing keys", () => {
    const kinds: Registry = registry().map((kind) => {
      if (kind.kind !== "news") return kind;
      const rest = { ...kind };
      delete rest.view;
      return rest;
    });
    const state = newState("scenario.plain", "seed-1", miniContent);
    expect(() => viewWith(kinds, { state, world: world(0), content: miniContent })).toThrow(/view keys: news/);
  });

  test("[R-ENGINE-008] given a state, when the view is built, then the seed and the draw counts stay with the authority", () => {
    const state = newState("scenario.plain", "my-secret-seed", miniContent);
    const view = viewFor({ state, world: world(0), content: miniContent });
    expect(JSON.stringify(view)).not.toContain("my-secret-seed");
    expect("seed" in view).toBe(false);
    expect("draws" in view).toBe(false);
  });

  test("[R-ENGINE-010] given a state, when turned to JSON and back, then it is equal", () => {
    const game = start({ scenario: "scenario.worker" });
    game.endTurn([{ activity: "activity.rest", param: null }]);
    game.grant(2);
    const copy = JSON.parse(JSON.stringify(game.state)) as State;
    expect(copy).toEqual(game.state);
    expect(hashState(copy)).toBe(hashState(game.state));
  });

  test("[R-ENGINE-010] given a save, when replayed, then the state is rebuilt exactly", () => {
    const game = start({ scenario: "scenario.worker", seed: "replay-me" });
    game.endTurn([{ activity: "activity.rest", param: null }]);
    game.endTurn();
    game.grant(3);
    game.endTurn([{ activity: "activity.study", param: null }]);
    expect(savedCommands(game.save)).toHaveLength(4);
    expect(savedCommands(game.save).map((entry) => entry.tick)).toEqual([0, 1, 2, 2]);
    const rebuilt = replay(game.save, miniContent, world);
    expect(rebuilt.state).toEqual(game.state);
    expect(hashState(rebuilt.state)).toBe(hashState(game.state));
    expect(rebuilt.versions).toEqual([1, 2, 3, 4]);
  });

  test("[R-ENGINE-010] given a save for other content, when replayed, then it throws", () => {
    const game = start();
    expect(() => replay({ ...game.save, segments: [{ ...game.save.segments[0]!, content: "other" }] }, miniContent, world)).toThrow(/for content other/);
  });

  test("[R-ENGINE-011] given a turn banked and no set piece open, when the turn is ended with every slot resting, then it is accepted whatever is owed", () => {
    for (const scenario of ["scenario.plain", "scenario.worker"] as const) {
      const game = start({ scenario });
      for (let i = 0; i < 5; i += 1) expect(game.send({ type: "turn/end", slots: [] }).ok).toBe(true);
    }
  });

  test("[R-ENGINE-012] given a world tick lower than the last accepted one, when stepped, then it is rejected with clock-went-back", () => {
    const game = start();
    game.endTurn();
    game.endTurn();
    expect(game.state.tick).toBe(1);
    const back = step(game.state, withBasedOn(game.state, { type: "turn/end", slots: [] }), world(0), miniContent);
    expect(back).toMatchObject({ ok: false, code: "clock-went-back" });
    const same = step(game.state, withBasedOn(game.state, { type: "turn/end", slots: [] }), world(1), miniContent);
    expect(same.ok).toBe(true);
    const ahead = step(game.state, withBasedOn(game.state, { type: "turn/end", slots: [] }), world(9), miniContent);
    expect(ahead.ok && ahead.state.tick).toBe(9);
  });

  test("[R-ENGINE-013] given a turn event, when applied, then only the turn slice changes and every other slice is the same object", () => {
    const state = newState("scenario.plain", "seed-1", miniContent);
    const granted: TurnEvent = { type: "turn/granted", count: 1, banked: 24 };
    const after = applyEventWith(registry(), state, granted, miniContent);
    expect(after.turn).not.toBe(state.turn);
    for (const key of ["quality", "activity", "wallet", "document", "route", "setpiece", "obligation", "offer", "chapter", "news"] as const) {
      expect(after[key]).toBe(state[key]);
    }
    expect(after.v).toBe(state.v);
  });

  test("[R-ENGINE-013] given an accepted command, when stepped, then it ends with one engine/stepped event carrying the four counters", () => {
    const game = start();
    const result = game.endTurn();
    const last = result.events.at(-1);
    expect(last).toEqual({ type: "engine/stepped", v: 1, tick: 0, draws: {}, nextInstance: game.state.nextInstance });
    expect(result.events.filter((event) => event.type === "engine/stepped")).toHaveLength(1);
  });

  test("[R-ENGINE-013] given a kind that returns another kind's event, when stepped, then the engine refuses it", () => {
    const kinds: Registry = registry().map((kind) =>
      kind.kind === "quality" ? { ...kind, phases: { month: () => [{ type: "turn/refilled", banked: 24 }] } } : kind,
    );
    const state = newState("scenario.plain", "seed-1", miniContent);
    expect(() => stepWith(kinds, state, withBasedOn(state, { type: "turn/end", slots: [] }), world(0), miniContent)).toThrow(
      /quality kind returned the event turn\/refilled/,
    );
  });

  test("[R-ENGINE-013] given an event naming no kind, when applied, then it throws", () => {
    const state = newState("scenario.plain", "seed-1", miniContent);
    const ghost = { type: "ghost/moved" } as unknown as BaseEvent;
    expect(() => applyEventWith(registry(), state, ghost, miniContent)).toThrow(/names no kind/);
  });
});
