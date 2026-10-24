import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { int } from "@japacity/sim";
import { draw, setPockets, slot } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { abroadGame, newGame, viewAfter } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { payAMonth } from "../../../shared/words/pay";
import { Jobs } from "./Jobs";

const SHOP = "activity.job-uk-retail-part" as Id<"activity">;
const HUNT = "activity.job-hunt" as Id<"activity">;

/** The graduate in the UK, hunting the shop job month after month until it is offered. */
function shopOffered() {
  const game = abroadGame();
  // Decision 0013: in the recorded life the hunt misses its first months, and landed with no pounds the unpaid dues
  // would take its student status, and the shop job with it, before an offer comes. So each month's pound dues are
  // covered before it hunts, and it stays a student who may work part time. The December visit opens within the
  // months of the hunt; it is answered by staying, so the hunt goes on.
  for (let month = 0; month < 24 && !game.view().offers.some((offer) => offer.terms.job === SHOP); month += 1) {
    for (let question = game.view().setpiece?.question; question !== undefined && question !== null; question = game.view().setpiece?.question) {
      game.accept({ type: "setpiece/answer", question: question.id, answer: question.allowed[0]! });
    }
    setPockets(game, { GBP: game.view().obligations.reduce((sum, owed) => sum + owed.due, 0) });
    game.endTurn([{ activity: HUNT, param: SHOP }]);
  }
  const view = game.view();
  if (!view.offers.some((offer) => offer.terms.job === SHOP)) throw new Error("The shop job was never offered.");
  return { game, view };
}

describe("Jobs abroad", () => {
  test("[world:one-action-one-sheet] [wallet:view-carries-month-pay] [abroad-money:salary-abroad-taxed-locally] given the part-time shop job offered in the UK, when Jobs opens, then the offer says its pay a month as the wallet will book it, the year's figure over twelve less the month's tax on the part above the line, and never the year's figure", async () => {
    const { view } = shopOffered();
    await renderWithView(<Jobs />, view);
    const month = payAMonth(SHOP);
    if (month === null) throw new Error("The shop job has no pay");
    const { taxFreeLine, taxBp } = content.country["country.uk"]!;
    const written = content.activity[SHOP]?.pay?.amount;
    if (typeof written !== "number") throw new Error("The shop job's pay is no written figure");
    expect(written).toBeGreaterThan(taxFreeLine);
    const tax = int.divFloor(int.bp(written - taxFreeLine, taxBp), 12);
    expect(tax).toBeGreaterThan(0);
    const offered = view.offers.find((offer) => offer.terms.job === SHOP);
    expect(offered?.pay).toEqual({ currency: month.currency, amount: month.amount - tax });
    const row = document.querySelector("[data-job-offers]");
    expect(row?.textContent).toContain(say("ui.job.pay", { amount: formatMoney(month.amount - tax, month.currency) }));
    expect(row?.textContent).not.toContain(formatMoney(written, month.currency));
  });
});

describe("a side job's level in Jobs", () => {
  test("[activity:side-jobs-pay-by-tier] given weekend tutoring held under its tech tier, when Jobs opens, then the side job's row says its pay now and what lifts it", async () => {
    const view = viewAfter(newGame("scenario.graduate"), [{ type: "activity/start-job", job: "activity.weekend-tutoring" }]);
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

  test("[activity:waiting-months-build-profile] given the manager noticed and the pay rose, when Jobs opens, then the job's row says the pay with the raise and when it landed, and a month on, that it was last month", async () => {
    const game = newGame("scenario.banker", noticeSeed(true));
    const job = game.state.activity.job!;
    const pay = content.activity[job]!.pay!;
    if (typeof pay.amount !== "number") throw new Error("A fixed pay was expected.");
    const raised = pay.amount + int.bp(pay.amount, content.tuning.activity.raiseBp);
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

  test("[activity:waiting-months-build-profile] given the draw missed, when Jobs opens, then the row says the pay as it was and no raise", async () => {
    const game = newGame("scenario.banker", noticeSeed(false));
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

describe("the pay Jobs says", () => {
  test("[wallet:view-carries-month-pay] given a job held whose month the wallet books at another figure than content's, when Jobs opens, then the row says the view's pay and never the written one", async () => {
    const game = newGame("scenario.banker");
    const job = game.state.activity.job!;
    const written = content.activity[job]!.pay!;
    if (typeof written.amount !== "number") throw new Error("A fixed pay was expected.");
    const view = game.view();
    const pay = { currency: written.currency, amount: written.amount - 250_000 };
    await renderWithView(<Jobs />, { ...view, job: { ...view.job, pay } });
    const text = document.querySelector("[data-phone-app=jobs]")?.textContent ?? "";
    expect(text).toContain(say("ui.job.pay", { amount: formatMoney(pay.amount, pay.currency) }));
    expect(text).not.toContain(say("ui.job.pay", { amount: formatMoney(written.amount, written.currency) }));
  });
});
