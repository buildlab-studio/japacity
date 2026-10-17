// The tags under what was kept (docs/rules/text.md R-TEXT-008, world.md R-WORLD-008): the month's lotto is one down
// tag and one money row, however many visits the tickets were bought on. A change of money is
// never a tag: it is said by its own line under Kept, both sides as they were (R-WORLD-008, Results.changed.test.tsx).
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { LOTTO_TICKETS } from "../../shared/words/money";
import { say, words } from "../../shared/words/text";
import { changesInto, foldLotto, kept, moneyLines, monthTags } from "./month.results";
import { Results } from "./Results";

const TICKET = content.tuning.luck.ticket;

describe("the tags under what was kept", () => {
  test("[R-TEXT-008] [R-WORLD-008] [R-LUCK-005] given three tickets bought on three visits, when the month's results show, then the lotto is said once, as a down tag with the three tickets' money, and what was kept still counts each", async () => {
    const game = newGame("scenario.ada");
    const now: ReportLine[] = [];
    for (let visit = 0; visit < 3; visit += 1) now.push(...game.accept({ type: "activity/now", activity: "activity.play-lotto", param: "1" }).lines);
    game.endTurn();
    const lines = moneyLines([...now, ...(game.view().report?.lines ?? [])]);
    expect(foldLotto(lines).filter((entry) => entry.line.key === LOTTO_TICKETS)).toHaveLength(1);
    expect(monthTags(lines)).toEqual([{ id: "lotto", tone: "down", key: "ui.results.tag.lotto", amount: { currency: "NGN", amount: TICKET * 3 } }]);
    const { store } = await renderWithView(<Results place="Home" />, game.view());
    act(() => store.setState({ reportOpen: true, lastMonthLines: now }));
    // The close lists no row of money bought by hand: the tickets are said once, by the tag.
    const lotto = words(LOTTO_TICKETS, { amount: { currency: "NGN", amount: TICKET * 3 } });
    expect(document.querySelector("[data-world-sheet='results']")?.textContent ?? "").not.toContain(lotto);
    const tag = document.querySelector("[data-results-tag='lotto'] [data-tone]");
    expect(tag?.getAttribute("data-tone")).toBe("down");
    expect(tag?.textContent).toBe(say("ui.results.tag.lotto", { amount: { currency: "NGN", amount: TICKET * 3 } }));
    // The telling folds; the count does not.
    expect(document.querySelector("[data-results-kept]")?.getAttribute("data-results-kept")).toBe(String(kept(lines).find((net) => net.currency === "NGN")?.amount ?? 0));
  });

  test("[R-TEXT-008] [R-WORLD-008] given naira changed into pounds at the bank, when the tags are read, then no tag says the change, since its own line under Kept says it once with both sides, and no lotto tag", () => {
    const game = newGame("scenario.ada");
    const told = game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: 20_000_000, via: "bank" }).lines;
    const lines = moneyLines(told);
    expect(monthTags(lines)).toEqual([]);
    const [change, ...more] = changesInto(lines);
    expect(more).toEqual([]);
    expect(change?.paid).toMatchObject({ currency: "NGN" });
    expect(change?.got.currency).toBe("GBP");
    expect(change?.got.amount).toBeGreaterThan(0);
  });
});
