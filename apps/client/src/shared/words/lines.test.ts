import type { ReportLine } from "@japacity/sim";
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { formatMoney } from "./format";
import { slot } from "../../../../../packages/sim/src/route/route.journey";
import { legalCommands } from "../../../../../packages/sim/src/testing/legal";
import { newGame } from "../testing/fixtures";
import { asksAttention, tidyLines } from "./lines";
import { bandWords, nameOf, runningName, words } from "./text";

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
    // Said without its figure (R-TEXT-005).
    expect(words("line.quality.worn", { quality: "quality.wellbeing", points: 2 })).toBe("Work wore on your wellbeing.");
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

describe("a quality's move in words", () => {
  test("[R-TEXT-005] given a quality moved up while its band is low, or down while it is high, when the line is told, then it says the move alone, never a band that reads the other way, and no figure", () => {
    const up = words("line.quality.gain", { quality: "quality.network", points: 2, value: 5 });
    const down = words("line.quality.loss", { quality: "quality.wellbeing", points: 3, value: 95 });
    expect(up).toBe(`${nameOf("quality.network")} up.`);
    expect(down).toBe(`${nameOf("quality.wellbeing")} down.`);
    expect(up).not.toContain(bandWords("quality.network", 5) ?? "-");
    expect(down).not.toContain(bandWords("quality.wellbeing", 95) ?? "-");
    for (const said of [up, down]) expect(said).not.toMatch(/\d/);
    // From nothing (the prologue's draw), the band alone still says where the character starts.
    expect(words("line.quality.gain", { quality: "quality.network", points: 5, value: 5 })).toBe(`${bandWords("quality.network", 5) ?? ""}.`);
  });
});

describe("what needs the player", () => {
  test("[R-PROLOGUE-008] given the life from sixteen played to its degree, when the graded line is read, then it is told and never tagged as needing the player", () => {
    const game = newGame("scenario.prologue");
    const told: ReportLine[] = [];
    for (let guard = 0; guard < 60 && game.state.prologue.open && !told.some((each) => each.key === "line.prologue.graded"); guard += 1) {
      const [first] = legalCommands(game.view());
      if (first === undefined) throw new Error("The prologue is open with no legal answer.");
      told.push(...game.accept(first).lines);
    }
    const graded = told.find((each) => each.key === "line.prologue.graded");
    // The simulation marks it for attention; the screen tells it as what happened.
    expect(graded?.attention).toBe(true);
    expect(told.filter((each) => each.key.startsWith("line.prologue.")).some(asksAttention)).toBe(false);
    expect(asksAttention({ ...line("line.prologue.graded", { grade: 3 }), attention: true })).toBe(false);
    expect(asksAttention({ ...line("line.offer.opened", { offer: "offer.job" }), attention: true })).toBe(true);
  });
});

describe("a paper's fee", () => {
  test("[R-WORLD-008] given Ada asking for her transcript and her passport in one month, when the month's lines are tidied, then each fee is said as that paper's, never as money paid at some office", () => {
    const game = newGame("scenario.ada");
    const lines = game.endTurn([slot("activity.get-transcript", null), slot("activity.get-passport", null)]).lines;
    const shown = read(lines);
    const fees = lines.filter((each) => each.key === "line.wallet.fee-document");
    expect(fees).toHaveLength(2);
    expect(shown).toContain(`The ${runningName("document.transcript")}'s fee: ${formatMoney(2_500_000, "NGN")}.`);
    expect(runningName("document.transcript")).toMatch(/^[a-z].*transcript$/);
    expect(shown.some((said) => said.startsWith("The passport's fee: "))).toBe(true);
    expect(shown.some((said) => said.startsWith("Paid at the office"))).toBe(false);
  });
});

describe("the stall's takings", () => {
  test("[R-ACTIVITY-016] given the month's pay from the trader's own shop, when the lines are told, then they say the stall cleared it, never a salary; any other job keeps its salary line", () => {
    const pay = (job: string): ReportLine => ({ key: "line.activity.salary", params: { job, amount: { currency: "NGN", amount: 180_000_00 } }, tone: "good", attention: false, counts: [] });
    const [shop] = tidyLines([pay("activity.run-shop")]);
    expect(shop?.key).toBe("line.activity.salary.activity.run-shop");
    expect(words(shop!.key, shop!.params)).toBe(`Your stall cleared ${formatMoney(180_000_00, "NGN")} this month.`);
    expect(tidyLines([pay("activity.job-teacher")])[0]?.key).toBe("line.activity.salary");
  });
});


describe("a route heard of", () => {
  /** Every `via` a route is heard by: the ones content's effects name and the ones the simulation names itself. */
  const vias = (): string[] => {
    const named = [...JSON.stringify(content).matchAll(/\{"type":"route\/hear"[^{}]*?"via":"([^"]+)"/g)].map((found) => found[1]!);
    return [...new Set([...named, "friend", "news", "sibling", "partner"])].sort();
  };

  test("[R-TEXT-007] given a route heard of by any source, when the line is told, then it names where the word came from and never tells the player what they heard", () => {
    expect(vias()).toEqual(expect.arrayContaining(["meetup", "motor-park", "returnee"]));
    const said = new Set<string>();
    for (const via of vias()) {
      const shown = words("line.route.heard", { route: "route.uk-masters", via });
      expect(shown).toContain(nameOf("route.uk-masters"));
      // The source named on any that fails, so a miss says which.
      expect(/\byou\b|\byour\b|heard|talking/i.test(shown) ? via : null).toBeNull();
      expect({ via, shown }).not.toEqual({ via, shown: words("line.route.heard", { route: "route.uk-masters" }) });
      said.add(shown);
    }
    expect(said.size).toBe(vias().length);
    expect(words("line.route.heard", { route: "route.uk-masters", via: "meetup" })).toBe(`At the meetup: ${nameOf("route.uk-masters")}.`);
    // A source with no words of its own still says no "you".
    expect(words("line.route.heard", { route: "route.uk-masters", via: "unnamed" })).toBe(`Word came round of ${runningName("route.uk-masters")}.`);
  });

  test("[R-TEXT-007] given Ada's first month at the meetup, when the line is told, then it says the meetup was the source", () => {
    const game = newGame("scenario.ada");
    const heard = game.endTurn([slot("activity.meetup", null)]).lines.filter((each) => each.key === "line.route.heard");
    expect(heard.length).toBeGreaterThan(0);
    for (const each of heard) expect(words(each.key, each.params)).toMatch(/^At the meetup: /);
  });
});
