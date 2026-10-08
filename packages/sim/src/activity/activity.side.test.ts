// Side jobs and the one chance: docs/rules/activity.md R-ACTIVITY-010 and 011,
// health.md R-HEALTH-004.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp } from "../engine/int";
import type { Accepted, BaseEvent, Id, ReadCtx } from "../engine/types";
import { applyEffects, draw, slot } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { freeSlots } from "../turn/turn.logic";
import { sideJobHeld, SIDE_JOB_LOCK } from "./activity.logic";

const NIGHT: Id<"activity"> = "activity.night-support";
const TUTORING: Id<"activity"> = "activity.weekend-tutoring";
const RIDE: Id<"activity"> = "activity.ride-driving";
const HUNT: Id<"activity"> = "activity.job-hunt";
const tuning = content.tuning;

interface Money {
  type: string;
  currency: string;
  pocket: string;
  amount: number;
  reason: string;
}

function moneyOf(result: Accepted, reason: string): Money[] {
  return result.events.filter((event): event is BaseEvent & Money => (event.type === "wallet/credited" || event.type === "wallet/debited") && (event as unknown as Money).reason === reason) as Money[];
}

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function payOf(id: Id<"activity">): number {
  const amount = content.activity[id]?.pay?.amount;
  if (typeof amount !== "number") throw new Error(`${id} pays no fixed figure.`);
  return amount;
}

/** A life holding a side job, taken as the job offer's acceptance takes it. */
function sideJob(scenario: Id<"scenario">, side: Id<"activity">): Game {
  const game = start({ content, scenario });
  applyEffects(game, [{ type: "activity/start-job", job: side }]);
  return game;
}

describe("side jobs", () => {
  test("[R-ACTIVITY-010] [R-ACTIVITY-005] given a hunt for a side job, when it lands and the offer is accepted, then the side job is held beside no job, one slot is locked for it and the month's free slots drop by one", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(game.view().freeSlots).toBe(tuning.turn.freeSlotsNoJob);
    let offer: string | undefined;
    for (let month = 0; month < 30 && offer === undefined; month += 1) {
      game.endTurn([slot(HUNT, NIGHT)]);
      offer = game.view().offers.find((open) => open.entry === "offer.job" && open.terms.job === NIGHT)?.id;
    }
    if (offer === undefined) throw new Error("No hunt landed in 30 months.");
    const accepted = game.accept({ type: "offer/choose", offer, choice: "accept" });
    expect(accepted.events).toContainEqual({ type: "activity/side-started", side: NIGHT, previous: null });
    expect(game.state.activity).toMatchObject({ job: null, side: NIGHT });
    expect(game.view().locks).toEqual([{ slots: 1, untilMonth: game.state.turn.month, why: SIDE_JOB_LOCK }]);
    expect(game.view().freeSlots).toBe(tuning.turn.freeSlotsNoJob - 1);
    expect(sideJobHeld(readOf(game))).toBe(true);
    // The side job is not hunted again while held.
    expect(game.view().activities.find((option) => option.id === HUNT)?.params).not.toContain(NIGHT);
  });

  test("[R-ACTIVITY-010] given a side job paid in dollars and one paid in naira, when a month is played, then the dollars go to the bank and the naira to cash, its toll applies, and the slot stays locked for the next month", () => {
    const night = sideJob("scenario.ada", NIGHT);
    const month = night.endTurn();
    expect(moneyOf(month, "salary")).toEqual([{ type: "wallet/credited", currency: "USD", pocket: "bank", amount: payOf(NIGHT), reason: "salary" }]);
    expect(month.events).toContainEqual({ type: "quality/changed", quality: "quality.wellbeing", amount: -6, source: NIGHT });
    expect(month.lines.map((line) => line.key)).toContain("line.activity.side-pay");
    expect(night.view().locks).toEqual([{ slots: 1, untilMonth: night.state.turn.month, why: SIDE_JOB_LOCK }]);
    expect(freeSlots(night.state, content)).toBe(tuning.turn.freeSlotsNoJob - 1);
    night.expectRejected({ type: "turn/end", slots: [slot("activity.rest"), slot("activity.rest"), slot("activity.rest")] }, "not-legal");

    const tutoring = sideJob("scenario.ada", TUTORING);
    expect(moneyOf(tutoring.endTurn(), "gig")).toEqual([{ type: "wallet/credited", currency: "NGN", pocket: "cash", amount: payOf(TUTORING), reason: "gig" }]);
  });

  test("[R-ACTIVITY-010] given a job and a side job, when the side job is quit, then only it ends; with none held, quitting a side job is not legal; one side job at a time", () => {
    const tunde = sideJob("scenario.tunde", TUTORING);
    applyEffects(tunde, [{ type: "activity/start-job", job: RIDE }]);
    expect(tunde.state.activity).toMatchObject({ job: "activity.job-bank-officer", side: RIDE });
    const quit = tunde.accept({ type: "activity/quit", side: true });
    expect(quit.events).toContainEqual({ type: "activity/side-ended", side: RIDE, why: "quit" });
    expect(quit.lines.map((line) => line.key)).toEqual(["line.activity.side-quit"]);
    expect(tunde.state.activity).toMatchObject({ job: "activity.job-bank-officer", side: null });
    expect(sideJobHeld(readOf(tunde))).toBe(false);
    tunde.expectRejected({ type: "activity/quit", side: true }, "not-legal");
    // The plain quit is still the job's.
    tunde.accept({ type: "activity/quit" });
    expect(tunde.state.activity.job).toBeNull();
  });

  test("[R-ACTIVITY-010] [R-PLACE-003] given a side job at home, when the character arrives abroad, then it ends in the first month", () => {
    const game = sideJob("scenario.ada", TUTORING);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    const month = game.endTurn();
    expect(month.events).toContainEqual({ type: "activity/side-ended", side: TUTORING, why: "moved" });
    expect(moneyOf(month, "gig")).toEqual([]);
  });

  test("[R-HEALTH-004] given a side job and a slot locked for illness, when the month is played, then it pays the sick share", () => {
    const game = sideJob("scenario.ada", TUTORING);
    applyEffects(game, [{ type: "turn/lock", slots: 1, months: 1, why: "illness" }]);
    expect(moneyOf(game.endTurn(), "gig")[0]?.amount).toBe(bp(payOf(TUTORING), tuning.health.sickPayBp));
  });
});

describe("the one chance", () => {
  test("[R-ACTIVITY-011] given a side job at home, when the draw on `street` falls under the chance, then the cash goes, the phone is paid from the bank, wellbeing drops 12 and the line asks for attention; the rest of the bank is not touched", () => {
    const game = sideJob("scenario.tunde", RIDE);
    let robbed = 0;
    for (let month = 0; month < 400 && robbed === 0; month += 1) {
      if (game.state.turn.banked < 1) game.grant(tuning.turn.cap);
      const n = game.state.draws.street ?? 0;
      const hit = draw(game.state.seed, "street", n, 10000) < tuning.ladder.oneChanceBp;
      const pocket = game.state.wallet.pockets.NGN;
      const result = game.endTurn();
      expect(game.state.draws.street).toBe(n + 1);
      if (!hit) {
        expect(moneyOf(result, "mishap")).toEqual([]);
        continue;
      }
      robbed += 1;
      // The side job's naira pay arrives in cash first, so it goes too.
      const cash = pocket.cash + payOf(RIDE);
      expect(moneyOf(result, "mishap")).toEqual([
        { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: cash, reason: "mishap" },
        { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: tuning.ladder.phone, reason: "mishap" },
      ]);
      expect(result.events).toContainEqual({ type: "quality/changed", quality: "quality.wellbeing", amount: -12, source: RIDE });
      expect(result.lines.find((line) => line.key === "line.activity.robbed")).toMatchObject({ attention: true, tone: "bad" });
    }
    expect(robbed).toBe(1);
  });

  test("[R-ACTIVITY-011] given a month with a safe ride or a night at the office, or no side job, when the month is played, then there is no draw on `street`", () => {
    for (const counter of ["activity.safe-ride", "activity.sleep-at-office"] as const) {
      const game = sideJob("scenario.tunde", RIDE);
      const n = game.state.draws.street ?? 0;
      game.endTurn([slot(counter)]);
      expect(game.state.draws.street ?? 0).toBe(n);
    }
    const plain = start({ content, scenario: "scenario.tunde" });
    plain.endTurn();
    expect(plain.state.draws.street ?? 0).toBe(0);
  });

  test("[R-ACTIVITY-011] given the safe ride, when it is played, then it costs ₦25,000 under upkeep", () => {
    const game = sideJob("scenario.tunde", RIDE);
    const result = game.endTurn([slot("activity.safe-ride")]);
    expect(moneyOf(result, "upkeep").filter((event) => event.amount === 2500000)).toHaveLength(1);
  });
});
