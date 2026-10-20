// What this month's tickets cost, on the phone (luck:kiosk-sells-lotto-tickets): read from
// the month's lines, as the kiosk reads them, so the app and the kiosk agree.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { lottoMonth } from "../../../shared/words/lottoLines";
import { Lotto } from "./Lotto";
import { say } from "../../../shared/words/text";

const { ticket } = content.tuning.luck;

/** The graduate buys this many tickets at the kiosk, one at each visit, as the street's slip sells them. */
function bought(visits: number): { lines: ReportLine[]; game: ReturnType<typeof newGame> } {
  const game = newGame("scenario.graduate");
  const lines: ReportLine[] = [];
  for (let visit = 0; visit < visits; visit += 1) lines.push(...game.accept({ type: "activity/now", activity: "activity.play-lotto", param: "1" }).lines);
  return { lines, game };
}

describe("the month's lotto", () => {
  test("[luck:kiosk-sells-lotto-tickets] given three tickets bought at the kiosk this month, when the Lotto app opens, then it says three tickets this month and what they cost, from the wallet's social lines", async () => {
    const { lines, game } = bought(3);
    expect(lottoMonth(lines)).toEqual({ tickets: 3, spent: { currency: "NGN", amount: ticket * 3 } });
    const { store } = await renderWithView(<Lotto />, game.view());
    act(() => store.setState({ monthLines: lines }));
    const fact = document.querySelector("[data-lotto-month]");
    expect(fact?.textContent).toContain(say("phone.lotto.month", { count: 3 }));
    expect(fact?.textContent).toContain(say("phone.lotto.month-cost", { amount: formatMoney(ticket * 3, "NGN") }));
  });

  test("[luck:kiosk-sells-lotto-tickets] given no ticket bought this month, when the Lotto app opens, then it says no figure", async () => {
    const game = newGame("scenario.graduate");
    await renderWithView(<Lotto />, game.view());
    expect(document.querySelector("[data-lotto-month]")).toBeNull();
  });

});
