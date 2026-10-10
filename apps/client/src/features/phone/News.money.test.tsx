// News tells the month's money in the results' own words (docs/rules/world.md R-WORLD-008):
// News said "Changed at the bank: ₦163,682." where the results said ₦166,175 with the charge apart, "Changed money.
// £92 in hand." for pounds that went into the bank, and "Changed at the bank" for the FX man's changes.
import type { ReportLine } from "@japacity/sim";
import { act, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import type { Game } from "../../../../../packages/sim/src/testing/play";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nowLineWords } from "../../shared/words/acts";
import { moneyLines } from "../../shared/words/money";
import { newsLines } from "../../shared/words/told";
import { words } from "../../shared/words/text";
import { latelyLines } from "./apps/Bank";
import { PhoneApps } from "./PhoneApps";
import { reloadSeen } from "./seen";

beforeEach(() => {
  localStorage.clear();
  reloadSeen();
});

/** Tunde's month of changes both ways, at the bank and with the FX man, as the eleventh review made them; then the month ends. */
function moneyMonth(): { game: Game; mid: ReportLine[]; end: ReportLine[] } {
  const game = newGame("scenario.tunde");
  const mid: ReportLine[] = [];
  const play = (command: Parameters<Game["accept"]>[0]): void => {
    mid.push(...game.accept(command).lines);
  };
  play({ type: "wallet/convert", from: "NGN", to: "GBP", amount: 16_617_500, via: "bank" });
  play({ type: "wallet/convert", from: "GBP", to: "NGN", amount: 2_200, via: "bank" });
  play({ type: "wallet/move", currency: "NGN", amount: 13_429_600, to: "cash" });
  play({ type: "wallet/convert", from: "NGN", to: "GBP", amount: 6_714_800, via: "aboki" });
  play({ type: "wallet/convert", from: "GBP", to: "NGN", amount: 2_600, via: "aboki" });
  const end = game.endTurn().lines;
  return { game, mid, end };
}

/** The wallet's own words for a change, which only the results' telling may stand in for. */
const RAW: readonly string[] = ["line.wallet.converted", "line.wallet.convert-paid", "line.wallet.bank-charge"];

describe("News tells the month's money as the results do", () => {
  test("[R-WORLD-008] [R-WORLD-019] given a month with changes both ways at the bank and with the FX man, when the results, the Bank's Lately and News tell it, then each money line is the same words in all three, and News never tells a change in the wallet's raw words", () => {
    const { game, mid, end } = moneyMonth();
    const results = moneyLines([...mid, ...end]).map(({ line }) => nowLineWords(line));
    expect(results.length).toBeGreaterThanOrEqual(8);
    // Lately reads the month just ended as the results list it.
    expect(latelyLines(game.view(), mid, []).map((line) => words(line.key, line.params))).toEqual(results);
    const news = newsLines(mid, end, game.view());
    const told = news.map((line) => nowLineWords(line));
    // Every money line the results tell, in their order, in News.
    expect(told.filter((said) => results.includes(said))).toEqual(results);
    expect(news.filter((line) => RAW.includes(line.key))).toEqual([]);
    // What the review saw: the bank's change as the naira left after its charge, "Changed money" for pounds banked, the FX man as the bank.
    const raw = mid.filter((line) => RAW.includes(line.key)).map((line) => words(line.key, line.params));
    const unsaid = raw.filter((said) => !results.includes(said));
    expect(unsaid.length).toBeGreaterThanOrEqual(5);
    for (const said of unsaid) expect(told).not.toContain(said);
  });

  test("[R-WORLD-008] given the same month ended, when News opens on the phone, then its report shows the results' money lines", async () => {
    const { game, mid, end } = moneyMonth();
    const results = moneyLines([...mid, ...end]).map(({ line }) => nowLineWords(line));
    const { store } = await renderWithView(<PhoneApps onClose={() => undefined} area="Yaba" now={() => new Date(2026, 9, 10, 12, 5)} talk={null} />, game.view());
    act(() => {
      store.setState({ lastMonthLines: mid });
    });
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="news"]')!);
    const shown = [...document.querySelectorAll("[data-report] li")].map((item) => item.textContent);
    for (const said of results) expect(shown).toContain(said);
  });
});
