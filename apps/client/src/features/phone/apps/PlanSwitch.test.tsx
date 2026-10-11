// A way out's page with the switch (docs/rules/chapter.md R-CHAPTER-009): on another way's page, what making
// it the plan does to japacity, Keep mine, and Make this the plan, which looks into it when only heard of
// and records the choice the chapters follow from the next close.
import { text } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { slot } from "../../../../../../packages/sim/src/route/route.journey";
import type { Game } from "../../../../../../packages/sim/src/testing/play";
import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../../authority/store";
import { gameAuthority, newGame } from "../../../shared/testing/fixtures";
import "../../../shared/testing/render";
import { say } from "../../../shared/words/text";
import { RoutePage, switchOf } from "./PlanSwitch";

const UK: Id<"route"> = "route.uk-masters";
const CARE: Id<"route"> = "route.uk-care";
const LOOK = "activity.look-into-route";

/** The nurse who has heard of the master's and of care work, and has read the care page. */
function nurseOnCare(): Game {
  const game = newGame("scenario.ngozi");
  for (let month = 0; month < 8 && game.state.route[CARE]?.state === "unknown"; month += 1) game.endTurn();
  game.endTurn([slot(LOOK, CARE)]);
  if (game.state.route[UK]?.state !== "heard") throw new Error("The nurse has not heard of the master's.");
  return game;
}

/** The page over the real engine, so the switch's command lands as the game would take it. */
async function showPage(game: Game, route: Id<"route">, onClose: () => void = () => undefined): Promise<{ store: GameStore; sent: { type: string }[] }> {
  const authority = gameAuthority(game);
  const store = createGameStore(authority);
  await store.getState().refresh();
  render(
    <GameProvider store={store}>
      <RoutePage route={route} onClose={onClose} />
    </GameProvider>,
  );
  return { store, sent: authority.sent };
}

function percentOf(game: Game, route: Id<"route">): number {
  const way = game.view().plan.ways.find((each) => each.route === route);
  if (way === undefined) throw new Error(`${route} is not a way in the view.`);
  return way.percent;
}

describe("the switch on another way's page", () => {
  test("[R-CHAPTER-009] given the nurse on care, when the master's page is read, then the switch says the fall in japacity against care work, with Keep mine and Make this the plan", async () => {
    const game = nurseOnCare();
    const change = percentOf(game, UK) - percentOf(game, CARE);
    expect(change).toBeLessThan(0);
    expect(switchOf(game.view(), UK)).toEqual({ plan: CARE, change });
    await showPage(game, UK);
    const block = document.querySelector("[data-plan-switch]");
    expect(block?.getAttribute("data-plan-switch")).toBe(UK);
    expect(block?.textContent).toContain(say("route.plan.instead", { plan: "care work", change: `-${String(-change)}` }));
    expect(block?.querySelector("[data-plan-keep]")?.textContent).toBe("Keep mine");
    expect(block?.querySelector("[data-plan-make]")?.textContent).toBe("Make this the plan");
  });

  test("[R-CHAPTER-009] given the plan's own page, when it is read, then it says this is your plan and offers no switch", async () => {
    const game = nurseOnCare();
    expect(switchOf(game.view(), CARE)).toBeNull();
    await showPage(game, CARE);
    expect(document.querySelector("[data-plan-switch]")).toBeNull();
    expect(document.querySelector("[data-plan-mine]")?.textContent).toContain(say("route.plan.mine"));
  });

  test("[R-CHAPTER-009] given the switch, when Keep mine is tapped, then the page closes and nothing is sent", async () => {
    const game = nurseOnCare();
    let closed = 0;
    const { sent } = await showPage(game, UK, () => (closed += 1));
    fireEvent.click(document.querySelector<HTMLElement>("[data-plan-keep]")!);
    expect(closed).toBe(1);
    expect(sent).toEqual([]);
  });

  test("[R-CHAPTER-009] [R-ACTIVITY-015] given the master's only heard of, when Make this the plan is tapped, then the lean moves to the master's, its page is read at once, and the page says it is the plan", async () => {
    const game = nurseOnCare();
    const { store, sent } = await showPage(game, UK);
    await act(async () => {
      fireEvent.click(document.querySelector<HTMLElement>("[data-plan-make]")!);
      // The command's reply, then the page planned after it.
      await new Promise((settle) => setTimeout(settle, 0));
    });
    // the official page is read now, never planned, so its command follows the lean.
    expect(sent.map((command) => command.type)).toEqual(["chapter/lean", "activity/now"]);
    expect(sent.at(-1)).toMatchObject({ activity: LOOK, param: UK });
    expect(game.state.chapter.chosen).toBe(UK);
    expect(store.getState().view?.plan.route).toBe(UK);
    expect(store.getState().plan).not.toContainEqual({ activity: LOOK, param: UK });
    expect(document.querySelector("[data-plan-switch]")).toBeNull();
    expect(document.querySelector("[data-plan-mine]")?.textContent).toContain(say("route.plan.mine"));
    // The care page is now the other way, and says the rise back.
    expect(switchOf(store.getState().view!, CARE)).toEqual({ plan: UK, change: percentOf(game, CARE) - percentOf(game, UK) });
  });

  test("[R-CHAPTER-009] given a way with the same figure as the plan, when its switch is read, then it says the same japacity, not a sign on nought", () => {
    const game = nurseOnCare();
    const view = game.view();
    const same = { ...view, plan: { ...view.plan, ways: view.plan.ways.map((way) => ({ ...way, percent: 30 })) } };
    expect(switchOf(same, UK)).toEqual({ plan: CARE, change: 0 });
    expect(say("route.plan.same", { plan: "care work" })).toBe("Instead of care work: the same japacity");
  });

  test("[R-CHAPTER-009] given the switch's words and each way's short name, when they are read, then a person says them: no exclamation mark, no dash", () => {
    const keys = Object.keys(text).filter((key) => key.startsWith("route.plan.") || key.endsWith(".short") || /^route\.[\w-]+\.file$/.test(key));
    expect(keys.length).toBeGreaterThanOrEqual(15);
    for (const key of keys) expect(text[key]).not.toMatch(/[!\u2013\u2014]/);
    expect([UK, CARE, "route.uk-talent", "route.canada-points", "route.gulf-contract"].map((id) => text[`${id}.short`])).toEqual(["the master's", "care work", "the talent visa", "the points", "the Gulf"]);
  });
});
