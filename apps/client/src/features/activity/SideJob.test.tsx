import { content } from "@japacity/content";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richAbroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say, sayCount } from "../../shared/words/text";
import { ActivityView } from "./ActivityView";

describe("the side job and slots held", () => {
  test("[R-TURN-009] given a slot held by a side job, then the plan says which slot is held, why and for how long", async () => {
    await renderWithView(<ActivityView />, richAbroadView());
    expect(screen.getByText(say("ui.locks.side", { slots: sayCount("ui.offer.lock.slots", 1, { count: 1 }), why: say("ui.locks.why.side-job") }))).toBeDefined();
  });

  test("[R-ACTIVITY-010] [R-WALLET-016] given the view's side job, then the plan names it and the view's pay for it", async () => {
    const written = content.activity["activity.weekend-tutoring"]?.pay;
    if (written === null || written === undefined || typeof written.amount !== "number") throw new Error("The tutoring has no pay.");
    const sidePay = { currency: written.currency, amount: written.amount };
    const view = { ...engineView(), job: { id: null, months: 0, side: "activity.weekend-tutoring" as const, pay: null, sidePay } };
    await renderWithView(<ActivityView />, view);
    const card = document.querySelector("[data-side-job]") as HTMLElement;
    expect(card.textContent).toContain(nameOf("activity.weekend-tutoring"));
    expect(card.textContent).toContain(say("ui.job.pay", { amount: formatMoney(sidePay.amount, sidePay.currency) }));
  });

  test("[R-ACTIVITY-010] given a side job held, when it is quit, then activity/quit is sent with side true", async () => {
    const view = richAbroadView();
    const { authority } = await renderWithView(<ActivityView />, view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.side.quit") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.side.quit-yes") }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "activity/quit", side: true, basedOn: view.v }]));
  });

  test("given no side job, then there is nothing to quit", async () => {
    await renderWithView(<ActivityView />, engineView());
    expect(screen.queryByRole("button", { name: say("ui.side.quit") })).toBeNull();
  });
});
