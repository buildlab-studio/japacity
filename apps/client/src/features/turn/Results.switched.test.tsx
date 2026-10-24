// A grant from inside the country on the results (route-gates:in-country-grant-switches-status): the new permission leads the month as
// the visa granted does, and its words say the new status starts with no flight.
import type { PlayerView, ReportLine } from "@japacity/sim";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { richAbroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, runningName, words } from "../../shared/words/text";
import { leadsAlone } from "./month.results";
import { Results } from "./Results";

const SWITCHED: ReportLine = { key: "line.route.switched", params: { route: "route.uk-partner" }, tone: "good", attention: true, counts: [], big: true };

describe("a grant from inside the country", () => {
  test("[route-gates:in-country-grant-switches-status] given a partner's visa granted in country, when the results open, then the new permission leads the month as its hero, before payday, and says it starts with no flight", async () => {
    expect(leadsAlone(SWITCHED)).toBe(true);
    const turned: ReportLine[] = [{ key: "line.wallet.salary", params: { amount: { currency: "GBP", amount: 180_000 } }, tone: "good", attention: false, counts: [] }, SWITCHED];
    const view: PlayerView = { ...richAbroadView(), setpiece: null, interview: null, report: { month: 4, lines: turned, japacityBefore: null, japacityAfter: null, attention: false } };
    const { store } = await renderWithView(<Results place="Peckham" />, view);
    act(() => store.setState({ reportOpen: true, lastMonthLines: [] }));
    const first = document.querySelector<HTMLElement>("[data-results-story] li");
    expect(first?.dataset.storyLine).toBe(SWITCHED.key);
    expect(first?.hasAttribute("data-results-best")).toBe(true);
    const said = first?.textContent ?? "";
    expect(said).toBe(words(SWITCHED.key, SWITCHED.params));
    expect([said.includes(runningName("route.uk-partner")) || said.includes(nameOf("route.uk-partner")), /no flight/.test(said)]).toEqual([true, true]);
  });
});
