// The trades' ladders at home: activity:each-trade-climbs-its-ladder (rungs hunted by months across the trade's jobs),
// activity:capital-opens-own-work (own work opened with its capital) and activity:fish-racks-at-makoko (the fish trade's
// ladder and its side job). Real content, lives played through `step`.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp, mulDiv } from "../engine/int";
import type { Accepted, Id } from "../engine/types";
import { applyEffects } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { playPrologueBy, start } from "../testing/play";
import { judged, moneyOf, salaries } from "../testing/read";
import { setPockets } from "../testing/wallet";
import { HUNT, NIGHT_SUPPORT } from "../testing/ids";

const SENIOR_NURSE: Id<"activity"> = "activity.job-senior-nurse";
const NURSE_JOBS: Id<"activity">[] = ["activity.job-nurse", SENIOR_NURSE, "activity.job-ward-manager"];
const RACKS: Id<"activity"> = "activity.job-fish-racks";
const KILN: Id<"activity"> = "activity.job-fish-smoker";
const TRADER: Id<"activity"> = "activity.job-fish-trader";
const BUY_KILN: Id<"activity"> = "activity.buy-kiln";
const FISH_TRADE: Id<"activity"> = "activity.start-fish-trade";
const OPEN_POS: Id<"activity"> = "activity.open-pos-stand";
const POS: Id<"activity"> = "activity.pos-stand";
const CANOE: Id<"activity"> = "activity.canoe-deliveries";
const CARE: Id<"quality"> = "quality.care";
/** The child of the water's tile: commerce at school, work after it, the counter's savings, and the room on the lagoon. */
const WATER = ["begin", "commercial", "work", "save", "makoko"];

function hunted(game: Game): readonly string[] {
  return game.view().activities.find((option) => option.id === HUNT)?.params ?? [];
}

function option(game: Game, id: Id<"activity">) {
  const found = game.view().activities.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} is not in the view.`);
  return found;
}

function raiseTo(game: Game, quality: Id<"quality">, value: number): void {
  for (let guard = 0; (game.state.quality[quality] ?? 0) < value && guard < 200; guard += 1) applyEffects(game, [{ type: "quality/add", quality, amount: 1 }]);
  expect(game.state.quality[quality]).toBe(value);
}

function months(game: Game, count: number): Accepted[] {
  const played: Accepted[] = [];
  for (let at = 0; at < count; at += 1) {
    if (game.state.turn.banked < 1) game.grant(1);
    played.push(game.endTurn([]));
  }
  return played;
}

function writtenPay(id: Id<"activity">): number {
  const amount = content.activity[id]?.pay?.amount;
  if (typeof amount !== "number") throw new Error(`${id} pays no fixed figure.`);
  return amount;
}

/** The child of the water on the racks, from the prologue: the room on the lagoon, the racks taken. */
function onTheRacks(): Game {
  const game = start({ content, scenario: "scenario.prologue", seed: "ladder-0" });
  playPrologueBy(game, WATER);
  expect(game.state.home.place).toBe("place.makoko");
  applyEffects(game, [{ type: "activity/start-job", job: RACKS }]);
  return game;
}

describe("each trade climbs its ladder", () => {
  test("[activity:each-trade-climbs-its-ladder] given the nurse with 30 months on the ward, when her care is one under the senior rung's 70 and then at it, then the senior nursing officer is huntable only at 70", () => {
    const game = start({ content, scenario: "scenario.nurse" });
    expect(judged(game, { type: "activity/tenure", activities: NURSE_JOBS, months: 30 }).met).toBe(true);
    raiseTo(game, CARE, 69);
    expect(hunted(game)).not.toContain(SENIOR_NURSE);
    raiseTo(game, CARE, 70);
    expect(hunted(game)).toContain(SENIOR_NURSE);
  });

  test("[activity:each-trade-climbs-its-ladder] given a nurse who takes the senior rung, when she works it, then her months carry: the months across the nurse jobs keep counting from the ward's 30", () => {
    const game = start({ content, scenario: "scenario.nurse" });
    applyEffects(game, [{ type: "activity/start-job", job: SENIOR_NURSE }]);
    months(game, 3);
    expect(game.state.activity.tenure[SENIOR_NURSE]).toBe(3);
    expect(judged(game, { type: "activity/tenure", activities: NURSE_JOBS, months: 33 })).toEqual({ met: true, have: 33, need: 33 });
  });

  test("[activity:each-trade-climbs-its-ladder] given night support held, when months are worked, then they count toward the support jobs' months that remote support asks", () => {
    const game = start({ content, scenario: "scenario.graduate" });
    applyEffects(game, [{ type: "activity/start-job", job: NIGHT_SUPPORT }]);
    months(game, 2);
    expect(game.state.activity.tenure[NIGHT_SUPPORT]).toBe(2);
    const remote = content.activity["activity.job-remote-support"]?.requires.find((requirement) => requirement.type === "activity/tenure");
    if (remote?.type !== "activity/tenure") throw new Error("Remote support asks no months.");
    expect(judged(game, { ...remote, months: 2 }).met).toBe(true);
  });

  test("[activity:each-trade-climbs-its-ladder] given months on a side job, when a requirement asks months in any job, then only main jobs count, as before side jobs kept months", () => {
    const game = start({ content, scenario: "scenario.graduate" });
    applyEffects(game, [{ type: "activity/start-job", job: NIGHT_SUPPORT }]);
    months(game, 2);
    expect(judged(game, { type: "activity/tenure", activities: [], months: 1 }).met).toBe(false);
  });
});

describe("own work opened with its capital", () => {
  test("[activity:capital-opens-own-work] given 12 months on the racks and the kiln's ₦100,000, when the kiln is built, then the capital goes under goods at once and the kiln is the job held; it is not hunted and leaves the board", () => {
    const game = onTheRacks();
    months(game, 11);
    expect(option(game, BUY_KILN).allowed).toBe(false);
    months(game, 1);
    setPockets(game, { NGN: 150000_00 });
    expect(option(game, BUY_KILN).allowed).toBe(true);
    const built = game.accept({ type: "activity/now", activity: BUY_KILN, param: null });
    expect(moneyOf(built, "goods").map((event) => event.amount)).toEqual([100000_00]);
    expect(game.state.activity.job).toBe(KILN);
    expect(hunted(game)).not.toContain(KILN);
    expect(salaries(months(game, 1)[0]!)).toEqual([writtenPay(KILN)]);
  });

  test("[activity:capital-opens-own-work] given the kiln's capital short by a kobo, when the kiln is asked for, then it is shut and refused as unaffordable, and nothing is taken", () => {
    const game = onTheRacks();
    months(game, 12);
    setPockets(game, { NGN: 100000_00 - 1 });
    expect(option(game, BUY_KILN).affordable).toBe(false);
    game.expectRejected({ type: "activity/now", activity: BUY_KILN, param: null }, "cannot-afford");
    expect(game.state.activity.job).toBe(RACKS);
  });

  test("[activity:capital-opens-own-work] given own work standing a year, when its takings are paid, then they have grown by the raise share a year by the months it has stood", () => {
    const game = onTheRacks();
    months(game, 12);
    setPockets(game, { NGN: 100000_00 });
    game.accept({ type: "activity/now", activity: BUY_KILN, param: null });
    const paid = months(game, 13).map((month) => salaries(month)[0]);
    const written = writtenPay(KILN);
    expect(paid[0]).toBe(written);
    expect(paid[12]).toBe(written + mulDiv(bp(written, content.tuning.activity.raiseBp), 12, 12));
  });

  test("[activity:capital-opens-own-work] given 30 months across the racks and the kiln, when the fish trade is opened with ₦300,000, then the fish trader is the job held; at 29 months it is shut", () => {
    const game = onTheRacks();
    months(game, 12);
    setPockets(game, { NGN: 100000_00 });
    game.accept({ type: "activity/now", activity: BUY_KILN, param: null });
    months(game, 17);
    setPockets(game, { NGN: 300000_00 });
    expect(option(game, FISH_TRADE).allowed).toBe(false);
    months(game, 1);
    setPockets(game, { NGN: 300000_00 });
    expect(option(game, FISH_TRADE).allowed).toBe(true);
    const opened = game.accept({ type: "activity/now", activity: FISH_TRADE, param: null });
    expect(moneyOf(opened, "goods").map((event) => event.amount)).toEqual([300000_00]);
    expect(game.state.activity.job).toBe(TRADER);
  });

  test("[activity:capital-opens-own-work] given a banker, when the POS stand is set up with ₦300,000, then it is the side job held beside the bank job; with a side job already held, or with no bank job, it is refused", () => {
    const banker = start({ content, scenario: "scenario.banker" });
    setPockets(banker, { NGN: 300000_00 });
    const opened = banker.accept({ type: "activity/now", activity: OPEN_POS, param: null });
    expect(moneyOf(opened, "goods").map((event) => event.amount)).toEqual([300000_00]);
    expect(banker.state.activity).toMatchObject({ job: "activity.job-bank-officer", side: POS });

    const busy = start({ content, scenario: "scenario.banker" });
    applyEffects(busy, [{ type: "activity/start-job", job: "activity.ride-driving" }]);
    setPockets(busy, { NGN: 300000_00 });
    expect(option(busy, OPEN_POS).allowed).toBe(false);
    busy.expectRejected({ type: "activity/now", activity: OPEN_POS, param: null }, "not-legal");

    const graduate = start({ content, scenario: "scenario.graduate" });
    setPockets(graduate, { NGN: 300000_00 });
    graduate.expectRejected({ type: "activity/now", activity: OPEN_POS, param: null }, "not-legal");
  });
});

describe("the fish racks at Makoko", () => {
  test("[activity:fish-racks-at-makoko] given a life in Makoko's room and one in the family house, when the hunt is listed, then canoe deliveries, the fish trade's side job, are on Makoko's board only", () => {
    const water = start({ content, scenario: "scenario.prologue", seed: "ladder-0" });
    playPrologueBy(water, WATER);
    expect(hunted(water)).toContain(CANOE);
    expect(hunted(start({ content, scenario: "scenario.graduate" }))).not.toContain(CANOE);
    expect(content.activity[CANOE]?.slot).toBe("side");
    // The way up from the racks is the kiln, opened on the racks' savings.
    expect(content.activity[BUY_KILN]?.effects).toEqual([{ type: "activity/start-job", job: KILN }]);
  });
});
