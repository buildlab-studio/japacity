import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { livingCharge } from "./obligation.logic";
import { start } from "../testing/play";

describe("living by hand", () => {
  test("[R-HOME-012] given the family house's upkeep, when the month turns at home, then nothing of the living is charged and a meal costs at the act", () => {
    expect(content.tuning.home.livingByHandBp).toBe(10000);
    const game = start({ content, scenario: "scenario.ada" });
    const read = { world: game.world(), content };
    expect(livingCharge(read, "obligation.upkeep", 9_500_000)).toBe(0);
    expect(livingCharge(read, "obligation.upkeep-compound", content.tuning.home.compound.upkeep)).toBe(0);
    const bank = game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash;
    game.endTurn();
    expect(game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash).toBe(bank);
    // A meal bought and cooked is a meal of your own; the family house's pot is the house's (home.pot.test.ts).
    const price = content.activity["activity.cook-own"]!.cost[0]!.amount;
    if (typeof price !== "number") throw new Error("The meal's price is not a fixed figure.");
    game.accept({ type: "activity/now", activity: "activity.cook-own", param: null });
    expect(game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash).toBe(bank - price);
  });

  test("[R-HOME-012] given upkeep abroad, when the charge is read, then it is whole", () => {
    const game = start({ content, scenario: "scenario.ada" });
    const read = { world: game.world(), content };
    expect(livingCharge(read, "obligation.upkeep-uk", 100_000)).toBe(100_000);
  });
});
