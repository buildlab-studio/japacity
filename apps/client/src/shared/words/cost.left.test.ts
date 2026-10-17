// What is left after a fee in another money (docs/rules/world.md R-WORLD-006; wallet.md R-WALLET-009): the
// card's figure left must match the band's after, which counts the naira cash held even though the bank cannot spend
// it on pounds. Real content, the fee paid through `step`.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { applyEffects, readyLife, slot } from "../../../../../packages/sim/src/route/route.journey";
import { afterPaying } from "./cost";

const TALENT: Id<"route"> = "route.uk-talent";
const ENDORSE = "activity.apply-endorsement";

describe("what is left after a fee in pounds", () => {
  test("[R-WORLD-006] [R-WALLET-009] given naira in the bank and in cash and the endorsement paid in pounds from the naira bank, when its card says what is left and the fee is paid, then the figure is the band's after, the cash counted", () => {
    const cash = 3_730_000;
    const game = readyLife(content, { quiet: true, qualities: { "quality.tech": 85, "quality.portfolio": 5, "quality.network": 70 }, pockets: { NGN: { bank: 1_117_530_000 - cash, cash } } });
    for (let months = 0; months < 4 && game.state.route["route.uk-masters"]!.state === "unknown"; months += 1) game.endTurn();
    applyEffects(game, [{ type: "route/hear", route: TALENT, via: "meetup" }]);
    game.endTurn([slot("activity.look-into-route", TALENT)]);
    const view = game.view();
    expect(view.pockets.NGN.cash).toBeGreaterThan(0);
    expect(view.pockets.GBP.bank + view.pockets.GBP.cash).toBe(0);
    const endorse = view.activities.find((option) => option.id === ENDORSE)!;
    expect([endorse.allowed, endorse.affordable]).toEqual([true, true]);
    const paying = afterPaying(view, [], endorse.cost);
    if (paying.short !== null) throw new Error("The endorsement could not be paid.");
    game.accept({ type: "activity/now", activity: ENDORSE, param: null });
    const after = game.view().pockets.NGN;
    expect(paying.left).toEqual({ currency: "NGN", amount: after.bank + after.cash });
  });
});
