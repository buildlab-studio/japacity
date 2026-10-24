// What the results lead with (world:month-end-results-sheet), played on the real engine: a bill
// that could not be paid is the first story line, in red, with its figure and what it cost, though
// no money moved; a month where nothing moved says so instead of "+₦0"; a hunt's answer is told
// on the same screen; and the visa grant leads alone, the asks and the loans after it.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import type { Game } from "@japacity/sim/testing";
import { slot, applyEffects } from "@japacity/sim/testing";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { formatMoney } from "../../shared/words/format";
import { chargedLivingGame, newGame, recordedGame, abroadGame, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, words } from "../../shared/words/text";
import { monthlyPayOf } from "../../shared/words/cost";
import { storyLines, toldOnResults } from "./month.results";
import { Results } from "./Results";
import { turnWords } from "./turn.words";

/** The graduate with every naira taken, so whatever the month charges cannot be paid. */
function graduateBroke(game: Game = newGame("scenario.graduate")): Game {
  const pocket = game.state.wallet.pockets.NGN;
  applyEffects(game, [
    { type: "money/take", currency: "NGN", pocket: "cash", amount: pocket.cash, reason: "social" },
    { type: "money/take", currency: "NGN", pocket: "bank", amount: pocket.bank, reason: "social" },
  ]);
  return game;
}

async function showResults(game: Game, lines: ReportLine[]) {
  const view = game.view();
  const { store } = await renderWithView(<Results place="Home" />, { ...view, report: { month: view.month, lines, japacityBefore: null, japacityAfter: null, attention: false } });
  act(() => store.setState({ reportOpen: true }));
}

function storyRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-results-story] li")];
}

describe("money that was not paid", () => {
  test("[world:month-end-results-sheet] given the graduate with nothing to pay its living costs, when the month ends, then the first story line says the living costs went unpaid, in red, with the figure and what it cost", async () => {
    // Decision 0013 (home:living-by-hand): at home nothing of the living is charged as the month turns, so a broke month there
    // misses no living costs at all; the unpaid line is tested on the living charged whole, as the simulation's relief tests do.
    const lived = graduateBroke().endTurn().lines;
    expect(lived.some((line) => line.key === "line.obligation.missed" && line.params["obligation"] === "obligation.upkeep")).toBe(false);
    const game = graduateBroke(chargedLivingGame("scenario.graduate"));
    const due = game.view().obligations.find((owed) => owed.entry === "obligation.upkeep")?.due ?? 0;
    expect(due).toBeGreaterThan(0);
    const { lines } = game.endTurn();
    await showResults(game, lines);
    const first = storyRows()[0];
    const said = words("ui.results.unpaid.standing-mood", { obligation: "obligation.upkeep", amount: { currency: "NGN", amount: due } });
    expect(first?.textContent).toBe(said);
    expect(said).toContain(formatMoney(due, "NGN"));
    expect(said).toContain(nameOf("obligation.upkeep"));
    expect(first?.getAttribute("data-unpaid")).toBe("true");
    expect(first?.className).toContain("text-out");
  });

  test("[world:month-end-results-sheet] given a month where no money moved, when the results show, then the headline says nothing moved rather than kept +₦0, and the money count is still what moved", async () => {
    const game = graduateBroke();
    const { lines } = game.endTurn();
    await showResults(game, lines);
    const kept = document.querySelector("[data-results-kept]");
    expect(kept?.getAttribute("data-results-kept")).toBe("0");
    expect(kept?.textContent).toBe(turnWords("turn.results.nothing-moved"));
    expect(kept?.textContent).not.toContain("+");
  });

  test("[world:month-end-results-sheet] [credit:payments-move-the-mark] given the graduate abroad holding no pounds, when its first month's rent goes unpaid, then the results lead with it and the mark on its credit file", () => {
    const game = abroadGame();
    expect(game.view().pockets.GBP.bank + game.view().pockets.GBP.cash).toBe(0);
    const rent = game.view().obligations.find((owed) => content.obligation[owed.entry]?.type === "rent");
    if (rent === undefined) throw new Error("The graduate abroad holds no rent.");
    const { lines } = game.endTurn();
    const told = storyLines(lines).map((line) => toldOnResults(line, game.view()));
    const rentLine = told.find((line) => line.params.obligation === rent.entry);
    expect(rentLine?.key).toBe("ui.results.unpaid.credit-standing-mood");
    const unpaid = told.filter((line) => line.key.startsWith("ui.results.unpaid."));
    expect(told.slice(0, unpaid.length)).toEqual(unpaid);
    expect(words(rentLine?.key ?? "", rentLine?.params)).toContain(formatMoney(rent.due, "GBP"));
  });

  test("[world:month-end-results-sheet] [abroad-money:missed-tuition-runs-in-stages] given the graduate abroad holding no pounds, when a tuition instalment goes unpaid, then the results lead with the fees office's reminder and its sum, and nothing more is lost that month", () => {
    const game = abroadGame();
    const tuition = game.view().obligations.find((owed) => owed.entry === "obligation.tuition" && owed.due > 0);
    if (tuition === undefined) throw new Error("No tuition falls due in the graduate's first month abroad.");
    const { lines } = game.endTurn();
    const told = storyLines(lines).map((line) => toldOnResults(line, game.view()));
    const missed = told.find((line) => line.params.obligation === "obligation.tuition");
    expect(missed?.key).toBe("line.obligation.tuition-reminder");
    const said = words(missed?.key ?? "", missed?.params);
    expect(said).toContain(formatMoney(tuition.due, "GBP"));
    expect(said).toMatch(/fees office/);
    expect(said).not.toMatch(/withdraw/);
  });
});

describe("a hunt's answer on the results", () => {
  test("[world:month-end-results-sheet] given a hunt that found nothing, when the results show, then it says the job and not this time, among the story lines", async () => {
    // On this seed the first draw for a junior developer finds nothing; the hunt is past the
    // sure first months (guide:early-win-in-three-turns), so the draw stands.
    const game = newGame("scenario.graduate");
    for (let month = 0; month < 3; month += 1) game.endTurn([]);
    const { lines } = game.endTurn([slot("activity.job-hunt", "activity.job-junior-developer")]);
    expect(lines.some((line) => line.key === "line.activity.hunt-missed")).toBe(true);
    await showResults(game, lines);
    expect(storyRows().map((row) => row.textContent)).toContain(words("ui.results.hunt-missed", { job: "activity.job-junior-developer" }));
    expect(words("ui.results.hunt-missed", { job: "activity.job-junior-developer" })).toBe(`${nameOf("activity.job-junior-developer")}: not this time.`);
  });

  test("[world:month-end-results-sheet] given a hunt that found a job, when the results show, then it says an offer with the job and its pay a month, ranked with the offers", async () => {
    const game = newGame("scenario.graduate");
    const { lines } = game.endTurn([slot("activity.job-hunt", "activity.job-teacher")]);
    await showResults(game, lines);
    // wallet:view-carries-month-pay: the pay a month is the one the view gives the offer, as the wallet will book it.
    const pay = monthlyPayOf(game.view(), "activity.job-teacher");
    if (pay === null) throw new Error("The teacher's job has no pay.");
    const said = words("ui.results.hunt-offer", { job: "activity.job-teacher", pay });
    expect(storyRows()[0]?.textContent).toBe(said);
    expect(said).toContain(`${formatMoney(pay.amount, pay.currency)} a month`);
  });

  test("[world:month-end-results-sheet] [wallet:view-carries-month-pay] [abroad-money:salary-abroad-taxed-locally] given a job abroad above the tax line, whose pay content gives a year, when its pay a month is read from the view, then it is the year's pay over twelve less the month's tax on the part above the line", () => {
    // wallet:view-carries-month-pay: the figure is the view's, the job held through the engine.
    const year = content.activity["activity.job-uk-retail-part"]?.pay?.amount;
    expect(typeof year).toBe("number");
    const { taxFreeLine, taxBp } = content.country["country.uk"]!;
    expect(year as number).toBeGreaterThan(taxFreeLine);
    const tax = Math.floor(Math.floor(((year as number) - taxFreeLine) * taxBp / 10_000) / 12);
    expect(tax).toBeGreaterThan(0);
    const view = viewAfter(abroadGame(), [{ type: "activity/start-job", job: "activity.job-uk-retail-part" }]);
    expect(monthlyPayOf(view, "activity.job-uk-retail-part")).toEqual({ currency: "GBP", amount: Math.floor((year as number) / 12) - tax });
  });
});

describe("the grant leads", () => {
  test("[world:month-end-results-sheet] given the graduate's recorded life in the month of its grant, when the results show, then the grant is the first story line, alone in the lead, and no funds loan opens that month", async () => {
    // The recorded life up to the month's end that brought the grant, found by walking back from the flight.
    let game = recordedGame("graduate-careful", 1);
    for (let back = 1; back < 16 && !(game.view().report?.lines ?? []).some((line) => line.key === "line.route.granted"); back += 1) game = recordedGame("graduate-careful", back);
    const lines = game.view().report?.lines ?? [];
    expect(lines.some((line) => line.key === "line.route.granted")).toBe(true);
    await showResults(game, lines);
    const rows = storyRows();
    expect(rows[0]?.getAttribute("data-story-line")).toBe("line.route.granted");
    expect(rows[0]?.getAttribute("data-story-lead")).toBe("true");
    expect(rows.filter((row) => row.getAttribute("data-story-lead") === "true")).toHaveLength(1);
    // route:departure-pays-flight: once granted, no held-funds loan is offered.
    expect(game.view().offers.some((offer) => offer.entry === "offer.held-funds")).toBe(false);
  });
});
