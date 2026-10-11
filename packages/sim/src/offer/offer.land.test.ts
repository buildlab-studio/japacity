// The plot sold to a buyer the game brings (docs/rules/offer.md, the land buyer; wallet.md R-WALLET-011; route.md
// R-ROUTE-013): selling the plot put ₦8,500,000 in the bank "from somewhere a visa officer will ask
// about". A sale the game itself made is documented money, the deed of sale its paper: it records no lot and adds
// nothing to the unexplained share. A gift still does. Played through the harness with the real content.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { applyEffects, readyLife, toKnown, UK } from "../route/route.journey";

const LAND_BUYER = "offer.land-buyer";

describe("the plot's sale is a traced source", () => {
  test("[R-WALLET-011] [R-ROUTE-013] given land held and the master's known, when the land buyer's offer is answered with Sell the plot, then the price lands in the bank, no lot is recorded, no deposit is flagged and the unexplained share stays as it was", () => {
    const game = readyLife(content, { quiet: true, qualities: { "quality.land": 1 } });
    toKnown(game);
    applyEffects(game, [{ type: "offer/open", offer: LAND_BUYER }]);
    const offer = game.view().offers.find((open) => open.entry === LAND_BUYER);
    if (offer === undefined) throw new Error("The land buyer did not come.");
    const price = offer.terms["price"];
    if (typeof price !== "number") throw new Error("The land buyer named no price.");
    const bank = game.state.wallet.pockets.NGN.bank;
    const lots = game.state.wallet.lots.length;
    const unexplained = game.view().routes.find((route) => route.id === UK)?.unexplainedBp;
    const said = game.accept({ type: "offer/choose", offer: offer.id, choice: "sell" }).lines;
    expect(game.state.wallet.pockets.NGN.bank - bank).toBe(price);
    expect(game.state.wallet.lots).toHaveLength(lots);
    expect(said.some((line) => line.key === "line.wallet.flagged")).toBe(false);
    expect(game.view().routes.find((route) => route.id === UK)?.unexplainedBp).toBe(unexplained);
    expect(game.state.quality["quality.land"]).toBe(0);
  });

  test("[R-WALLET-011] given the land's sale and the relative's gift, when their effects are read, then the sale is not flagged and the gift still is", () => {
    const sell = content.offer[LAND_BUYER]?.choices.find((choice) => choice.id === "sell")?.effects ?? [];
    expect(sell.find((effect) => effect.type === "money/add")).toMatchObject({ reason: "sale" });
    expect(sell.some((effect) => effect.type === "money/add" && effect.flagged === true)).toBe(false);
    // The relative's gift to the bank still lands with nothing to say where it came from (offer.relative-sends).
    const relative = content.offer["offer.relative-sends"]?.choices.flatMap((choice) => choice.effects) ?? [];
    expect(relative.some((effect) => effect.type === "money/add" && effect.reason === "gift" && effect.flagged === true)).toBe(true);
  });
});
