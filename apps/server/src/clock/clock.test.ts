import { content } from "@japacity/content";
import { newState, nextGameMorning, worldClockAt } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { currentTick } from "../app";
import { restMonth, held, newLife, send, testServer, view } from "../authority/authority.testing";
import { sendAuthority } from "../authority/command";
import { productionConfig, testConfig } from "../config";
import { earnTurns, nextTurnAt } from "./turns";
import { clockView, tickAt, turnClock } from "./view";

const { epoch, worldTickMs, turnRefillMs } = productionConfig.clock;
const cap = content.tuning.turn.cap;
const clock = turnClock(productionConfig, cap);

/** A state with `banked` turns in the bank. */
function banked(count: number) {
  const state = newState("scenario.ada", "clock-seed", content);
  return { ...state, turn: { ...state.turn, banked: count } };
}

describe("turns on real time", () => {
  test("[clock:turns-earned-from-refill-time] given a bank under the cap, when one ms short of a refill has passed, then nothing is earned and refilledAt stays", () => {
    expect(earnTurns(banked(20), epoch, epoch + turnRefillMs - 1, clock)).toEqual({ grant: 0, refilledAt: epoch });
  });

  test("[clock:turns-earned-from-refill-time] [clock:earned-turns-granted-first] given a bank under the cap, when exactly one refill has passed, then one turn is granted and refilledAt moves on by one refill", () => {
    expect(earnTurns(banked(20), epoch, epoch + turnRefillMs, clock)).toEqual({ grant: 1, refilledAt: epoch + turnRefillMs });
    expect(earnTurns(banked(20), epoch, epoch + 3 * turnRefillMs + 5, clock)).toEqual({ grant: 3, refilledAt: epoch + 3 * turnRefillMs });
  });

  test("[clock:earned-turns-granted-first] given more earned than the room left, when granted, then only the room is granted and refilledAt moves to now", () => {
    const now = epoch + 10 * turnRefillMs + 7;
    expect(earnTurns(banked(cap - 2), epoch, now, clock)).toEqual({ grant: 2, refilledAt: now });
    expect(earnTurns(banked(cap - 2), epoch, epoch + 2 * turnRefillMs, clock)).toEqual({ grant: 2, refilledAt: epoch + 2 * turnRefillMs });
  });

  test("[clock:full-bank-earns-nothing] given a full bank, when any time has passed, then nothing is earned and refilledAt is held at now", () => {
    const now = epoch + 40 * turnRefillMs;
    expect(earnTurns(banked(cap), epoch, now, clock)).toEqual({ grant: 0, refilledAt: now });
  });

  test("[clock:production-has-no-fast-clock] given an empty bank, when the production clock and the test server's fast clock read it, then only the fast clock grants at once", () => {
    expect(earnTurns(banked(0), epoch, epoch + 1, clock).grant).toBe(0);
    const fast = turnClock(testConfig({ testing: { fastClock: true } }), cap);
    expect(earnTurns(banked(0), epoch, epoch + 1, fast)).toEqual({ grant: cap, refilledAt: epoch + 1 });
    expect(turnClock(productionConfig, cap).fastClock).toBe(false);
  });

  test("[clock:reply-carries-the-clock] given a bank under the cap and a full one, when the next turn is read, then it is one refill after refilledAt, or null while full", () => {
    expect(nextTurnAt(banked(3), epoch + 5, clock)).toBe(epoch + 5 + turnRefillMs);
    expect(nextTurnAt(banked(cap), epoch + 5, clock)).toBeNull();
  });
});

describe("the clock a reply carries", () => {
  test("[clock:server-owns-the-clock] given any time, when the tick is read for a reply, then it is the app's current tick", () => {
    for (const now of [epoch - 1, epoch, epoch + worldTickMs - 1, epoch + worldTickMs, epoch + 9 * worldTickMs + 3]) {
      expect(tickAt(productionConfig.clock, now)).toBe(currentTick({ config: productionConfig, now: () => now }));
    }
  });

  test("[clock:reply-carries-the-clock] given a time inside a tick, when the clock is made, then it holds the tick, the start of the next and the next turn", () => {
    const now = epoch + 2 * worldTickMs + 17;
    expect(clockView(productionConfig, now, banked(5), now - 3, cap)).toEqual({ tick: 2, nextTickAt: epoch + 3 * worldTickMs, nextTurnAt: now - 3 + turnRefillMs, morningAt: nextGameMorning(now), world: worldClockAt(now) });
  });

  test("[clock:reply-carries-the-clock] [clock:turns-earned-from-refill-time] given a character that spent two turns, when the view is fetched one ms before a refill and at it, then the second fetch grants one turn and the clock says when the next comes", async () => {
    const server = testServer();
    await newLife(server, "acc-1");
    let reply = await view(server, "acc-1");
    for (let month = 0; month < 2; month += 1) {
      if (!reply.body.ok) throw new Error(reply.body.detail);
      const sent = await send(server, "acc-1", restMonth(reply.body.view));
      expect(sent.body.ok).toBe(true);
      reply = await view(server, "acc-1");
    }
    if (!reply.body.ok) throw new Error(reply.body.detail);
    expect(reply.body.view.turns.banked).toBe(cap - 2);
    expect(reply.body.clock).toEqual({ tick: 0, nextTickAt: epoch + worldTickMs, nextTurnAt: epoch + turnRefillMs, morningAt: nextGameMorning(epoch), world: worldClockAt(epoch) });

    server.wait(turnRefillMs - 1);
    const before = await view(server, "acc-1");
    if (!before.body.ok) throw new Error(before.body.detail);
    expect(before.body.view.turns.banked).toBe(cap - 2);

    server.wait(1);
    const after = await view(server, "acc-1");
    if (!after.body.ok) throw new Error(after.body.detail);
    expect(after.body.view.turns.banked).toBe(cap - 1);
    expect(after.body.clock.nextTurnAt).toBe(epoch + 2 * turnRefillMs);
  });

  test("[clock:earned-turns-granted-first] [server:authority-commands-same-path] given earned turns, when the view is fetched, then one turns/grant from the authority is logged like any command and refilledAt is stored", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    const first = await view(server, "acc-1");
    if (!first.body.ok) throw new Error(first.body.detail);
    await send(server, "acc-1", restMonth(first.body.view));
    await send(server, "acc-1", restMonth({ v: 1 }));
    server.wait(turnRefillMs + 5);
    await view(server, "acc-1");
    const stored = await held(server, character);
    const last = stored.tail.at(-1);
    expect(last).toMatchObject({ sender: "authority", command: { type: "turns/grant", count: 1, basedOn: 2 }, v: 3, tick: 0 });
    expect(stored.character.refilledAt).toBe(epoch + turnRefillMs);
  });

  test("[clock:full-bank-earns-nothing] given a full bank for a day, when a turn is spent and the view fetched one ms short of a refill later, then no turn was banked for the time spent full", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    server.wait(24 * turnRefillMs);
    const full = await view(server, "acc-1");
    if (!full.body.ok) throw new Error(full.body.detail);
    expect(full.body.clock.nextTurnAt).toBeNull();
    expect((await held(server, character)).character.refilledAt).toBe(server.deps.now());
    await send(server, "acc-1", restMonth(full.body.view));
    const spentAt = server.deps.now();
    server.wait(turnRefillMs - 1);
    const later = await view(server, "acc-1");
    if (!later.body.ok) throw new Error(later.body.detail);
    expect(later.body.view.turns.banked).toBe(cap - 1);
    expect(later.body.clock.nextTurnAt).toBe(spentAt + turnRefillMs);
  });

  test("[clock:bonus-grants-keep-refill-time] given a character mid-refill, when the authority grants an apology's turns, then refilledAt does not move", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    const first = await view(server, "acc-1");
    if (!first.body.ok) throw new Error(first.body.detail);
    await send(server, "acc-1", restMonth(first.body.view));
    await send(server, "acc-1", restMonth({ v: 1 }));
    server.wait(turnRefillMs - 10);
    const outcome = await sendAuthority(server.deps, character, { type: "turns/grant", count: 1, basedOn: 0 });
    expect(outcome.kind).toBe("done");
    const stored = await held(server, character);
    expect(stored.character.refilledAt).toBe(epoch);
    expect(stored.tail.at(-1)).toMatchObject({ sender: "authority", command: { type: "turns/grant", count: 1, basedOn: 2 } });
    const after = await view(server, "acc-1");
    if (!after.body.ok) throw new Error(after.body.detail);
    expect(after.body.view.turns.banked).toBe(cap - 1);
  });
});
