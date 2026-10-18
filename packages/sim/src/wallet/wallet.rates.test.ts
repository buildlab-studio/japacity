import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { CURRENCIES, isCurrency, placeCurrency, spendable } from "./wallet.rates";

describe("the currencies and what a pocket has to spend", () => {
  test("[abroad-money:foreign-currencies-join-wallet] given the wallet's currencies, when a value is checked, then only naira and the five foreign currencies are currencies, and a pocket spends its bank and cash but not what is locked", () => {
    expect(CURRENCIES).toEqual(["NGN", "GBP", "USD", "CAD", "AED", "EUR"]);
    for (const currency of CURRENCIES) expect(isCurrency(currency)).toBe(true);
    for (const value of ["ngn", "JPY", "", 1, null]) expect(isCurrency(value)).toBe(false);
    const pocket = { bank: 300, cash: 45, locked: 1_000 };
    expect(spendable(pocket)).toBe(345);
  });

  test("[world:month-end-results-sheet] given where a life is, when the money of the place is read, then it is naira at home and on the road and the country's own abroad", () => {
    expect(placeCurrency({ where: "home", country: null }, content)).toBe("NGN");
    expect(placeCurrency({ where: "road", country: null }, content)).toBe("NGN");
    expect(placeCurrency({ where: "abroad", country: null }, content)).toBe("NGN");
    expect(placeCurrency({ where: "abroad", country: "country.uk" }, content)).toBe("GBP");
    expect(placeCurrency({ where: "abroad", country: "country.canada" }, content)).toBe("CAD");
  });
});
