import { describe, expect, test } from "vitest";

import { bp } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import { registry } from "../kinds";
import { arrivalsCrossed, freeHalfDays, freeSlots } from "./turn.logic";
import { stepWith } from "../engine/step";
import type { BaseEvent, Command, Ctx, Effect, Rejection, State } from "../engine/types";
import { miniContent } from "../testing/miniContent";
import { start } from "../testing/play";
import type { Loose } from "../testing/play";
import { standInWorld } from "../world/standIn";

const tuning = miniContent.tuning.turn;

/**
 * A registry where `offer/choose` carries out a turn effect, so tests can
 * reach `turn/refill` and `turn/finish` through the engine's own routing. It
 * takes the place of the offer kind's own `offer/choose`.
 */
function registryWithEffectCommand(effect: Extract<Effect, { type: `turn/${string}` }>) {
  return registry().map((kind) =>
    kind.kind !== "offer"
      ? kind
      : {
          ...kind,
          commands: {
            "offer/choose": (ctx: Ctx): BaseEvent[] | Rejection => ctx.apply([effect], { source: "test", param: null, terms: {} }),
          },
        },
  );
}

/** Sets wellbeing through the engine, as an offer choice would. */
function setWellbeing(game: ReturnType<typeof start>, value: number): void {
  const amount = value - (game.state.quality["quality.wellbeing"] ?? 0);
  const kinds = registry().map((kind) =>
    kind.kind !== "offer"
      ? kind
      : { ...kind, commands: { "offer/choose": (ctx: Ctx): BaseEvent[] => ctx.apply([{ type: "quality/add", quality: "quality.wellbeing", amount }], { source: "test", param: null, terms: {} }) } },
  );
  const result = sendWith(kinds, game.state, { type: "offer/choose", offer: "x", choice: "y" }, game.tick);
  if (!result.ok) throw new Error(result.detail);
  game.state = result.state;
  expect(game.state.quality["quality.wellbeing"]).toBe(value);
}

function sendWith(kinds: ReturnType<typeof registry>, state: State, command: Loose, tick = 0) {
  const full: Command = { ...command, basedOn: state.v };
  return stepWith(kinds, state, full, standInWorld("w", tick, miniContent), miniContent);
}

describe("turns", () => {
  test("[R-TURN-001] [R-TURN-010] given a new character, when the state is built, then 24 turns are banked, the month is 0 and no time is spent", () => {
    const game = start();
    expect(game.state.turn).toEqual({ month: 0, banked: tuning.start, spent: 0, ended: false, report: null, locks: [] });
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

  test("[R-TURN-003] given no turn banked, when the turn is ended, then the month turns, as the bank gates nothing (decision 0011)", () => {
    const game = start();
    for (let i = 0; i < tuning.start; i += 1) game.endTurn();
    expect(game.state.turn.banked).toBe(0);
    game.endTurn();
    expect(game.state.turn.banked).toBe(0);
    expect(game.state.turn.month).toBe(tuning.start + 1);
  });

  test("[R-TURN-010] given a life with no job, when the month's free time is read, then it is the whole month, and with a job what the job leaves", () => {
    const game = start();
    expect(freeHalfDays(game.state, miniContent)).toBe(tuning.halfDays.noJob);
    expect(tuning.halfDays.noJob).toBe(60);
    expect(tuning.halfDays.withJob).toBe(20);
  });

  test("[R-TURN-010] given time spent this month, when the turn is ended, then the new month starts with none spent", () => {
    const game = start();
    const result = sendWith(
      registryWithEffectCommand({ type: "turn/spend-days", halfDays: 3 }),
      game.state,
      { type: "offer/choose", offer: "x", choice: "y" },
      game.tick,
    );
    if (!result.ok) throw new Error(result.detail);
    expect(result.state.turn.spent).toBe(3);
    expect(result.events).toContainEqual({ type: "turn/days-spent", halfDays: 3, spent: 3 });
    game.state = result.state;
    game.endTurn();
    expect(game.state.turn.spent).toBe(0);
  });

  test("[R-TURN-010] [R-OFFER-008] given the arrival marks at a third and two thirds, when a spend is read against them, then a mark counts once, when the time was under it and is now at or past it, and one spend may cross both", () => {
    const marks = tuning.arrivalsBp;
    expect(marks).toEqual([3333, 6667]);
    const first = bp(60, 3333);
    const second = bp(60, 6667);
    expect([first, second]).toEqual([19, 40]);
    expect(arrivalsCrossed(0, first - 1, 60, marks)).toBe(0);
    expect(arrivalsCrossed(first - 1, first, 60, marks)).toBe(1);
    expect(arrivalsCrossed(first, second - 1, 60, marks)).toBe(0);
    expect(arrivalsCrossed(second - 1, second, 60, marks)).toBe(1);
    expect(arrivalsCrossed(0, 60, 60, marks)).toBe(2);
    expect(arrivalsCrossed(second, 60, 60, marks)).toBe(0);
    // With a job the month is shorter and the marks come sooner.
    expect(arrivalsCrossed(0, bp(20, 3333), 20, marks)).toBe(1);
  });

  test("[R-TURN-010] given time spent up to the month, when more is spent, then it never passes the month's free time", () => {
    const game = start();
    const spend = (state: State, halfDays: number) => {
      const result = sendWith(registryWithEffectCommand({ type: "turn/spend-days", halfDays }), state, { type: "offer/choose", offer: "x", choice: "y" }, game.tick);
      if (!result.ok) throw new Error(result.detail);
      return result.state;
    };
    const state = spend(spend(game.state, 59), 5);
    expect(state.turn.spent).toBe(tuning.halfDays.noJob);
    expect(checkInvariants(state, miniContent)).toEqual([]);
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
    expect(game.expectRejected({ type: "turns/grant", count: 0 }, "bad-amount", "authority").code).toBe("bad-amount");
    expect(game.expectRejected({ type: "turns/grant", count: Number("1.5") }, "bad-amount", "authority").code).toBe("bad-amount");
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

  test("[R-TURN-006] given a job and wellbeing at 25 and at 24, when the free slots are counted, then 25 keeps both and 24 loses one, and the turn check follows", () => {
    const burnout = miniContent.tuning.quality.burnoutBelow;
    expect(burnout).toBe(25);
    const rest = { activity: "activity.rest" as const, param: null };
    const at = start({ scenario: "scenario.worker" });
    setWellbeing(at, burnout);
    expect(at.view().freeSlots).toBe(tuning.freeSlots);
    at.endTurn([rest, rest]);
    const under = start({ scenario: "scenario.worker" });
    setWellbeing(under, burnout - 1);
    expect(under.view().freeSlots).toBe(tuning.freeSlots - 1);
    under.expectRejected({ type: "turn/end", slots: [rest, rest] }, "not-legal");
    under.endTurn([rest]);
  });

  test("[R-TURN-006] given no job and wellbeing at 25 and at 24, when the free slots are counted, then 25 keeps three and 24 loses one", () => {
    const burnout = miniContent.tuning.quality.burnoutBelow;
    const rest = { activity: "activity.rest" as const, param: null };
    const at = start({ scenario: "scenario.plain" });
    setWellbeing(at, burnout);
    expect(at.view().freeSlots).toBe(tuning.freeSlotsNoJob);
    at.endTurn([rest, rest, rest]);
    const under = start({ scenario: "scenario.plain" });
    setWellbeing(under, burnout - 1);
    expect(under.view().freeSlots).toBe(tuning.freeSlotsNoJob - 1);
    under.expectRejected({ type: "turn/end", slots: [rest, rest, rest] }, "not-legal");
    under.endTurn([rest, rest]);
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

  test("[R-TURN-006] given rest, which the player never plans since an empty slot rests, when a recorded pick of it and an empty month are played, then the pick still plays and every empty slot rests", () => {
    const game = start({ scenario: "scenario.plain" });
    const recorded = game.endTurn([{ activity: "activity.rest", param: null }]);
    expect(recorded.events.some((event) => event.type === "activity/slot-played")).toBe(true);
    const empty = game.endTurn([]);
    expect(empty.events.find((event) => event.type === "activity/rested")).toMatchObject({ slots: game.view().freeSlots });
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

  test("[R-TURN-009] given a lock of one slot for two months, when the months pass, then the free slots drop by one for those months and come back after", () => {
    const game = start({ scenario: "scenario.plain" });
    const kinds = registryWithEffectCommand({ type: "turn/lock", slots: 1, months: 2, why: "illness" });
    const locked = sendWith(kinds, game.state, { type: "offer/choose", offer: "x", choice: "y" }, game.tick);
    if (!locked.ok) throw new Error(locked.detail);
    game.state = locked.state;
    expect(game.view().freeSlots).toBe(tuning.freeSlotsNoJob - 1);
    expect(game.view().locks).toEqual([{ slots: 1, untilMonth: 1, why: "illness" }]);
    const rest = { activity: "activity.rest" as const, param: null };
    game.expectRejected({ type: "turn/end", slots: [rest, rest, rest] }, "not-legal");
    game.endTurn([rest, rest]);
    expect(game.view().freeSlots).toBe(tuning.freeSlotsNoJob - 1);
    game.endTurn([rest, rest]);
    expect(game.view().freeSlots).toBe(tuning.freeSlotsNoJob);
    expect(game.view().locks).toEqual([]);
    expect(game.state.turn.locks).toEqual([]);
  });

  test("[R-TURN-009] given a job, burnout and the most slots locked, when the free slots are counted, then they stop at zero, and only an empty turn is legal", () => {
    const game = start({ scenario: "scenario.worker" });
    expect(game.view().freeSlots).toBe(tuning.freeSlots - 1);
    const kinds = registryWithEffectCommand({ type: "turn/lock", slots: tuning.maxLocked, months: 1, why: "illness" });
    const locked = sendWith(kinds, game.state, { type: "offer/choose", offer: "x", choice: "y" }, game.tick);
    if (!locked.ok) throw new Error(locked.detail);
    game.state = locked.state;
    expect(tuning.freeSlots - 1 - tuning.maxLocked).toBeLessThan(0);
    expect(game.view().freeSlots).toBe(0);
    game.expectRejected({ type: "turn/end", slots: [{ activity: "activity.rest", param: null }] }, "not-legal");
    game.endTurn([]);
    expect(game.state.turn.locks).toEqual([]);
    expect(game.view().freeSlots).toBe(tuning.freeSlots - 1);
  });

  test("[R-TURN-009] given a lock of one month applied while a turn resolves, when it lands, then that turn keeps the slots it was checked with, the month in hand is locked, and the lock ends in the next spend", () => {
    const rest = miniContent.activity["activity.rest"]!;
    const lockingRest = { ...rest, id: "activity.lock-rest" as const, effects: [...rest.effects, { type: "turn/lock" as const, slots: 1, months: 1, why: "night" }] };
    const used = { ...miniContent, activity: { ...miniContent.activity, [lockingRest.id]: lockingRest } };
    const game = start({ scenario: "scenario.plain", content: used });
    const pick = { activity: lockingRest.id, param: null };
    const result = game.endTurn([pick, pick, pick]);
    expect(game.state.turn.month).toBe(1);
    expect(result.events.filter((event) => event.type === "activity/slot-played")).toHaveLength(3);
    // The first slot's lock took one slot; the second asked again and the cap allowed it; the third found no room.
    expect(game.state.turn.locks).toEqual([
      { slots: 1, untilMonth: 1, why: "night" },
      { slots: 1, untilMonth: 1, why: "night" },
    ]);
    expect(game.view().locks.every((lock) => lock.untilMonth === game.state.turn.month)).toBe(true);
    expect(game.view().freeSlots).toBe(tuning.freeSlotsNoJob - tuning.maxLocked);
    game.expectRejected({ type: "turn/end", slots: [pick, pick] }, "not-legal");
    const next = game.endTurn([{ activity: "activity.rest", param: null }]);
    expect(next.events).toContainEqual({ type: "turn/unlocked", why: ["night", "night"] });
    expect(game.state.turn.locks).toEqual([]);
    expect(game.view().freeSlots).toBe(tuning.freeSlotsNoJob);
  });

  test("[R-TURN-009] given locks at the most allowed, when another lock is asked for, then it is cut to what is left and never below zero slots", () => {
    const game = start({ scenario: "scenario.plain" });
    const kinds = registryWithEffectCommand({ type: "turn/lock", slots: 5, months: 1, why: "burial" });
    const locked = sendWith(kinds, game.state, { type: "offer/choose", offer: "x", choice: "y" }, game.tick);
    if (!locked.ok) throw new Error(locked.detail);
    expect(locked.state.turn.locks.reduce((sum, lock) => sum + lock.slots, 0)).toBe(tuning.maxLocked);
    expect(freeSlots(locked.state, miniContent)).toBe(tuning.freeSlotsNoJob - tuning.maxLocked);
    const again = sendWith(kinds, locked.state, { type: "offer/choose", offer: "x", choice: "y" }, game.tick);
    if (!again.ok) throw new Error(again.detail);
    expect(again.state.turn.locks).toEqual(locked.state.turn.locks);
    expect(checkInvariants(again.state, miniContent)).toEqual([]);
  });
});
