// The car on finance in Bills (docs/rules/car.md R-CAR-007, R-CAR-003, R-CAR-004), moved from the old obligation list
// (features/obligation/CarCard.test.tsx) with its assertions against the bill's card. The rate is said as the interest
// a month in money, never a percentage (the shared words rule; an amendment of R-CAR-007 is asked).
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { carViewOf, richAbroadView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { say, sayCount } from "../../../shared/words/text";
import { phoneWords } from "../phone.words";
import { carFigures } from "./BillFacts";
import { Bills } from "./Bills";

const CAR = content.obligation["obligation.car"]!;
const terms = CAR.car!;

function withCar(change: Partial<PlayerView["obligations"][number]>): PlayerView {
  const view = richAbroadView();
  return {
    ...view,
    obligations: view.obligations.map((owed) => {
      if (owed.entry !== "obligation.car") return owed;
      const changed = { ...owed, ...change };
      return { ...changed, car: carViewOf(changed, view.month) };
    }),
  };
}

function car(view: PlayerView) {
  return view.obligations.find((owed) => owed.entry === "obligation.car")!;
}

function card(owed: PlayerView["obligations"][number]): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-bill="${owed.id}"]`)!;
}

describe("the car on finance, in Bills", () => {
  test("[R-CAR-007] given a car with two payments missed, then the price paid, the third and half marks, the final payment, the rate and the notice show", async () => {
    const view = richAbroadView();
    const owed = car(view);
    const figures = carFigures(owed, view.month)!;
    expect(figures.paid).toBe(terms.price - owed.outstanding);
    expect(figures.paid).toBeGreaterThanOrEqual(figures.third);
    expect(figures.paid).toBeLessThan(figures.half);
    await renderWithView(<Bills />, view);
    const shown = within(card(owed));
    expect(shown.getByRole("meter", { name: say("ui.car.paid", { paid: formatMoney(figures.paid, "GBP"), price: formatMoney(terms.price, "GBP") }) })).toBeDefined();
    expect(shown.getByText(say("ui.car.third-mark"))).toBeDefined();
    expect(shown.getByText(say("ui.car.half-mark"))).toBeDefined();
    expect(shown.getByText(say("ui.car.past-third", { half: formatMoney(figures.half - figures.paid, "GBP") }))).toBeDefined();
    expect(shown.getByText(say("ui.car.final", { amount: formatMoney(figures.final, "GBP") }))).toBeDefined();
    expect(shown.getByText(phoneWords("phone.bills.car.interest", { amount: formatMoney(owed.car!.interest, "GBP") }))).toBeDefined();
    expect(card(owed).textContent).not.toContain("%");
    expect(shown.getByText(sayCount("ui.obligation.missed", 2, { count: 2 }))).toBeDefined();
    expect(shown.getByText(say("ui.car.notice"))).toBeDefined();
    expect(shown.getByRole<HTMLButtonElement>("button", { name: say("ui.car.hand-back") }).disabled).toBe(true);
  });

  test("[R-CAR-003] given a third paid and a third miss, then the court date shows and clearing the arrears pays exactly what is due", async () => {
    const view = withCar({ missed: CAR.grace + 1 });
    const owed = car(view);
    const { authority } = await renderWithView(<Bills />, view);
    expect(within(card(owed)).getByText(sayCount("ui.car.court", terms.courtMonths, { months: terms.courtMonths }))).toBeDefined();
    const pay = card(owed).querySelector<HTMLElement>(`[data-pay="${owed.id}"]`)!;
    expect(pay.textContent).toContain(formatMoney(owed.due, "GBP"));
    fireEvent.click(pay);
    fireEvent.click(document.querySelector<HTMLElement>("[data-ask-main]")!);
    await waitFor(() => expect(authority.sent).toEqual([{ type: "obligation/pay", obligation: owed.id, amount: owed.due, basedOn: view.v }]));
  });

  test("[R-CAR-004] given half the price paid, when the car is handed back, then obligation/pay is sent with the amount 0", async () => {
    const half = Math.floor((terms.price * terms.handBackBp) / 10000);
    const view = withCar({ outstanding: terms.price - half, missed: 0, state: "active" });
    const owed = car(view);
    const { authority } = await renderWithView(<Bills />, view);
    expect(screen.getByText(say("ui.car.past-half"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.car.hand-back") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.car.hand-back-yes") }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "obligation/pay", obligation: owed.id, amount: 0, basedOn: view.v }]));
  });
});
