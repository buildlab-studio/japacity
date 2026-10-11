// What is coming with a month to it (docs/rules/world.md R-WORLD-002): the whole list soonest first, each
// as months away, and only dates the player can act on or waits on.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { engineView, newGame, richView, setPockets, viewAfter } from "../testing/fixtures";
import { formatMoney } from "./format";
import { nameOf, say } from "./text";
import { AGE_LIMIT_NEAR, ageMonthsOf, comingOf, RENT_NEAR, soonest } from "./coming";

describe("what is coming", () => {
  test("[R-CLOCK-032] given the English result sealed until the morning and a passport on its way, when the list is read, then the result comes tomorrow at seven in words and the passport keeps its months", () => {
    const base = richView();
    const view = {
      ...base,
      month: 10,
      documents: [
        { id: "document.english-test" as const, state: "pending" as const, readyMonth: 10, expiresMonth: null, value: null, onItsWay: 10 },
        { id: "document.passport" as const, state: "pending" as const, readyMonth: 12, expiresMonth: null, value: null, onItsWay: 12 },
      ],
    };
    const papers = comingOf(view).filter((item) => item.kind === "paper");
    expect(papers.map((item) => [item.what, item.when])).toEqual([
      [nameOf("document.english-test"), "Tomorrow, 7am"],
      [nameOf("document.passport"), undefined],
    ]);
  });

  test("[R-WORLD-002] given a new life, when the list is read, then the next birthday is on it as months away, and the chip has nothing to say", () => {
    const view = engineView();
    const age = ageMonthsOf(view);
    const list = comingOf(view);
    expect(list.map((item) => item.kind)).toEqual(["birthday"]);
    expect(list[0]?.what).toBe(say("ui.world.coming.birthday", { age: Math.floor(age / 12) + 1 }));
    expect(list[0]?.month).toBe(view.month + 12 - (age % 12));
    expect(soonest(view)).toBeNull();
  });

  test("[R-WORLD-002] given open asks, a paper on its way and a visa awaited, when the list is read, then each is on it with its month and the list runs soonest first", () => {
    const base = richView();
    const view = {
      ...base,
      month: 10,
      documents: [{ id: "document.passport" as const, state: "pending" as const, readyMonth: 12, expiresMonth: null, value: null, onItsWay: 12 }],
      routes: [{ ...base.routes[0]!, id: "route.uk-masters" as const, state: "applying" as const, visa: { submittedMonth: 9, decisionMonth: 11 } }],
    };
    const list = comingOf(view);
    const months = list.map((item) => item.month);
    expect([...months].sort((a, b) => a - b)).toEqual(months);
    expect(list.find((item) => item.kind === "paper")).toMatchObject({ what: nameOf("document.passport"), month: 12 });
    expect(list.find((item) => item.kind === "visa")).toMatchObject({ what: nameOf("route.uk-masters"), month: 11 });
    expect(list.filter((item) => item.kind === "offer").length).toBe(view.offers.filter((offer) => offer.expiresMonth >= 10).length);
    // Nothing past is listed; the chip says the soonest thing to answer or wait on.
    expect(list.every((item) => item.month >= view.month)).toBe(true);
    expect(soonest(view)).toEqual(list.find((item) => item.kind !== "birthday" && item.kind !== "age-limit"));
  });

  test("[R-DOCUMENT-008] given a held passport with a new copy requested, when the list is read, then the new copy is on it at the month the engine says it is due", () => {
    const game = newGame("scenario.tunde");
    const view = viewAfter(game, [{ type: "document/request", document: "document.passport" }]);
    const passport = view.documents.find((paper) => paper.id === "document.passport");
    expect(passport?.state).toBe("held");
    expect(passport?.onItsWay).not.toBeNull();
    expect(comingOf(view).find((item) => item.kind === "paper")).toMatchObject({ what: nameOf("document.passport"), month: passport?.onItsWay });
  });

  test("[R-WORLD-002] given the Gulf heard of and the character near its age limit, when the list is read, then the limit is on it as months away; far from it, or on a route unheard, it is not", () => {
    const base = engineView();
    const limit = content.route["route.gulf-contract"]?.contract?.maxAgeMonths;
    if (limit === undefined) throw new Error("The Gulf has no age limit.");
    const aged = (months: number, state: "heard" | "unknown") => ({
      ...base,
      qualities: base.qualities.map((quality) => (quality.id === "quality.age-months" ? { ...quality, value: limit - months } : quality)),
      routes: [{ ...richView().routes[0]!, id: "route.gulf-contract" as const, state, visa: null }],
    });
    const near = comingOf(aged(6, "heard")).find((item) => item.kind === "age-limit");
    expect(near).toMatchObject({ what: say("ui.world.coming.age-limit", { route: nameOf("route.gulf-contract") }), month: base.month + 6 });
    expect(comingOf(aged(AGE_LIMIT_NEAR + 1, "heard")).find((item) => item.kind === "age-limit")).toBeUndefined();
    expect(comingOf(aged(6, "unknown")).find((item) => item.kind === "age-limit")).toBeUndefined();
  });

  test("[R-HOME-010] given Ada in the room in a compound, when months pass, then the room's rent joins the list two months before the month it is taken, at that month, and the chip may say it", () => {
    const game = newGame();
    setPockets(game, { NGN: 5_000_000_00 });
    game.accept({ type: "home/move", to: "place.compound-room" });
    const what = say("ui.world.coming.rent", { amount: formatMoney(content.tuning.home.compound.rentYear, "NGN") });
    const seen: { what: string; away: number; dueIn: number }[] = [];
    while (game.state.turn.month < 12) {
      const view = game.view();
      const rent = comingOf(view).find((item) => item.kind === "rent");
      if (rent !== undefined) seen.push({ what: rent.what, away: rent.month - view.month, dueIn: view.home.roomRent!.dueIn });
      setPockets(game, { NGN: 5_000_000_00 });
      if (game.state.turn.banked < 1) game.grant(content.tuning.turn.cap);
      game.endTurn();
    }
    expect(seen).toEqual([RENT_NEAR, 1, 0].map((away) => ({ what, away, dueIn: away })));
    expect(soonest(newGame().view())).toBeNull();
  });
});
