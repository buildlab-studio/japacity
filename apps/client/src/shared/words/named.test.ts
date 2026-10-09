// A blow's money named for what it paid (docs/rules/world.md R-WORLD-008): the
// laptop's repair read "Something went wrong and it cost ₦85,000." on the results.
import { describe, expect, test } from "vitest";

import { moneyLines } from "../../features/turn/month.results";
import { newGame, openOffer } from "../testing/fixtures";
import { formatMoney } from "./format";
import { words } from "./text";

describe("money named for the blow that took it", () => {
  test("[R-WORLD-008] given the laptop's fault and its repair paid, when the month's money is read, then the line names the repair and its cost", () => {
    const game = newGame();
    const offer = openOffer(game, "offer.laptop-fault");
    const mid = game.accept({ type: "offer/choose", offer: offer.id, choice: "repair" }).lines;
    const end = game.endTurn().lines;
    const repair = moneyLines([...mid, ...end]).find((entry) => entry.sign === -1 && entry.amount === 8_500_000);
    if (repair === undefined) throw new Error("The repair took nothing.");
    expect(repair.line.key).toBe("ui.line.offer-paid.offer.laptop-fault");
    expect(words(repair.line.key, repair.line.params)).toBe(`The laptop repair: ${formatMoney(8_500_000, "NGN")}.`);
  });

  test("[R-WORLD-008] given an illness and the hospital paid, when the month's money is read, then the line names the treatment, never that something went wrong", () => {
    const game = newGame();
    const offer = openOffer(game, "offer.illness");
    const mid = game.accept({ type: "offer/choose", offer: offer.id, choice: "hospital" }).lines;
    const money = moneyLines([...mid, ...game.endTurn().lines]);
    const said = money.map((entry) => words(entry.line.key, entry.line.params));
    expect(said.some((line) => line.startsWith("Treatment for the illness: "))).toBe(true);
    expect(said.some((line) => line.startsWith("Something went wrong"))).toBe(false);
  });
});
