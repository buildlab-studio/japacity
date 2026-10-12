// The month's close, shrunk (docs/rules/world.md R-WORLD-008; decisions 0035, 0036): the
// results sheet after Sleep leads with payday when there is one, then the rent when it was due, then the moments, then
// Kept, in four to six lines. What was bought by hand during the month was paid as it was done and is not listed again:
// no "Done this month", no living line, no relief line at home, no "you rested". The sheet keeps its look.
import type { PlayerView, ReportLine } from "@japacity/sim";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { words } from "../../shared/words/text";
import { CLOSE_MAX, monthClose } from "./month.results";
import { Results } from "./Results";

const naira = (amount: number) => ({ currency: "NGN" as const, amount });
function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"] = "plain", attention = false): ReportLine {
  return { key, params, tone, attention, counts: [] };
}

/** The close's rows in the order they stand on the sheet: payday, rent, each moment, Kept. */
function rows(): string[] {
  return [...document.querySelectorAll("[data-results-payday], [data-results-rent], [data-results-story] li, [data-results-kept]")].map((node) =>
    node.hasAttribute("data-results-payday") ? "payday" : node.hasAttribute("data-results-rent") ? "rent" : node.hasAttribute("data-results-kept") ? "kept" : "moment",
  );
}

function sheetText(): string {
  return document.querySelector("[data-world-sheet='results']")?.textContent ?? "";
}

describe("the month's close", () => {
  test("[R-WORLD-008] given the nurse's lived month (meals, water, gist and study bought by hand) and her salary, when the results open after Sleep, then payday leads, then the moments, then Kept, in four to six lines, with nothing bought by hand listed, no living line, no relief and no rest filler", async () => {
    const game = newGame("scenario.ngozi");
    const mid: ReportLine[] = [];
    for (const activity of ["activity.cook-at-home", "activity.cook-at-home", "activity.fetch-water", "activity.family-time", "activity.study-english"] as const) mid.push(...game.accept({ type: "activity/now", activity, param: null }).lines);
    const { lines } = game.endTurn();
    expect(lines.some((each) => each.key === "line.activity.rested")).toBe(true);
    const { store } = await renderWithView(<Results place="The family house" />, game.view());
    act(() => store.setState({ reportOpen: true, lastMonthLines: mid }));
    const order = rows();
    expect(order[0]).toBe("payday");
    expect(order.at(-1)).toBe("kept");
    expect(order.filter((row) => row === "kept")).toHaveLength(1);
    expect(order.length).toBeGreaterThanOrEqual(4);
    expect(order.length).toBeLessThanOrEqual(CLOSE_MAX);
    const salary = lines.find((each) => each.key === "line.activity.salary");
    if (salary === undefined) throw new Error("No salary this month.");
    expect(document.querySelector("[data-results-payday]")?.textContent).toContain(words(salary.key, salary.params));
    const text = sheetText();
    for (const said of ["Food:", "Spent on study", "Done this month", "You rested", "Living costs", "less.", words("line.activity.cook-at-home.now"), "Sent to family"]) expect(text).not.toContain(said);
    // The look stays: one sheet, its title and its one way back.
    expect(document.querySelector("[data-results-back]")).not.toBeNull();
  });

  test("[R-WORLD-008] given a month with pay and rent due, when the close is read, then payday leads, the rent comes next, then the moments, then Kept", async () => {
    const turned = [
      line("line.wallet.salary", { amount: naira(45_000_000) }, "good"),
      line("line.wallet.rent", { amount: naira(12_000_000) }, "bad"),
      line("line.wallet.upkeep", { amount: naira(3_000_000) }, "bad"),
      line("line.activity.rested", { slots: 2 }),
      line("line.route.heard", { route: "route.uk-masters", via: "news" }, "good"),
    ];
    const close = monthClose(turned, turned);
    expect(close.payday.map((entry) => entry.line.key)).toEqual(["line.wallet.salary"]);
    expect(close.rent.map((entry) => [entry.line.key, entry.amount])).toEqual([["line.wallet.rent", 12_000_000]]);
    expect(close.moments.map((each) => each.key)).toEqual(["line.route.heard"]);
    const view: PlayerView = { ...richView(), setpiece: null, interview: null, report: { month: 4, lines: turned, japacityBefore: null, japacityAfter: null, attention: false } };
    const { store } = await renderWithView(<Results place="Peckham" />, view);
    act(() => store.setState({ reportOpen: true, lastMonthLines: [] }));
    expect(rows()).toEqual(["payday", "rent", "moment", "kept"]);
    expect(document.querySelector("[data-results-rent]")?.textContent).toContain(`-${formatMoney(12_000_000, "NGN")}`);
    expect(sheetText()).not.toContain(words("line.wallet.upkeep", { amount: naira(3_000_000) }));
    expect(sheetText()).not.toContain("You rested");
    // Kept still counts every naira that moved, the living among it.
    expect(document.querySelector("[data-results-kept]")?.getAttribute("data-results-kept")).toBe(String(45_000_000 - 12_000_000 - 3_000_000));
  });

  test("[R-WORLD-008] given pay, rent and more moments than fit, when the close is read, then the moments take only the room left, so the sheet holds six lines with Kept", () => {
    const turned = [
      line("line.wallet.salary", { amount: naira(45_000_000) }, "good"),
      line("line.wallet.rent", { amount: naira(12_000_000) }, "bad"),
      ...["route.uk-masters", "route.uk-care", "route.canada-points", "route.uae-work", "route.italy-seasonal"].map((route) => line("line.route.heard", { route, via: "news" }, "good")),
    ];
    const close = monthClose(turned, turned);
    expect(close.payday.length + close.rent.length + close.moments.length + 1).toBe(CLOSE_MAX);
  });
});
