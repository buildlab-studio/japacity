// Canada's return after a removal on the way's file (route-gates:canada-return-asks-authorisation): when the view says the first
// application still owes the authorisation to return and the removal costs, the file names both as money before it is sent.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { abroadView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { Japa } from "./Japa";

const CANADA = "route.canada-points";

/**
 * A view whose Canadian route is known and owes the return's fees as the engine would say them. A removal from Canada and its
 * ten-year ban are no few commands away, so the view's field is set from the world's figures.
 */
function owing(owes: boolean): PlayerView {
  const base = abroadView();
  const route = base.routes.find((entry) => entry.id === CANADA);
  if (route === undefined) throw new Error("No Canadian route in the view.");
  const arc = { currency: "CAD" as const, amount: content.var["var.canada-arc-fee"]!.start };
  const removal = { currency: "CAD" as const, amount: content.var["var.canada-removal-cost"]!.start };
  return { ...base, routes: [{ ...route, state: "known", ...(owes ? { authorisation: { arc, removal } } : {}) }] };
}

describe("Canada's return after a removal", () => {
  test("[route-gates:canada-return-asks-authorisation] given the Canadian way owing the authorisation to return and the removal costs, when its file shows, then it names both as money and says the first application pays them", async () => {
    const view = owing(true);
    const fees = view.routes[0]!.authorisation!;
    await renderWithView(<Japa />, view);
    const block = document.querySelector<HTMLElement>(`[data-way-file="${CANADA}"] [data-way-authorisation]`);
    expect(block?.textContent).toContain(say("ui.route.authorisation", { arc: formatMoney(fees.arc.amount, fees.arc.currency), removal: formatMoney(fees.removal.amount, fees.removal.currency) }));
    expect(block?.textContent).toContain(formatMoney(fees.arc.amount, fees.arc.currency));
    expect(block?.textContent).toContain(formatMoney(fees.removal.amount, fees.removal.currency));
  });

  test("[route-gates:canada-return-asks-authorisation] given nothing owed, when the file shows, then no return fees are named", async () => {
    await renderWithView(<Japa />, owing(false));
    expect(document.querySelector("[data-way-authorisation]")).toBeNull();
  });
});
