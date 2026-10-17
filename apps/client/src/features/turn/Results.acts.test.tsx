// What the waiting months' acts came to, on the results the month it happens (docs/rules/world.md
// R-WORLD-008, docs/rules/activity.md R-ACTIVITY-013), played on the real engine
// and the real content: the exam's score and what a pass needs, a piece for the portfolio, open
// source's first merge and its quiet months, the raise with what it adds and the month nobody said
// anything. Each is told with the month's story, as a hunt's "not this time" is.
import { content } from "@japacity/content";
import type { Id, ReportLine } from "@japacity/sim";
import { int } from "@japacity/sim";
import type { Game } from "@japacity/sim/testing";
import { draw, slot } from "@japacity/sim/testing";
import { act, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import { gameAuthority, newGame } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { countWords } from "../../shared/words/count";
import { formatMoney } from "../../shared/words/format";
import { words } from "../../shared/words/text";
import { STORY_MAX, storyLines } from "./month.results";
import { Results } from "./Results";

const CERTIFY: Id<"activity"> = "activity.nurse-certification";
const BUILD: Id<"activity"> = "activity.build-portfolio";
const OPEN_SOURCE: Id<"activity"> = "activity.open-source";
const NOTICED: Id<"activity"> = "activity.be-noticed";
const EXAM = "setpiece.nurse-exam";
const PORTFOLIO = "quality.portfolio";

/** The most pieces any route's checklist asks for: what a piece is counted toward. */
function piecesAsked(): number {
  const asked = Object.values(content.route)
    .flatMap((route) => route?.checklist ?? [])
    .flatMap((item) => (item.requirement.type === "quality/min" && item.requirement.quality === PORTFOLIO ? [item.requirement.value] : []));
  return Math.max(...asked);
}

async function storeOf(game: Game): Promise<GameStore> {
  const store = createGameStore(gameAuthority(game));
  await store.getState().refresh();
  return store;
}

/**
 * One month through the store as the Month sheet sends it: these acts planned, the rest rest. `now`: acts done at once
 * within the month before it turns (decision 0035, R-ACTIVITY-019), each sent as the act's sheet sends it.
 */
async function month(store: GameStore, game: Game, picks: Id<"activity">[] = [], now: Id<"activity">[] = []): Promise<void> {
  if (game.state.turn.banked < 1) game.grant(1);
  await store.getState().refresh();
  // Each month here is its own plan: what was started last month carries on (R-WORLD-007), so it is cleared first.
  act(() => store.getState().clearPlan());
  for (const pick of picks) expect(store.getState().addToPlan(slot(pick))).toBe(true);
  for (const activity of now) {
    await act(async () => {
      const reply = await store.getState().send({ type: "activity/now", activity, param: null });
      expect(reply?.ok).toBe(true);
    });
  }
  await act(async () => {
    await store.getState().endMonth();
  });
  act(() => store.setState({ moments: [], reportOpen: true }));
}

/** The results of the month just ended, and their story rows as they read. */
function results(store: GameStore): string[] {
  const { unmount } = render(
    <GameProvider store={store}>
      <Results place="Yaba" />
    </GameProvider>,
  );
  const rows = [...document.querySelectorAll("[data-results-story] li")].map((row) => row.textContent ?? "");
  unmount();
  return rows;
}

/** A seed whose first draw on the job stream lands under the raise's chance (or over it, with `hit` false). */
function seedFor(hit: boolean): string {
  const chance = content.tuning.activity.raiseChanceBp;
  for (let n = 0; n < 200; n += 1) {
    const seed = `notice-${String(n)}`;
    if (draw(seed, "job", 0, 10000) < chance === hit) return seed;
  }
  throw new Error("No seed found.");
}

describe("the certification exam on the results", () => {
  /** Ngozi sits the exam, answers each question right or wrong as given, and ends the month. */
  async function sat(right: boolean[]): Promise<string[]> {
    const game = newGame("scenario.ngozi");
    const store = await storeOf(game);
    await month(store, game, [CERTIFY]);
    const exam = content.setpiece[EXAM]!;
    for (const [index, correct] of right.entries()) {
      const question = store.getState().view?.setpiece?.question;
      if (question === undefined || question === null) throw new Error("No question is open.");
      const answer = exam.questions[index]!.answers.find((each) => each.score > 0 === correct)!;
      await act(async () => {
        await store.getState().send({ type: "setpiece/answer", question: question.id, answer: answer.id });
      });
    }
    expect(store.getState().view?.setpiece).toBeNull();
    await month(store, game);
    return results(store);
  }

  test("[R-WORLD-008] [R-ACTIVITY-013] given the nurse gets one of three right, when the month's results open, then they say her score and what a pass needs, not only that the exam is over", async () => {
    const pass = content.activity[CERTIFY]!.exam!.pass;
    const rows = await sat([true, false, false]);
    expect(rows).toContain(words("line.activity.exam-failed", { right: countWords(1), asked: countWords(3), pass: countWords(pass) }));
    expect(rows).not.toContain(words("line.setpiece.closed", { setpiece: EXAM }));
  });

  test("[R-WORLD-008] [R-ACTIVITY-013] given the nurse gets two of three right, when the month's results open, then they say she passed, with her score", async () => {
    const rows = await sat([true, false, true]);
    expect(rows).toContain(words("line.activity.exam-passed", { right: countWords(2), asked: countWords(3) }));
    expect(rows).not.toContain(words("line.setpiece.closed", { setpiece: EXAM }));
  });
});

describe("the developer's months on the results", () => {
  test("[R-WORLD-008] [R-ACTIVITY-013] given a developer one piece short of what a route asks, when she builds something and then builds again, then each month's results tell the piece, the first how many of what is asked", async () => {
    const game = newGame("scenario.zainab");
    const need = piecesAsked();
    expect(game.state.quality[PORTFOLIO]).toBe(need - 1);
    const store = await storeOf(game);
    // Decision 0035 (R-ACTIVITY-019): the portfolio is built act by act, at once, and the month's results tell the piece
    // with the month's own lines.
    await month(store, game, [], [BUILD]);
    expect(results(store)).toContain(words("line.activity.piece-built", { pieces: countWords(need), need: countWords(need) }));
    await month(store, game, [], [BUILD]);
    const more = results(store);
    expect(more).toContain(words("line.activity.piece-built-more", { pieces: countWords(need + 1) }));
    expect(more.some((row) => row.startsWith(words("line.activity.piece-built", { pieces: "", need: "" }).split(":")[0]!))).toBe(false);
  });

  test("[R-WORLD-008] [R-ACTIVITY-013] given a developer on open source, when three months are played, then the results tell the first merge, then the piece, then the quiet month of fixes", async () => {
    const game = newGame("scenario.zainab");
    const need = piecesAsked();
    const store = await storeOf(game);
    await month(store, game, [OPEN_SOURCE]);
    expect(results(store)).toContain(words("line.activity.first-merged"));
    await month(store, game, [OPEN_SOURCE]);
    const second = results(store);
    expect(second).toContain(words("line.activity.piece-built", { pieces: countWords(need), need: countWords(need) }));
    expect(second).not.toContain(words("line.activity.first-merged"));
    await month(store, game, [OPEN_SOURCE]);
    const third = results(store);
    expect(third).toContain(words("line.activity.contributed"));
    expect(third).not.toContain(words("line.activity.first-merged"));
  });

  test("[R-WORLD-008] [R-ACTIVITY-013] given a piece under, at and over what a route asks, when the story is read, then the first two say how many of what is asked and the last how many there are", () => {
    const need = piecesAsked();
    const gain = (value: number): ReportLine => ({ key: "line.quality.gain", params: { quality: PORTFOLIO, points: 1, value }, tone: "good", attention: false, counts: [] });
    expect(storyLines([gain(1)])).toEqual([expect.objectContaining({ key: "line.activity.piece-built", params: { pieces: 1, need } })]);
    expect(storyLines([gain(need)])).toEqual([expect.objectContaining({ key: "line.activity.piece-built", params: { pieces: need, need } })]);
    expect(storyLines([gain(need + 1)])).toEqual([expect.objectContaining({ key: "line.activity.piece-built-more", params: { pieces: need + 1 } })]);
    // Any other skill rising stays in News.
    expect(storyLines([{ ...gain(50), params: { quality: "quality.tech", points: 1, value: 50 } }])).toEqual([]);
  });
});

describe("being noticed at work on the results", () => {
  test("[R-WORLD-008] [R-ACTIVITY-013] given the raise lands, when the month's results open, then they say the manager noticed and what it adds a month", async () => {
    const game = newGame("scenario.tunde", seedFor(true));
    const job = game.state.activity.job!;
    const pay = content.activity[job]!.pay!;
    if (typeof pay.amount !== "number") throw new Error("A fixed pay was expected.");
    const rise = int.bp(pay.amount, content.tuning.activity.raiseBp);
    const store = await storeOf(game);
    await month(store, game, [NOTICED]);
    const said = words("line.activity.raised", { job, amount: { currency: pay.currency, amount: pay.amount + rise }, rise: { currency: pay.currency, amount: rise } });
    expect(said).toContain(formatMoney(rise, pay.currency));
    expect(results(store)).toContain(said);
  });

  test("[R-WORLD-008] [R-ACTIVITY-013] given a month at work tried without the raise, when the month's results open, then they say nobody has said anything yet", async () => {
    const game = newGame("scenario.tunde", seedFor(false));
    const job = game.state.activity.job!;
    const store = await storeOf(game);
    await month(store, game, [NOTICED]);
    expect(results(store)).toContain(words("line.activity.not-noticed", { job }));
  });

  test("[R-WORLD-008] given a full month of story, when an act's outcome is ranked, then it stands with the hunt's answer, before the way out heard of and the chores", () => {
    const plain = (key: string, params: ReportLine["params"] = {}): ReportLine => ({ key, params, tone: "plain", attention: false, counts: [] });
    const routes = Object.keys(content.route).slice(0, STORY_MAX);
    const told = storyLines([plain("line.obligation.relief.cooked"), ...routes.map((route) => plain("line.route.heard", { route })), plain("line.activity.not-noticed", { job: "activity.job-bank-officer" })]);
    expect(told[0]?.key).toBe("line.activity.not-noticed");
    expect(told.some((line) => line.key === "line.obligation.relief.cooked")).toBe(false);
  });
});

describe("the cash warning in a full month", () => {
  test("[R-WALLET-019] given more story lines than the results hold, when the month closed with the cash warning, then the warning is still told", () => {
    const busy: ReportLine[] = Array.from({ length: 9 }, (_unused, index) => ({ key: `line.route.heard-${String(index)}`, params: {}, tone: "plain", attention: false, counts: [] }));
    const warning: ReportLine = { key: "line.wallet.cash-warning", params: {}, tone: "plain", attention: true, counts: [] };
    const told = storyLines([...busy, warning]);
    expect(told.map((line) => line.key)).toContain("line.wallet.cash-warning");
  });
});
