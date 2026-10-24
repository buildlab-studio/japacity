// Secure's `second` path, a second route granted after a return (chapter.md, row 6), and what it reads: the month a route is granted
// (route:grant-moves-to-granted) against the latest return home (chapter:items-are-live-requirements).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import type { Effect, Id } from "../engine/types";
import { flownGraduate, playUntil } from "../testing/goal.journey";
import { flown } from "../testing/place.journey";
import { applyEffects, readyLife, toDecision } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { closed, readOf } from "../testing/read";
import { ALWAYS_GRANTED, offeredSeed } from "../testing/place.journey";
import { CARE_ROUTE, SECURE, UK_ROUTE } from "../testing/ids";

/** The graduate flown and on through Landing, so Secure is the chapter in hand. */
function atSecure(): Game {
  const game = flownGraduate(content);
  playUntil(game, SECURE);
  return game;
}

/** The care route as a decision that grants it in the month given would leave it. */
function careGrantedIn(game: Game, month: number): void {
  game.state = { ...game.state, route: { ...game.state.route, [CARE_ROUTE]: { ...game.state.route[CARE_ROUTE]!, state: "granted", grantedMonth: month } } };
}

/** Every pocket emptied but the UK fare in pounds, so the return is broke and the home path stays shut. */
function brokeReturn(game: Game): void {
  const pockets = game.state.wallet.pockets;
  const takes: Effect[] = (["NGN", "USD", "GBP"] as const).flatMap((currency): Effect[] => {
    const held = pockets[currency].bank + pockets[currency].cash;
    return held === 0 ? [] : [{ type: "money/take", currency, pocket: "any", amount: held, reason: "mishap" }];
  });
  applyEffects(game, [...takes, { type: "money/add", currency: "GBP", pocket: "bank", amount: content.country["country.uk"]!.fare, reason: "gift" }]);
  game.accept({ type: "return/home" });
  expect(game.state.place.returns.at(-1)?.shape).toBe("broke");
}

describe("the month a route is granted", () => {
  test("[route:grant-moves-to-granted] given an application decided with a grant, when the decision lands, then the route is granted and keeps the month of the grant", () => {
    const game = readyLife(content, { seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
    toDecision(game);
    expect(game.state.route[UK_ROUTE]).toMatchObject({ state: "granted", grantedMonth: game.state.turn.month });
  });
});

describe("a route granted after the latest return", () => {
  const afterReturn = (route: Id<"route">) => ({ type: "route/state" as const, route, in: ["granted" as const], afterReturn: true as const });

  test("[chapter:items-are-live-requirements] given a granted route, when route/state with afterReturn is judged, then it holds only for a grant in a month after the latest return home, and never with no return on record", () => {
    const game = flown(content);
    careGrantedIn(game, game.state.turn.month);
    expect(check(readOf(game), afterReturn(CARE_ROUTE)).met).toBe(false);
    applyEffects(game, [{ type: "money/add", currency: "GBP", pocket: "bank", amount: 500000, reason: "gift" }]);
    game.accept({ type: "return/home" });
    const back = game.state.turn.month;
    careGrantedIn(game, back);
    expect(check(readOf(game), afterReturn(CARE_ROUTE)).met).toBe(false);
    careGrantedIn(game, back + 1);
    expect(check(readOf(game), afterReturn(CARE_ROUTE)).met).toBe(true);
    expect(check(readOf(game), { type: "route/state", route: CARE_ROUTE, in: ["granted"] }).met).toBe(true);
  });

  test("[chapter:met-items-close-the-chapter] given Secure in hand abroad and a second route granted before the first flight, when the month ends, then Secure stays open: an unused visa is no second route", () => {
    const game = atSecure();
    careGrantedIn(game, game.state.place.movedMonth - 1);
    const result = game.endTurn();
    expect(closed(result)).toEqual([]);
    expect(game.state.chapter.current).toBe(SECURE);
  });

  test("[chapter:met-items-close-the-chapter] given Secure in hand, a second route granted before the first flight and then a broke return, when the month ends at home, then Secure stays open; a route granted after the return closes it", () => {
    const game = atSecure();
    careGrantedIn(game, game.state.place.movedMonth - 1);
    brokeReturn(game);
    expect(closed(game.endTurn())).toEqual([]);
    expect(game.state.chapter.current).toBe(SECURE);
    careGrantedIn(game, game.state.turn.month);
    expect(closed(game.endTurn())).toEqual([{ type: "chapter/closed", chapter: SECURE, next: null }]);
  });
});
