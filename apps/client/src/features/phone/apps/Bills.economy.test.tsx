// The economy's bills in Bills (route:education-loan-pays-the-school, activity:bootcamp-paid-after-a-job): the education loan says nothing is
// paid while the course runs and when repayments start; the bootcamp's fee, once a developer job opens it, says what it is.
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../../../shared/testing/fixtures";
import type { PlayerView } from "@japacity/sim";

import { renderWithView } from "../../../shared/testing/render";
import { say } from "../../../shared/words/text";
import { Bills } from "./Bills";

async function openBills(view: PlayerView) {
  await renderWithView(<Bills />, view);
}

const billOf = (entry: string) => [...document.querySelectorAll<HTMLElement>("[data-bill]")].find((bill) => bill.getAttribute("data-bill-entry") === entry);

describe("the economy's bills", () => {
  test("[route:education-loan-pays-the-school] given the education loan taken, when Bills opens, then it says nothing is paid while you study and when repayments start", async () => {
    const view = viewAfter(newGame("scenario.graduate"), [{ type: "obligation/open", obligation: "obligation.education-loan", principal: 1_000_000 }]);
    const loan = view.obligations.find((owed) => owed.entry === "obligation.education-loan");
    expect(loan?.deferred).toBeDefined();
    await openBills(view);
    expect(billOf("obligation.education-loan")?.textContent).toContain(say("phone.bills.deferred"));
  });

  test("[activity:bootcamp-paid-after-a-job] given the bootcamp's fee opened by a developer job, when Bills opens, then it says it is the bootcamp's fee, paid now the job is held", async () => {
    const view = viewAfter(newGame("scenario.graduate"), [{ type: "obligation/open", obligation: "obligation.bootcamp", principal: 300_000_000 }]);
    await openBills(view);
    expect(billOf("obligation.bootcamp")?.textContent).toContain(say("phone.bills.why.obligation.bootcamp"));
  });
});
