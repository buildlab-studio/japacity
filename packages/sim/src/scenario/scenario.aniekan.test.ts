// Aniekan's starting life through the engine: the
// scenario rules every fixed life keeps, and a prologue closed from the start.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { checkInvariants } from "../engine/invariants";
import { start } from "../testing/play";

const LIFE = "scenario.aniekan" as const;

describe("Aniekan's life", () => {
  test("[scenario:state-built-from-scenario] given Aniekan, when a new state is built, then every always-true rule holds in it", () => {
    const game = start({ scenario: LIFE, seed: "fifth-1", content });
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[scenario:new-state-starts-clean] given Aniekan, when a new state is built, then no route is known, nothing is open, only his own obligations run, and the opening money came in as opening", () => {
    const game = start({ scenario: LIFE, seed: "fifth-1", content });
    const view = game.view();
    expect(Object.values(game.state.route).filter((held) => held !== undefined && held.state !== "unknown")).toEqual([]);
    expect(Object.keys(game.state.offer.items)).toEqual([]);
    expect(view.prologue).toBeNull();
    expect(game.state.setpiece.open).toBeNull();
    expect(Object.values(game.state.obligation.items).map((held) => held.entry).sort()).toEqual(["obligation.home-support", "obligation.upkeep"]);
    expect(Object.keys(game.state.wallet.totals.in)).toEqual(["opening"]);
  });

  test("[scenario:first-turn-always-endable] [prologue:fixed-life-skips-prologue] given Aniekan, when the first turn is ended with every slot resting, then it is accepted, and his prologue was closed from the start with no steps", () => {
    const game = start({ scenario: LIFE, seed: "fifth-1", content });
    expect(game.state.prologue).toMatchObject({ open: false, step: null, choices: {} });
    expect(game.endTurn().ok).toBe(true);
  });
});
