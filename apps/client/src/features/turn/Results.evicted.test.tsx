// The month the settlement is cleared (docs/rules/home.md R-HOME-003), on the real engine: the
// results lead with it, in the money's red as a bill unpaid is, told straight.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { applyOverlay } from "../../../../../packages/sim/src/engine/overlay";
import type { Game } from "../../../../../packages/sim/src/testing/play";
import { start } from "../../../../../packages/sim/src/testing/play";
import { setPockets } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { storyLines } from "./month.results";
import { Results } from "./Results";

const SURE = applyOverlay(content, { version: "test-results-evicted", tuning: { home: { evictionBp: 10000 } } });

/** Ada in Makoko on content where the settlement is sure to be cleared, with cash enough after two months of rent to lose the most. */
function inMakoko(): Game {
  const game = start({ content: SURE, scenario: "scenario.ada" });
  setPockets(game, { NGN: 500_000_00 });
  game.accept({ type: "wallet/move", currency: "NGN", amount: 100_000_00, to: "cash" });
  game.accept({ type: "home/move", to: "place.makoko" });
  return game;
}

async function showResults(game: Game, lines: ReportLine[]) {
  const view = game.view();
  const { store } = await renderWithView(<Results place="Makoko" />, { ...view, report: { month: view.month, lines, japacityBefore: null, japacityAfter: null, attention: true } });
  act(() => store.setState({ reportOpen: true }));
}

describe("the eviction month's results", () => {
  test("[R-HOME-003] given Ada in Makoko the month the settlement is cleared, when the results show, then the first story line is the eviction with the cash lost, in red", async () => {
    const game = inMakoko();
    const { lines } = game.endTurn();
    expect(storyLines(lines)[0]?.key).toBe("line.home.evicted");
    await showResults(game, lines);
    const first = document.querySelector<HTMLElement>("[data-results-story] li");
    expect(first?.getAttribute("data-story-line")).toBe("line.home.evicted");
    expect(first?.className).toContain("text-out");
    expect(first?.textContent).toContain(formatMoney(content.tuning.home.evictionLossNaira, "NGN"));
  });

  test("[R-HOME-003] given an eviction month that also brought other news, when the story is ordered, then the eviction still comes first", () => {
    const evicted: ReportLine = { key: "line.home.evicted-no-cash", params: { lost: { currency: "NGN", amount: 0 } }, tone: "bad", attention: true, counts: [] };
    const granted: ReportLine = { key: "line.route.granted", params: { route: "route.uk-masters" }, tone: "good", attention: true, counts: [] };
    const unpaid: ReportLine = { key: "line.obligation.missed", params: { obligation: "obligation.upkeep-makoko", amount: { currency: "NGN", amount: 100 } }, tone: "bad", attention: true, counts: [] };
    expect(storyLines([unpaid, granted, evicted]).map((line) => line.key)).toEqual(["line.home.evicted-no-cash", "line.route.granted", "line.obligation.missed"]);
  });
});
