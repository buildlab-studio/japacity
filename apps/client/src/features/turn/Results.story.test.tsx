// The story lands on the results (docs/rules/world.md R-WORLD-008), played on the real engine: what
// was kept leads, then the month's story (a job found, an offer, a way out heard of), then the money.
// At most six story lines show; the rest of the month stays in News.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { act, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { slot } from "../../../../../packages/sim/src/route/route.journey";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { words } from "../../shared/words/text";
import { kept, moneyLines, STORY_MAX, storyLines, toldOnResults } from "./month.results";
import { Results } from "./Results";
import { turnWords } from "./turn.words";

const TEACHER = "activity.job-teacher";

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"] = "plain"): ReportLine {
  return { key, params, tone, attention: false, counts: [] };
}

describe("the month's story on the results", () => {
  test("[R-WORLD-008] given Ada's first month hunting for work, when the results show, then the job found stands under This month as one offer, after what was kept and before the money", async () => {
    const game = newGame("scenario.ada");
    const { lines } = game.endTurn([slot("activity.job-hunt", TEACHER)]);
    const hired = lines.find((each) => each.key === "line.activity.hunt-hired");
    const offer = lines.find((each) => each.key === "line.offer.opened");
    if (hired === undefined || offer === undefined) throw new Error("The hunt found no job on this seed.");
    const { store } = await renderWithView(<Results place="Home" />, game.view());
    act(() => store.setState({ reportOpen: true }));
    const story = document.querySelector("[data-results-story]");
    expect(story?.querySelector("h3")?.textContent).toBe(turnWords("turn.results.story"));
    const told = [...(story?.querySelectorAll("li") ?? [])].map((row) => row.textContent);
    // The job found is told as the results tell it: an offer, with its pay a month.
    const found = toldOnResults(hired);
    expect(told).toContain(words(found.key, found.params));
    // One line for an offer: the offer it opens is not told again.
    expect(told).not.toContain(words(offer.key, offer.params));
    expect(told.filter((row) => row === words(found.key, found.params))).toHaveLength(1);
    // Kept first, then the story, then the money.
    const order = [...document.querySelectorAll("[data-results-kept], [data-results-story], [data-results-lines]")].map((node) => (node.hasAttribute("data-results-kept") ? "kept" : node.hasAttribute("data-results-story") ? "story" : "money"));
    expect(order).toEqual(["kept", "story", "money"]);
    // The money count is still only money that moved.
    expect(document.querySelector("[data-results-kept]")?.getAttribute("data-results-kept")).toBe(String(kept(moneyLines(lines)).find((net) => net.currency === "NGN")?.amount ?? 0));
  });

  test("[R-WORLD-008] given a way out heard of in the month, when the story is read, then it is told, and money and plain news are not", () => {
    const game = newGame("scenario.ada");
    game.endTurn();
    // On this seed the news brings the UK master's in the second month.
    const { lines } = game.endTurn();
    expect(lines.some((each) => each.key === "line.route.heard")).toBe(true);
    const keys = storyLines(lines).map((each) => each.key);
    expect(keys).toContain("line.route.heard");
    expect(keys.some((key) => key.startsWith("line.wallet.") || key.startsWith("line.quality."))).toBe(false);
  });

  test("[R-WORLD-008] given a paper ready, a test band and a deposit that will be asked about, when the story is read, then each is told", () => {
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

  test("[R-WORLD-008] given more story than fits, when the results show, then six lines stand, offers and ways out first, and the rest is left to News", async () => {
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
    expect(document.querySelectorAll("[data-results-story] li")).toHaveLength(STORY_MAX);
    expect(screen.getByText(turnWords("turn.results.news"))).toBeDefined();
  });

  test("[R-CHAPTER-008] given home's send-off answered with the party, or lapsed into dinner, when the story is read, then each is told in the offer's own words for that answer, and an answer with no words of its own stays plain", () => {
    const SEND_OFF = "offer.family-send-off";
    const told = storyLines([
      line("line.offer.taken", { offer: SEND_OFF, choice: "party" }),
      line("line.offer.lapsed", { offer: SEND_OFF, choice: "dinner" }),
      line("line.offer.taken", { offer: "offer.nepa-bill", choice: "pay" }),
    ]);
    expect(told.map((each) => words(each.key, each.params))).toEqual([words(`${SEND_OFF}.said.party`), words(`${SEND_OFF}.said.dinner`)]);
    expect(words(`${SEND_OFF}.said.party`)).toContain("aunties");
  });
});

describe("the adviser's reading and the relative's gift", () => {
  test("[R-WORLD-008] [R-ADVICE-004] given the adviser's reading beside a way out heard of, when the story is ranked, then her reading leads", () => {
    const told = storyLines([line("line.route.heard", { route: "route.uk-masters" }), line("line.activity.adviser-missing", { route: "route.uk-masters", count: 3, months: 4 })]);
    expect(told[0]?.key).toBe("line.activity.adviser-missing");
  });

  test("[R-WORLD-008] [R-LUCK-010] given the relative's gift answered, when the story is read, then the wallet's bare flag line is not told beside the answer's own words", () => {
    const flagged = line("line.wallet.flagged", { amount: { currency: "USD", amount: 50_000 } });
    expect(storyLines([flagged]).map((each) => each.key)).toContain("line.wallet.flagged");
    const told = storyLines([flagged, line("line.offer.taken", { offer: "offer.relative-sends", choice: "take" })]);
    expect(told.some((each) => each.key === "line.wallet.flagged")).toBe(false);
  });
});
