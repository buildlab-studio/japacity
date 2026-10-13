// The credit file abroad in the Bank (docs/rules/credit.md R-CREDIT-006, R-CREDIT-007): moved from the old credit panel
// (CreditView), which nothing mounted once the world became the month's page. The mark, the counts, a judgment and when it
// clears, and what the next ten points buy are the Bank's card abroad; the month it clears is said as months away (R-WORLD-002).
import type { PlayerView } from "@japacity/sim";
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, engineView, richAbroadView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { inMonths, nameOf, say } from "../../../shared/words/text";
import { phoneWords } from "../phone.words";
import { Bank } from "./Bank";

function nextTen(): HTMLElement {
  return document.querySelector("[data-credit] [data-next-ten]") as HTMLElement;
}

describe("the credit file in the Bank", () => {
  test("[R-CREDIT-007] given Ada just landed with an empty file, then the mark is a meter at nothing and the phone contract is what the next ten points buy", async () => {
    const view = abroadView();
    const file = view.credit!;
    expect(file.mark).toBe(0);
    await renderWithView(<Bank />, view);
    const meter = screen.getByRole("meter", { name: say("ui.credit.mark", { mark: 0 }) });
    expect(meter.getAttribute("aria-valuenow")).toBe("0");
    const soon = file.needs.filter((need) => need.creditMin <= 10);
    expect(soon.length).toBeGreaterThan(0);
    for (const need of soon) expect(within(nextTen()).getByText(say("ui.credit.need", { name: nameOf(need.id), min: need.creditMin }))).toBeDefined();
  });

  test("[R-CREDIT-007] given a mark of 24, then what is open now, what the next ten points buy and what is further off are told apart", async () => {
    await renderWithView(<Bank />, richAbroadView());
    expect(screen.getByText(say("ui.credit.next-ten", { mark: 34 }))).toBeDefined();
    expect(within(nextTen()).getByText(say("ui.credit.need", { name: nameOf("obligation.car"), min: 30 }))).toBeDefined();
    expect(screen.getByText(`${nameOf("obligation.phone-uk")}, ${nameOf("obligation.rent-flat-uk")}`)).toBeDefined();
  });

  test("[R-CREDIT-006] given a judgment on the file, then the month it clears shows, as months away, and nothing above 20 is offered", async () => {
    const rich = richAbroadView();
    const view: PlayerView = { ...rich, credit: { ...rich.credit!, mark: 25, judgmentUntil: 90 } };
    await renderWithView(<Bank />, view);
    expect(document.querySelector("[data-credit-judgment]")?.textContent).toBe(phoneWords("phone.bank.credit.judgment", { when: inMonths(90, view.month), cap: "20" }));
    expect(within(nextTen()).queryByText(new RegExp(nameOf("obligation.car")))).toBeNull();
    expect(screen.getByText(say("ui.credit.next-none"))).toBeDefined();
  });

  test("given a life at home, then there is no credit file to show", async () => {
    await renderWithView(<Bank />, engineView());
    expect(screen.queryByText(say("ui.credit.title"))).toBeNull();
  });
});
