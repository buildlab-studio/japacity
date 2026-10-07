import { describe, expect, test } from "vitest";

import { registry } from "../kinds";
import { stepWith } from "../engine/step";
import type { BaseEvent, Command, Ctx, Rejection, State } from "../engine/types";
import { miniContent } from "../testing/miniContent";
import { start } from "../testing/play";
import type { Loose } from "../testing/play";
import { standInWorld } from "../world/standIn";

const tuning = miniContent.tuning.turn;

/**
 * A registry where `offer/choose` carries out a turn effect, so tests can
 * reach `turn/refill` and `turn/finish` through the engine's own routing. The
 * offer stub has no command handler, so nothing real is replaced.
 */
function registryWithEffectCommand(effect: { type: "turn/refill" } | { type: "turn/finish" }) {
  return registry().map((kind) =>
    kind.kind !== "offer"
      ? kind
      : {
          ...kind,
          commands: {
            "offer/choose": (ctx: Ctx, _command: Command): BaseEvent[] | Rejection =>
              ctx.apply([effect], { source: "test", param: null, terms: {} }),
          },
        },
  );
}

function sendWith(kinds: ReturnType<typeof registry>, state: State, command: Loose, tick = 0) {
  return stepWith(kinds, state, { ...command, basedOn: state.v } as Command, standInWorld("w", tick, miniContent), miniContent);
}

describe("turns", () => {
  test("[R-TURN-001] given a new character, when the state is built, then 24 turns are banked and the month is 0", () => {
    const game = start();
    expect(game.state.turn).toEqual({ month: 0, banked: tuning.start, ended: false, report: null });
    expect(tuning.start).toBe(24);
  });

  test("[R-TURN-002] given a full bank, when the authority grants more, then the bank stays at the cap", () => {
    const game = start();
    game.endTurn();
    const result = game.grant(5);
    expect(game.state.turn.banked).toBe(tuning.cap);
    expect(result.events[0]).toEqual({ type: "turn/granted", count: 1, banked: tuning.cap });
  });

  test("[R-TURN-002] given the cap, when a grant would pass it, then it is cut to the cap and never above", () => {
    const game = start();
    game.grant(1000);
    expect(game.state.turn.banked).toBe(tuning.cap);
  });

  test("[R-TURN-003] given a banked turn, when the turn is ended, then one is spent and the month goes up by one", () => {
    const game = start();
    game.endTurn();
    expect(game.state.turn.banked).toBe(tuning.start - 1);
    expect(game.state.turn.month).toBe(1);
    game.endTurn();
    expect(game.state.turn.banked).toBe(tuning.start - 2);
    expect(game.state.turn.month).toBe(2);
  });

  test("[R-TURN-003] given no turn banked, when the turn is ended, then it is rejected with no-turns", () => {
    const game = start();
    for (let i = 0; i < tuning.start; i += 1) game.endTurn();
    expect(game.state.turn.banked).toBe(0);
    game.expectRejected({ type: "turn/end", slots: [] }, "no-turns");
    expect(game.state.turn.month).toBe(tuning.start);
  });

  test("[R-TURN-004] given a part-spent bank, when the effect turn/refill is carried out, then the bank is full", () => {
    const game = start();
    game.endTurn();
    game.endTurn();
    const result = sendWith(
      registryWithEffectCommand({ type: "turn/refill" }),
      game.state,
      { type: "offer/choose", offer: "x", choice: "y" },
      game.tick,
    );
    if (!result.ok) throw new Error(result.detail);
    expect(result.state.turn.banked).toBe(tuning.cap);
    expect(result.events.map((event) => event.type)).toEqual(["turn/refilled", "engine/stepped"]);
  });

  test("[R-TURN-005] given a player, when they send turns/grant, then it is rejected with not-yours", () => {
    const game = start();
    game.endTurn();
    game.expectRejected({ type: "turns/grant", count: 1 }, "not-yours", "player");
    expect(game.state.turn.banked).toBe(tuning.start - 1);
  });

  test("[R-TURN-005] given the authority, when it sends turns/grant, then turns are added", () => {
    const game = start();
    game.endTurn();
    game.endTurn();
    game.grant(1);
    expect(game.state.turn.banked).toBe(tuning.start - 1);
  });

  test("[R-TURN-005] given the authority, when it grants zero or a fraction, then it is rejected with bad-amount", () => {
    const game = start();
    game.expectRejected({ type: "turns/grant", count: 0 }, "bad-amount", "authority");
    game.expectRejected({ type: "turns/grant", count: Number("1.5") }, "bad-amount", "authority");
  });

  test("[R-TURN-006] given no job, when the view is read, then there are 3 free slots", () => {
    const game = start({ scenario: "scenario.plain" });
    expect(game.view().freeSlots).toBe(tuning.freeSlotsNoJob);
    expect(tuning.freeSlotsNoJob).toBe(3);
  });

  test("[R-TURN-006] given a job and wellbeing under 25, when the view is read, then there is one slot fewer than 2", () => {
    const game = start({ scenario: "scenario.worker" });
    expect(game.state.quality["quality.wellbeing"]).toBeLessThan(miniContent.tuning.quality.burnoutBelow);
    expect(game.view().freeSlots).toBe(tuning.freeSlots - 1);
  });

  test("[R-TURN-006] given 3 free slots, when 4 are filled, then the turn is rejected with not-legal", () => {
    const game = start({ scenario: "scenario.plain" });
    const rest = { activity: "activity.rest" as const, param: null };
    game.expectRejected({ type: "turn/end", slots: [rest, rest, rest, rest] }, "not-legal");
    game.endTurn([rest, rest, rest]);
    expect(game.state.turn.month).toBe(1);
  });

  test("[R-TURN-006] given free slots, when fewer are filled, then the empty ones count as rest and the turn is accepted", () => {
    const game = start({ scenario: "scenario.plain" });
    game.endTurn([{ activity: "activity.rest", param: null }]);
    game.endTurn([]);
    expect(game.state.turn.month).toBe(2);
  });

  test("[R-TURN-007] given the effect turn/finish, when it is carried out, then the life is ended and only turns/grant is accepted", () => {
    const game = start();
    const kinds = registryWithEffectCommand({ type: "turn/finish" });
    const finished = sendWith(kinds, game.state, { type: "offer/choose", offer: "x", choice: "y" });
    if (!finished.ok) throw new Error(finished.detail);
    expect(finished.state.turn.ended).toBe(true);

    const ended = sendWith(kinds, finished.state, { type: "turn/end", slots: [] });
    expect(ended).toMatchObject({ ok: false, code: "ended" });
    const quit = sendWith(kinds, finished.state, { type: "activity/quit" });
    expect(quit).toMatchObject({ ok: false, code: "ended" });
    const granted = stepWith(kinds, finished.state, { type: "turns/grant", count: 1, basedOn: finished.state.v }, standInWorld("w", 0, miniContent), miniContent, "authority");
    expect(granted.ok).toBe(true);
  });

  test("[R-TURN-008] given a turn, when it ends, then a report with the month, the lines, japacity before and after, and attention is stored", () => {
    const game = start({ scenario: "scenario.plain" });
    const result = game.endTurn([{ activity: "activity.rest", param: null }]);
    const report = game.state.turn.report;
    expect(report).not.toBeNull();
    expect(report?.month).toBe(1);
    expect(report?.lines).toEqual(result.lines);
    expect(report).toMatchObject({ japacityBefore: null, japacityAfter: null, attention: false });
    expect(game.view().report).toEqual(report);
  });
});
