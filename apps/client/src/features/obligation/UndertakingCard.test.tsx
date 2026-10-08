import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say, sayCount } from "../../shared/words/text";
import { ObligationView } from "./ObligationView";

type Owed = PlayerView["obligations"][number];

function undertaking(change: Partial<Owed> = {}): Owed {
  return {
    id: "obligation-50",
    entry: "obligation.undertaking-ca",
    state: "active",
    openedMonth: 40,
    amount: 0,
    principal: 0,
    outstanding: 0,
    monthsLeft: 30,
    missed: 0,
    bond: "bond-3",
    charged: 2,
    due: 0,
    car: null,
    ...change,
  };
}

async function showing(owed: Owed) {
  const base = abroadView();
  return renderWithView(<ObligationView />, { ...base, obligations: [owed] });
}

describe("the undertaking", () => {
  test("[R-UNDERTAKING-012] given an undertaking running with nothing owed, then the obligation list shows the months left, the months charged and that nothing is owed, with the assistance line", async () => {
    await showing(undertaking());
    const shown = document.querySelector<HTMLElement>("[data-undertaking]")!;
    expect(within(shown).getByText(text["obligation.undertaking-ca.name"]!)).toBeDefined();
    expect(within(shown).getByText(sayCount("ui.undertaking.months-left", 30, { months: 30 }))).toBeDefined();
    expect(within(shown).getByText(sayCount("ui.undertaking.charged", 2, { months: 2 }))).toBeDefined();
    expect(within(shown).getByText(say("ui.undertaking.nothing-owed"))).toBeDefined();
    expect(within(shown).getByText(say("ui.undertaking.assistance", { amount: formatMoney(content.var["var.ca-assistance"]!.start, "CAD") }))).toBeDefined();
    expect(within(shown).queryByRole("button")).toBeNull();
  });

  test("[R-UNDERTAKING-008] given a charge missed and owed, then what is owed shows in Canadian dollars, the misses are counted, and paying it sends the whole sum", async () => {
    const { authority } = await showing(undertaking({ state: "grace", outstanding: 73_300, missed: 1, monthsLeft: 1, charged: 0 }));
    const shown = document.querySelector<HTMLElement>("[data-undertaking]")!;
    expect(within(shown).getByText(say("ui.undertaking.owed", { amount: formatMoney(73_300, "CAD") }))).toBeDefined();
    expect(within(shown).getByText(sayCount("ui.undertaking.months-left", 1, { months: 1 }))).toBeDefined();
    expect(within(shown).getByText(sayCount("ui.undertaking.charged", 0, { months: 0 }))).toBeDefined();
    expect(within(shown).getByText(sayCount("ui.obligation.missed", 1, { count: 1 }))).toBeDefined();
    fireEvent.click(within(shown).getByRole("button", { name: `${say("ui.undertaking.pay")} ${formatMoney(73_300, "CAD")}` }));
    await screen.findByText(say("ui.undertaking.owed", { amount: formatMoney(73_300, "CAD") }));
    expect(authority.sent.at(-1)).toMatchObject({ type: "obligation/pay", obligation: "obligation-50", amount: 73_300 });
  });
});
