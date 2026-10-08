// Life goals: docs/rules/goal.md R-GOAL-001 to 003, on Ada's recorded life
// carried on abroad and home again.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { checkInvariants } from "../engine/invariants";
import type { Accepted, BaseEvent, Effect, Id, ReportLine, State } from "../engine/types";
import { registry } from "../kinds";
import { applyEffects } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { answerOpen, flownAda, monthAbroad, playUntil, SECURE } from "./goal.journey";
import { goalKind } from "./goal.logic";

const WELLBEING: Id<"quality"> = "quality.wellbeing";
const STANDING: Id<"quality"> = "quality.standing";
const POUNDS = 100;

function goalLines(result: Accepted): ReportLine[] {
  return result.lines.filter((line) => line.key.startsWith("line.goal."));
}

function goalEvents(result: { events: BaseEvent[] }): BaseEvent[] {
  return result.events.filter((event) => event.type.startsWith("goal/"));
}

function rewardOf(result: { events: BaseEvent[] }, goal: Id<"goal">): [string, number][] {
  return result.events
    .filter((event) => event.type === "quality/changed" && (event as unknown as { source: string }).source === goal)
    .map((event) => {
      const change = event as unknown as { quality: string; amount: number };
      return [change.quality, change.amount];
    });
}

function isOpen(game: Game, goal: Id<"goal">): boolean {
  return game.state.goal.open[goal] !== undefined;
}

function isDone(game: Game, goal: Id<"goal">): boolean {
  return game.state.goal.done[goal] !== undefined;
}

function monthsAbroad(game: Game): number {
  return game.state.turn.month - game.state.place.movedMonth;
}

/**
 * Ada flown, with pounds enough that her rent never misses and her standing
 * and wellbeing brought down from the top so a reward shows in full, and her
 * first month abroad played, its December scene answered.
 */
function landed(): Game {
  const game = flownAda(content);
  applyEffects(game, [
    { type: "money/add", currency: "GBP", pocket: "bank", amount: 2000000 * POUNDS, reason: "gift" },
    { type: "quality/add", quality: STANDING, amount: -40 },
    { type: "quality/add", quality: WELLBEING, amount: -40 },
  ]);
  monthAbroad(game);
  answerOpen(game);
  return game;
}

/** Plays months abroad until the goal opens, and returns that month's result. */
function untilOpen(game: Game, goal: Id<"goal">, most = 24): Accepted {
  for (let month = 0; month < most; month += 1) {
    const result = monthAbroad(game);
    if (isOpen(game, goal) || isDone(game, goal)) return result;
  }
  throw new Error(`${goal} did not open in ${String(most)} months.`);
}

/** Applies the effects and plays the month; the goal phase runs at its end. */
function thenMonth(game: Game, effects: Effect[]): Accepted {
  if (effects.length > 0) applyEffects(game, effects);
  return monthAbroad(game);
}

/** Ada flown and home again by choice, the fare paid from a gift of pounds. */
function homeByChoice(): Game {
  const game = landed();
  game.accept({ type: "return/home" });
  expect(game.state.place.returns.map((back) => back.shape)).toEqual(["by-choice"]);
  return game;
}

describe("goals open and are done in the chapter phase", () => {
  test("[R-GOAL-001] given Ada abroad, when her sixth month abroad ends, then her own door opens with a quiet line, and not a month sooner", () => {
    const game = landed();
    while (monthsAbroad(game) < 5) monthAbroad(game);
    expect(isOpen(game, "goal.own-door")).toBe(false);
    const result = monthAbroad(game);
    expect(monthsAbroad(game)).toBe(6);
    expect(isOpen(game, "goal.own-door")).toBe(true);
    expect(game.state.goal.open["goal.own-door"]).toEqual({ openedMonth: game.state.turn.month });
    expect(goalLines(result)).toContainEqual({ key: "line.goal.opened", params: { goal: "goal.own-door" }, tone: "plain", attention: false, counts: [] });
  });

  test("[R-GOAL-001] given her own door open and a room rented, when her file reaches 20, then it is done with a line that asks for attention and its reward, once", () => {
    const game = landed();
    // Her rent payments would have her file at 20 by six months; it is brought down so the door opens undone.
    while (monthsAbroad(game) < 5) monthAbroad(game);
    thenMonth(game, [{ type: "credit/mark", amount: -100 }]);
    expect(isOpen(game, "goal.own-door")).toBe(true);
    expect(isDone(game, "goal.own-door")).toBe(false);
    const result = thenMonth(game, [
      { type: "credit/mark", amount: 40 },
      { type: "quality/add", quality: WELLBEING, amount: -40 },
    ]);
    expect(isDone(game, "goal.own-door")).toBe(true);
    expect(goalLines(result)).toContainEqual({ key: "line.goal.done", params: { goal: "goal.own-door" }, tone: "good", attention: true, counts: [] });
    expect(rewardOf(result, "goal.own-door")).toEqual([[WELLBEING, 6]]);
    const later = monthAbroad(game);
    expect(rewardOf(later, "goal.own-door")).toEqual([]);
  });

  test("[R-GOAL-001] given December answered in her first month abroad, when her twelfth month abroad ends, then the December goal opens and is done in the same phase, the opening first", () => {
    const game = landed();
    expect(game.state.setpiece.answered["setpiece.december"]).toBe(1);
    while (monthsAbroad(game) < 11) monthAbroad(game);
    expect(isOpen(game, "goal.december") || isDone(game, "goal.december")).toBe(false);
    const result = thenMonth(game, [{ type: "quality/add", quality: WELLBEING, amount: -40 }]);
    expect(goalEvents(result).filter((event) => (event as unknown as { goal: string }).goal === "goal.december").map((event) => event.type)).toEqual([
      "goal/opened",
      "goal/done",
    ]);
    expect(game.state.goal.done["goal.december"]).toEqual({ month: game.state.turn.month });
    expect(rewardOf(result, "goal.december")).toEqual([[WELLBEING, 5]]);
  });

  test("[R-GOAL-001] given twelve months abroad, when Ada starts a job a step above, then a step up opens at twelve months and is done", () => {
    const game = landed();
    untilOpen(game, "goal.step-up");
    expect(monthsAbroad(game)).toBe(12);
    // The graduate job needs the work a graduate status allows.
    const result = thenMonth(game, [
      { type: "status/grant", status: "status.uk-graduate" },
      { type: "activity/start-job", job: "activity.job-uk-graduate" },
    ]);
    expect(isDone(game, "goal.step-up")).toBe(true);
    expect(rewardOf(result, "goal.step-up")).toEqual([[STANDING, 5]]);
  });

  test("[R-GOAL-001] given her file at 10 and then at 60, when the months end, then a clean file opens and then is done", () => {
    const game = landed();
    thenMonth(game, [{ type: "credit/mark", amount: 10 }]);
    expect(isOpen(game, "goal.clean-file")).toBe(true);
    expect(isDone(game, "goal.clean-file")).toBe(false);
    const result = thenMonth(game, [{ type: "credit/mark", amount: 60 }]);
    expect(isDone(game, "goal.clean-file")).toBe(true);
    expect(rewardOf(result, "goal.clean-file")).toEqual([[WELLBEING, 3]]);
  });

  test("[R-GOAL-001] given her file at 20 and then a car on finance, when the months end, then the first car opens and then is done", () => {
    const game = landed();
    thenMonth(game, [{ type: "credit/mark", amount: 20 }]);
    expect(isOpen(game, "goal.first-car")).toBe(true);
    const result = thenMonth(game, [
      { type: "credit/mark", amount: 20 },
      // The price less the tenth paid down (R-CAR-001).
      { type: "obligation/open", obligation: "obligation.car", principal: 855000 },
    ]);
    expect(isDone(game, "goal.first-car")).toBe(true);
    expect(rewardOf(result, "goal.first-car")).toEqual([
      [STANDING, 4],
      [WELLBEING, 4],
    ]);
  });

  test("[R-GOAL-001] given a first sum sent home and then two million naira in all, when the months end, then sending well opens and then is done", () => {
    const game = landed();
    game.accept({ type: "wallet/remit", currency: "GBP", amount: 100 * POUNDS, channel: "app" });
    thenMonth(game, []);
    expect(isOpen(game, "goal.send-well")).toBe(true);
    game.accept({ type: "wallet/remit", currency: "GBP", amount: 2000 * POUNDS, channel: "app" });
    const result = thenMonth(game, []);
    expect(isDone(game, "goal.send-well")).toBe(true);
    expect(rewardOf(result, "goal.send-well")).toEqual([[STANDING, 6]]);
  });

  test("[R-GOAL-001] given a status that counts to settlement and then a settled one, when the months end, then settled opens and then is done", () => {
    const game = landed();
    thenMonth(game, [{ type: "status/grant", status: "status.uk-sponsored", job: "activity.job-uk-care" }]);
    expect(isOpen(game, "goal.settled")).toBe(true);
    const result = thenMonth(game, [{ type: "status/grant", status: "status.uk-settled" }]);
    expect(isDone(game, "goal.settled")).toBe(true);
    expect(rewardOf(result, "goal.settled")).toEqual([
      [STANDING, 10],
      [WELLBEING, 8],
    ]);
  });

  test("[R-GOAL-001] given Ada home by choice, when the month ends and then ten and a half million naira is in the bank, then home with capital opens and then is done", () => {
    const game = homeByChoice();
    game.endTurn();
    expect(isOpen(game, "goal.home-with-capital")).toBe(true);
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 1050000000, reason: "gift" }]);
    const result = game.endTurn();
    expect(isDone(game, "goal.home-with-capital")).toBe(true);
    expect(rewardOf(result, "goal.home-with-capital")).toEqual([[STANDING, 8]]);
  });

  test("[R-GOAL-001] given Ada home, when a route is granted after the return, then a second route opens and then is done", () => {
    const game = homeByChoice();
    game.endTurn();
    expect(isOpen(game, "goal.second-route")).toBe(true);
    // A grant takes years of play; the route's state is written as the decision would leave it.
    game.state = { ...game.state, route: { ...game.state.route, "route.uk-care": { ...game.state.route["route.uk-care"]!, state: "granted" } } };
    applyEffects(game, [{ type: "quality/add", quality: WELLBEING, amount: -40 }]);
    const result = game.endTurn();
    expect(isDone(game, "goal.second-route")).toBe(true);
    expect(rewardOf(result, "goal.second-route")).toEqual([[WELLBEING, 8]]);
  });

  test("[R-GOAL-001] given five million naira and then land and fifteen million, when the months end, then the house opens and then is done, wherever Ada is", () => {
    const game = landed();
    thenMonth(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 500000000, reason: "gift" }]);
    expect(isOpen(game, "goal.the-house")).toBe(true);
    const result = thenMonth(game, [
      { type: "quality/add", quality: "quality.land", amount: 1 },
      { type: "money/add", currency: "NGN", pocket: "bank", amount: 1000000000, reason: "gift" },
    ]);
    expect(isDone(game, "goal.the-house")).toBe(true);
    expect(rewardOf(result, "goal.the-house")).toEqual([[STANDING, 10]]);
  });

  test("[R-GOAL-001] [R-PLACE-003] given money sent home and Ada home before the month ends, when it ends, then sending well, a goal abroad, does not open at home", () => {
    const game = landed();
    game.accept({ type: "wallet/remit", currency: "GBP", amount: 100 * POUNDS, channel: "app" });
    game.accept({ type: "return/home" });
    game.endTurn();
    expect(isOpen(game, "goal.send-well")).toBe(false);
    expect(game.state.goal.done["goal.send-well"]).toBeUndefined();
  });

  test("[R-GOAL-001] given the effects, when goal/open and goal/done are applied, then the first opens whatever its conditions say and the second finishes with its reward, once", () => {
    const game = start({ scenario: "scenario.ada", content });
    applyEffects(game, [{ type: "goal/open", goal: "goal.settled" }]);
    expect(isOpen(game, "goal.settled")).toBe(true);
    applyEffects(game, [{ type: "goal/done", goal: "goal.clean-file" }]);
    expect(isDone(game, "goal.clean-file")).toBe(true);
    expect(game.state.quality[WELLBEING]).toBe(start({ scenario: "scenario.ada", content }).state.quality[WELLBEING]! + 3);
    const before = game.state.quality[WELLBEING];
    applyEffects(game, [
      { type: "goal/done", goal: "goal.clean-file" },
      { type: "goal/open", goal: "goal.clean-file" },
    ]);
    expect(game.state.quality[WELLBEING]).toBe(before);
    expect(isOpen(game, "goal.clean-file")).toBe(false);
  });
});

describe("the December visit", () => {
  test("[R-RETURN-005] given Ada's first month abroad in the December tick, when she goes and spends on everything, then the fare and each answer's price leave her pounds as each is given and the page's standing comes", () => {
    const game = flownAda(content);
    applyEffects(game, [
      { type: "money/add", currency: "GBP", pocket: "bank", amount: 10000 * POUNDS, reason: "gift" },
      { type: "quality/add", quality: STANDING, amount: -40 },
    ]);
    game.endTurn();
    expect(game.state.setpiece.open).toMatchObject({ entry: "setpiece.december", route: null });
    const pick: Record<string, string> = { go: "go", party: "big", gifts: "all", look: "outfit" };
    const standing = game.state.quality[STANDING]!;
    const paid: number[] = [];
    for (let guard = 0; guard < 4; guard += 1) {
      const question = game.view().setpiece!.question!;
      const before = game.state.wallet.pockets.GBP.bank + game.state.wallet.pockets.GBP.cash;
      game.accept({ type: "setpiece/answer", question: question.id, answer: pick[question.id.slice(0, question.id.indexOf("-"))]! });
      paid.push(before - game.state.wallet.pockets.GBP.bank - game.state.wallet.pockets.GBP.cash);
    }
    expect(game.state.setpiece.open).toBeNull();
    // The fare both ways in December, and the party, the gifts and the look at their prices in pounds.
    expect(paid.reduce((sum, amount) => sum + amount, 0)).toBe(310000 + 22700 + 34100 + 14200);
    expect(game.state.quality[STANDING]).toBe(standing + 6 + 8 + 4);
    expect(game.state.setpiece.answered["setpiece.december"]).toBe(1);
  });
});

describe("done stays done", () => {
  test("[R-GOAL-002] given a clean file done, when the file falls back to nothing, then it stays done, the requirement still holds and no reward comes twice", () => {
    const game = landed();
    thenMonth(game, [{ type: "credit/mark", amount: 10 }]);
    thenMonth(game, [{ type: "credit/mark", amount: 60 }]);
    const month = game.state.goal.done["goal.clean-file"]?.month;
    expect(month).toBeDefined();
    const result = thenMonth(game, [{ type: "credit/mark", amount: -100 }]);
    expect(game.state.goal.done["goal.clean-file"]?.month).toBe(month);
    expect(isOpen(game, "goal.clean-file")).toBe(false);
    expect(rewardOf(result, "goal.clean-file")).toEqual([]);
    expect(goalKind.requirements?.["goal/done"]?.({ state: game.state, world: game.world(), content }, { type: "goal/done", goal: "goal.clean-file" }, {}).met).toBe(true);
  });

  test("[R-GOAL-002] given a goal done in a month no chapter closes, when the month ends, then the bank is one turn lower: goals do not refill it", () => {
    const game = landed();
    // Landing closes with the first job; the months after it close no chapter.
    playUntil(game, SECURE);
    thenMonth(game, [{ type: "credit/mark", amount: 10 }]);
    const banked = game.state.turn.banked;
    const result = thenMonth(game, [{ type: "credit/mark", amount: 60 }]);
    expect(isDone(game, "goal.clean-file")).toBe(true);
    expect(result.events.filter((event) => event.type === "chapter/closed")).toEqual([]);
    expect(game.state.turn.banked).toBe(banked - 1);
  });

  test("[R-GOAL-002] given the content, when every entry outside the goals is read, then none waits on a goal", () => {
    const { goal: _goals, ...rest } = content;
    expect(Object.keys(_goals).length).toBe(10);
    expect(JSON.stringify(rest)).not.toContain('"goal/done"');
  });
});

describe("the goals in the view", () => {
  test("[R-GOAL-003] given goals open in different months and one done, when the view is read, then open goals come by the month they opened, each item met or not, and the done list carries the month", () => {
    const game = landed();
    thenMonth(game, [{ type: "credit/mark", amount: 10 }]);
    const cleanMonth = game.state.turn.month;
    untilOpen(game, "goal.step-up");
    const stepMonth = game.state.turn.month;
    const view = game.view().goals;
    const ids = view.open.map((goal) => goal.id);
    expect(ids).toContain("goal.clean-file");
    expect(ids.indexOf("goal.clean-file")).toBeLessThan(ids.indexOf("goal.step-up"));
    expect(game.state.goal.open["goal.clean-file"]?.openedMonth).toBe(cleanMonth);
    expect(game.state.goal.open["goal.step-up"]?.openedMonth).toBe(stepMonth);
    // Each item is its place in `doneIf`.
    expect(view.open.find((goal) => goal.id === "goal.step-up")?.items).toEqual([{ id: "0", met: false }]);
    expect(view.open.find((goal) => goal.id === "goal.clean-file")?.items).toEqual([{ id: "0", met: false }]);
    // Her rent has kept her file climbing: her own door was done when it opened, at six months.
    expect(view.done).toContainEqual({ id: "goal.own-door", month: game.state.place.movedMonth + 6 });
    thenMonth(game, [{ type: "credit/mark", amount: 60 }]);
    expect(game.view().goals.done).toContainEqual({ id: "goal.clean-file", month: game.state.turn.month });
    expect(game.view().goals.open.map((goal) => goal.id)).not.toContain("goal.clean-file");
  });

  test("[R-GOAL-003] given a new life, when the view is read, then no goal is open or done, and every goal has a name and words for its lines", () => {
    expect(start({ scenario: "scenario.ada", content }).view().goals).toEqual({ open: [], done: [] });
    for (const key of ["line.goal.opened", "line.goal.done"]) expect(text[key]).toContain("{goal}");
  });
});

describe("what must hold", () => {
  test("[R-GOAL-002] given a played life abroad, when the invariants are checked, then they hold, and a goal open and done at once or unknown is named", () => {
    const game = landed();
    thenMonth(game, [{ type: "credit/mark", amount: 10 }]);
    expect(checkInvariants(game.state, content)).toEqual([]);
    expect(registry().find((kind) => kind.kind === "goal")).toBe(goalKind);
    const broken: State = {
      ...game.state,
      goal: { open: { "goal.clean-file": { openedMonth: 1 }, "goal.nowhere": { openedMonth: 1 } }, done: { "goal.clean-file": { month: 2 } } },
    };
    expect(goalKind.invariants?.(broken, content)).toEqual([
      "The goal goal.clean-file is both open and done.",
      "The open goal goal.nowhere is not in content.",
    ]);
  });
});
