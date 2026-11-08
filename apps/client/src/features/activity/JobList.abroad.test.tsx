import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { qualityIn } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { abroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { ActivityPicker } from "./ActivityView";
import { chanceBand, jobChanceBp } from "../../shared/words/jobs";
import { jobFacts } from "../../shared/words/facts";
import { factWords } from "../../shared/ui/Facts";
import { payAMonth } from "../../shared/words/pay";
import { say } from "../../shared/words/text";

const SHOP = "activity.job-uk-retail-part" as Id<"activity">;
const HUNT = "activity.job-hunt";

describe("the jobs list abroad", () => {
  test("[world:one-action-one-sheet] given the graduate in the UK with the part-time shop job open to the hunt, when the jobs list shows, then its row says the pay a month and never the year's figure", async () => {
    const view = abroadView();
    expect(view.activities.find((option) => option.id === HUNT)?.params).toContain(SHOP);
    await renderWithView(<ActivityPicker only={[HUNT]} />, view);
    const month = payAMonth(SHOP);
    if (month === null) throw new Error("The shop job has no pay");
    const row = document.querySelector(`[data-jobs] [data-job='${SHOP}']`);
    expect(row?.textContent).toContain(say("jobs.pay", { amount: formatMoney(month.amount, month.currency) }));
    expect(row?.textContent).not.toContain(formatMoney(month.amount * 12, month.currency));
  });
});

describe("a job named by a board or a notice", () => {
  test("[world:one-action-one-sheet] [text:show-then-tell] given the graduate in the UK and the shop job on Peckham's notice, when the hunt's card names it, then its facts say the pay a month and the chance as chips, in that order, as the list's row does", () => {
    const view = abroadView();
    const month = payAMonth(SHOP);
    if (month === null) throw new Error("The shop job has no pay");
    const { facts, line } = jobFacts(view, "activity.job-hunt", SHOP);
    expect(facts.slice(0, 2).map((fact) => [fact.kind, factWords(fact)])).toEqual([
      ["pay", say("jobs.pay", { amount: formatMoney(month.amount, month.currency) })],
      ["chance", say(`jobs.chance.${chanceBand(jobChanceBp(content.activity[SHOP]!, qualityIn(view, "quality.network")))}`)],
    ]);
    expect(line ?? "").not.toContain(formatMoney(month.amount, month.currency));
    expect(facts.map(factWords).join(" ")).not.toContain(formatMoney(month.amount * 12, month.currency));
  });
});
