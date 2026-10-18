import { describe, expect, test } from "vitest";

import { checkInvariants } from "../engine/invariants";
import { newState } from "../engine/state";
import type { Id } from "../engine/types";
import { miniContent } from "../testing/miniContent";
import { start } from "../testing/play";

const scenarios = Object.keys(miniContent.scenario) as Id<"scenario">[];

describe("starting lives", () => {
  test.each(scenarios)("[scenario:state-built-from-scenario] given %s, when a new state is built, then every invariant holds", (scenario) => {
    const state = newState(scenario, "seed", miniContent);
    expect(checkInvariants(state, miniContent)).toEqual([]);
    expect(state.scenario).toBe(scenario);
    expect(state.content).toBe(miniContent.version);
  });

  test("[scenario:state-built-from-scenario] given a scenario that is not in content, when a state is built, then it throws", () => {
    expect(() => newState("scenario.nobody", "seed", miniContent)).toThrow(/no scenario/);
  });

  test.each(scenarios)("[scenario:new-state-starts-clean] given %s, when a new state is built, then routes are unknown, nothing is open, and only the listed obligations exist", (scenario) => {
    const state = newState(scenario, "seed", miniContent);
    const entry = miniContent.scenario[scenario]!;
    for (const route of Object.values(state.route)) expect(route.state).toBe("unknown");
    expect(state.offer.items).toEqual({});
    expect(state.setpiece.open).toBeNull();
    const opened = Object.values(state.obligation.items).map((item) => ({ obligation: item.entry, amount: item.amount }));
    expect(opened).toEqual(entry.obligations);
    expect(state.nextInstance).toBe(1 + entry.obligations.length);
  });

  test.each(scenarios)("[scenario:new-state-starts-clean] given %s, when a new state is built, then the opening balances are credited under the reason opening", (scenario) => {
    const state = newState(scenario, "seed", miniContent);
    const entry = miniContent.scenario[scenario]!;
    for (const [currency, given] of Object.entries(entry.pockets)) {
      const pocket = state.wallet.pockets[currency as "NGN" | "GBP" | "USD"];
      expect(pocket).toEqual({ bank: given.bank, cash: given.cash, locked: 0 });
      expect(state.wallet.totals.in.opening?.[currency as "NGN"]).toBe(given.bank + given.cash);
    }
    expect(state.wallet.pockets.USD).toEqual({ bank: 0, cash: 0, locked: 0 });
  });

  test.each(scenarios)("[scenario:first-turn-always-endable] given %s, when the first turn is ended with every slot resting, then it is accepted", (scenario) => {
    const game = start({ scenario });
    const result = game.endTurn([]);
    expect(result.ok).toBe(true);
    expect(game.state.turn.month).toBe(1);
    expect(checkInvariants(game.state, miniContent)).toEqual([]);
  });
});
