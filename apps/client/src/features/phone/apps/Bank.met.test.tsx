// Saved for the move, met (docs/rules/world.md R-WORLD-019): the nurse's Bank read
// "SAVED FOR THE MOVE £429 of £324" and nothing said the figure was met or what it was for. Once what is held covers it,
// the Bank says so, and says the figure is the move's fees. Played on the real engine and content.
import { content } from "@japacity/content";
import type { Effect } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { phoneWords } from "../phone.words";
import { Bank, savingsOf } from "./Bank";

const CARE = "route.uk-care" as const;

/** Ngozi with care work as her plan: heard of with what its hearing asks, looked into, leant on. */
function carePlan() {
  const game = newGame("scenario.ngozi");
  const bars = (content.route[CARE]?.hearIf ?? []).flatMap((requirement): Effect[] => (requirement.type === "quality/min" ? [{ type: "quality/add", quality: requirement.quality, amount: requirement.value }] : []));
  viewAfter(game, [...bars, { type: "route/hear", route: CARE, via: "meetup" }]);
  game.accept({ type: "activity/now", activity: "activity.look-into-route", param: CARE });
  game.accept({ type: "chapter/lean", route: CARE });
  return game;
}

describe("Saved for the move, once it is met", () => {
  test("[R-WORLD-019] given a nurse whose plan is care work holding more than its fees, when the Bank opens, then it says the figure is met and is the move's fees, never only the two figures", async () => {
    const game = carePlan();
    const required = savingsOf(game.view())!.required;
    const view = viewAfter(game, [{ type: "money/add", currency: "GBP", pocket: "bank", amount: required * 2, reason: "gift" }]);
    const savings = savingsOf(view)!;
    expect(savings.shown).toBeGreaterThanOrEqual(savings.required);
    await renderWithView(<Bank />, view);
    const shown = document.querySelector("[data-savings]")?.textContent ?? "";
    expect(shown).toContain(phoneWords("phone.bank.savings.met.fees", { shown: formatMoney(savings.shown, "GBP"), required: formatMoney(savings.required, "GBP") }));
    expect(shown).toMatch(/enough for the move's fees/i);
    expect(shown).not.toContain(phoneWords("phone.bank.savings.line", { shown: formatMoney(savings.shown, "GBP"), required: formatMoney(savings.required, "GBP") }));
  });

});
