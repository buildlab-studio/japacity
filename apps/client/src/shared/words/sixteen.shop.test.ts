// The trader's way and words after the handover: a trader from the tile whose master
// settled her stays a trader with a shop's capital once the living costs take the first month, her first chapter
// reads in her words, and her own way to a job is the shop's act at her stall. Real content, real draws.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { nudgeOf, stepWayOf } from "../../features/city/nudge";
import { answersInOrder, archetypeOf, presetAnswer, type Archetype } from "../frontdoor/archetypes";
import { newGame } from "../testing/fixtures";
import { nextStepOf, openingKey, ownWayOf, ownWords, sixteenPath } from "./sixteen";

const FIRST_CHAPTER = "chapter.find-your-feet";
const OPEN_SHOP = "activity.open-shop";
const SHOP = "activity.run-shop";
const GULF = "route.gulf-contract";
const SERVICE_YEAR = /service year|allowance/i;

/** Plays an archetype's tile on one seed: its preset answers while allowed, else the answer that suits it. */
function play(archetype: Archetype, seed: string): ReturnType<typeof newGame> {
  const game = newGame("scenario.prologue", seed);
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const preset = presetAnswer(archetype, prologue);
    const open = preset ?? answersInOrder(archetype, prologue.step, prologue.answers).find((answer) => answer.allowed)?.id;
    if (open === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer: open });
  }
  return game;
}

/** The first seed whose trader came out of the master's years with the settlement. */
function settledTrader(): ReturnType<typeof newGame> {
  const trader = archetypeOf("trader")!;
  for (let at = 0; at < 30; at += 1) {
    const game = play(trader, `trader-${String(at)}`);
    if (sixteenPath(game.view()) === "capital") return game;
  }
  throw new Error("No settled trader in thirty seeds.");
}

function fairSettlement(): number {
  const fair = (content.prologue.settlement?.answers ?? []).flatMap((answer) => answer.draw ?? []).find((outcome) => outcome.id === "fair");
  const money = fair?.effects.find((effect) => effect.type === "money/add");
  if (money?.type !== "money/add" || typeof money.amount !== "number") throw new Error("No fair settlement in content.");
  return money.amount;
}

describe("the trader's way to her own shop", () => {
  test("[R-PROLOGUE-011] given a trader from the tile with the settlement, when the living costs take her under the settlement and she has heard of a way out and read up on it, then she is still a trader with a shop's capital, and her own way to a job is the shop's act at her stall", () => {
    const game = settledTrader();
    game.endTurn([{ activity: "activity.ask-around", param: null }]);
    let view = game.view();
    expect(view.pockets.NGN.bank + view.pockets.NGN.cash).toBeLessThan(fairSettlement());
    expect(sixteenPath(view)).toBe("capital");
    expect(view.routes.find((route) => route.id === GULF)?.state).toBe("heard");
    game.endTurn([{ activity: "activity.look-into-route", param: GULF }]);
    view = game.view();
    expect(sixteenPath(view)).toBe("capital");
    expect(nextStepOf(view)).toBe("job");
    expect(ownWayOf(view)).toEqual({ step: "job", key: "shop", place: "place.tejuosho-market", thing: "own-stall", activity: OPEN_SHOP });
    expect(view.activities.find((option) => option.id === OPEN_SHOP)?.allowed).toBe(true);
    // The nudge names the shop in its own words and rides to the stall (an ask that came this month waits aside).
    expect(nudgeOf({ ...view, offers: [] })).toEqual({ key: `${FIRST_CHAPTER}.item.job.nudge.shop`, about: "step" });
    expect(stepWayOf(view)).toEqual({ go: "place.tejuosho-market", at: ["place.tejuosho-market:own-stall"] });

    game.endTurn([{ activity: OPEN_SHOP, param: null }]);
    view = game.view();
    expect(view.job.id).toBe(SHOP);
    expect(sixteenPath(view)).toBe("capital");
    expect(ownWayOf(view)).toBeNull();
  });

  test("[R-PROLOGUE-011] [R-CHAPTER-005] given a trader with the settlement, when her first chapter is read, then its opening and every item are in her words and none says the service year; a graduate's read as before", () => {
    const view = settledTrader().view();
    expect(view.chapter.current).toBe(FIRST_CHAPTER);
    expect(text[openingKey(view)]).toBe(text[`${FIRST_CHAPTER}.open.prologue.capital`]);
    expect(text[openingKey(view)]).not.toMatch(SERVICE_YEAR);
    const keys = view.chapter.items.map((item) => ownWords(view, `${FIRST_CHAPTER}.item.${item.id}`));
    expect(keys).toEqual(view.chapter.items.map((item) => `${FIRST_CHAPTER}.item.${item.id}.capital`));
    for (const key of keys) expect(text[key]).toBeDefined();
    expect(text[ownWords(view, `${FIRST_CHAPTER}.item.job`)]).toBe("Open the shop with the settlement");
    expect(text[`${FIRST_CHAPTER}.item.job.nudge.shop`]).toBeDefined();

    const graduate = newGame("scenario.ada").view();
    expect(ownWords(graduate, `${FIRST_CHAPTER}.item.job`)).toBe(`${FIRST_CHAPTER}.item.job`);
    expect(openingKey(graduate)).toBe(`${FIRST_CHAPTER}.open.ada`);
  });

  test("[R-PROLOGUE-011] given a shop worker from the tile, with no settlement, when her first chapter is read, then it never says the service year and never offers a shop", () => {
    const view = play(archetypeOf("shop-worker")!, "shop-worker-0").view();
    expect(sixteenPath(view)).toBe("trade");
    expect(text[openingKey(view)]).not.toMatch(SERVICE_YEAR);
    for (const item of view.chapter.items) expect(text[ownWords(view, `${FIRST_CHAPTER}.item.${item.id}`)]).not.toMatch(/shop|settlement/i);
    expect(view.activities.find((option) => option.id === OPEN_SHOP)?.allowed).toBe(false);
  });
});
