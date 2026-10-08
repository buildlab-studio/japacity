import type { PlayerView } from "@japacity/sim";
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, engineView, richAbroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, say } from "../../shared/words/text";
import { CreditView } from "./CreditView";

function nextTen(): HTMLElement {
  return document.querySelector("[data-next-ten]") as HTMLElement;
}

describe("the credit file", () => {
  test("[R-CREDIT-007] given Ada just landed with an empty file, then the mark is a meter at nothing and the phone contract is what the next ten points buy", async () => {
    const view = abroadView();
    const file = view.credit!;
    expect(file.mark).toBe(0);
    await renderWithView(<CreditView />, view);
    const meter = screen.getByRole("meter", { name: say("ui.credit.mark", { mark: 0 }) });
    expect(meter.getAttribute("aria-valuenow")).toBe("0");
    const soon = file.needs.filter((need) => need.creditMin <= 10);
    expect(soon.length).toBeGreaterThan(0);
    for (const need of soon) expect(within(nextTen()).getByText(say("ui.credit.need", { name: nameOf(need.id), min: need.creditMin }))).toBeDefined();
  });

  test("[R-CREDIT-007] given a mark of 24, then what is open now, what the next ten points buy and what is further off are told apart", async () => {
    await renderWithView(<CreditView />, richAbroadView());
    expect(screen.getByText(say("ui.credit.next-ten", { mark: 34 }))).toBeDefined();
    expect(within(nextTen()).getByText(say("ui.credit.need", { name: nameOf("obligation.car"), min: 30 }))).toBeDefined();
    expect(screen.getByText(`${nameOf("obligation.phone-uk")}, ${nameOf("obligation.rent-flat-uk")}`)).toBeDefined();
  });

  test("[R-CREDIT-006] given a judgment on the file, then the month it clears shows and nothing above 20 is offered", async () => {
    const rich = richAbroadView();
    const view: PlayerView = { ...rich, credit: { ...rich.credit!, mark: 25, judgmentUntil: 90 } };
    await renderWithView(<CreditView />, view);
    expect(screen.getByText(say("ui.credit.judgment", { month: 90, cap: 20 }))).toBeDefined();
    expect(within(nextTen()).queryByText(new RegExp(nameOf("obligation.car")))).toBeNull();
    expect(screen.getByText(say("ui.credit.next-none"))).toBeDefined();
  });

  test("given a life at home, then there is no credit file to show", async () => {
    await renderWithView(<CreditView />, engineView());
    expect(screen.queryByText(say("ui.credit.title"))).toBeNull();
  });
});
