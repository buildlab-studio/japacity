// The story lands on the results (world:month-end-results-sheet), played on the real engine: what
// was kept leads, then the month's story (a job found, an offer, a way out heard of), then the money.
// At most six story lines show; the rest of the month stays in News.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { slot, lifeSaves } from "@japacity/sim/testing";
import { act, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame, recordedGame } from "../../shared/testing/fixtures";
import { markWord } from "../../shared/ui/Mark";
import { renderWithView } from "../../shared/testing/render";
import { say, sayCount, words } from "../../shared/words/text";
import { CLOSE_MAX, kept, moneyLines, STORY_MAX, storyLines, toldOnResults, untoldLines } from "./month.results";
import { Results } from "./Results";
import { turnWords } from "./turn.words";

const TEACHER = "activity.job-teacher";

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"] = "plain"): ReportLine {
  return { key, params, tone, attention: false, counts: [] };
}

describe("the month's story on the results", () => {
  test("[world:month-end-results-sheet] given Ada's first month hunting for work, when the results show, then the job found stands under This month as one offer, before what was kept, and the foodstuff bought by hand is not listed again", async () => {
    const game = newGame("scenario.ada");
    // Decision 0013 (home:living-by-hand): no living is charged as the month turns at home, so the money of the month is what was
    // paid at the act: the big pot's foodstuff bought mid-month (the family house's meals from the pot are free),
    // which the results count with the month's own lines.
    const { lines: meal } = game.accept({ type: "activity/now", activity: "activity.cook-jollof", param: null });
    expect(moneyLines(meal)).toHaveLength(1);
    const { lines } = game.endTurn([slot("activity.job-hunt", TEACHER)]);
    const hired = lines.find((each) => each.key === "line.activity.hunt-hired");
    const offer = lines.find((each) => each.key === "line.offer.opened");
    if (hired === undefined || offer === undefined) throw new Error("The hunt found no job on this seed.");
    const { store } = await renderWithView(<Results place="Home" />, game.view());
    act(() => store.setState({ reportOpen: true, lastMonthLines: meal }));
    const story = document.querySelector("[data-results-story]");
    expect(story?.querySelector("h3")?.textContent).toBe(turnWords("turn.results.story"));
    const told = [...(story?.querySelectorAll("li") ?? [])].map((row) => row.textContent);
    // The job found is told as the results tell it: an offer, with its pay a month.
    const found = toldOnResults(hired, game.view());
    expect(told).toContain(words(found.key, found.params));
    // One line for an offer: the offer it opens is not told again.
    expect(told).not.toContain(words(offer.key, offer.params));
    expect(told.filter((row) => row === words(found.key, found.params))).toHaveLength(1);
    // The close: no pay and no rent this month, so the moments lead, then Kept; no list of money.
    const order = [...document.querySelectorAll("[data-results-kept], [data-results-story], [data-results-lines], [data-results-payday], [data-results-rent]")].map((node) => (node.hasAttribute("data-results-kept") ? "kept" : node.hasAttribute("data-results-story") ? "story" : "money"));
    expect(order).toEqual(["story", "kept"]);
    // The meal was paid as it was cooked: it is in Kept, never listed again.
    const sheetText = document.querySelector("[data-world-sheet='results']")?.textContent ?? "";
    expect(sheetText).not.toContain(words(meal[0]!.key, meal[0]!.params));
    // The money count is still only money that moved.
    expect(document.querySelector("[data-results-kept]")?.getAttribute("data-results-kept")).toBe(String(kept(moneyLines([...meal, ...lines])).find((net) => net.currency === "NGN")?.amount ?? 0));
  });

  test("[world:month-end-results-sheet] given a way out heard of in the month, when the story is read, then it is told, and money and plain news are not", () => {
    const game = newGame("scenario.ada");
    game.endTurn();
    // On this seed the news brings the UK master's in the second month.
    const { lines } = game.endTurn();
    expect(lines.some((each) => each.key === "line.route.heard")).toBe(true);
    const keys = storyLines(lines).map((each) => each.key);
    expect(keys).toContain("line.route.heard");
    expect(keys.some((key) => key.startsWith("line.wallet.") || key.startsWith("line.quality."))).toBe(false);
  });

  test("[world:month-end-results-sheet] given a paper ready, a test band and a deposit that will be asked about, when the story is read, then each is told", () => {
    const lines = [
      line("line.document.issued", { document: "document.passport" }, "good"),
      line("line.document.issued-band", { document: "document.english-test", band: 60 }, "good"),
      line("line.wallet.flagged", { amount: { currency: "NGN", amount: 900_000_000 } }, "bad"),
      line("line.chapter.closed", {}, "good"),
      line("line.activity.rested", { slots: 2 }),
    ];
    // A band that reaches the route's is told as meeting it.
    expect(storyLines(lines).map((each) => each.key)).toEqual(["line.document.issued", "line.document.issued-band-met", "line.wallet.flagged", "line.chapter.closed"]);
  });

  test("[world:month-end-results-sheet] given more story than fits, when the results show, then the story holds six, and on the sheet five stand beside Kept, offers and ways out first, and the rest is left to News", async () => {
    const routes = Object.keys(content.route).slice(0, STORY_MAX);
    const lines = [line("line.chapter.closed", {}, "good"), ...routes.map((route) => line("line.route.heard", { route, via: "news" }, "good")), line("line.offer.opened", { offer: "offer.job" })];
    const shown = storyLines(lines);
    expect(shown).toHaveLength(STORY_MAX);
    expect(shown[0]?.key).toBe("line.offer.opened");
    expect(shown.some((each) => each.key === "line.chapter.closed")).toBe(false);
    const game = newGame("scenario.ada");
    const view = game.view();
    const { store } = await renderWithView(<Results place="Home" />, { ...view, report: { month: view.month, lines, japacityBefore: null, japacityAfter: null, attention: false } });
    act(() => store.setState({ reportOpen: true }));
    // Four to six lines on the close, Kept among them: no pay and no rent, so five moments.
    expect(document.querySelectorAll("[data-results-story] li")).toHaveLength(CLOSE_MAX - 1);
    expect(screen.getByText(turnWords("turn.results.news"))).toBeDefined();
  });

  test("[chapter:family-marks-the-grant] given home's send-off answered with the party, or lapsed into dinner, when the story is read, then each is told in the offer's own words for that answer, and an answer with no words of its own stays plain", () => {
    const SEND_OFF = "offer.family-send-off";
    const told = storyLines([
      line("line.offer.taken", { offer: SEND_OFF, choice: "party" }),
      line("line.offer.lapsed", { offer: SEND_OFF, choice: "dinner" }),
      // An answer that moves no quality has no words of its own (the bill paid now tells what came of it, world:month-end-results-sheet).
      line("line.offer.taken", { offer: "offer.recruiter-message", choice: "ignore" }),
    ]);
    expect(told.map((each) => words(each.key, each.params))).toEqual([words(`${SEND_OFF}.said.party`), words(`${SEND_OFF}.said.dinner`)]);
    expect(words(`${SEND_OFF}.said.party`)).toContain("aunties");
  });
});

describe("the adviser's reading and the relative's gift", () => {
  test("[world:month-end-results-sheet] [advice:licensed-adviser-is-truthful] given the adviser's reading beside a way out heard of, when the story is ranked, then her reading leads", () => {
    const told = storyLines([line("line.route.heard", { route: "route.uk-masters" }), line("line.activity.adviser-missing", { route: "route.uk-masters", count: 3, months: 4 })]);
    expect(told[0]?.key).toBe("line.activity.adviser-missing");
  });

  test("[text:show-then-tell] [advice:licensed-adviser-is-truthful] given the adviser read a file in the month, when the results show, then her reading names the route in one line and its conditions are tags with marks, never her sentence", async () => {
    // Ada's recorded life once the master's is known: the adviser is paid now and the month ends. Under decision 0013 the
    // life does its study act by act, so the master's is known after its first 28 commands.
    const game = recordedGame("ada-careful", lifeSaves["ada-careful"]!.commands.length - 28);
    const { lines: now } = game.accept({ type: "activity/now", activity: "activity.see-adviser", param: null });
    game.endTurn();
    const reading = now.find((each) => each.key === "line.activity.adviser-missing");
    if (reading === undefined) throw new Error("The adviser found the file complete on this life.");
    const { store } = await renderWithView(<Results place="Home" />, game.view());
    act(() => store.setState({ reportOpen: true, lastMonthLines: now }));
    const row = document.querySelector("[data-reading='missing']");
    expect(row?.firstElementChild?.textContent).toBe(words("ui.results.reading", { route: reading.params.route! }));
    expect(row?.textContent).not.toContain(words(reading.key, reading.params));
    expect(row?.textContent).not.toMatch(/\./);
    const missing = row?.querySelector("[data-state-tag='missing']");
    expect(missing?.textContent).toBe(say("ui.results.reading.missing", { count: reading.params.count as number }));
    expect(missing?.querySelector("[data-mark]")?.getAttribute("aria-label")).toBe(markWord("failed"));
    const months = row?.querySelector("[data-state-tag='months']");
    expect(months?.textContent).toBe(sayCount("ui.results.reading.months", reading.params.months as number, { count: reading.params.months as number }));
    expect(months?.querySelector("[data-mark]")?.getAttribute("aria-label")).toBe(markWord("waiting"));
  });

  test("[world:month-end-results-sheet] [luck:japa-luck-in-existing-systems] given the relative's gift answered, when the story is read, then the wallet's bare flag line is not told beside the answer's own words", () => {
    const flagged = line("line.wallet.flagged", { amount: { currency: "USD", amount: 50_000 } });
    expect(storyLines([flagged]).map((each) => each.key)).toContain("line.wallet.flagged");
    const told = storyLines([flagged, line("line.offer.taken", { offer: "offer.relative-sends", choice: "take" })]);
    expect(told.some((each) => each.key === "line.wallet.flagged")).toBe(false);
  });

  test("[wallet:cash-pile-warning] [world:month-end-results-sheet] given a month that closes with more naira cash than the warning line, when the results are read, then Mama's warning is told among the month's story, in her words with no figure, as no money line, and is not left for News", () => {
    const game = newGame("scenario.tunde");
    const short = content.tuning.wallet.cashWarnAt + 1 - game.view().pockets.NGN.cash;
    game.accept({ type: "wallet/move", currency: "NGN", amount: short, to: "cash" });
    const { lines } = game.endTurn([]);
    expect(game.view().pockets.NGN.cash).toBeGreaterThan(content.tuning.wallet.cashWarnAt);
    const warning = lines.find((each) => each.key === "line.wallet.cash-warning");
    expect(warning).toMatchObject({ attention: true, params: {} });
    expect(storyLines(lines).map((each) => each.key)).toContain("line.wallet.cash-warning");
    expect(moneyLines(lines).some((each) => each.line.key === "line.wallet.cash-warning")).toBe(false);
    expect(untoldLines(lines).some((each) => each.key === "line.wallet.cash-warning")).toBe(false);
    expect(words("line.wallet.cash-warning", {})).toMatch(/^Mama/);
  });
});
