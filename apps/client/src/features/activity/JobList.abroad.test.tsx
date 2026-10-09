import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { abroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { ActivityPicker } from "./ActivityView";
import { jobsWords } from "./jobs.words";
import { payAMonth } from "./pay";

const SHOP = "activity.job-uk-retail-part" as Id<"activity">;
const HUNT = "activity.job-hunt";

describe("the jobs list abroad", () => {
  test("[R-WORLD-006] given Ada in the UK with the part-time shop job open to the hunt, when the jobs list shows, then its row says the pay a month and never the year's figure", async () => {
    const view = abroadView();
    expect(view.activities.find((option) => option.id === HUNT)?.params).toContain(SHOP);
    await renderWithView(<ActivityPicker only={[HUNT]} />, view);
    const month = payAMonth(SHOP);
    if (month === null) throw new Error("The shop job has no pay");
    const row = document.querySelector(`[data-jobs] [data-job='${SHOP}']`);
    expect(row?.textContent).toContain(jobsWords("jobs.pay", { amount: formatMoney(month.amount, month.currency) }));
    expect(row?.textContent).not.toContain(formatMoney(month.amount * 12, month.currency));
  });
});
