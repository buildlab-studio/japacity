// The Bank's other money says where it is held (world:phone-holds-what-phones-hold): a bare "Also held: £81" would not say
// whether the pounds are cash or in the bank, and the band shows only the naira.
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { Bank } from "./Bank";
import { say } from "../../../shared/words/text";

describe("other money held, and where", () => {
  test("[world:phone-holds-what-phones-hold] given pounds in the bank and dollars both in the bank and in cash, when the Bank opens at home, then each figure says where it is held", async () => {
    const view = viewAfter(newGame("scenario.tunde"), [
      { type: "money/add", currency: "GBP", pocket: "bank", amount: 8_100, reason: "gift" },
      { type: "money/add", currency: "USD", pocket: "bank", amount: 50_000, reason: "gift" },
      { type: "money/add", currency: "USD", pocket: "cash", amount: 2_000, reason: "gift" },
    ]);
    await renderWithView(<Bank />, view);
    const band = document.querySelector("[data-bank-balance]")?.textContent ?? "";
    expect(band).toContain(say("phone.bank.also.bank", { amount: formatMoney(8_100, "GBP") }));
    expect(band).toContain(say("phone.bank.also.bank", { amount: formatMoney(50_000, "USD") }));
    expect(band).toContain(say("phone.bank.also.cash", { amount: formatMoney(2_000, "USD") }));
    expect(band).not.toContain(formatMoney(52_000, "USD"));
  });

  test("[world:phone-holds-what-phones-hold] given pounds in the bank and dollars both in the bank and in cash, when the Bank opens at home, then each other money is its own chip, so the row wraps inside the card one money at a time", async () => {
    const view = viewAfter(newGame("scenario.tunde"), [
      { type: "money/add", currency: "GBP", pocket: "bank", amount: 8_100, reason: "gift" },
      { type: "money/add", currency: "USD", pocket: "bank", amount: 50_000, reason: "gift" },
      { type: "money/add", currency: "USD", pocket: "cash", amount: 2_000, reason: "gift" },
    ]);
    await renderWithView(<Bank />, view);
    const chips = [...document.querySelectorAll<HTMLElement>("[data-also]")];
    expect(chips.map((chip) => chip.getAttribute("data-also"))).toEqual(["GBP", "USD"]);
    expect(chips[0]?.textContent).toBe(say("phone.bank.also.bank", { amount: formatMoney(8_100, "GBP") }));
    expect(chips[1]?.textContent).toContain(say("phone.bank.also.cash", { amount: formatMoney(2_000, "USD") }));
    // A chip may wrap inside the card: never held to one line.
    for (const chip of chips) expect(chip.querySelector("[data-sticker-chip]")?.className).toContain("chip-wrap");
  });
});
