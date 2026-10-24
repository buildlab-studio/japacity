// Side jobs and the one chance: activity:side-job-holds-a-slot and activity:one-chance-bus-robbery,
// health:sick-pay-unless-sick-leave.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp } from "../engine/int";
import type { Id } from "../engine/types";
import { ALWAYS_GRANTED, offeredSeed } from "../testing/place.journey";
import { applyEffects, draw, readyLife, slot, toDecision } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { moneyOf, readOf } from "../testing/read";
import { freeSlots } from "../turn/turn.logic";
import { sideJobHeld, SIDE_JOB_LOCK } from "./activity.logic";
import { HUNT, NIGHT_SUPPORT, RIDE, TUTORING, UK_ROUTE } from "../testing/ids";

const tuning = content.tuning;

function payOf(id: Id<"activity">): number {
  const amount = content.activity[id]?.pay?.amount;
  if (typeof amount !== "number") throw new Error(`${id} pays no fixed figure.`);
  return amount;
}

/** A graduate whose English meets night support's 60 and tech its 40 (activity:each-trade-climbs-its-ladder), so it may be hunted. */
function nightReady(): Game {
  const game = start({ content, scenario: "scenario.graduate" });
  applyEffects(game, [
    { type: "quality/add", quality: "quality.english", amount: 60 - (game.state.quality["quality.english"] ?? 0) },
    { type: "quality/add", quality: "quality.tech", amount: 40 - (game.state.quality["quality.tech"] ?? 0) },
  ]);
  return game;
}

/** A life holding a side job, taken as the job offer's acceptance takes it. */
function sideJob(scenario: Id<"scenario">, side: Id<"activity">): Game {
  const game = start({ content, scenario });
  applyEffects(game, [{ type: "activity/start-job", job: side }]);
  return game;
}

describe("side jobs", () => {
  test("[activity:side-job-holds-a-slot] [activity:job-hunt-lands-offer] given a hunt for a side job, when it lands and the offer is accepted, then the side job is held beside no job, one slot is locked for it and the month's free slots drop by one", () => {
    const game = nightReady();
    expect(game.view().freeSlots).toBe(tuning.turn.freeSlotsNoJob);
    let offer: string | undefined;
    for (let month = 0; month < 30 && offer === undefined; month += 1) {
      game.endTurn([slot(HUNT, NIGHT_SUPPORT)]);
      offer = game.view().offers.find((open) => open.entry === "offer.job" && open.terms.job === NIGHT_SUPPORT)?.id;
    }
    if (offer === undefined) throw new Error("No hunt landed in 30 months.");
    const accepted = game.accept({ type: "offer/choose", offer, choice: "accept" });
    expect(accepted.events).toContainEqual({ type: "activity/side-started", side: NIGHT_SUPPORT, previous: null });
    expect(game.state.activity).toMatchObject({ job: null, side: NIGHT_SUPPORT });
    // wallet:view-carries-month-pay: the view carries each job's month as the wallet will book it.
    expect(game.view().job).toEqual({ id: null, months: 0, side: NIGHT_SUPPORT, pay: null, sidePay: { currency: "USD", amount: payOf(NIGHT_SUPPORT) } });
    expect(game.view().locks).toEqual([{ slots: 1, untilMonth: game.state.turn.month, why: SIDE_JOB_LOCK }]);
    expect(game.view().freeSlots).toBe(tuning.turn.freeSlotsNoJob - 1);
    expect(sideJobHeld(readOf(game))).toBe(true);
    // The side job is not hunted again while held.
    expect(game.view().activities.find((option) => option.id === HUNT)?.params).not.toContain(NIGHT_SUPPORT);
  });

  test("[wallet:view-carries-month-pay] given a hunt for a side job that lands, when the offer is read, then it says the month's pay; once the side job is held the view's side pay is the same, and the month books exactly it", () => {
    const game = nightReady();
    let offer: { id: string; pay?: { currency: string; amount: number } } | undefined;
    for (let month = 0; month < 30 && offer === undefined; month += 1) {
      game.endTurn([slot(HUNT, NIGHT_SUPPORT)]);
      offer = game.view().offers.find((open) => open.entry === "offer.job" && open.terms.job === NIGHT_SUPPORT);
    }
    if (offer === undefined) throw new Error("No hunt landed in 30 months.");
    expect(offer.pay).toEqual({ currency: "USD", amount: payOf(NIGHT_SUPPORT) });
    game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
    expect(game.view().job.sidePay).toEqual(offer.pay);
    expect(moneyOf(game.endTurn(), "salary").map((money) => money.amount)).toEqual([offer.pay?.amount]);
  });

  test("[activity:side-job-holds-a-slot] [wallet:money-lands-as-in-lagos] given a side job paid in dollars and one paid in naira, when a month is played, then the dollars go to the bank and the naira, a month's pay over the line for cash, to the bank as well, its toll applies, and the slot stays locked for the next month", () => {
    const night = sideJob("scenario.graduate", NIGHT_SUPPORT);
    const month = night.endTurn();
    expect(moneyOf(month, "salary")).toEqual([{ type: "wallet/credited", currency: "USD", pocket: "bank", amount: payOf(NIGHT_SUPPORT), reason: "salary" }]);
    expect(month.events).toContainEqual({ type: "quality/changed", quality: "quality.wellbeing", amount: -6, source: NIGHT_SUPPORT });
    expect(month.lines.map((line) => line.key)).toContain("line.activity.side-pay");
    expect(night.view().locks).toEqual([{ slots: 1, untilMonth: night.state.turn.month, why: SIDE_JOB_LOCK }]);
    expect(freeSlots(night.state, content)).toBe(tuning.turn.freeSlotsNoJob - 1);
    night.expectRejected({ type: "turn/end", slots: [slot("activity.rest"), slot("activity.rest"), slot("activity.rest")] }, "not-legal");

    const tutoring = sideJob("scenario.graduate", TUTORING);
    expect(payOf(TUTORING)).toBeGreaterThan(tuning.wallet.cashUpTo);
    expect(moneyOf(tutoring.endTurn(), "gig")).toEqual([{ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: payOf(TUTORING), reason: "gig" }]);
  });

  test("[activity:side-job-holds-a-slot] given a job and a side job, when the side job is quit, then only it ends; with none held, quitting a side job is not legal; one side job at a time", () => {
    const banker = sideJob("scenario.banker", TUTORING);
    applyEffects(banker, [{ type: "activity/start-job", job: RIDE }]);
    expect(banker.state.activity).toMatchObject({ job: "activity.job-bank-officer", side: RIDE });
    const quit = banker.accept({ type: "activity/quit", side: true });
    expect(quit.events).toContainEqual({ type: "activity/side-ended", side: RIDE, why: "quit" });
    expect(quit.lines.map((line) => line.key)).toEqual(["line.activity.side-quit"]);
    expect(banker.state.activity).toMatchObject({ job: "activity.job-bank-officer", side: null });
    expect(sideJobHeld(readOf(banker))).toBe(false);
    banker.expectRejected({ type: "activity/quit", side: true }, "not-legal");
    // The plain quit is still the job's.
    banker.accept({ type: "activity/quit" });
    expect(banker.state.activity.job).toBeNull();
  });

  test("[activity:side-job-holds-a-slot] given a job and a side job, when `activity/end-job` names the side slot, then only the side job ends, with the effect's why; with no side job held it ends nothing", () => {
    const banker = sideJob("scenario.banker", RIDE);
    applyEffects(banker, [{ type: "activity/end-job", why: "moved", side: true }]);
    expect(banker.state.activity).toMatchObject({ job: "activity.job-bank-officer", side: null });
    const before = banker.state.activity;
    applyEffects(banker, [{ type: "activity/end-job", why: "moved", side: true }]);
    expect(banker.state.activity).toEqual(before);
  });

  test("[activity:side-job-holds-a-slot] given a job and a side job, when `activity/end-job` names no slot, then only the main job ends, whatever its why", () => {
    for (const why of ["moved", "side-moved"]) {
      const banker = sideJob("scenario.banker", RIDE);
      applyEffects(banker, [{ type: "activity/end-job", why }]);
      expect(banker.state.activity).toMatchObject({ job: null, side: RIDE });
    }
  });

  test("[activity:side-job-holds-a-slot] [place:entries-legal-by-where] given a side job at home, when the character arrives abroad, then it ends in the first month", () => {
    const game = sideJob("scenario.graduate", TUTORING);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    const month = game.endTurn();
    expect(month.events).toContainEqual({ type: "activity/side-ended", side: TUTORING, why: "moved" });
    expect(moneyOf(month, "gig")).toEqual([]);
  });

  test("[activity:side-job-holds-a-slot] [place:entries-legal-by-where] given a side job at home, when the character flies, then it ends at the flight, before any month abroad, and the job held at home ends with it", () => {
    const game = readyLife(content, { seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
    toDecision(game);
    applyEffects(game, [{ type: "activity/start-job", job: TUTORING }]);
    expect(game.state.activity.side).toBe(TUTORING);
    const flight = game.accept({ type: "route/depart", route: UK_ROUTE });
    expect(game.state.place.where).toBe("abroad");
    expect(game.state.activity.side).toBeNull();
    expect(flight.events).toContainEqual({ type: "activity/side-ended", side: TUTORING, why: "moved" });
    expect(flight.lines.map((line) => line.key)).toContain("line.activity.side-ended");
    expect(game.state.activity.job).toBeNull();
    const month = game.endTurn();
    expect(month.events.filter((event) => event.type === "activity/side-ended")).toEqual([]);
  });

  test("[activity:side-job-holds-a-slot] [place:entries-legal-by-where] given no side job, when the character flies, then the flight ends no side job and the job at home ends", () => {
    const game = readyLife(content, { seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
    toDecision(game);
    applyEffects(game, [{ type: "activity/start-job", job: "activity.job-bank-officer" }]);
    expect(game.state.activity).toMatchObject({ job: "activity.job-bank-officer", side: null });
    const flight = game.accept({ type: "route/depart", route: UK_ROUTE });
    expect(flight.events.filter((event) => event.type === "activity/side-ended")).toEqual([]);
    expect(flight.events).toContainEqual({ type: "activity/job-ended", job: "activity.job-bank-officer", why: "moved" });
    expect(game.state.activity).toMatchObject({ job: null, side: null });
  });

  test("[health:sick-pay-unless-sick-leave] given a side job and a slot locked for illness, when the month is played, then it pays the sick share", () => {
    const game = sideJob("scenario.graduate", TUTORING);
    applyEffects(game, [{ type: "turn/lock", slots: 1, months: 1, why: "illness" }]);
    expect(moneyOf(game.endTurn(), "gig")[0]?.amount).toBe(bp(payOf(TUTORING), tuning.health.sickPayBp));
  });
});

describe("the one chance", () => {
  test("[activity:one-chance-bus-robbery] [wallet:money-lands-as-in-lagos] given a side job at home, when the draw on `street` falls under the chance, then the cash goes, the phone is paid from the bank, wellbeing drops 12 and the line asks for attention; the rest of the bank, the month's pay in it, is not touched", () => {
    const game = sideJob("scenario.banker", RIDE);
    let robbed = 0;
    for (let month = 0; month < 400 && robbed === 0; month += 1) {
      if (game.state.turn.banked < 1) game.grant(tuning.turn.cap);
      const n = game.state.draws.street ?? 0;
      const hit = draw(game.state.seed, "street", n, 10000) < tuning.ladder.oneChanceBp;
      const pocket = game.state.wallet.pockets.NGN;
      const result = game.endTurn();
      expect(game.state.draws.street).toBe(n + 1);
      // The side job's naira pay, over the line for cash, lands in the bank (wallet:money-lands-as-in-lagos): the bus takes the cash on you.
      expect(payOf(RIDE)).toBeGreaterThan(tuning.wallet.cashUpTo);
      const cash = pocket.cash;
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

  test("[activity:one-chance-bus-robbery] given a month with a safe ride or a night at the office, or no side job, when the month is played, then there is no draw on `street`", () => {
    for (const counter of ["activity.safe-ride", "activity.sleep-at-office"] as const) {
      const game = sideJob("scenario.banker", RIDE);
      const n = game.state.draws.street ?? 0;
      game.endTurn([slot(counter)]);
      expect(game.state.draws.street ?? 0).toBe(n);
    }
    const plain = start({ content, scenario: "scenario.banker" });
    plain.endTurn();
    expect(plain.state.draws.street ?? 0).toBe(0);
  });

  test("[activity:one-chance-bus-robbery] given the safe ride, when it is played, then it costs ₦25,000 under upkeep", () => {
    const game = sideJob("scenario.banker", RIDE);
    const result = game.endTurn([slot("activity.safe-ride")]);
    expect(moneyOf(result, "upkeep").filter((event) => event.amount === 2500000)).toHaveLength(1);
  });
});
