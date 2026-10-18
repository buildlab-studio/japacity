// The family house's pot and a home of your own's (home.md R-HOME-012): at the family house the pot is
// the house's, so eating from it costs nothing and the big pot is foodstuff bought for the house; in a home of your own a
// meal and a pot cost what they cost. Each corner offers its own acts by id in its place file; the simulation charges an
// act what its entry says, wherever it is done.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Accepted, Id } from "../engine/types";
import type { Game } from "../testing/play";
import { applyEffects } from "../testing/route.journey";
import { start } from "../testing/play";
import type { WalletEvent } from "../wallet/wallet.events";

const POT: Id<"activity"> = "activity.cook-at-home";
const BIG_POT: Id<"activity"> = "activity.cook-jollof";
const OWN: Id<"activity"> = "activity.cook-own";
const OWN_POT: Id<"activity"> = "activity.cook-own-pot";
const STANDING: Id<"quality"> = "quality.standing";
const BELLY: Id<"quality"> = "quality.belly";

function quality(game: Game, id: Id<"quality">): number {
  return game.view().qualities.find((one) => one.id === id)?.value ?? 0;
}

function naira(game: Game): number {
  const { cash, bank } = game.state.wallet.pockets.NGN;
  return cash + bank;
}

/** What an act took, by reason. */
function taken(result: Accepted): { reason: string; amount: number }[] {
  return result.events
    .filter((event): event is typeof event & Extract<WalletEvent, { type: "wallet/debited" }> => event.type === "wallet/debited")
    .map((event) => ({ reason: event.reason, amount: event.amount }));
}

function eat(game: Game, activity: Id<"activity">): Accepted {
  const result = game.accept({ type: "activity/now", activity, param: null });
  if (!("events" in result)) throw new Error(`${activity} was refused: ${JSON.stringify(result)}`);
  return result;
}

/** The price of an act from its entry, a fixed naira figure. */
function price(activity: Id<"activity">): number {
  const cost = content.activity[activity]?.cost[0]?.amount;
  if (typeof cost !== "number") throw new Error(`${activity} has no fixed price`);
  return cost;
}

describe("the family house's pot", () => {
  test("[R-HOME-012] [R-OBLIGATION-014] given Ada at the family house, when she eats from the pot, then no money moves and she is fed: the pot is the house's", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(game.view().home.place).toBe("place.family-house");
    expect(content.activity[POT]?.cost).toEqual([]);
    const before = naira(game);
    const hungry = quality(game, BELLY);
    const result = eat(game, POT);
    expect(taken(result)).toEqual([]);
    expect(naira(game)).toBe(before);
    expect(quality(game, BELLY)).toBeGreaterThan(hungry);
  });

  test("[R-HOME-012] given Ada at the family house, when she buys the big pot for the house, then ₦7,500 goes out under foodstuff, the house eats and her standing rises", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(price(BIG_POT)).toBe(7_500_00);
    const before = naira(game);
    const standing = quality(game, STANDING);
    const result = eat(game, BIG_POT);
    expect(taken(result)).toEqual([{ reason: "foodstuff", amount: 7_500_00 }]);
    expect(naira(game)).toBe(before - 7_500_00);
    expect(quality(game, STANDING)).toBeGreaterThan(standing);
  });
});

describe("a home of your own's corner", () => {
  test("[R-HOME-012] given Ada moved into the room in a compound, when she cooks her own meal and her own pot, then ₦1,500 and ₦7,500 go out under food, as the room's meals always cost", () => {
    const game = start({ content, scenario: "scenario.ada" });
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 5_000_000_00, reason: "gift" }]);
    game.accept({ type: "home/move", to: "place.compound-room" });
    expect(game.view().home.place).toBe("place.compound-room");
    expect([price(OWN), price(OWN_POT)]).toEqual([1_500_00, 7_500_00]);
    expect(taken(eat(game, OWN))).toEqual([{ reason: "food", amount: 1_500_00 }]);
    expect(taken(eat(game, OWN_POT))).toEqual([{ reason: "food", amount: 7_500_00 }]);
  });

  test("[R-HOME-012] given the four cooking acts, when their entries are read, then the pot and the big pot are the family house's, at home only, and a meal of your own in naira is had at home only, the room abroad cooking in pounds; each lifts the belly as before", () => {
    expect(content.activity[POT]?.where).toBe("home");
    expect(content.activity[BIG_POT]?.where).toBe("home");
    // No naira is charged abroad; in the UK the room's meal is activity.cook-own-uk.
    expect(content.activity[OWN]?.where).toBe("home");
    expect(content.activity["activity.cook-own-uk"]).toMatchObject({ where: "abroad", country: "country.uk", cost: [{ currency: "GBP", reason: "food" }] });
    expect(content.activity[OWN_POT]?.where).toBe("home");
    expect(content.activity[POT]?.effects).toEqual(content.activity[OWN]?.effects);
    expect(content.activity[BIG_POT]?.effects).toEqual(content.activity[OWN_POT]?.effects);
    for (const id of [POT, BIG_POT, OWN, OWN_POT]) expect(content.activity[id]?.repeat).toBe(true);
  });
});
