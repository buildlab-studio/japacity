// One figure across the screens: what the results say against the board, the
// Bank and News, beside the shell since each assertion reads two features (tests/boundaries.test.ts). Played on the
// real engine from the tiles' own years.
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Bank } from "../features/phone/apps/Bank";
import { phoneWords } from "../features/phone/phone.words";
import { savings } from "../features/turn/month.results";
import { Results } from "../features/turn/Results";
import { type Archetype, answersInOrder, archetypeOf, presetAnswer } from "../shared/frontdoor/archetypes";
import { newGame } from "../shared/testing/fixtures";
import { renderWithView } from "../shared/testing/render";
import { formatMoney } from "../shared/words/format";
import { words } from "../shared/words/text";
import { newsLines, toldOnResults } from "../shared/words/told";

const HUNT = "activity.job-hunt";
const JUNIOR_DEV = "activity.job-junior-dev";
const TALENT = "route.uk-talent";

/** A tile's life from sixteen, handed over: its preset played on one seed. */
function lifeOf(tile: Archetype, seed: string): ReturnType<typeof newGame> {
  const game = newGame("scenario.prologue", seed);
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = presetAnswer(tile, prologue) ?? answersInOrder(tile, prologue.step, prologue.answers).find((one) => one.allowed)?.id;
    if (answer === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  return game;
}

/** The developer tile's life, handed over. */
function developer(): ReturnType<typeof newGame> {
  return lifeOf(archetypeOf("developer")!, "developer-0");
}

describe("Saved for the move on the results and the Bank", () => {
  test("[R-WORLD-019] given the developer who hears of the talent visa at the meetup in his first month, when the month's results and the Bank are read before the official page, then both say the same figure toward the move", async () => {
    const game = developer();
    game.accept({ type: "activity/now", activity: "activity.meetup", param: null });
    game.endTurn([]);
    const view = game.view();
    expect(view.plan.route).toBe(TALENT);
    expect(view.routes.find((route) => route.id === TALENT)?.state).toBe("heard");
    const shown = savings(view);
    if (shown === null || shown.kind !== "funds") throw new Error("The results show no figure toward the move.");
    await renderWithView(<Bank />, view);
    expect(document.querySelector("[data-savings-none]")).toBeNull();
    expect(document.querySelector("[data-savings]")?.textContent).toContain(phoneWords("phone.bank.savings.line", { shown: formatMoney(shown.shown, shown.currency), required: formatMoney(shown.required, shown.currency) }));
  });
});

describe("the sure first hunt that lands another job", () => {
  test("[R-ACTIVITY-005] [R-WORLD-008] given the developer's application for the junior developer's job with the month full, when the draw misses, then the results and News say the junior developer's job came to nothing before the offer the sure hunt landed", async () => {
    const tile = archetypeOf("developer")!;
    // The first seed of a handful whose draw misses: the sure hunt then lands customer service.
    for (let at = 0; at < 12; at += 1) {
      const game = lifeOf(tile, `z1-${String(at)}`);
      game.accept({ type: "activity/now", activity: HUNT, param: JUNIOR_DEV });
      const met = game.accept({ type: "activity/now", activity: "activity.meetup", param: null });
      const ended = game.endTurn([
        { activity: "activity.build-portfolio", param: null },
        { activity: "activity.open-source", param: null },
      ]);
      const hunts = ended.lines.filter((line) => line.key.startsWith("line.activity.hunt-"));
      if (hunts[0]?.params["job"] === JUNIOR_DEV && hunts[0].key === "line.activity.hunt-hired") continue;
      const view = game.view();
      expect(hunts.map((line) => [line.key, line.params["job"]])).toEqual([
        ["line.activity.hunt-missed", JUNIOR_DEV],
        ["line.activity.hunt-hired", "activity.job-customer-service"],
      ]);
      const missed = toldOnResults(hunts[0]!, view);
      const offered = toldOnResults(hunts[1]!, view);
      expect(words(missed.key, missed.params)).toBe("Junior developer: not this time.");
      expect(words(offered.key, offered.params)).toMatch(/^An offer: Customer service agent, /);
      const { store } = await renderWithView(<Results place="Yaba" />, view);
      act(() => store.setState({ reportOpen: true }));
      const told = [...document.querySelectorAll("[data-results-story] li")].map((row) => row.textContent ?? "");
      const said = [words(missed.key, missed.params), words(offered.key, offered.params)];
      expect(said.map((one) => told.indexOf(one))).toEqual([told.indexOf(said[0]!), told.indexOf(said[0]!) + 1]);
      expect(told.indexOf(said[0]!)).toBeGreaterThanOrEqual(0);
      const news = newsLines(met.lines, view.report?.lines ?? [], view).map((line) => words(line.key, line.params));
      expect(news).toEqual(expect.arrayContaining(said));
      return;
    }
    throw new Error("Every draw landed the junior developer's job in twelve seeds.");
  });
});
