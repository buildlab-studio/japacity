// The tags under what was kept (docs/rules/text.md R-TEXT-008, world.md R-WORLD-008): a change of money is a plain
// tag, since it counts for nothing (decision 0021), and the month's lotto is one down tag and one money row, however
// many visits the tickets were bought on.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { LOTTO_TICKETS } from "../../shared/words/money";
import { say, words } from "../../shared/words/text";
import { foldLotto, kept, moneyLines, monthTags } from "./month.results";
import { Results } from "./Results";

const TICKET = content.tuning.luck.ticket;

describe("the tags under what was kept", () => {
  test("[R-TEXT-008] [R-WORLD-008] [R-LUCK-005] given three tickets bought on three visits, when the month's results show, then the lotto is one row with the three tickets' money and a down tag, and what was kept still counts each", async () => {
    const game = newGame("scenario.ada");
    const now: ReportLine[] = [];
    for (let visit = 0; visit < 3; visit += 1) now.push(...game.accept({ type: "activity/now", activity: "activity.play-lotto", param: "1" }).lines);
    game.endTurn();
    const lines = moneyLines([...now, ...(game.view().report?.lines ?? [])]);
    expect(foldLotto(lines).filter((entry) => entry.line.key === LOTTO_TICKETS)).toHaveLength(1);
    expect(monthTags(lines)).toEqual([{ id: "lotto", tone: "down", key: "ui.results.tag.lotto", amount: { currency: "NGN", amount: TICKET * 3 } }]);
    const { store } = await renderWithView(<Results place="Home" />, game.view());
    act(() => store.setState({ reportOpen: true, lastMonthLines: now }));
    const rows = [...document.querySelectorAll<HTMLElement>("[data-results-lines] li")].map((row) => row.textContent ?? "");
    const lotto = words(LOTTO_TICKETS, { amount: { currency: "NGN", amount: TICKET * 3 } });
    expect(rows.filter((row) => row.startsWith(lotto))).toHaveLength(1);
    const tag = document.querySelector("[data-results-tag='lotto'] [data-tone]");
    expect(tag?.getAttribute("data-tone")).toBe("down");
    expect(tag?.textContent).toBe(say("ui.results.tag.lotto", { amount: { currency: "NGN", amount: TICKET * 3 } }));
    // The telling folds; the count does not.
    expect(document.querySelector("[data-results-kept]")?.getAttribute("data-results-kept")).toBe(String(kept(lines).find((net) => net.currency === "NGN")?.amount ?? 0));
  });

  test("[R-TEXT-008] [R-WORLD-008] given naira changed into pounds at the bank, when the tags are read, then the change is one plain tag with the pounds that came in, and no lotto tag", () => {
    const game = newGame("scenario.ada");
    const told = game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: 20_000_000, via: "bank" }).lines;
    const lines = moneyLines(told);
    const tags = monthTags(lines);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ id: "change", tone: "plain", key: "ui.results.tag.change", amount: { currency: "GBP" } });
    expect(tags[0]!.amount.amount).toBeGreaterThan(0);
  });
});
