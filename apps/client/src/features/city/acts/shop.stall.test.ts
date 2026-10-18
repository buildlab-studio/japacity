// The trader's shop at her stall (activity:trader-opens-own-shop, world:things-are-tappable-models): "Open the
// shop" says what it costs and what it pays, and the stall keeps its label in the market while the shop runs. Real
// content, real draws.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import tejuosho from "../../../../public/assets/places/tejuosho-front/place.json";
import { archetypeOf } from "../../../shared/frontdoor/archetypes";
import { playTile } from "../../../shared/frontdoor/archetypes.testing";
import { newGame } from "../../../shared/testing/fixtures";
import { formatMoney } from "../../../shared/words/format";
import { needsWords } from "../../../shared/words/requirement";
import { sixteenPath } from "../../../shared/words/sixteen";
import { blurbOf, say } from "../../../shared/words/text";
import { actsOffered } from "./acts";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { stagedNow, thingsNow, thingsOf, withMoreAt } from "../scene/things";

const MARKET = "place.tejuosho-market";
const OPEN_SHOP = "activity.open-shop";
const SHOP = "activity.run-shop";

/** The first seed whose trader from the tile came out of the master's years with the settlement. */
function settledTrader(): ReturnType<typeof newGame> {
  const trader = archetypeOf("trader")!;
  for (let at = 0; at < 30; at += 1) {
    const game = newGame("scenario.prologue", `trader-${String(at)}`);
    playTile(game, trader);
    if (sixteenPath(game.view()) === "capital") return game;
  }
  throw new Error("No settled trader in thirty seeds.");
}

/** The market's things as the world shows them for this view. */
function marketThings(view: PlayerView) {
  const staged = new Set<string>(content.place[MARKET]?.stages ?? []);
  return thingsNow(withMoreAt(thingsOf(stageOf(tejuosho as unknown as PlaceFile)), MARKET), stagedNow(new Set(actsOffered(view)), staged, new Set(view.offers.map((offer) => offer.entry)), null, view.chapter.current));
}

describe("the trader's shop at her stall", () => {
  test("[activity:trader-opens-own-shop] given the content, when Open the shop's sheet is read, then it says the shop costs nothing to open and what it pays a month, the shop's own figure", () => {
    const pay = content.activity[SHOP]?.pay;
    if (pay === null || pay === undefined || typeof pay.amount !== "number") throw new Error("The shop pays no fixed figure in content.");
    expect(content.activity[OPEN_SHOP]?.cost).toEqual([]);
    const blurb = blurbOf(OPEN_SHOP) ?? "";
    expect(blurb).toMatch(/costs nothing/i);
    expect(blurb).toContain(`${formatMoney(pay.amount, pay.currency)} a month`);
  });

  test("[activity:trader-opens-own-shop] [world:things-are-tappable-models] given a settled trader whose shop opened at the month's end, when the market is read, then her stall stands with its label, and its sheet says the shop is running, not what it lacks", () => {
    const game = settledTrader();
    expect(marketThings(game.view()).some((thing) => thing.id === "own-stall")).toBe(true);
    game.endTurn([{ activity: OPEN_SHOP, param: null }]);
    const view = game.view();
    expect(view.job.id).toBe(SHOP);
    const stall = marketThings(view).find((thing) => thing.id === "own-stall");
    expect(stall?.label).toBe("city.thing.own-stall");
    const option = view.activities.find((candidate) => candidate.id === OPEN_SHOP);
    expect(option?.allowed).toBe(false);
    expect(needsWords(option?.missing ?? [], { routes: view.routes })).toBe(say("ui.needs.running"));
  });
});
