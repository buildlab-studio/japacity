// What the results tell of the talk and of a paper running out (docs/rules/world.md R-WORLD-008; the thirteenth
// review). Z8: "The talk is over." said nothing of how it went or what it counted for. Z10: the TB
// certificate ran out unseen seven months after it was taken, ₦120,000 gone. Played on the real engine and content.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { act, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { slot } from "../../../../../packages/sim/src/route/route.journey";
import type { Game } from "../../../../../packages/sim/src/testing/play";
import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import { gameAuthority, newGame } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { inMonths, runningName, say, words } from "../../shared/words/text";
import { runningOut } from "./month.results";
import { Results } from "./Results";

const TALK: Id<"activity"> = "activity.conference-talk";
const TALK_PIECE = "setpiece.conference-talk";
const MEETUP: Id<"activity"> = "activity.meetup";
const TB: Id<"activity"> = "activity.tb-test";
const TB_PAPER = "document.tb-certificate";
const CARE = "route.uk-care";

async function storeOf(game: Game): Promise<GameStore> {
  const store = createGameStore(gameAuthority(game));
  await store.getState().refresh();
  return store;
}

/** One month through the store as the Month sheet sends it: these acts planned, the rest rest. */
async function month(store: GameStore, game: Game, picks: Id<"activity">[] = []): Promise<void> {
  if (game.state.turn.banked < 1) game.grant(1);
  await store.getState().refresh();
  act(() => store.getState().clearPlan());
  for (const pick of picks) expect(store.getState().addToPlan(slot(pick))).toBe(true);
  await act(async () => {
    await store.getState().endMonth();
  });
  act(() => store.setState({ moments: [], reportOpen: true }));
}

/** A now-act done at once (R-ACTIVITY-015): the meetup, a paper's request. */
async function now(store: GameStore, activity: Id<"activity">, param: string | null = null): Promise<void> {
  await act(async () => {
    const reply = await store.getState().send({ type: "activity/now", activity, param });
    expect(reply?.ok).toBe(true);
  });
}

/** The results of the month just ended: the story rows, and the lines on papers running out. */
function results(store: GameStore): { story: string[]; runsOut: string[] } {
  const { unmount } = render(
    <GameProvider store={store}>
      <Results place="Yaba" />
    </GameProvider>,
  );
  const story = [...document.querySelectorAll("[data-results-story] li")].map((row) => row.textContent ?? "");
  const runsOut = [...document.querySelectorAll("[data-results-runs-out]")].map((row) => row.textContent ?? "");
  unmount();
  return { story, runsOut };
}

describe("how the talk went", () => {
  /** Zainab meets people until the talk is open to her, gives it, opens with `answer` and ends the month. */
  async function gave(answer: string): Promise<string[]> {
    const game = newGame("scenario.zainab");
    const store = await storeOf(game);
    for (let months = 0; months < 4 && store.getState().view?.activities.find((option) => option.id === TALK)?.allowed !== true; months += 1) {
      await now(store, MEETUP);
      await month(store, game);
    }
    await month(store, game, [TALK]);
    const question = store.getState().view?.setpiece?.question;
    if (question === undefined || question === null) throw new Error("The talk's question is not open.");
    await act(async () => {
      await store.getState().send({ type: "setpiece/answer", question: question.id, answer });
    });
    expect(store.getState().view?.setpiece).toBeNull();
    await month(store, game);
    return results(store).story;
  }

  test("[R-ACTIVITY-013] [R-WORLD-008] given the talk opened with the code run live, when the month's results open, then they say it went well and what it counted for, not only that it is over", async () => {
    const rows = await gave("demo");
    expect(rows).toContain(say("line.activity.exam-passed.activity.conference-talk"));
    expect(say("line.activity.exam-passed.activity.conference-talk")).toMatch(/went well.*counts toward the endorsement's letters/);
    expect(rows).not.toContain(words("line.setpiece.closed", { setpiece: TALK_PIECE }));
  });

  test("[R-ACTIVITY-013] [R-WORLD-008] given the talk read off the slides, when the month's results open, then they say it fell flat, and what it still counted for", async () => {
    const rows = await gave("slides");
    expect(rows).toContain(say("line.activity.exam-failed.activity.conference-talk"));
    expect(say("line.activity.exam-failed.activity.conference-talk")).toMatch(/fell flat.*counts toward the endorsement's letters/);
    expect(rows.join(" ")).not.toMatch(/\bexam\b|\d/);
  });

  test("[R-ACTIVITY-013] given the talk's answers, when they are read from content, then the live code and the story hold the room and the slides do not", () => {
    const answers = content.setpiece[TALK_PIECE]!.questions[0]!.answers;
    expect(Object.fromEntries(answers.map((answer) => [answer.id, answer.score]))).toEqual({ demo: 1, story: 1, slides: 0 });
    expect(content.activity[TALK]!.exam).toEqual({ setpiece: TALK_PIECE, pass: 1, effects: [] });
  });
});

describe("a paper running out before the application", () => {
  test("[R-DOCUMENT-004] [R-WORLD-008] given the ready nurse with care work her plan and a TB certificate taken early, when it is two months and then one from running out, then the results say so in one line each month; a paper of no use to her plan is never warned of", async () => {
    const game = newGame("scenario.ngozi");
    const store = await storeOf(game);
    for (let months = 0; months < 6 && (game.state.route[CARE]?.state ?? "unknown") === "unknown"; months += 1) {
      await now(store, MEETUP);
      await month(store, game);
    }
    await now(store, "activity.look-into-route", CARE);
    expect(store.getState().view?.plan.route).toBe(CARE);
    await now(store, TB);
    await month(store, game);
    const issued = store.getState().view!.documents.find((paper) => paper.id === TB_PAPER)!;
    expect(issued.state).toBe("held");
    const validity = content.document[TB_PAPER]!.validMonths!;
    expect(issued.expiresMonth! - store.getState().view!.month).toBeGreaterThan(2);
    expect(results(store).runsOut).toEqual([]);
    while (issued.expiresMonth! - store.getState().view!.month > 2) await month(store, game);
    const two = store.getState().view!;
    expect(results(store).runsOut).toEqual([say("document.reminder.runs-out", { document: runningName(TB_PAPER), when: inMonths(issued.expiresMonth!, two.month) })]);
    expect(results(store).runsOut[0]).toBe("Your TB test certificate runs out in 2 months.");
    await month(store, game);
    expect(results(store).runsOut).toEqual(["Your TB test certificate runs out next month."]);
    expect(validity).toBe(6);
    // Her plan sent, nothing is warned of; a paper no step of her plan reads is never warned of.
    const view = store.getState().view!;
    expect(runningOut({ ...view, routes: view.routes.map((route) => (route.id === CARE ? { ...route, state: "applying" as const } : route)) })).toEqual([]);
    expect(runningOut({ ...view, plan: { ...view.plan, route: "route.gulf-contract" }, routes: view.routes.map((route) => (route.id === "route.gulf-contract" ? { ...route, state: "known" as const } : route)) })).toEqual([]);
  });
});
