import type { PlayerView, Reply } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import type { ServerRejection } from "../shared/net/contract";
import { reportedError } from "../shared/net/http";
import { engineView } from "../shared/testing/fixtures";
import { deferred } from "../shared/testing/server";
import { sayCount } from "../shared/words/text";
import { createGameStore, rejectionWords } from "./store";

const at = (v: number): PlayerView => ({ ...engineView(), v });

describe("the store online", () => {
  test("[R-SERVER-019] given a command sent, then it shows as sent and the view stays as it was until the reply arrives", async () => {
    const reply = deferred<Reply>();
    const store = createGameStore({ view: () => Promise.resolve(at(3)), send: () => reply.promise });
    await store.getState().refresh();
    const sending = store.getState().endMonth();
    expect(store.getState().busy).toBe(true);
    expect(store.getState().view?.v).toBe(3);
    reply.resolve({ ok: true, view: at(4), lines: [] });
    await sending;
    expect(store.getState().busy).toBe(false);
    expect(store.getState().view?.v).toBe(4);
  });

  test("[R-SERVER-019] given a fetch that set out before a command's reply, when it lands after, then the older view is dropped", async () => {
    const late = deferred<PlayerView>();
    let calls = 0;
    const store = createGameStore({
      view: () => (calls++ === 0 ? Promise.resolve(at(3)) : late.promise),
      send: () => Promise.resolve({ ok: true, view: at(4), lines: [] }),
    });
    await store.getState().refresh();
    const refreshing = store.getState().refresh();
    await store.getState().endMonth();
    late.resolve(at(3));
    await refreshing;
    expect(store.getState().view?.v).toBe(4);
  });

  test("[R-CLOCK-003] given the authority reports a clock, then the store keeps it beside the view", () => {
    const store = createGameStore({ view: () => Promise.resolve(at(1)), send: () => Promise.reject(new Error("unused")) });
    const clock = { tick: 2, nextTickAt: 10, nextTurnAt: 5 };
    store.getState().heard({ kind: "clock", clock });
    expect(store.getState().clock).toEqual(clock);
  });

  test("[R-SERVER-001] given the server says signed-out, then the store goes to the account screens and shows no failure", async () => {
    const refusal: ServerRejection = { ok: false, code: "signed-out", detail: "no session" };
    const store = createGameStore({
      view: () => {
        store.getState().heard({ kind: "signed-out" });
        return Promise.reject(reportedError(refusal));
      },
      send: () => Promise.resolve(refusal),
    });
    await store.getState().refresh();
    expect(store.getState().signedOut).toBe(true);
    expect(store.getState().failed).toBeNull();
  });

  test("[R-SERVER-025] given the authority reports rate-limited, then the player is told how long to wait", () => {
    const store = createGameStore({ view: () => Promise.resolve(at(1)), send: () => Promise.reject(new Error("unused")) });
    store.getState().heard({ kind: "rate-limited", retryAfter: 4 });
    expect(store.getState().rejection).toEqual({ code: "rate-limited", words: sayCount("ui.online.wait", 4, { seconds: 4 }) });
  });

  test("[R-ACCOUNT-015] given no character on the account, then the life chooser opens, and online it never offers a second life", () => {
    const store = createGameStore(
      { view: () => Promise.resolve(at(1)), send: () => Promise.reject(new Error("unused")) },
      { life: { newLife: () => Promise.resolve(at(0)) }, lifeAgain: false },
    );
    expect(store.getState().openLifeChooser).toBeNull();
    store.getState().heard({ kind: "no-character" });
    expect(store.getState().choosingLife).toBe(true);
  });

  test("given every server refusal, then each has words of its own", () => {
    for (const code of ["rate-limited", "signed-out", "diverged", "region-closed", "one-character", "no-character"] as const) {
      expect(rejectionWords(code)).not.toBe(code);
    }
  });

  test("[R-ACCOUNT-016] given the account left, then the view goes and the reason is kept for the sign-in screen", async () => {
    const store = createGameStore({ view: () => Promise.resolve(at(1)), send: () => Promise.reject(new Error("unused")) });
    await store.getState().refresh();
    store.getState().leave("ui.account.notice.deleted");
    expect(store.getState()).toMatchObject({ signedOut: true, view: null, accountNotice: "ui.account.notice.deleted" });
  });
});

describe("the month kept through a reload", () => {
  test("[R-WORLD-007] [R-WORLD-008] given a plan, lines mid-month and a card closed, when a new store loads the same view, then it has them all; when the view has moved on, then none", async () => {
    localStorage.clear();
    const line = { key: "line.wallet.social", params: { amount: { currency: "NGN" as const, amount: 100 } }, tone: "bad" as const, attention: false, counts: [] };
    const first = createGameStore({ view: () => Promise.resolve(at(7)), send: () => Promise.resolve({ ok: true, view: at(7), lines: [line] }) });
    await first.getState().refresh();
    first.getState().setSlot(0, { activity: "activity.rest", param: null });
    await first.getState().send({ type: "wallet/move", currency: "NGN", amount: 1, to: "cash" });
    first.getState().closeCard("card-1");
    const again = createGameStore({ view: () => Promise.resolve(at(7)), send: () => Promise.resolve({ ok: true, view: at(7), lines: [] }) });
    await again.getState().refresh();
    expect(again.getState().plan[0]).toEqual({ activity: "activity.rest", param: null });
    expect(again.getState().monthLines).toEqual([line]);
    expect(again.getState().cardClosed).toBe("card-1");
    const later = createGameStore({ view: () => Promise.resolve(at(8)), send: () => Promise.resolve({ ok: true, view: at(8), lines: [] }) });
    await later.getState().refresh();
    expect(later.getState().plan.every((pick) => pick === null)).toBe(true);
    expect(later.getState().monthLines).toEqual([]);
    expect(later.getState().cardClosed).toBeNull();
  });
});
