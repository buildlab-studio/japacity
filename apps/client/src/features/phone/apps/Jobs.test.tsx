import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { bp } from "../../../../../../packages/sim/src/engine/int";
import { draw, slot } from "../../../../../../packages/sim/src/route/route.journey";
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
    expect(document.querySelector("[data-phone-app=jobs]")?.textContent).toContain("Pays ₦60,000 a month; ₦90,000 once your tech is good");
  });
});

describe("the raise in Jobs", () => {
  const NOTICED = "activity.be-noticed" as Id<"activity">;

  /** A seed whose first draw on the job stream lands under the raise's chance (or over it, with `hit` false). */
  function noticeSeed(hit: boolean): string {
    for (let n = 0; n < 200; n += 1) {
      const seed = `notice-${String(n)}`;
      if (draw(seed, "job", 0, 10000) < content.tuning.activity.raiseChanceBp === hit) return seed;
    }
    throw new Error("No seed found.");
  }

  test("[R-ACTIVITY-013] given the manager noticed and the pay rose, when Jobs opens, then the job's row says the pay with the raise and when it landed, and a month on, that it was last month", async () => {
    const game = newGame("scenario.tunde", noticeSeed(true));
    const job = game.state.activity.job!;
    const pay = content.activity[job]!.pay!;
    if (typeof pay.amount !== "number") throw new Error("A fixed pay was expected.");
    const raised = pay.amount + bp(pay.amount, content.tuning.activity.raiseBp);
    game.endTurn([slot(NOTICED)]);
    await renderWithView(<Jobs />, game.view());
    const row = () => document.querySelector("[data-phone-app=jobs]")?.textContent ?? "";
    expect(row()).toContain(say("ui.job.pay", { amount: formatMoney(raised, pay.currency) }));
    expect(row()).not.toContain(say("ui.job.pay", { amount: formatMoney(pay.amount, pay.currency) }));
    expect(row()).toContain("Raised this month");
    document.body.innerHTML = "";
    if (game.state.turn.banked < 1) game.grant(1);
    game.endTurn();
    await renderWithView(<Jobs />, game.view());
    expect(row()).toContain("Raised last month");
  });

  test("[R-ACTIVITY-013] given the draw missed, when Jobs opens, then the row says the pay as it was and no raise", async () => {
    const game = newGame("scenario.tunde", noticeSeed(false));
    const job = game.state.activity.job!;
    const pay = content.activity[job]!.pay!;
    if (typeof pay.amount !== "number") throw new Error("A fixed pay was expected.");
    game.endTurn([slot(NOTICED)]);
    await renderWithView(<Jobs />, game.view());
    const text = document.querySelector("[data-phone-app=jobs]")?.textContent ?? "";
    expect(text).toContain(say("ui.job.pay", { amount: formatMoney(pay.amount, pay.currency) }));
    expect(text).not.toContain("Raised");
  });
});
