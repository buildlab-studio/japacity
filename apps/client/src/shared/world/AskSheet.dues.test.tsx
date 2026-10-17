// The card warns when the month's dues are more than what is left after (docs/rules/world.md
// R-WORLD-006), played on the real engine: Ada with ₦99,700 and ₦95,000 of living costs due takes a
// ₦15,000 course, and the card says more than "₦84,700 left". The button stays
// open; only a cost that cannot be paid at all shuts it.
import type { Currency } from "@japacity/sim";
import { applyEffects } from "@japacity/sim/testing";
import { cleanup } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { chargedLivingGame, newGame, viewAfter } from "../testing/fixtures";
import { renderWithView } from "../testing/render";
import { afterPaying, monthDues } from "../words/cost";
import { formatMoney } from "../words/format";
import { say } from "../words/text";
import { AskSheet } from "./AskSheet";
import type { Ask } from "./contract";

const money = (amount: number, currency: string): string => formatMoney(amount, currency as Currency);

const COURSE = 1_500_000;

function course(): Ask {
  return { form: "card", icon: "hand", who: "The hub, Yaba", title: "Take a coding course", line: "You pay for a course.", cost: { amount: COURSE, currency: "NGN" }, button: "Take a coding course", act: () => undefined, dismiss: () => undefined };
}

/** Ada's game holding exactly `naira`, all in the bank, with no job: whatever she owes falls due at the month's end. */
function adaGame(naira: number, game = newGame("scenario.ada")) {
  const pocket = game.state.wallet.pockets.NGN;
  applyEffects(game, [
    { type: "money/take", currency: "NGN", pocket: "cash", amount: pocket.cash, reason: "social" },
    { type: "money/take", currency: "NGN", pocket: "bank", amount: pocket.bank - naira, reason: "social" },
  ]);
  return game;
}

function adaHolding(naira: number) {
  return adaGame(naira).view();
}

function main(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>("[data-ask-main]");
  if (found === null) throw new Error("No sheet is open.");
  return found;
}

describe("the month's dues on the card", () => {
  test("[R-WORLD-006] given Ada with ₦99,700 and ₦95,000 of living costs due, when the coding course's card opens, then it says what is left and what falls due, in warning tone, and the button stays open", async () => {
    // Decision 0035 (R-HOME-012): at home nothing of the living falls due at the month's end, so the card says only what
    // is left, with no warning.
    const lived = adaHolding(9_970_000);
    expect(lived.obligations.find((owed) => owed.entry === "obligation.upkeep")?.due).toBe(0);
    await renderWithView(<AskSheet ask={course()} formatMoney={money} />, lived);
    expect(main().querySelector("[data-ask-warn]")).toBeNull();
    expect(main().textContent).toContain(say("ui.world.left", { amount: money(9_970_000 - COURSE, "NGN") }));
    cleanup();
    // The warning is tested on the living charged whole, as the simulation's relief tests charge it.
    const view = adaGame(9_970_000, chargedLivingGame("scenario.ada")).view();
    const due = view.obligations.find((owed) => owed.entry === "obligation.upkeep")?.due ?? 0;
    expect(due).toBe(9_500_000);
    await renderWithView(<AskSheet ask={course()} formatMoney={money} />, view);
    expect(main().disabled).toBe(false);
    const line = main().querySelector("[data-ask-warn]");
    expect(line?.textContent).toBe(say("ui.world.left-due", { left: money(9_970_000 - COURSE, "NGN"), due: money(due, "NGN") }));
    expect(line?.textContent).toBe("₦84,700 left, ₦95,000 due at the month's end");
  });

  test("[R-WORLD-006] given enough left after for the month's dues, when the card opens, then it says only what is left, with no warning", async () => {
    const view = adaHolding(9_500_000 + COURSE);
    await renderWithView(<AskSheet ask={course()} formatMoney={money} />, view);
    expect(main().querySelector("[data-ask-warn]")).toBeNull();
    expect(main().textContent).toContain(say("ui.world.left", { amount: money(9_500_000, "NGN") }));
  });

  test("[R-WORLD-006] given a cost that cannot be paid at all, when the card opens, then it is shut as short, and the dues do not change the figure short", async () => {
    const view = adaHolding(COURSE - 100);
    await renderWithView(<AskSheet ask={course()} formatMoney={money} />, view);
    expect(main().disabled).toBe(true);
    expect(main().textContent).toContain(say("ui.world.short", { amount: money(100, "NGN") }));
  });

  test("[R-WORLD-006] given a job whose pay arrives before the dues are taken, when what is left after is counted, then the pay counts toward the dues", () => {
    // R-WALLET-016: the job is started through the engine, so its month's pay is the view's.
    const view = viewAfter(adaGame(9_970_000), [{ type: "activity/start-job", job: "activity.job-teacher" }]);
    const dues = monthDues(view);
    const paying = afterPaying(view, [], [{ currency: "NGN", amount: COURSE }], dues);
    expect(paying.short).toBeNull();
    expect(paying.short === null ? paying.due : "short").toBeNull();
  });
});
