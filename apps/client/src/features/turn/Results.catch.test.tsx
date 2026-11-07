// A job's pay told in its own words still counts as pay (world:month-end-results-sheet): the crew's share led by the catch's word
// (activity:catch-drawn-each-month) and the takings of own work (activity:capital-opens-own-work, activity:trader-opens-own-shop)
// lead the results as payday and count in Kept, so what was kept is what really moved. Played on the real engine: the child of
// the water third in Sewanu's canoe with the nets beside it, as a player takes them at the net shed.
import { content } from "@japacity/content";
import type { Id, ReportLine } from "@japacity/sim";
import { applyEffects, type Game, playPrologueBy, start } from "@japacity/sim/testing";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { words } from "../../shared/words/text";
import { kept, monthClose, moneyLines } from "./month.results";
import { Results } from "./Results";

/** The child of the water's tile: commerce at school, work after it, the counter's savings, and the room on the lagoon. */
const WATER = ["begin", "commercial", "work", "save", "makoko"];
const SALARY = "line.activity.salary";

function naira(game: Game): number {
  const pocket = game.state.wallet.pockets.NGN;
  return pocket.bank + pocket.cash;
}

function keptNaira(lines: readonly ReportLine[]): number {
  return kept(moneyLines(lines)).find((net) => net.currency === "NGN")?.amount ?? 0;
}

function water(seed: string): Game {
  const game = start({ content, scenario: "scenario.prologue", seed });
  playPrologueBy(game, WATER);
  return game;
}

/** Sewanu asked and his place taken, then the nets taken at the shed: the crew as the main job, the nets as the side job. */
function crewAndNets(seed: string): { game: Game; mid: ReportLine[] } {
  const game = water(seed);
  const mid: ReportLine[] = [];
  mid.push(...game.accept({ type: "activity/now", activity: "activity.ask-fisherman", param: null }).lines);
  const offer = game.view().offers.find((each) => each.entry === "offer.canoe-place");
  if (offer === undefined) throw new Error("Sewanu offered no place.");
  mid.push(...game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" }).lines);
  mid.push(...game.accept({ type: "activity/now", activity: "activity.take-net-work", param: null }).lines);
  expect(game.state.activity.job).toBe("activity.job-canoe-crew");
  expect(game.state.activity.side).toBe("activity.mend-nets");
  return { game, mid };
}

function payOf(lines: readonly ReportLine[]): ReportLine {
  const pay = lines.find((line) => line.key === SALARY);
  if (pay === undefined) throw new Error("No pay this month.");
  return pay;
}

function bandOf(line: ReportLine): string {
  const band = line.params["catch"];
  if (typeof band !== "string") throw new Error("The pay carries no catch.");
  return band;
}

function amountOf(line: ReportLine): number {
  return (line.params["amount"] as { amount: number }).amount;
}

describe("the crew's share on the results", () => {
  test("[world:month-end-results-sheet] [activity:catch-drawn-each-month] given the child of the water third in Sewanu's canoe with the nets beside it, when each of six months ends, then the catch's share leads as payday under the catch's word and Kept counts it with the nets' pay, what really moved", () => {
    const { game, mid } = crewAndNets("results-catch-1");
    const bands = new Set<string>();
    for (let month = 0; month < 6; month += 1) {
      const before = naira(game);
      if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
      const { lines } = game.endTurn();
      const all = month === 0 ? [...mid, ...lines] : lines;
      const pay = payOf(lines);
      const band = bandOf(pay);
      bands.add(band);
      expect(keptNaira(all)).toBe(naira(game) - before);
      const close = monthClose(all, lines);
      expect(close.payday.map((entry) => entry.amount)).toContain(amountOf(pay));
      expect(close.payday.some((entry) => entry.line.key === `${SALARY}.catch.${band}`)).toBe(true);
    }
    // The seed draws more than one band over the six months, so the words of each are read.
    expect(bands.size).toBeGreaterThan(1);
  });

  test("[world:month-end-results-sheet] [activity:catch-drawn-each-month] given a month in the crew, when the results open after Sleep, then payday leads with the catch's word beside the share's figure, said once, then Kept", async () => {
    const { game, mid } = crewAndNets("results-catch-2");
    game.grant(game.content.tuning.turn.cap);
    const before = naira(game);
    const { lines } = game.endTurn();
    const pay = payOf(lines);
    const band = bandOf(pay);
    const { store } = await renderWithView(<Results place="Makoko" />, game.view());
    act(() => store.setState({ reportOpen: true, lastMonthLines: mid }));
    const payday = [...document.querySelectorAll<HTMLElement>("[data-results-payday]")];
    expect(payday.map((row) => Number(row.dataset.resultsPayday))).toContain(amountOf(pay));
    const crew = payday.find((row) => Number(row.dataset.resultsPayday) === amountOf(pay));
    expect(crew?.querySelector("[data-results-money-label]")?.textContent).toBe(words(`${SALARY}.catch.${band}.label`, pay.params));
    expect(crew?.textContent?.split(formatMoney(amountOf(pay), "NGN"))).toHaveLength(2);
    expect(Number(document.querySelector<HTMLElement>("[data-results-kept]")?.dataset.resultsKept)).toBe(naira(game) - before);
  });
});

describe("own work's takings on the results", () => {
  test("[world:month-end-results-sheet] [activity:capital-opens-own-work] [activity:trader-opens-own-shop] given a month at the kiln, in the fish trade and at the shop, when the month ends, then the takings told in their own words lead as payday and Kept counts them, what really moved", () => {
    for (const job of ["activity.job-fish-smoker", "activity.job-fish-trader", "activity.run-shop"] as Id<"activity">[]) {
      const game = water(`results-own-${job}`);
      applyEffects(game, [{ type: "activity/start-job", job }]);
      expect(game.state.activity.job).toBe(job);
      game.grant(game.content.tuning.turn.cap);
      const before = naira(game);
      const { lines } = game.endTurn();
      const pay = payOf(lines);
      expect(keptNaira(lines)).toBe(naira(game) - before);
      const close = monthClose(lines, lines);
      expect(close.payday.map((entry) => [entry.line.key, entry.amount])).toContainEqual([`${SALARY}.${job}`, amountOf(pay)]);
    }
  });
});
