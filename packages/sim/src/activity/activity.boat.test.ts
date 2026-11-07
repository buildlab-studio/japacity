// The boat work at Makoko's net shed (activity:boat-work-at-the-net-shed), the catch drawn each month on its own stream
// (activity:catch-drawn-each-month, decision 0037) and the match at the viewing centre (activity:watch-the-match). Real content,
// the child of the water played from the prologue as its tile plays it.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp, roundDownTo } from "../engine/int";
import type { CatchBand, Id, World } from "../engine/types";
import type { Game } from "../testing/play";
import { playPrologueBy, start } from "../testing/play";
import { eventsOf, naira, quality } from "../testing/read";
import { applyEffects, draw, seedWhere } from "../testing/route.journey";
import { standInWorld } from "../world/standIn";
import { catchBandAt } from "./activity.pay";

const ASK: Id<"activity"> = "activity.ask-fisherman";
const NETS_ACT: Id<"activity"> = "activity.take-net-work";
const BUY: Id<"activity"> = "activity.buy-canoe";
const TAXI_ACT: Id<"activity"> = "activity.start-canoe-taxi";
const MATCH: Id<"activity"> = "activity.watch-match";
const CREW: Id<"activity"> = "activity.job-canoe-crew";
const OWN: Id<"activity"> = "activity.job-own-canoe";
const NETS: Id<"activity"> = "activity.mend-nets";
const TAXI: Id<"activity"> = "activity.canoe-taxi";
const RACKS: Id<"activity"> = "activity.job-fish-racks";
const PLACE = "offer.canoe-place";
const CIRCLE = "offer.join-ajo";
const NETWORK: Id<"quality"> = "quality.network";
const STANDING: Id<"quality"> = "quality.standing";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const KOBO = 100;
/** The child of the water's tile: commerce at school, work after it, the counter's savings, and the room on the lagoon. */
const WATER = ["begin", "commercial", "work", "save", "makoko"];
/** The shop worker's tile: the same years, and the family house to sleep in. */
const SHOP_WORKER = ["begin", "commercial", "work", "save", "family-house"];

const tuning = content.tuning.activity;
const basePay = (job: Id<"activity">): number => {
  const pay = content.activity[job]?.pay;
  if (pay === null || pay === undefined || typeof pay.amount !== "number") throw new Error(`${job} has no written pay.`);
  return pay.amount;
};
const band = (name: CatchBand) => {
  const found = tuning.catch.find((one) => one.band === name);
  if (found === undefined) throw new Error(`No band ${name}.`);
  return found;
};

/** A world whose rains are as given every tick, the stand-in's otherwise. */
function rainsWorld(rains: 0 | 1): (tick: number) => World {
  return (tick) => {
    const world = standInWorld("world-1", tick, content);
    return { ...world, vars: { ...world.vars, "var.season-rains": rains } };
  };
}

function sixteen(seed: string, answers: readonly string[] = WATER, rains?: 0 | 1): Game {
  const game = start({ content, scenario: "scenario.prologue", seed, ...(rains === undefined ? {} : { worldAt: rainsWorld(rains) }) });
  playPrologueBy(game, answers);
  return game;
}

/** A month ended resting, turns granted when none are banked. */
function month(game: Game) {
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn();
}

function now(game: Game, activity: Id<"activity">) {
  return game.accept({ type: "activity/now", activity, param: null });
}

function placeOffer(game: Game) {
  return game.view().offers.find((offer) => offer.entry === PLACE);
}

/** Asks Sewanu and takes his place: the crew's job held. */
function intoCrew(game: Game): void {
  now(game, ASK);
  const offer = placeOffer(game);
  if (offer === undefined) throw new Error("Sewanu offered no place.");
  game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
}

/** Leaves the life exactly `kobo` naira, all in the bank. */
function holding(game: Game, kobo: number): void {
  const { bank, cash } = game.state.wallet.pockets.NGN;
  applyEffects(game, [
    { type: "money/take", currency: "NGN", pocket: "bank", amount: bank, reason: "mishap" },
    { type: "money/take", currency: "NGN", pocket: "cash", amount: cash, reason: "mishap" },
    { type: "money/add", currency: "NGN", pocket: "bank", amount: kobo, reason: "gift" },
  ]);
}

/** The place's answers among a command's lines, each said as its words' key: the variant's where the line carries one. */
function nowKeys(result: { lines: { key: string; params: Record<string, unknown> }[] }): string[] {
  return result.lines.filter((line) => line.key.endsWith(".now")).map((line) => (typeof line.params["variant"] === "string" ? `${line.key}.${line.params["variant"]}` : line.key));
}

describe("the boat work at the net shed", () => {
  test("[activity:boat-work-at-the-net-shed] given the child of the water in Makoko's room, when Sewanu is asked, then he offers the place in his canoe in his own words, with the crew's job and its base pay, and Take it starts the crew as the main job", () => {
    const game = sixteen("boat-1");
    const asked = now(game, ASK);
    expect(nowKeys(asked)).toEqual(["line.activity.ask-fisherman.now.offer"]);
    const offer = placeOffer(game);
    expect(offer?.terms).toMatchObject({ job: CREW });
    expect(offer?.pay).toEqual({ currency: "NGN", amount: basePay(CREW) });
    expect(offer?.expiresMonth).toBe(game.state.turn.month + 2);
    game.accept({ type: "offer/choose", offer: offer!.id, choice: "accept" });
    expect(game.state.activity.job).toBe(CREW);
  });

  test("[activity:boat-work-at-the-net-shed] given the place offered once, when Sewanu is asked again in a later month, after Not now, then he only talks: the place is offered once a life", () => {
    const game = sixteen("boat-2");
    now(game, ASK);
    game.accept({ type: "offer/choose", offer: placeOffer(game)!.id, choice: "decline" });
    month(game);
    const again = now(game, ASK);
    expect(nowKeys(again)).toEqual(["line.activity.ask-fisherman.now"]);
    expect(placeOffer(game)).toBeUndefined();
    game.expectRejected({ type: "activity/now", activity: ASK, param: null }, "not-legal");
  });

  test("[activity:boat-work-at-the-net-shed] given the place left unanswered, when two months pass, then it lapses into nothing and no job starts", () => {
    const game = sixteen("boat-3");
    now(game, ASK);
    month(game);
    expect(placeOffer(game)).toBeDefined();
    month(game);
    expect(placeOffer(game)).toBeUndefined();
    expect(game.state.activity.job).not.toBe(CREW);
  });

  test("[activity:boat-work-at-the-net-shed] given a life at the family house, when Sewanu is asked at Makoko, then he only talks and nothing is offered, so the place waits for a life on the water", () => {
    const game = sixteen("boat-4", SHOP_WORKER);
    expect(game.state.home.place).toBe("place.family-house");
    expect(nowKeys(now(game, ASK))).toEqual(["line.activity.ask-fisherman.now"]);
    expect(placeOffer(game)).toBeUndefined();
    expect(game.state.offer.timesOpened[PLACE]).toBeUndefined();
  });

  test("[activity:boat-work-at-the-net-shed] [activity:new-job-replaces-held] given the racks held, when Sewanu's place is taken, then the crew replaces the racks, and the racks' months are kept", () => {
    const game = sixteen("boat-5");
    applyEffects(game, [{ type: "activity/start-job", job: RACKS }]);
    month(game);
    intoCrew(game);
    expect(game.state.activity.job).toBe(CREW);
    expect(game.state.activity.tenure[RACKS]).toBe(1);
  });

  test("[activity:boat-work-at-the-net-shed] [activity:capital-opens-own-work] given the crew held 11 months and then 12, when the canoe is bought, then it is refused at 11 and opens your own canoe at 12", () => {
    const game = sixteen("boat-6");
    intoCrew(game);
    for (let at = 0; at < 11; at += 1) month(game);
    expect(game.state.activity.tenure[CREW]).toBe(11);
    holding(game, basePay(OWN) * 10);
    game.expectRejected({ type: "activity/now", activity: BUY, param: null }, "not-legal");
    month(game);
    expect(game.state.activity.tenure[CREW]).toBe(12);
    holding(game, basePay(OWN) * 10);
    now(game, BUY);
    expect(game.state.activity.job).toBe(OWN);
  });

  test("[activity:boat-work-at-the-net-shed] [activity:capital-opens-own-work] given 12 months in the crew, when the canoe is bought with ₦199,999 and then with ₦200,000, then the first is refused and the second takes all of it under goods", () => {
    const game = sixteen("boat-7");
    intoCrew(game);
    for (let at = 0; at < 12; at += 1) month(game);
    expect(content.activity[BUY]?.cost).toEqual([{ currency: "NGN", amount: 20000000, reason: "goods" }]);
    holding(game, 20000000 - KOBO);
    game.expectRejected({ type: "activity/now", activity: BUY, param: null }, "cannot-afford");
    holding(game, 20000000);
    const bought = now(game, BUY);
    expect(naira(game)).toBe(0);
    expect(eventsOf(bought, "wallet/debited").map((event) => event["reason"])).toContain("goods");
    expect(game.state.activity.job).toBe(OWN);
  });

  test("[activity:boat-work-at-the-net-shed] [activity:side-job-holds-a-slot] given a life living in Makoko, when it asks to mend nets, then the side job is held at once, certain, and pays ₦45,000 each month with wellbeing -1; a life at the family house is refused", () => {
    const game = sixteen("boat-8");
    now(game, NETS_ACT);
    expect(game.state.activity.side).toBe(NETS);
    const worked = month(game);
    expect(eventsOf(worked, "activity/side-worked")).toMatchObject([{ side: NETS, pay: { currency: "NGN", amount: basePay(NETS) } }]);
    expect(basePay(NETS)).toBe(4500000);
    expect(content.activity[NETS]?.effects).toEqual([{ type: "quality/add", quality: WELLBEING, amount: -1 }]);
    const away = sixteen("boat-8", SHOP_WORKER);
    away.expectRejected({ type: "activity/now", activity: NETS_ACT, param: null }, "not-legal");
  });

  test("[activity:boat-work-at-the-net-shed] given the crew held, and then your own canoe, when the taxi canoe is asked for, then it is refused with the crew and held with the canoe, paying ₦90,000 a month", () => {
    const game = sixteen("boat-9");
    intoCrew(game);
    game.expectRejected({ type: "activity/now", activity: TAXI_ACT, param: null }, "not-legal");
    applyEffects(game, [{ type: "activity/start-job", job: OWN }]);
    now(game, TAXI_ACT);
    expect(game.state.activity.side).toBe(TAXI);
    expect(eventsOf(month(game), "activity/side-worked")).toMatchObject([{ side: TAXI, pay: { currency: "NGN", amount: 9000000 } }]);
  });

  test("[activity:boat-work-at-the-net-shed] [activity:requirements-judged-at-hunt] given the crew and the nets held in Makoko, when the life moves back to the family house, then both are still held and pay the next month", () => {
    const game = sixteen("boat-10");
    intoCrew(game);
    now(game, NETS_ACT);
    holding(game, 100000000);
    game.accept({ type: "home/move", to: "place.family-house" });
    const worked = month(game);
    expect(game.state.activity.job).toBe(CREW);
    expect(game.state.activity.side).toBe(NETS);
    expect(eventsOf(worked, "activity/month-worked")[0]?.["job"]).toBe(CREW);
    expect(eventsOf(worked, "activity/side-worked")[0]?.["side"]).toBe(NETS);
  });
});

describe("the catch", () => {
  test("[activity:catch-drawn-each-month] given the bands as content holds them, when they are read, then lean pays half, fair the base and good 1.6 times, and the chances make the whole both in the dry months and in the rains", () => {
    expect(tuning.catch.map((one) => [one.band, one.payBp])).toEqual([
      ["lean", 5000],
      ["fair", 10000],
      ["good", 16000],
    ]);
    expect(tuning.catch.map((one) => one.chanceBp)).toEqual([2500, 5000, 2500]);
    expect(tuning.catch.map((one) => one.rainsBp)).toEqual([3500, 5000, 1500]);
    expect(content.activity[CREW]?.catch).toBe(true);
    expect(content.activity[OWN]?.catch).toBe(true);
    expect(Object.values(content.activity).filter((entry) => entry.catch === true).map((entry) => entry.id).sort()).toEqual([CREW, OWN].sort());
  });

  test("[activity:catch-drawn-each-month] given a draw at each edge, when its band is read, then the dry months turn at 2,500 and 7,500 and the rains at 3,500 and 8,500", () => {
    const at = (rains: boolean, roll: number) => catchBandAt(tuning.catch, rains, roll).band;
    expect([0, 2499, 2500, 7499, 7500, 9999].map((roll) => at(false, roll))).toEqual(["lean", "lean", "fair", "fair", "good", "good"]);
    expect([0, 3499, 3500, 8499, 8500, 9999].map((roll) => at(true, roll))).toEqual(["lean", "lean", "fair", "fair", "good", "good"]);
  });

  for (const [name, rains, from, to] of [
    ["lean", 0, 0, 2499],
    ["fair", 0, 2500, 7499],
    ["good", 0, 7500, 9999],
    ["lean", 1, 2500, 3499],
    ["good", 1, 8500, 9999],
  ] as const) {
    test(`[activity:catch-drawn-each-month] given the crew's first month with the catch's draw from ${String(from)} to ${String(to)}${rains === 1 ? " in the rains" : ""}, when the month ends, then the catch is ${name}, the pay is the base scaled by its band in whole naira, and the pay line carries the band`, () => {
      const seed = seedWhere((candidate) => {
        const roll = draw(candidate, "catch", 0, 10000);
        return roll >= from && roll <= to;
      });
      const game = sixteen(seed, WATER, rains);
      intoCrew(game);
      const worked = month(game);
      const sick = eventsOf(worked, "activity/sick-pay").length > 0;
      const paid = eventsOf(worked, "activity/month-worked")[0];
      expect(paid).toMatchObject({ job: CREW, catch: name });
      const expected = roundDownTo(bp(basePay(CREW), band(name).payBp), KOBO);
      expect(paid?.["pay"]).toEqual({ currency: "NGN", amount: sick ? bp(expected, content.tuning.health.sickPayBp) : expected });
      const line = worked.lines.find((one) => one.key === "line.activity.salary");
      expect(line?.params).toMatchObject({ job: CREW, catch: name });
      expect(game.state.draws.catch).toBe(1);
    });
  }

  test("[activity:catch-drawn-each-month] given the crew held and a month on sick pay or not, when months are worked, then the catch is drawn once every month the boat job is held", () => {
    const game = sixteen("catch-months");
    intoCrew(game);
    for (let at = 1; at <= 6; at += 1) {
      month(game);
      expect(game.state.draws.catch).toBe(at);
    }
  });

  test("[activity:catch-drawn-each-month] given the child of the water at the racks and a life at the family house, when months pass with no boat job, then neither draws on the catch's stream", () => {
    for (const game of [sixteen("catch-none"), sixteen("catch-none", SHOP_WORKER)]) {
      applyEffects(game, [{ type: "activity/start-job", job: RACKS }]);
      for (let at = 0; at < 4; at += 1) month(game);
      expect(game.state.draws.catch).toBeUndefined();
    }
  });

  test("[activity:catch-drawn-each-month] [wallet:view-carries-month-pay] given the crew held, when the view is read, then the job's month pay is the base, before any catch", () => {
    const game = sixteen("catch-view");
    intoCrew(game);
    expect(game.view().job.pay).toEqual({ currency: "NGN", amount: basePay(CREW) });
  });

  test("[activity:catch-drawn-each-month] [activity:capital-opens-own-work] given your own canoe held six months, when its base is read, then it has grown as own work grows, and a fair month pays that base", () => {
    const seed = seedWhere((candidate) => Array.from({ length: 7 }, (_, n) => draw(candidate, "catch", n, 10000)).every((roll) => roll >= 2500 && roll < 7500));
    const game = sixteen(seed);
    applyEffects(game, [{ type: "activity/start-job", job: OWN }]);
    for (let at = 0; at < 6; at += 1) month(game);
    const grown = basePay(OWN) + bp(bp(basePay(OWN), content.tuning.activity.raiseBp), 5000);
    expect(game.view().job.pay).toEqual({ currency: "NGN", amount: grown });
    const worked = month(game);
    const sick = eventsOf(worked, "activity/sick-pay").length > 0;
    const fair = roundDownTo(grown, KOBO);
    expect(eventsOf(worked, "activity/month-worked")[0]?.["pay"]).toEqual({ currency: "NGN", amount: sick ? bp(fair, content.tuning.health.sickPayBp) : fair });
  });
});

describe("the match", () => {
  test("[activity:watch-the-match] given a life at Makoko, when the match is watched the first time, then it costs ₦1,000 under social, adds network 2 and wellbeing 3, names Sewanu's boat work, and draws nothing on offer", () => {
    const game = sixteen("match-1");
    expect(content.activity[MATCH]?.cost).toEqual([{ currency: "NGN", amount: 100000, reason: "social" }]);
    const network = quality(game, NETWORK);
    const offers = game.state.draws.offer ?? 0;
    const watched = now(game, MATCH);
    expect(nowKeys(watched)).toEqual(["line.activity.watch-match.now.first"]);
    expect(quality(game, NETWORK)).toBe(network + 2);
    expect(eventsOf(watched, "wallet/debited").map((event) => event["reason"])).toEqual(["social"]);
    expect(game.state.draws.offer ?? 0).toBe(offers);
    game.expectRejected({ type: "activity/now", activity: MATCH, param: null }, "not-legal");
  });

  test("[activity:watch-the-match] given the match watched once, when it is watched in a later month, then the place's plain line answers and one draw is made on offer", () => {
    const game = sixteen("match-2");
    now(game, MATCH);
    month(game);
    const offers = game.state.draws.offer ?? 0;
    const again = now(game, MATCH);
    expect(nowKeys(again)).toEqual(["line.activity.watch-match.now"]);
    expect(game.state.draws.offer).toBe(offers + 1);
  });

  test("[activity:watch-the-match] [luck:savings-circle-holds-pot] given a life with the circle's standing and network, when a later watch's draw lands under 2,000, then the savings circle opens; over it, none does", () => {
    for (const lands of [true, false]) {
      let found = false;
      for (let at = 0; at < 400 && !found; at += 1) {
        const game = sixteen(`match-circle-${String(at)}`);
        now(game, MATCH);
        month(game);
        applyEffects(game, [
          { type: "quality/add", quality: STANDING, amount: 40 },
          { type: "quality/add", quality: NETWORK, amount: 20 },
        ]);
        if (game.view().offers.some((offer) => offer.entry === CIRCLE)) continue;
        const n = game.state.draws.offer ?? 0;
        if (draw(game.state.seed, "offer", n, 10000) < tuning.matchCircleBp !== lands) continue;
        found = true;
        now(game, MATCH);
        expect(game.view().offers.some((offer) => offer.entry === CIRCLE)).toBe(lands);
      }
      expect(found).toBe(true);
    }
  });

  test("[activity:watch-the-match] given a life short of the circle's network, when a later watch's draw lands, then the draw is made and no circle opens", () => {
    let found = false;
    for (let at = 0; at < 400 && !found; at += 1) {
      const game = sixteen(`match-short-${String(at)}`);
      now(game, MATCH);
      month(game);
      if (quality(game, NETWORK) >= 20) applyEffects(game, [{ type: "quality/add", quality: NETWORK, amount: -quality(game, NETWORK) }]);
      const n = game.state.draws.offer ?? 0;
      if (draw(game.state.seed, "offer", n, 10000) >= tuning.matchCircleBp) continue;
      found = true;
      now(game, MATCH);
      expect(game.state.draws.offer).toBe(n + 1);
      expect(game.view().offers.some((offer) => offer.entry === CIRCLE)).toBe(false);
    }
    expect(found).toBe(true);
  });
});
