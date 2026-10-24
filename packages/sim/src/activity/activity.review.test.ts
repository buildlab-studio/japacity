// The yearly pay review: activity:naira-pay-reviewed-yearly, with the raise from being noticed on the reviewed pay
// (activity:waiting-months-build-profile) and the view's pay as the review left it (wallet:view-carries-month-pay). The world's
// official dollar rate is fixed by the test, so each review's share is known.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp, roundDownTo } from "../engine/int";
import type { Accepted, Id, World } from "../engine/types";
import { applyEffects, raiseSeed, slot } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { eventsOf, keys, moneyOf, salaries } from "../testing/read";
import { standInWorld } from "../world/standIn";
import { REST } from "../testing/ids";

const AGENT: Id<"activity"> = "activity.job-customer-service";
const TEACHER: Id<"activity"> = "activity.job-teacher";
const REMOTE: Id<"activity"> = "activity.job-remote-developer";
const NOTICED: Id<"activity"> = "activity.be-noticed";
const BASE_RATE = 150000;
const { tuning } = content;

/** The stand-in world with the official dollar at `BASE_RATE` before tick 12 and at `later` from it. */
function worldWith(later: number): (tick: number) => World {
  return (tick) => {
    const world = standInWorld("review-world", tick, content);
    const official = tick < 12 ? BASE_RATE : later;
    return { ...world, rates: { ...world.rates, USD: { ...world.rates.USD, official } } };
  };
}

function writtenPay(id: Id<"activity">): number {
  const amount = content.activity[id]?.pay?.amount;
  if (typeof amount !== "number") throw new Error(`${id} pays no fixed figure.`);
  return amount;
}

/** A graduate who starts a job now, in a world whose dollar moves to `later` at tick 12. */
function working(job: Id<"activity">, later: number, seed = "review-0"): Game {
  const game = start({ content, scenario: "scenario.graduate", seed, worldAt: worldWith(later) });
  applyEffects(game, [{ type: "activity/start-job", job }]);
  return game;
}

function months(game: Game, count: number): Accepted[] {
  const played: Accepted[] = [];
  for (let at = 0; at < count; at += 1) {
    if (game.state.turn.banked < 1) game.grant(1);
    played.push(game.endTurn([]));
  }
  return played;
}

/** The pay a review gives a held figure at a share, rounded down to whole naira. */
function reviewedBy(pay: number, share: number): number {
  return roundDownTo(pay + bp(pay, share), 100);
}

describe("the yearly pay review", () => {
  test("[activity:naira-pay-reviewed-yearly] given a formal job and a calm dollar, when twelve months are worked, then the thirteenth month's pay is 10% more, told in one line, and the months before pay the entry's figure", () => {
    const game = working(AGENT, BASE_RATE);
    const year = months(game, 12);
    expect(year.flatMap(salaries)).toEqual(Array.from({ length: 12 }, () => writtenPay(AGENT)));
    const thirteenth = months(game, 1)[0]!;
    const pay = reviewedBy(writtenPay(AGENT), tuning.activity.reviewFormalBp);
    expect(pay).toBe(121000_00);
    expect(salaries(thirteenth)).toEqual([pay]);
    expect(eventsOf(thirteenth, "activity/reviewed")).toEqual([
      { type: "activity/reviewed", job: AGENT, was: { currency: "NGN", amount: writtenPay(AGENT) }, pay: { currency: "NGN", amount: pay }, rate: BASE_RATE },
    ]);
    expect(keys(thirteenth)).toContain("line.activity.reviewed");
  });

  test("[activity:naira-pay-reviewed-yearly] given a formal job and the dollar up 30% over the year, when it is reviewed, then the pay rises 10% plus half the 20% beyond it", () => {
    const game = working(AGENT, BASE_RATE + bp(BASE_RATE, 3000));
    months(game, 12);
    expect(salaries(months(game, 1)[0]!)).toEqual([reviewedBy(writtenPay(AGENT), 2000)]);
  });

  test("[activity:naira-pay-reviewed-yearly] given a formal job and the dollar doubled, when it is reviewed, then the rise stops at the 30% cap", () => {
    const game = working(AGENT, BASE_RATE * 2);
    months(game, 12);
    expect(salaries(months(game, 1)[0]!)).toEqual([reviewedBy(writtenPay(AGENT), tuning.activity.reviewCapBp)]);
  });

  test("[activity:naira-pay-reviewed-yearly] given a formal job and the dollar cheaper over the year, when it is reviewed, then the rise is the formal 10% and never less", () => {
    const game = working(AGENT, BASE_RATE - bp(BASE_RATE, 2000));
    months(game, 12);
    expect(salaries(months(game, 1)[0]!)).toEqual([reviewedBy(writtenPay(AGENT), tuning.activity.reviewFormalBp)]);
  });

  test("[activity:naira-pay-reviewed-yearly] given an informal job and the dollar doubled, when it is reviewed, then the pay rises 5% whatever the dollar did", () => {
    const game = working(TEACHER, BASE_RATE * 2);
    months(game, 12);
    expect(salaries(months(game, 1)[0]!)).toEqual([reviewedBy(writtenPay(TEACHER), tuning.activity.reviewInformalBp)]);
  });

  test("[activity:naira-pay-reviewed-yearly] given a second year, when the job is reviewed again, then the rise compounds on the reviewed pay from the rate of the last review", () => {
    const game = working(AGENT, BASE_RATE);
    months(game, 24);
    const second = salaries(months(game, 1)[0]!);
    expect(second).toEqual([reviewedBy(reviewedBy(writtenPay(AGENT), tuning.activity.reviewFormalBp), tuning.activity.reviewFormalBp)]);
  });

  test("[activity:naira-pay-reviewed-yearly] given dollar pay, when a year is worked, then it is not reviewed", () => {
    const game = working(REMOTE, BASE_RATE * 2);
    const paid = months(game, 13).flatMap((month) => moneyOf(month, "salary").map((credit) => credit.amount));
    expect(new Set(paid)).toEqual(new Set([writtenPay(REMOTE)]));
    expect(game.view().job.review).toBeUndefined();
  });

  test("[activity:naira-pay-reviewed-yearly] given a new rung, when it is started after months in the job below, then its year starts again: no review until its own twelve months", () => {
    const game = working(AGENT, BASE_RATE);
    months(game, 6);
    applyEffects(game, [{ type: "activity/start-job", job: "activity.job-team-lead" }]);
    const year = months(game, 12).flatMap((month) => eventsOf(month, "activity/reviewed"));
    expect(year).toEqual([]);
    expect(eventsOf(months(game, 1)[0]!, "activity/reviewed")).toHaveLength(1);
  });

  test("[activity:naira-pay-reviewed-yearly] [wallet:view-carries-month-pay] given a reviewed job, when the view is read, then the Jobs app's pay is the reviewed pay and the next review is counted in months", () => {
    const game = working(AGENT, BASE_RATE);
    expect(game.view().job.review).toBe(13);
    months(game, 12);
    expect(game.view().job.review).toBe(1);
    months(game, 1);
    expect(game.view().job.pay).toEqual({ currency: "NGN", amount: reviewedBy(writtenPay(AGENT), tuning.activity.reviewFormalBp) });
    expect(game.view().job.review).toBe(12);
  });

  test("[activity:naira-pay-reviewed-yearly] given a starting life holding its job from before the game, when the first month is played, then its pay is put on record and its first review comes a year later", () => {
    const game = start({ content, scenario: "scenario.banker", worldAt: worldWith(BASE_RATE) });
    expect(game.state.activity.pay).toBeUndefined();
    months(game, 1);
    expect(game.state.activity).toMatchObject({ pay: writtenPay("activity.job-bank-officer"), reviewRate: BASE_RATE });
    const year = months(game, 11).flatMap((month) => eventsOf(month, "activity/reviewed"));
    expect(year).toEqual([]);
  });

  test("[activity:waiting-months-build-profile] [activity:naira-pay-reviewed-yearly] given a reviewed pay, when being noticed raises it, then the raise is on top of the pay as the review left it", () => {
    const game = working(AGENT, BASE_RATE, raiseSeed(content, true));
    months(game, 13);
    const reviewed = reviewedBy(writtenPay(AGENT), tuning.activity.reviewFormalBp);
    game.endTurn([slot(NOTICED), slot(REST)]);
    expect(salaries(months(game, 1)[0]!)).toEqual([reviewed + bp(reviewed, tuning.activity.raiseBp)]);
  });
});
