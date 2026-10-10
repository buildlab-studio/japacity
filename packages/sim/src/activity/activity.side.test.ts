// Side jobs and the one chance: docs/rules/activity.md R-ACTIVITY-010 and 011,
// health.md R-HEALTH-004.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp } from "../engine/int";
import type { Accepted, BaseEvent, Id, ReadCtx } from "../engine/types";
import { ALWAYS_GRANTED, offeredSeed } from "../place/place.journey";
import { applyEffects, draw, readyLife, slot, toDecision, UK } from "../route/route.journey";
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
  return result.events.filter((event): event is BaseEvent & Money => (event.type === "wallet/credited" || event.type === "wallet/debited") && (event as unknown as Money).reason === reason);
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
    // the view carries each job's month as the wallet will book it.
    expect(game.view().job).toEqual({ id: null, months: 0, side: NIGHT, pay: null, sidePay: { currency: "USD", amount: payOf(NIGHT) } });
    expect(game.view().locks).toEqual([{ slots: 1, untilMonth: game.state.turn.month, why: SIDE_JOB_LOCK }]);
    expect(game.view().freeSlots).toBe(tuning.turn.freeSlotsNoJob - 1);
    expect(sideJobHeld(readOf(game))).toBe(true);
    // The side job is not hunted again while held.
    expect(game.view().activities.find((option) => option.id === HUNT)?.params).not.toContain(NIGHT);
  });

  test("[R-WALLET-016] given a hunt for a side job that lands, when the offer is read, then it says the month's pay; once the side job is held the view's side pay is the same, and the month books exactly it", () => {
    const game = start({ content, scenario: "scenario.ada" });
    let offer: { id: string; pay?: { currency: string; amount: number } } | undefined;
    for (let month = 0; month < 30 && offer === undefined; month += 1) {
      game.endTurn([slot(HUNT, NIGHT)]);
      offer = game.view().offers.find((open) => open.entry === "offer.job" && open.terms.job === NIGHT);
    }
    if (offer === undefined) throw new Error("No hunt landed in 30 months.");
    expect(offer.pay).toEqual({ currency: "USD", amount: payOf(NIGHT) });
    game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
    expect(game.view().job.sidePay).toEqual(offer.pay);
    expect(moneyOf(game.endTurn(), "salary").map((money) => money.amount)).toEqual([offer.pay?.amount]);
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

  test("[R-ACTIVITY-010] given a job and a side job, when `activity/end-job` names the side slot, then only the side job ends, with the effect's why; with no side job held it ends nothing", () => {
    const tunde = sideJob("scenario.tunde", RIDE);
    applyEffects(tunde, [{ type: "activity/end-job", why: "moved", side: true }]);
    expect(tunde.state.activity).toMatchObject({ job: "activity.job-bank-officer", side: null });
    const before = tunde.state.activity;
    applyEffects(tunde, [{ type: "activity/end-job", why: "moved", side: true }]);
    expect(tunde.state.activity).toEqual(before);
  });

  test("[R-ACTIVITY-010] given a job and a side job, when `activity/end-job` names no slot, then only the main job ends, whatever its why", () => {
    for (const why of ["moved", "side-moved"]) {
      const tunde = sideJob("scenario.tunde", RIDE);
      applyEffects(tunde, [{ type: "activity/end-job", why }]);
      expect(tunde.state.activity).toMatchObject({ job: null, side: RIDE });
    }
  });

  test("[R-ACTIVITY-010] [R-PLACE-003] given a side job at home, when the character arrives abroad, then it ends in the first month", () => {
    const game = sideJob("scenario.ada", TUTORING);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    const month = game.endTurn();
    expect(month.events).toContainEqual({ type: "activity/side-ended", side: TUTORING, why: "moved" });
    expect(moneyOf(month, "gig")).toEqual([]);
  });

  test("[R-ACTIVITY-010] [R-PLACE-003] given a side job at home, when the character flies, then it ends at the flight, before any month abroad, and the job held at home ends with it", () => {
    const game = readyLife(content, { seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
    toDecision(game);
    applyEffects(game, [{ type: "activity/start-job", job: TUTORING }]);
    expect(game.state.activity.side).toBe(TUTORING);
    const flight = game.accept({ type: "route/depart", route: UK });
    expect(game.state.place.where).toBe("abroad");
    expect(game.state.activity.side).toBeNull();
    expect(flight.events).toContainEqual({ type: "activity/side-ended", side: TUTORING, why: "moved" });
    expect(flight.lines.map((line) => line.key)).toContain("line.activity.side-ended");
    expect(game.state.activity.job).toBeNull();
    const month = game.endTurn();
    expect(month.events.filter((event) => event.type === "activity/side-ended")).toEqual([]);
  });

  test("[R-ACTIVITY-010] [R-PLACE-003] given no side job, when the character flies, then the flight ends no side job and the job at home ends as before", () => {
    const game = readyLife(content, { seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
    toDecision(game);
    applyEffects(game, [{ type: "activity/start-job", job: "activity.job-bank-officer" }]);
    expect(game.state.activity).toMatchObject({ job: "activity.job-bank-officer", side: null });
    const flight = game.accept({ type: "route/depart", route: UK });
    expect(flight.events.filter((event) => event.type === "activity/side-ended")).toEqual([]);
    expect(flight.events).toContainEqual({ type: "activity/job-ended", job: "activity.job-bank-officer", why: "moved" });
    expect(game.state.activity).toMatchObject({ job: null, side: null });
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
      // The side job's naira pay arrives in cash first, so it goes too.
      const cash = pocket.cash + payOf(RIDE);
      const losses = [
        { type: "wallet/debited", currency: "NGN", pocket: "cash", amount: cash, reason: "mishap" },
        { type: "wallet/debited", currency: "NGN", pocket: "bank", amount: tuning.ladder.phone, reason: "mishap" },
      ];
      const shaken = { type: "quality/changed", quality: "quality.wellbeing", amount: -12, source: RIDE };
      expect(moneyOf(result, "mishap")).toEqual(hit ? losses : []);
      expect(result.events.filter((event) => event.type === "quality/changed" && (event as unknown as { amount: number }).amount === -12)).toEqual(hit ? [shaken] : []);
      expect(result.lines.filter((line) => line.key === "line.activity.robbed").map((line) => [line.attention, line.tone])).toEqual(hit ? [[true, "bad"]] : []);
      robbed += hit ? 1 : 0;
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
