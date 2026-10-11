// The ask card's main button and money (docs/rules/world.md R-WORLD-006): it says what is left
// after, counting the naira bank and cash less what the month's plan already pays for, and a
// cost that cannot be paid shuts it with how much is short, as the ride sheet does.
import type { Currency, PlayerView } from "@japacity/sim";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { engineView } from "../testing/fixtures";
import { plannable } from "../words/acts";
import { renderWithView } from "../testing/render";
import { formatMoney } from "../words/format";
import { say } from "../words/text";
import { AskSheet } from "./AskSheet";
import type { Ask } from "./contract";

const money = (amount: number, currency: string): string => formatMoney(amount, currency as Currency);

function askOf(form: Ask["form"], amount: number, act: () => void = () => undefined): Ask {
  return { form, icon: "hand", who: "The clinic", title: "TB test", line: "A nurse and a form.", cost: { amount, currency: "NGN" }, button: "TB test", act, dismiss: () => undefined };
}

function main(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>("[data-ask-main]");
  if (found === null) throw new Error("No sheet is open.");
  return found;
}

/** Everything the naira bank and cash hold in a view. */
function naira(view: PlayerView): number {
  return view.pockets.NGN.bank + view.pockets.NGN.cash;
}

/** A paid activity the view prices, for the plan to hold. */
function paidOption(view: PlayerView): { id: PlayerView["activities"][number]["id"]; amount: number } {
  // Decision 0035 (R-ACTIVITY-019): the study and the meals answer at once and are never planned, so the paid thing
  // the plan holds is a month-act.
  const option = view.activities.find((candidate) => candidate.cost.length === 1 && candidate.cost[0]?.currency === "NGN" && candidate.params === null && plannable(candidate.id));
  if (option === undefined) throw new Error("The view prices no paid activity.");
  return { id: option.id, amount: option.cost[0]?.amount ?? 0 };
}

describe("the ask card's money", () => {
  test("[R-WORLD-006] given a card ask that costs more than the player has, when it opens, then the main button is shut and says how much is short", () => {
    const act = vi.fn();
    render(<AskSheet ask={askOf("card", 12_000_000, act)} have={2_205_000} formatMoney={money} />);
    expect(main().disabled).toBe(true);
    expect(main().textContent).toContain(say("ui.world.short", { amount: money(9_795_000, "NGN") }));
    expect(main().textContent).not.toContain(say("ui.world.left", { amount: "" }).trim());
    fireEvent.click(main());
    expect(act).not.toHaveBeenCalled();
  });

  test("[R-WORLD-006] given a slip that costs exactly what the player has, and then one kobo more, when it opens, then the first leaves nothing and acts, and the second is shut as short", () => {
    const act = vi.fn();
    const { rerender } = render(<AskSheet ask={askOf("slip", 500_000, act)} have={500_000} formatMoney={money} />);
    expect(main().disabled).toBe(false);
    expect(document.querySelector("[data-ask-after]")?.textContent).toContain(say("ui.world.left", { amount: money(0, "NGN") }));
    fireEvent.click(main());
    expect(act).toHaveBeenCalledTimes(1);
    rerender(<AskSheet ask={askOf("slip", 500_001, act)} have={500_000} formatMoney={money} />);
    expect(main().disabled).toBe(true);
    expect(document.querySelector("[data-ask-after]")?.textContent).toContain(say("ui.world.short-label").toUpperCase());
    expect(document.querySelector("[data-ask-after]")?.textContent).toContain(money(1, "NGN"));
  });

  test("[R-WORLD-006] given a game with naira in the bank and only a little cash, when the world's ask opens with only cash passed, then what is left counts the bank and the cash", async () => {
    const view = engineView("scenario.ada");
    const cost = view.pockets.NGN.cash + 100_000;
    await renderWithView(<AskSheet ask={askOf("card", cost)} have={view.pockets.NGN.cash} formatMoney={money} />, view);
    expect(main().disabled).toBe(false);
    expect(main().textContent).toContain(say("ui.world.left", { amount: money(naira(view) - cost, "NGN") }));
  });

  test("[R-WORLD-006] given a plan that already pays for something, when an ask opens, then what is left is after the plan, and a cost the plan leaves too little for is shut as short", async () => {
    const view = engineView("scenario.ada");
    const planned = paidOption(view);
    const tooMuch = naira(view) - planned.amount + 1;
    const { store } = await renderWithView(<AskSheet ask={askOf("card", tooMuch)} formatMoney={money} />, view);
    expect(main().disabled).toBe(false);
    expect(main().textContent).toContain(say("ui.world.left", { amount: money(planned.amount - 1, "NGN") }));
    act(() => {
      store.getState().addToPlan({ activity: planned.id, param: null });
    });
    expect(main().disabled).toBe(true);
    expect(main().textContent).toContain(say("ui.world.short", { amount: money(1, "NGN") }));
  });

  test("[R-WORLD-006] given a phone ask whose money the app counted itself (held funds), when it opens inside a game, then that figure is the one used", async () => {
    const view = engineView("scenario.ada");
    await renderWithView(<AskSheet ask={askOf("slip", 1_000)} from={500} formatMoney={money} />, view);
    expect(main().disabled).toBe(true);
    expect(document.querySelector("[data-ask-after]")?.textContent).toContain(money(500, "NGN"));
  });
});
