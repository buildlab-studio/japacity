// What is owed, in Bills (docs/rules/world.md R-WORLD-019), moved from the old obligation list
// (features/obligation/ObligationView.test.tsx): the upkeep's name and this month's charge, and a loan's still owed
// with its misses counted. The loan's typed amount went with the old form (decision 0038: the phone shows no form);
// the slip paying this month's part in kobo is phone.test.tsx's "given Bills with a loan due".
import { text } from "@japacity/content";
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, richView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { say, sayCount } from "../../../shared/words/text";
import { Bills } from "./Bills";

describe("what is owed, in Bills", () => {
  // The naira upkeep at home is lived by hand and has no bill (R-HOME-012, decision 0035), so the upkeep abroad stands in.
  test("given upkeep, then its name and this month's charge are shown", async () => {
    const view = abroadView();
    const upkeep = view.obligations.find((owed) => owed.entry === "obligation.upkeep-uk")!;
    expect(upkeep.due).toBeGreaterThan(0);
    await renderWithView(<Bills />, view);
    const card = document.querySelector<HTMLElement>(`[data-bill="${upkeep.id}"]`)!;
    expect(card.textContent).toContain(text[`${upkeep.entry}.name`]!);
    expect(card.textContent).toContain(formatMoney(upkeep.due, "GBP"));
    expect(card.querySelector("[data-pay]")).toBeNull();
  });

  test("given a loan, then what is still owed shows, with one miss said as one payment", async () => {
    await renderWithView(<Bills />, richView());
    const card = within(document.querySelector<HTMLElement>('[data-bill="obligation-9"]')!);
    expect(card.getByText(say("ui.obligation.outstanding", { amount: formatMoney(80_000_000, "NGN") }))).toBeDefined();
    expect(card.getByText(sayCount("ui.obligation.missed", 1, { count: 1 }))).toBeDefined();
    expect(screen.queryByText(/1 payments/)).toBeNull();
  });

  test("[R-OBLIGATION-003] given a loan with one month left and one miss, then Bills reads 1 month left and 1 payment, never 1 months", async () => {
    const base = richView();
    const obligations = base.obligations.map((owed) => (owed.id === "obligation-9" ? { ...owed, monthsLeft: 1, missed: 1 } : owed));
    await renderWithView(<Bills />, { ...base, obligations });
    const card = within(document.querySelector<HTMLElement>('[data-bill="obligation-9"]')!);
    expect(card.getByText("1 month left")).toBeDefined();
    expect(card.getByText("Missed 1 payment in a row")).toBeDefined();
    expect(document.body.textContent).not.toMatch(/\b1 (months|questions|payments)\b/);
  });
});
