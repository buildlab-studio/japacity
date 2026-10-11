// The board's pick and the hunt's answer (docs/rules/activity.md R-ACTIVITY-005 as amended 11 Oct 2026; world.md
// R-WORLD-008): the developer's board opened on customer service every month, and
// the developer who applied for the junior developer's job with the month full was offered customer service and told
// nothing of the job asked for. The board opens on the life's own trade, and a sure first hunt that lands another job
// says first that the one asked for came to nothing. Played on the real engine from the tiles' own years.
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { type Archetype, answersInOrder, archetypeOf, presetAnswer } from "../../shared/frontdoor/archetypes";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { words } from "../../shared/words/text";
import { newsLines, toldOnResults } from "../../shared/words/told";
import { Results } from "../turn/Results";
import { ActivityPicker } from "./ActivityView";
import { firstJob, huntOrder } from "./JobList";

const HUNT = "activity.job-hunt";
const JUNIOR_DEV = "activity.job-junior-dev";

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

function checkedRow(): string | null {
  return [...document.querySelectorAll("[role='radio'][data-job]")].find((row) => row.getAttribute("aria-checked") === "true")?.getAttribute("data-job") ?? null;
}

describe("the board opens on the life's own trade", () => {
  test("[R-ACTIVITY-005] given the developer tile's first month, when the jobs board opens, then the junior developer's row is the one chosen, though customer service is listed first as the likelier", async () => {
    const view = lifeOf(archetypeOf("developer")!, "s4-developer").view();
    const listed = view.activities.find((option) => option.id === HUNT)?.params ?? [];
    const ordered = huntOrder(view, listed);
    expect(ordered[0]).toBe("activity.job-customer-service");
    expect(ordered).toContain(JUNIOR_DEV);
    expect(firstJob(view, ordered)).toBe(JUNIOR_DEV);
    await renderWithView(<ActivityPicker only={[HUNT]} />, view);
    expect(checkedRow()).toBe(JUNIOR_DEV);
  });

  test("[R-ACTIVITY-005] given a life with no trade the board lists (the shop worker's), when the board opens, then the first row is the one chosen, as before", async () => {
    const view = lifeOf(archetypeOf("shop-worker")!, "s4-shop").view();
    const ordered = huntOrder(view, view.activities.find((option) => option.id === HUNT)?.params ?? []);
    expect(ordered.length).toBeGreaterThan(0);
    expect(firstJob(view, ordered)).toBe(ordered[0]);
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
