import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { abroadGame, newGame, viewAfter } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { payAMonth } from "../../../shared/words/pay";
import { Jobs } from "./Jobs";

const SHOP = "activity.job-uk-retail-part" as Id<"activity">;
const HUNT = "activity.job-hunt" as Id<"activity">;

/** Ada in the UK, hunting the shop job month after month until it is offered. */
function shopOffered() {
  const game = abroadGame();
  for (let month = 0; month < 24 && !game.view().offers.some((offer) => offer.terms.job === SHOP); month += 1) game.endTurn([{ activity: HUNT, param: SHOP }]);
  const view = game.view();
  if (!view.offers.some((offer) => offer.terms.job === SHOP)) throw new Error("The shop job was never offered.");
  return { game, view };
}

describe("Jobs abroad", () => {
  test("[R-WORLD-006] given the part-time shop job offered in the UK, when Jobs opens, then the offer says its pay a month, the year's figure over twelve, and never the year's figure", async () => {
    const { view } = shopOffered();
    await renderWithView(<Jobs />, view);
    const month = payAMonth(SHOP);
    if (month === null) throw new Error("The shop job has no pay");
    const row = document.querySelector("[data-job-offers]");
    expect(row?.textContent).toContain(say("ui.job.pay", { amount: formatMoney(month.amount, month.currency) }));
    expect(row?.textContent).not.toContain(formatMoney(month.amount * 12, month.currency));
  });
});

describe("a side job's level in Jobs", () => {
  test("[R-ACTIVITY-014] given weekend tutoring held under its tech tier, when Jobs opens, then the side job's row says its pay now and what lifts it", async () => {
    const view = viewAfter(newGame("scenario.ada"), [{ type: "activity/start-job", job: "activity.weekend-tutoring" }]);
    await renderWithView(<Jobs />, view);
    expect(document.querySelector("[data-phone-app=jobs]")?.textContent).toContain("Pays ₦60,000 a month; ₦90,000 at tech 50");
  });
});
