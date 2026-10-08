import { text } from "@japacity/content";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say, sayCount } from "../../shared/words/text";
import { ObligationView } from "./ObligationView";

describe("what is owed", () => {
  test("given upkeep, then its name and this month's charge are shown", async () => {
    const view = engineView();
    await renderWithView(<ObligationView />, view);
    const upkeep = view.obligations[0]!;
    expect(screen.getByText(text[`${upkeep.entry}.name`]!)).toBeDefined();
    expect(screen.getByText(say("ui.obligation.due", { amount: formatMoney(upkeep.due, "NGN") }))).toBeDefined();
    expect(screen.queryByRole("button", { name: new RegExp(say("ui.obligation.pay")) })).toBeNull();
  });

  test("given a loan, then what is still owed shows, and paying sends obligation/pay in kobo", async () => {
    const view = richView();
    const { authority } = await renderWithView(<ObligationView />, view);
    expect(screen.getByText(say("ui.obligation.outstanding", { amount: formatMoney(80_000_000, "NGN") }))).toBeDefined();
    expect(screen.getByText(sayCount("ui.obligation.missed", 1, { count: 1 }))).toBeDefined();
    expect(screen.queryByText(/1 payments/)).toBeNull();
    fireEvent.change(screen.getByLabelText(say("ui.wallet.amount")), { target: { value: "20000" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.obligation.pay")}`) }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "obligation/pay", obligation: "obligation-9", amount: 2_000_000, basedOn: view.v }]));
  });
});
