import type { LotteryOdds, PlayerView, ReportLine } from "@japacity/sim";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, newGame, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { words } from "../../shared/words/text";
import { drawMissed, drawShown, kept, moneyLines, otherLines, savings, STORY_MAX, storyLines } from "./month.results";
import { localCurrency } from "../../shared/words/wayHome";
import { Results } from "./Results";
import { turnWords } from "./turn.words";

const SALARY: ReportLine = { key: "line.wallet.salary", params: { amount: { currency: "NGN", amount: 45_000_000 } }, tone: "good", attention: false, counts: [] };
const UPKEEP: ReportLine = { key: "line.wallet.upkeep", params: { amount: { currency: "NGN", amount: 10_000_000 } }, tone: "bad", attention: false, counts: [] };
const MOVED: ReportLine = { key: "line.wallet.moved", params: { amount: { currency: "NGN", amount: 5_000_000 }, pocket: "bank" }, tone: "plain", attention: false, counts: [] };
const FLAGGED: ReportLine = { key: "line.wallet.flagged", params: { amount: { currency: "NGN", amount: 9_000_000 } }, tone: "bad", attention: false, counts: [] };
const NEWS: ReportLine = { key: "line.test.not-written", params: {}, tone: "plain", attention: false, counts: [] };

const ODDS: LotteryOdds = { smallPerMillion: 1, small: 1, midPerMillion: 1, mid: 1, jackpotPerMillion: 1, jackpotStart: 1, jackpotGrowthBp: 0, jackpotCap: 1, forcedWinWeeks: null };

function withDraw(view: PlayerView, mine: number[] | null): PlayerView {
  return {
    ...view,
    lottery: {
      ticket: 50_000,
      maxTickets: 5,
      draw: 8,
      closesTick: 99,
      onSale: true,
      tickets: 2,
      numbers: mine,
      jackpot: 1,
      rolledOver: false,
      odds: ODDS,
      fingerprint: "f",
      last: {
        draw: 7,
        revealed: "r",
        beaconRound: 1,
        beaconRandomness: "b",
        listHash: "h",
        count: 80,
        odds: ODDS,
        jackpot: 1,
        winners: [
          { tier: "jackpot", tickets: [], amount: 0 },
          { tier: "small", tickets: [41, 12], amount: 100 },
        ],
        nextJackpot: 1,
      },
    },
  };
}

function monthEnded(lines: ReportLine[]): PlayerView {
  const view = { ...richView(), setpiece: null, interview: null };
  return { ...view, report: { month: 11, lines, japacityBefore: 58, japacityAfter: 64, attention: false } };
}

describe("what the results read", () => {
  test("[world:month-end-results-sheet] given a month's lines, when the money is read, then each line in or out has its sign, a plain move or a flag is not money, and what was kept is in less out", () => {
    const money = moneyLines([SALARY, MOVED, UPKEEP, FLAGGED, NEWS]);
    expect(money.map(({ line, sign }) => [line.key, sign])).toEqual([
      ["line.wallet.salary", 1],
      ["line.wallet.upkeep", -1],
    ]);
    expect(kept(money)).toEqual([{ currency: "NGN", amount: 35_000_000 }]);
    expect(otherLines([SALARY, MOVED, UPKEEP, NEWS]).map((line) => line.key)).toEqual(["line.wallet.moved", "line.test.not-written"]);
  });

  test("[world:month-end-results-sheet] given a draw result, when the numbers are read, then they are the winning tickets in order with the player's own matched", () => {
    expect(drawShown(withDraw(engineView(), [12, 30]))).toEqual({ draw: 7, numbers: [12, 41], matched: [12] });
    expect(drawShown(withDraw(engineView(), null))?.matched).toEqual([]);
    expect(drawShown({ lottery: null })).toBeNull();
  });

  test("[world:month-end-results-sheet] given a route with funds to show, when the savings are read, then they are the shown funds against the need in the route's money; with none, the japacity figure", () => {
    const rich = richView();
    expect(savings(rich)).toEqual({ kind: "funds", shown: 1_200_000, required: 3_000_000, currency: "GBP" });
    expect(savings({ ...rich, routes: [] })).toEqual({ kind: "percent", percent: 64 });
    expect(savings({ routes: [], japacity: { percent: null, route: null } })).toBeNull();
    expect(localCurrency(engineView())).toBe("NGN");
  });
});

describe("the results sheet", () => {
  test("[world:month-end-results-sheet] given the month ended with a salary and the living taken, when the results show, then they say the month is done, payday leads with its figure in its colour, no living line, and what was kept comes after", async () => {
    const view = monthEnded([SALARY, UPKEEP, NEWS]);
    const { store } = await renderWithView(<Results place="Ojuelegba" />, view);
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => store.setState({ reportOpen: true }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText(turnWords("turn.results.title"))).toBeTruthy();
    expect(within(sheet).queryByText(/Month \d+/)).toBeNull();
    expect(sheet.querySelector("[data-results-kept]")?.getAttribute("data-results-kept")).toBe("35000000");
    // The close: payday leads; no list of every line in and out, and no living line.
    const payday = sheet.querySelector("[data-results-payday]");
    expect(payday?.getAttribute("data-results-payday")).toBe("45000000");
    expect(within(sheet).getByText(`+${formatMoney(45_000_000, "NGN")}`).className).toContain("text-in");
    expect(within(sheet).getByText(words(SALARY.key, SALARY.params))).toBeTruthy();
    expect(within(sheet).queryByText(words(UPKEEP.key, UPKEEP.params))).toBeNull();
    expect(within(sheet).queryByText(`-${formatMoney(10_000_000, "NGN")}`)).toBeNull();
    expect(sheet.querySelector("[data-results-lines]")).toBeNull();
    const order = [...sheet.querySelectorAll("[data-results-payday], [data-results-kept]")].map((node) => (node.hasAttribute("data-results-payday") ? "payday" : "kept"));
    expect(order).toEqual(["payday", "kept"]);
    // The news line is not listed here: it lives in the phone's News app.
    expect(within(sheet).queryByText(words(NEWS.key, NEWS.params))).toBeNull();
    expect(within(sheet).getByText(turnWords("turn.results.news"))).toBeTruthy();
  });

  test("[world:month-end-results-sheet] given a draw result, when the results show, then the draw's numbers show and the player's matched one is lit with the signal", async () => {
    const { store } = await renderWithView(<Results place="Ojuelegba" />, withDraw(monthEnded([SALARY]), [41]));
    act(() => store.setState({ reportOpen: true }));
    const lit = [...document.querySelectorAll("[data-results-draw] li")].map((chip) => [chip.textContent, chip.getAttribute("data-matched"), chip.className.includes("bg-signal")]);
    expect(lit).toEqual([
      ["12", "false", false],
      ["41", "true", true],
    ]);
  });

  test("[world:month-end-results-sheet] given the results, then the savings bar stands toward the move, and the one main button goes back to the place and closes them", async () => {
    const { store } = await renderWithView(<Results place="Ojuelegba" />, monthEnded([SALARY]));
    act(() => store.setState({ reportOpen: true }));
    const bar = screen.getByRole("progressbar", { name: turnWords("turn.results.savings") });
    expect(bar.getAttribute("aria-valuenow")).toBe("1200000");
    expect(bar.getAttribute("aria-valuemax")).toBe("3000000");
    const back = screen.getByRole("button", { name: turnWords("turn.results.back", { place: "Ojuelegba" }) });
    fireEvent.click(back);
    expect(store.getState().reportOpen).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("[world:month-end-results-sheet] given staged wins still to show, when the month ends, then the results wait for them", async () => {
    const { store } = await renderWithView(<Results place="Ojuelegba" />, monthEnded([SALARY]));
    act(() => store.setState({ reportOpen: true, moments: [SALARY] }));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => store.setState({ moments: [] }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

/** The front page's line of the draw whose result the view holds (lottery:draw-result-on-front-page). */
const DRAWN: ReportLine = { key: "line.lottery.drawn-rolled", params: { draw: 7, jackpot: { currency: "NGN", amount: 20_000_000 }, winners: 2 }, tone: "plain", attention: false, counts: [] };

/** A month at the kiosk on the first seed whose draw makes the tickets lose, or win, as the real engine plays it. */
function kioskMonth(won: boolean, tickets: number): ReportLine[] {
  for (let seed = 1; seed < 200; seed += 1) {
    const game = newGame("scenario.graduate", `kiosk-${String(seed)}`);
    const lines = game.endTurn([{ activity: "activity.play-lotto", param: String(tickets) }]).lines;
    if (lines.some((line) => line.key === (won ? "line.activity.lotto-won" : "line.activity.lotto-lost"))) return lines;
  }
  throw new Error(`No seed made the kiosk's draw ${won ? "win" : "lose"}.`);
}

// A ticket bought and lost is said in words, never only as the tag "Lotto: ₦200".
describe("the draw's outcome said", () => {
  test("[world:month-end-results-sheet] [luck:kiosk-sells-lotto-tickets] given a ticket bought at the kiosk and lost, when the month's results show, then the story says the ticket did not win, in words, whatever else the month held", async () => {
    const lines = kioskMonth(false, 1);
    const story = storyLines(lines);
    const lost = story.find((line) => line.key === "line.activity.lotto-lost");
    expect(lost).toBeDefined();
    expect(words(lost!.key, lost!.params)).toBe("Your ticket did not win.");
    // A full month never cuts it: six other events first, and the draw is still said.
    const busy: ReportLine[] = Array.from({ length: STORY_MAX + 2 }, (_, at) => ({ key: "line.offer.opened", params: { offer: `offer.whip-round-${String(at)}` }, tone: "plain", attention: true, counts: [] }));
    expect(storyLines([...busy, ...lines]).some((line) => line.key === "line.activity.lotto-lost")).toBe(true);
    const { store } = await renderWithView(<Results place="Bode Thomas Street" />, monthEnded(lines));
    act(() => store.setState({ reportOpen: true }));
    expect(within(screen.getByRole("dialog")).getByText("Your ticket did not win.")).toBeTruthy();
  });

  test("[world:month-end-results-sheet] [luck:kiosk-sells-lotto-tickets] given tickets bought at the kiosk and one won, then the story says the win", () => {
    const lines = kioskMonth(true, 5);
    const won = storyLines(lines).find((line) => line.key === "line.activity.lotto-won");
    expect(won).toBeDefined();
    expect(words(won!.key, won!.params)).toMatch(/^5 tickets for ₦1,000, and one came in: ₦[\d,]+\.$/);
  });

  test("[world:month-end-results-sheet] [lottery:draw-result-on-front-page] given the Friday draw's result in the month's lines and the player's tickets in it, none matched, then the results say the tickets did not win; matched, or with no ticket, or before the result, they do not", async () => {
    expect(drawMissed(withDraw(engineView(), [30, 55]), [DRAWN])).toBe(2);
    expect(drawMissed(withDraw(engineView(), [12, 30]), [DRAWN])).toBeNull();
    expect(drawMissed(withDraw(engineView(), null), [DRAWN])).toBeNull();
    expect(drawMissed(withDraw(engineView(), [30, 55]), [])).toBeNull();
    const closed = withDraw(engineView(), [30, 55]);
    expect(drawMissed({ lottery: { ...closed.lottery!, onSale: false } }, [DRAWN])).toBeNull();
    const { store } = await renderWithView(<Results place="Ojuelegba" />, withDraw(monthEnded([SALARY, DRAWN]), [55]));
    act(() => store.setState({ reportOpen: true }));
    expect(document.querySelector("[data-results-draw-missed]")?.textContent).toBe(turnWords("turn.results.draw-missed.one"));
    expect(turnWords("turn.results.draw-missed.one")).toBe("Your ticket did not win.");
  });
});
