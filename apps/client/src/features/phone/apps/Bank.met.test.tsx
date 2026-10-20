// Saved for the move, met (world:phone-holds-what-phones-hold): once what is held covers the figure, the Bank says so, and
// says the figure is the move's fees, never a bare "SAVED FOR THE MOVE £429 of £324". Played on the real engine and
// content.
import { content } from "@japacity/content";
import type { Effect } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { Bank, savingsOf } from "./Bank";
import { say } from "../../../shared/words/text";

const CARE = "route.uk-care" as const;

/** The nurse with health care as its plan: heard of with what its hearing asks, looked into, leant on. */
function carePlan() {
  const game = newGame("scenario.nurse");
  const bars = (content.route[CARE]?.hearIf ?? []).flatMap((requirement): Effect[] => (requirement.type === "quality/min" ? [{ type: "quality/add", quality: requirement.quality, amount: requirement.value }] : []));
  viewAfter(game, [...bars, { type: "route/hear", route: CARE, via: "meetup" }]);
  game.accept({ type: "activity/now", activity: "activity.look-into-route", param: CARE });
  game.accept({ type: "chapter/lean", route: CARE });
  return game;
}

describe("Saved for the move, once it is met", () => {
  test("[world:phone-holds-what-phones-hold] given a nurse whose plan is health care holding more than its fees, when the Bank opens, then it says the figure is met and is the move's fees, never only the two figures", async () => {
    const game = carePlan();
    const required = savingsOf(game.view())!.required;
    const view = viewAfter(game, [{ type: "money/add", currency: "GBP", pocket: "bank", amount: required * 2, reason: "gift" }]);
    const savings = savingsOf(view)!;
    expect(savings.shown).toBeGreaterThanOrEqual(savings.required);
    await renderWithView(<Bank />, view);
    const shown = document.querySelector("[data-savings]")?.textContent ?? "";
    expect(shown).toContain(say("phone.bank.savings.met.fees", { shown: formatMoney(savings.shown, "GBP"), required: formatMoney(savings.required, "GBP") }));
    expect(shown).toMatch(/enough for the move's fees/i);
    expect(shown).not.toContain(say("phone.bank.savings.line", { shown: formatMoney(savings.shown, "GBP"), required: formatMoney(savings.required, "GBP") }));
  });

});
