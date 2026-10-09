// The card's main button fits its words at 390 px (docs/rules/world.md R-WORLD-006, the fourth
// review's N11): "Board the plane" with a reason from the world wrapped onto three lines and spilled
// out of the 58 px button. A long label and second line stack, the button as tall as they need.
import type { Currency } from "@japacity/sim";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import "../testing/render";
import { formatMoney } from "../words/format";
import { say } from "../words/text";
import { AskSheet } from "./AskSheet";
import type { Ask } from "./contract";

const money = (amount: number, currency: string): string => formatMoney(amount, currency as Currency);

function board(blocked?: string): Ask {
  return {
    form: "card",
    icon: "plane",
    who: "Murtala Muhammed International",
    title: say("ui.route.depart"),
    line: "The visa is in your passport.",
    cost: { amount: 160_000_000, currency: "NGN" },
    when: "now",
    button: say("ui.route.depart"),
    ...(blocked === undefined ? {} : { blocked }),
    act: () => undefined,
    dismiss: () => undefined,
  };
}

function main(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>("[data-ask-main]");
  if (found === null) throw new Error("No sheet is open.");
  return found;
}

describe("the main button's layout", () => {
  test("[R-WORLD-006] given Board the plane shut by the held funds, when the card opens, then the label stands over the reason and the button grows to hold them", () => {
    render(<AskSheet ask={board(say("ui.world.depart-held"))} have={1_054_106_300} formatMoney={money} />);
    expect(main().getAttribute("data-ask-stacked")).toBe("true");
    expect(main().style.height).toBe("auto");
    expect(main().style.flexDirection).toBe("column");
    const [label, second] = [...main().children];
    expect(label?.textContent).toBe(say("ui.route.depart"));
    expect(second?.textContent).toBe(say("ui.world.depart-held"));
  });

  test("[R-WORLD-006] given a short label and a short second line, when the card opens, then they sit side by side in the usual button", () => {
    render(<AskSheet ask={{ ...board(), button: "Rest", cost: null }} have={0} formatMoney={money} />);
    expect(main().getAttribute("data-ask-stacked")).toBeNull();
    expect(main().style.height).toBe("");
  });
});
