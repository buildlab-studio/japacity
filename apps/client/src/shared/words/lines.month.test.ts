// The month's lines that read wrong (docs/rules/world.md R-WORLD-008, R-WORLD-016;
// text.md R-TEXT-005): each payment named for what it paid, one line where two said one thing, and
// the living costs' rise told with its reason. Played on the real engine where a few commands get there.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { storyLines } from "../../features/turn/month.results";
import { applyEffects } from "../../../../../packages/sim/src/route/route.journey";
import { start } from "../../../../../packages/sim/src/testing/play";
import { chargedLivingContent, newGame, openOffer } from "../testing/fixtures";
import { formatMoney } from "./format";
import { tidyLines } from "./lines";
import { words } from "./text";

const line = (key: string, params: ReportLine["params"], tone: ReportLine["tone"] = "plain"): ReportLine => ({ key, params, tone, attention: false, counts: [] });
const read = (lines: readonly ReportLine[]) => tidyLines(lines).map((each) => words(each.key, each.params));

/** The naira an offer's choice takes, from content. */
function takes(offer: string, choice: string): number {
  const effect = content.offer[offer as keyof typeof content.offer]?.choices.find((each) => each.id === choice)?.effects.find((each) => each.type === "money/take");
  if (effect?.type !== "money/take" || typeof effect.amount !== "number") throw new Error(`${offer} ${choice} takes no money.`);
  return effect.amount;
}

describe("an answer's money, named for it", () => {
  test("[R-WORLD-008] [R-WORLD-016] given fuel scarcity, when the fares are paid, then the line says fuel scarcity and fares, never living costs", () => {
    const game = newGame("scenario.ada");
    const fuel = openOffer(game, "offer.fuel-scarcity");
    const result = game.accept({ type: "offer/choose", offer: fuel.id, choice: "pay" });
    const shown = read(result.lines);
    const amount = formatMoney(takes("offer.fuel-scarcity", "pay"), "NGN");
    expect(shown).toContain(`Fuel scarcity: ${amount} on fares.`);
    expect(shown.filter((said) => said.startsWith("Living costs"))).toEqual([]);
  });

  test("[R-TEXT-005] given any offer answered, when its line is read, then the offer's name never runs into the middle of a sentence", () => {
    expect(words("line.offer.taken", { offer: "offer.nepa-bill" })).toBe(`Answered: ${words("offer.nepa-bill.name")}.`);
    for (const choice of ["pay", "leave"]) {
      const fresh = newGame("scenario.ada");
      applyEffects(fresh, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 50_000_000, reason: "gift" }]);
      const bill = openOffer(fresh, "offer.nepa-bill");
      const shown = read(fresh.accept({ type: "offer/choose", offer: bill.id, choice }).lines);
      expect(shown.join(" ")).not.toMatch(/answer to NEPA/);
    }
  });

  test("[R-WORLD-008] [R-TEXT-005] given a meetup played, when the month's lines are read, then its spending is named the meetup, not going out", () => {
    const game = newGame("scenario.ada");
    // the meetup is an act done at once, so its spending is in its own lines, which the
    // month's results show with the month's (R-WORLD-008).
    const shown = read(game.accept({ type: "activity/now", activity: "activity.meetup", param: null }).lines);
    const cost = content.activity["activity.meetup"]?.cost.find((each) => each.currency === "NGN")?.amount;
    if (typeof cost !== "number") throw new Error("The meetup has no naira cost.");
    expect(shown).toContain(`The meetup: ${formatMoney(cost, "NGN")}.`);
    expect(shown.filter((said) => said.startsWith("Spent going out"))).toEqual([]);
  });
});

describe("one line for one thing", () => {
  test("[R-WORLD-008] given a goal opened and reached in the same month, when the lines are read, then only the goal reached is told", () => {
    const shown = read([line("line.goal.opened", { goal: "goal.send-well" }, "good"), line("line.goal.done", { goal: "goal.send-well" }, "good")]);
    expect(shown).toEqual([words("line.goal.done", { goal: "goal.send-well" })]);
    // A goal opened alone, or one opened beside another reached, is still told.
    expect(read([line("line.goal.opened", { goal: "goal.send-well" }, "good"), line("line.goal.done", { goal: "goal.first-car" }, "good")])).toHaveLength(2);
  });

  test("[R-WORLD-008] given the flight's month, when the job held at home ends with it, then the results tell it with the plane, not only News", () => {
    const lines = [
      line("line.route.departed", { route: "route.uk-masters" }, "good"),
      line("line.place.arrived", { country: "country.uk" }, "good"),
      line("line.status.granted", { status: "status.uk-student" }, "good"),
      line("line.activity.job-ended", { job: "activity.job-remote-dev" }, "bad"),
    ];
    const story = storyLines(lines).map((each) => each.key);
    const departed = story.indexOf("line.route.departed");
    expect(departed).toBeGreaterThanOrEqual(0);
    expect(story[departed + 1]).toBe("line.route.departed-job-ended");
    expect(words("line.route.departed-job-ended", { job: "activity.job-remote-dev" }).toLowerCase()).toContain(words("activity.job-remote-dev.name").toLowerCase());
    // A job that ends in a month with no flight keeps its own line, in News.
    expect(tidyLines([line("line.activity.job-ended", { job: "activity.job-remote-dev" }, "bad")]).map((each) => each.key)).toEqual(["line.activity.job-ended"]);
  });
});

/** Ada's months on the subsidy's world until it comes into force: that month's lines, and the month before's as read. */
function toSubsidyGone(on: typeof content): { risen: ReportLine[] | null; before: string[] } {
  // A world where the subsidy comes into force within the first year and a half (the probe's seed: in force at tick 16
  // since the one-chance story joined the pool and moved every world's draws, wallet.md R-WALLET-019).
  const game = start({ scenario: "scenario.ada", seed: "s", worldSeed: "w-1", content: on });
  applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 500_000_000, reason: "gift" }]);
  let risen: ReportLine[] | null = null;
  let before: string[] = [];
  for (let month = 0; month < 24 && risen === null; month += 1) {
    if (game.view().turns.banked < 1) game.grant(3);
    game.endTurn();
    const lines = game.view().report?.lines ?? [];
    if (lines.some((each) => each.key === "line.news.delivered" && each.params.story === "news.fuel-subsidy" && each.params.stage === "in-force")) risen = lines;
    else before = read(lines);
  }
  return { risen, before };
}

describe("living costs that rise", () => {
  test("[R-WORLD-008] given the fuel subsidy in force, when the month's living costs are charged at the new figure, then the results say living costs are up to it a month, and why", () => {
    // Decision 0035 (R-HOME-012): at home nothing of the living is charged as the month turns, so the month the subsidy
    // goes tells no living costs at all, neither the rise nor the charge.
    const lived = toSubsidyGone(content);
    if (lived.risen === null) throw new Error("The fuel subsidy never came into force.");
    expect(read(lived.risen).filter((said) => said.startsWith("Living costs"))).toEqual([]);
    // The rise's own words are tested where the living is charged whole, as the simulation's relief tests charge it.
    const { risen, before } = toSubsidyGone(chargedLivingContent);
    if (risen === null) throw new Error("The fuel subsidy never came into force.");
    const charged = risen.find((each) => each.key === "line.obligation.charged" && each.params.obligation === "obligation.upkeep");
    const amount = charged?.params.amount;
    if (typeof amount !== "object" || amount === null || !("amount" in amount)) throw new Error("No living costs charged.");
    const shown = read(risen);
    expect(shown).toContain(`Living costs are up to ${formatMoney(amount.amount, "NGN")} a month. The fuel subsidy is gone.`);
    expect(shown.filter((said) => said.startsWith("Living costs:"))).toEqual([]);
    // The month before, living costs read as they always do.
    expect(before.some((said) => said.startsWith("Living costs:"))).toBe(true);
  });
});
