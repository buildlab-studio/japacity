import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { formatMoney } from "./format";
import { tidyLines } from "./lines";
import { words } from "./text";

const line = (key: string, params: ReportLine["params"], tone: ReportLine["tone"] = "plain"): ReportLine => ({ key, params, tone, attention: false, counts: [] });

const read = (lines: ReportLine[]) => tidyLines(lines).map((each) => words(each.key, each.params));

describe("one line per payment", () => {
  test("given upkeep taken from bank and cash, then it shows as one line with one total", () => {
    const shown = read([
      line("line.wallet.upkeep", { currency: "NGN", amount: 5_305_951 }, "bad"),
      line("line.wallet.upkeep", { currency: "NGN", amount: 4_194_049 }, "bad"),
    ]);
    expect(shown).toEqual([words("line.wallet.upkeep", { amount: { currency: "NGN", amount: 9_500_000 } })]);
  });

  test("given typed money split across pockets, then the total keeps its currency", () => {
    const [only] = tidyLines([
      line("line.wallet.fee-test", { amount: { currency: "GBP", amount: 10_000 } }, "bad"),
      line("line.wallet.fee-test", { amount: { currency: "GBP", amount: 5_000 } }, "bad"),
    ]);
    expect(only?.params.amount).toEqual({ currency: "GBP", amount: 15_000 });
  });

  test("given salary told by the job and by the wallet, then it shows once, naming the job", () => {
    const shown = read([
      line("line.wallet.salary", { currency: "NGN", amount: 7_500_000 }, "good"),
      line("line.activity.salary", { job: "activity.job-teacher", currency: "NGN", amount: 7_500_000 }, "good"),
    ]);
    expect(shown).toEqual([words("line.activity.salary", { job: "activity.job-teacher", amount: { currency: "NGN", amount: 7_500_000 } })]);
  });

  test("given gig pay told twice, then it shows once", () => {
    const shown = tidyLines([
      line("line.activity.gig", { amount: 7_742_926 }, "good"),
      line("line.wallet.gig", { currency: "NGN", amount: 7_742_926 }, "good"),
    ]);
    expect(shown.map((each) => each.key)).toEqual(["line.activity.gig"]);
  });

  test("given an obligation charge the wallet already paid, then only the wallet's line shows", () => {
    const shown = tidyLines([
      line("line.wallet.upkeep", { currency: "NGN", amount: 5_000_000 }, "bad"),
      line("line.wallet.upkeep", { currency: "NGN", amount: 4_500_000 }, "bad"),
      line("line.obligation.charged", { obligation: "obligation.upkeep", amount: 9_500_000 }),
    ]);
    expect(shown.map((each) => each.key)).toEqual(["line.wallet.upkeep"]);
  });

  test("given two different payments of the same kind apart in the month, then both stay", () => {
    const shown = tidyLines([
      line("line.wallet.study", { currency: "NGN", amount: 1_000_000 }, "bad"),
      line("line.activity.played", { activity: "activity.rest" }),
      line("line.wallet.study", { currency: "NGN", amount: 1_000_000 }, "bad"),
    ]);
    expect(shown).toHaveLength(3);
  });
});

describe("lines that read right", () => {
  test("given a quality change, then its amount is points, never money", () => {
    expect(words("line.quality.loss", { quality: "quality.wellbeing", points: 4, value: 60 })).not.toMatch(/₦|£/);
    expect(words("line.quality.worn", { quality: "quality.wellbeing", points: 2 })).toBe("Work takes 2 off your wellbeing.");
  });

  test("given a school's discount in pounds as a bare number, then it shows in pounds", () => {
    expect(read([line("line.route.school-offer", { school: "school.northgate", discount: 200_000 }, "good")])[0]).toContain(formatMoney(200_000, "GBP"));
  });

  test("given a school offer with no discount, then the line does not say a discount of nothing", () => {
    const [shown] = read([line("line.route.school-offer", { school: "school.ashby", discount: 0 }, "good")]);
    expect(shown).not.toMatch(/Discount|£0|₦0/);
  });

  test("given an offer opened and a story delivered, then each line names it", () => {
    expect(words("line.offer.opened", { offer: "offer.job" })).toContain(words("offer.job.name"));
    expect(words("line.news.delivered", { story: "news.uk-unis-recruit", stage: "in-force", forYou: 1 })).toContain(words("news.uk-unis-recruit.name"));
  });

  test("given a bank queue, then what was paid shows in the currency it was paid in", () => {
    expect(words("line.wallet.queued", { from: "NGN", currency: "USD", paid: 50_000_000, readyMonth: 4 })).toContain(formatMoney(50_000_000, "NGN"));
  });

describe("one endorsement story", () => {
  test("[R-WORLD-008] given an endorsement issued, refused by the body, refused on the route and voided in one month, when the lines are tidied, then only the body's refusal is told", () => {
    const lines: ReportLine[] = [
      { key: "line.document.issued", params: { document: "document.endorsement" }, tone: "good", attention: false, counts: [] },
      { key: "line.route.endorsement-refused", params: { route: "route.uk-talent" }, tone: "bad", attention: false, counts: [] },
      { key: "line.route.refused", params: { route: "route.uk-talent", reason: "endorsement" }, tone: "bad", attention: false, counts: [] },
      { key: "line.document.voided", params: { document: "document.endorsement" }, tone: "bad", attention: false, counts: [] },
      { key: "line.route.granted", params: { route: "route.uk-masters" }, tone: "good", attention: false, counts: [] },
    ];
    expect(tidyLines(lines).map((line) => line.key)).toEqual(["line.route.endorsement-refused", "line.route.granted"]);
  });
});
});
