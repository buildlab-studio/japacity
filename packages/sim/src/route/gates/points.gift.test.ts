// The family's gift for Canada (route-gates:family-gift-counts-with-deed): opened by the family meeting for a Canada plan, counted in the
// Canadian funds only once its deed is held, and named on the passbook's family road with its deed (wallet:roads-to-the-target).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../../engine/check";
import { checkInvariants } from "../../engine/invariants";
import type { Id, PassbookRoad, ScenarioEntry } from "../../engine/types";
import type { Game } from "../../testing/play";
import { readOf } from "../../testing/read";
import { READY_PAPERS, UNIT, applyEffects, readyLife, slot } from "../../testing/route.journey";
import type { LifeOptions } from "../../testing/route.journey";
import { pointsFunds, pointsUnexplainedBp } from "./points";
import { CANADA_ROUTE, LOOK_INTO, NORTHGATE, UK_ROUTE } from "../../testing/ids";
import { passbookView } from "../../wallet/wallet.passbook";
import { convertMinor } from "../../engine/int";
import { officialRates } from "../../wallet/wallet.rates";

const GIFT: Id<"offer"> = "offer.family-gift-canada";
const MEETING: Id<"activity"> = "activity.family-meeting";
const DEED_ACT: Id<"activity"> = "activity.gift-deed";
const DEED: Id<"document"> = "document.gift-deed";
const ECA: Id<"document"> = "document.eca";
const MEANS = 30;
/** ₦100,000 for each point of the family's means (route-gates.md, Numbers). */
const PER_MEANS = 100000 * UNIT;

const ECA_PAPERS: ScenarioEntry["documents"] = [...READY_PAPERS, { document: ECA, monthsLeft: 60, value: null }];
const POCKETS: ScenarioEntry["pockets"] = { NGN: { bank: 2000000 * UNIT, cash: 3000000 * UNIT }, GBP: { bank: 5000 * UNIT, cash: 0 }, CAD: { bank: 2000 * UNIT, cash: 0 } };

/** The developer with the credential assessment in hand and the family's means at 30, standing 45. */
function developer(options: LifeOptions = {}): Game {
  return readyLife(content, {
    from: "scenario.developer",
    quiet: true,
    documents: ECA_PAPERS,
    pockets: POCKETS,
    qualities: { "quality.family-means": MEANS, "quality.standing": 45, "quality.family-stake": 0 },
    ...options,
  });
}

/** Months pass until Canada is heard of, then its page is looked into; the standing is set back to 45, whatever the months asked of it. */
function canadaKnown(game: Game): void {
  for (let month = 0; month < 6 && game.state.route[CANADA_ROUTE]!.state === "unknown"; month += 1) game.endTurn();
  game.endTurn([slot(LOOK_INTO, CANADA_ROUTE)]);
  expect(game.state.route[CANADA_ROUTE]!.state).toBe("known");
  applyEffects(game, [{ type: "quality/add", quality: "quality.standing", amount: 45 - (game.state.quality["quality.standing"] ?? 0) }]);
}

function openOf(game: Game, offer: Id<"offer">): string | null {
  return Object.values(game.state.offer.items).find((item) => item.entry === offer)?.id ?? null;
}

/** The family meeting called, its gift taken. Returns the gift's naira. */
function takeGift(game: Game): number {
  game.accept({ type: "activity/now", activity: MEETING, param: null });
  const id = openOf(game, GIFT);
  if (id === null) throw new Error("The meeting opened no gift.");
  const gift = Number(game.state.offer.items[id]!.terms["gift"]);
  game.accept({ type: "offer/choose", offer: id, choice: "accept" });
  return gift;
}

/** The Canadian cents the naira bank's `amount` is worth at the day's official rate. */
function inCents(game: Game, amount: number): number {
  return convertMinor(amount, "NGN", "CAD", officialRates(game.world()));
}

describe("route-gates:family-gift-counts-with-deed: the family's gift for Canada", () => {
  test("[route-gates:family-gift-counts-with-deed] [offer:lapsed-offer-removed] given the gift's entry, the deed and its act, when they are read, then the gift is opened only by the meeting, once, for three months, of the family's means times ₦100,000, lapsing into nothing; the deed takes a month at a notary for ₦20,000", () => {
    const gift = content.offer[GIFT]!;
    expect(gift).toMatchObject({ chanceBp: 0, maxTimes: 1, expiresAfter: 3, onExpire: null, where: "home", terms: { gift: { from: "quality", quality: "quality.family-means", times: PER_MEANS } } });
    expect(gift.choices.map((choice) => choice.id)).toEqual(["accept", "decline"]);
    expect(gift.choices[0]!.effects).toEqual([
      { type: "money/add", currency: "NGN", pocket: "bank", amount: { term: "gift" }, reason: "gift", flagged: true },
      { type: "route/gift", route: CANADA_ROUTE, amount: { term: "gift" } },
      { type: "quality/add", quality: "quality.family-stake", amount: 1 },
    ]);
    expect(gift.choices[1]!.effects).toEqual([{ type: "quality/add", quality: "quality.standing", amount: -2 }]);
    expect(content.document[DEED]).toEqual({ id: DEED, wait: [1, 1], validMonths: null, result: null });
    expect(content.activity[DEED_ACT]?.cost).toEqual([{ currency: "NGN", amount: 20000 * UNIT, reason: "fee-document" }]);
    expect(content.activity[MEETING]?.effects).toContainEqual({ type: "offer/open", offer: GIFT });
  });

  test("[route-gates:family-gift-counts-with-deed] given Canada known with the credential assessment held, when the family meeting is called at standing 40, then the gift opens for the family's means times ₦100,000; at standing 39 it does not", () => {
    for (const [standing, opens] of [
      [40, true],
      [39, false],
    ] as const) {
      const game = developer();
      canadaKnown(game);
      applyEffects(game, [{ type: "quality/add", quality: "quality.standing", amount: standing - (game.state.quality["quality.standing"] ?? 0) }]);
      game.accept({ type: "activity/now", activity: MEETING, param: null });
      const id = openOf(game, GIFT);
      expect(id !== null).toBe(opens);
      if (id !== null) expect(game.state.offer.items[id]!.terms["gift"]).toBe(MEANS * PER_MEANS);
    }
  });

  test("[route-gates:family-gift-counts-with-deed] given Canada known but no credential assessment, and no school's offer, when the family meeting is asked for, then it is not legal", () => {
    const game = developer({ documents: READY_PAPERS });
    canadaKnown(game);
    game.expectRejected({ type: "activity/now", activity: MEETING, param: null }, "not-legal");
  });

  test("[route-gates:family-gift-counts-with-deed] [wallet:roads-to-the-target] given the gift taken, when it lands, then the naira bank gains it under gift, flagged, the route records it, and the family's stake rises so the meeting and Papa's loan are shut", () => {
    const game = developer();
    canadaKnown(game);
    const bank = game.state.wallet.pockets.NGN.bank;
    const gift = takeGift(game);
    expect(game.state.wallet.pockets.NGN.bank).toBe(bank + gift);
    expect(game.state.wallet.lots).toContainEqual({ currency: "NGN", amount: gift, month: game.state.turn.month, reason: "gift" });
    expect(game.state.route[CANADA_ROUTE]!.gift).toEqual({ amount: gift, deeded: false });
    expect(game.state.quality["quality.family-stake"]).toBe(1);
    game.expectRejected({ type: "activity/now", activity: MEETING, param: null }, "not-legal");
    game.expectRejected({ type: "activity/now", activity: "activity.ask-family-loan", param: null }, "not-legal");
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[route-gates:family-gift-counts-with-deed] given the gift taken and no deed, when the Canadian funds are read, then the gift is left out at the day's official rate; once the deed is held a month on, it counts and its lot is dropped", () => {
    const game = developer();
    canadaKnown(game);
    const before = pointsFunds(readOf(game), CANADA_ROUTE).shown;
    const gift = takeGift(game);
    expect(pointsFunds(readOf(game), CANADA_ROUTE).shown).toBe(before);
    expect(pointsUnexplainedBp(readOf(game), CANADA_ROUTE)).toBeGreaterThan(0);
    game.accept({ type: "activity/now", activity: DEED_ACT, param: null });
    expect(check(readOf(game), { type: "document/pending", document: DEED }).met).toBe(true);
    expect(game.state.wallet.totals.out["fee-document"]?.NGN).toBe(20000 * UNIT);
    game.endTurn();
    expect(check(readOf(game), { type: "document/held", document: DEED }).met).toBe(true);
    const counted = pointsFunds(readOf(game), CANADA_ROUTE).shown;
    expect(game.state.route[CANADA_ROUTE]!.gift).toEqual({ amount: gift, deeded: true });
    expect(game.state.wallet.lots.filter((lot) => lot.reason === "gift")).toEqual([]);
    expect(pointsUnexplainedBp(readOf(game), CANADA_ROUTE)).toBe(0);
    // The whole naira bank counts once the deed is held.
    const pockets = game.state.wallet.pockets;
    const whole = inCents(game, pockets.NGN.bank) + inCents(game, pockets.NGN.locked) + convertMinor(pockets.GBP.bank, "GBP", "CAD", officialRates(game.world())) + pockets.CAD.bank;
    expect(counted).toBe(whole);
  });

  test("[route-gates:family-gift-counts-with-deed] given the gift taken and part of the naira spent, when the funds are read with no deed, then what is left out is never more than the naira bank holds", () => {
    const game = developer();
    canadaKnown(game);
    takeGift(game);
    const bank = game.state.wallet.pockets.NGN.bank;
    applyEffects(game, [{ type: "money/take", currency: "NGN", pocket: "bank", amount: bank - 1000 * UNIT, reason: "mishap" }]);
    const pockets = game.state.wallet.pockets;
    const others = convertMinor(pockets.GBP.bank, "GBP", "CAD", officialRates(game.world())) + pockets.CAD.bank;
    expect(pointsFunds(readOf(game), CANADA_ROUTE).shown).toBe(others);
  });

  test("[route-gates:family-gift-counts-with-deed] given the deed act, when it is asked for before any gift, or once the deed is held, then it is not legal", () => {
    const none = developer();
    canadaKnown(none);
    none.expectRejected({ type: "activity/now", activity: DEED_ACT, param: null }, "not-legal");
    const twice = developer();
    canadaKnown(twice);
    takeGift(twice);
    twice.accept({ type: "activity/now", activity: DEED_ACT, param: null });
    twice.endTurn();
    twice.expectRejected({ type: "activity/now", activity: DEED_ACT, param: null }, "not-legal");
  });

  test("[route-gates:family-gift-counts-with-deed] [offer:lapsed-offer-removed] given the gift opened and never answered, when its three months pass, then it lapses into nothing", () => {
    const game = developer();
    canadaKnown(game);
    game.accept({ type: "activity/now", activity: MEETING, param: null });
    expect(openOf(game, GIFT)).not.toBeNull();
    game.endTurn();
    game.endTurn();
    expect(openOf(game, GIFT)).not.toBeNull();
    game.endTurn();
    expect(openOf(game, GIFT)).toBeNull();
    expect(game.state.route[CANADA_ROUTE]!.gift).toBeUndefined();
    expect(game.state.quality["quality.family-stake"]).toBe(0);
    expect(game.state.wallet.totals.in.gift).toBeUndefined();
    expect(game.state.wallet.lots.filter((lot) => lot.reason === "gift")).toEqual([]);
  });

  test("[route-gates:family-gift-counts-with-deed] given a school's offer for the master's and Canada known with the assessment, when the meeting is called, then the plan's way picks: Canada made the plan opens the gift, the master's the pledge", () => {
    for (const [plan, opened] of [
      [CANADA_ROUTE, GIFT],
      [UK_ROUTE, "offer.family-pledge-small"],
    ] as const) {
      const game = developer();
      canadaKnown(game);
      applyEffects(game, [
        { type: "route/hear", route: UK_ROUTE, via: "friend" },
        { type: "quality/add", quality: "quality.standing", amount: -5 },
      ]);
      game.state = {
        ...game.state,
        route: { ...game.state.route, [UK_ROUTE]: { ...game.state.route[UK_ROUTE]!, state: "known", knownMonth: game.state.turn.month, schools: { [NORTHGATE]: { state: "offer", readyMonth: game.state.turn.month, discount: 0 } } } },
      };
      game.accept({ type: "chapter/lean", route: plan });
      game.accept({ type: "activity/now", activity: MEETING, param: null });
      const offers = Object.values(game.state.offer.items).map((item) => item.entry);
      expect(offers).toContain(opened);
      expect(offers.filter((entry) => entry === GIFT || entry.startsWith("offer.family-pledge"))).toEqual([opened]);
    }
  });
});

describe("wallet:roads-to-the-target: the family's road for a Canada plan", () => {
  test("[wallet:roads-to-the-target] [route-gates:family-gift-counts-with-deed] given a Canada plan with the assessment held, when the roads are read, then the family's road is the meeting with the gift as its lump; with the gift taken and no deed, the road names the deed", () => {
    const game = developer();
    canadaKnown(game);
    game.accept({ type: "chapter/lean", route: CANADA_ROUTE });
    const family = (): PassbookRoad | undefined => passbookView(readOf(game))?.roads.find((road) => road.road === "family");
    expect(family()).toMatchObject({ via: MEETING, state: "open", lump: MEANS * PER_MEANS });
    takeGift(game);
    expect(family()).toMatchObject({ via: DEED_ACT, state: "open", lump: 0 });
    game.accept({ type: "activity/now", activity: DEED_ACT, param: null });
    expect(family()).toMatchObject({ via: DEED_ACT, state: "shut" });
  });
});
