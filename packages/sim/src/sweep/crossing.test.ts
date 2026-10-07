// Rules that cross kinds, played end to end on the real content: an offer
// that changes the funds, a lender that takes money back, a refusal that
// undoes the checklist, a float that moves the funds, a hunt that ends in pay.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { convertMinor, mulDiv } from "../engine/int";
import type { Content, Currency, ForeignCurrency, Id, PlayerView, State } from "../engine/types";
import { NORTHGATE, offeredWith, readyContent, readyLife, seedWhere, slot, answerFirst, toDeposit, toOffer, uk, UK, UNIT } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { newsSchedule } from "../world/schedule";
import { standInWorld } from "../world/standIn";

function officialOf(pairs: PlayerView["rates"]): Record<ForeignCurrency, number> {
  const rates = {} as Record<ForeignCurrency, number>;
  for (const [currency, pair] of Object.entries(pairs) as [ForeignCurrency, { official: number }][]) rates[currency] = pair.official;
  return rates;
}

/** R-ROUTE-010 worked out by hand: bank and locked pockets of every currency, and the family support, in pence at the official rate. */
function fundsByHand(state: State, pairs: PlayerView["rates"]): number {
  const rates = officialOf(pairs);
  let shown = 0;
  for (const [currency, pocket] of Object.entries(state.wallet.pockets) as [Currency, State["wallet"]["pockets"]["NGN"]][]) {
    shown += convertMinor(pocket.bank, currency, "GBP", rates) + convertMinor(pocket.locked, currency, "GBP", rates);
  }
  const support = state.route[UK]?.support ?? null;
  if (support !== null) shown += convertMinor(support.amount, support.currency, "GBP", rates);
  return shown;
}

function fundsItem(view: PlayerView) {
  const item = view.routes.find((route) => route.id === UK)?.checklist.find((entry) => entry.id === "funds");
  if (item === undefined) throw new Error("The UK route shows no funds item.");
  return item;
}

function checklistMet(view: PlayerView, id: string): boolean {
  const item = view.routes.find((route) => route.id === UK)?.checklist.find((entry) => entry.id === id);
  if (item === undefined) throw new Error(`The UK route shows no ${id} item.`);
  return item.met;
}

function offerOf(view: PlayerView, entry: string) {
  return view.offers.find((offer) => offer.entry === entry);
}

/** A seed whose first school answer from Northgate is an offer for this grade. */
function offerSeed(used: Content, grade: number): string {
  return seedWhere((seed) => offeredWith(seed, used, NORTHGATE, grade));
}

describe("rules that cross kinds", () => {
  test("[R-OFFER-003] [R-ROUTE-010] given Ada with a school's offer, when the family meeting's pledge is accepted, then its support sits on the route and counts toward the funds shown, valued at the official rate", () => {
    const used = readyContent(content);
    const game = readyLife(content, { seed: offerSeed(used, 4) });
    toOffer(game);
    game.endTurn([slot("activity.family-meeting")]);
    // Standing decides which pledge the meeting opens: the full one from 50, the small one below.
    const pledge = game.view().offers.find((offer) => offer.entry === "offer.family-pledge" || offer.entry === "offer.family-pledge-small");
    expect(pledge).toBeDefined();
    const show = pledge!.terms.show as number;
    const perPoint = pledge!.entry === "offer.family-pledge" ? 300000 : 150000;
    expect(show).toBe((game.state.quality["quality.family-means"] ?? 0) * perPoint * UNIT);
    const before = fundsItem(game.view()).have ?? 0;

    game.accept({ type: "offer/choose", offer: pledge!.id, choice: "accept" });

    const view = game.view();
    expect(uk(game).support).toEqual({ currency: "NGN", amount: show });
    expect(view.routes.find((route) => route.id === UK)?.support).toEqual({ currency: "NGN", amount: show });
    expect(fundsItem(view).have).toBe(fundsByHand(game.state, view.rates));
    // The pledge's support and its gift both count; neither is spendable as the support.
    const rates = officialOf(view.rates);
    const gift = pledge!.terms.gift as number;
    expect((fundsItem(view).have ?? 0) - before).toBeGreaterThanOrEqual(convertMinor(show, "NGN", "GBP", rates) + convertMinor(gift, "NGN", "GBP", rates) - 2);
    expect(game.state.wallet.pockets.NGN.locked).toBe(0);
  });

  describe("held funds", () => {
    // Tunde, papers in hand. His pounds leave him £1,000 short of the funds once the Northgate deposit is paid, and his naira is next to nothing.
    const SHORT = 100000;
    const pinned = { "var.uk-living-line": 117100, "var.uk-living-months": 9, "var.fx-bank-queue": 0 } as Record<Id<"var">, number>;
    function heldLife(): Game {
      const required = 1700000 - 400000 + 117100 * 9;
      const options = {
        from: "scenario.tunde" as Id<"scenario">,
        pockets: { NGN: { bank: 0, cash: 0 }, GBP: { bank: required + 400000 - SHORT, cash: 0 } },
        vars: () => pinned,
        quiet: true,
      };
      const used = readyContent(content, options);
      return readyLife(content, { ...options, seed: offerSeed(used, 3) });
    }

    /** Ends rested months until the held-funds offer opens. */
    function toHeldFundsOffer(game: Game) {
      for (let month = 0; month < 4 && offerOf(game.view(), "offer.held-funds") === undefined; month += 1) game.endTurn();
      const offer = offerOf(game.view(), "offer.held-funds");
      if (offer === undefined) throw new Error("No held-funds offer opened.");
      return offer;
    }

    test("[R-OBLIGATION-006] [R-ROUTE-010] [R-ROUTE-011] given a deposit paid and the funds short, when the bank's held funds are taken, then the principal is locked, counts toward the funds shown, and the next month end counts the funds as held", () => {
      const game = heldLife();
      toDeposit(game);
      const offer = toHeldFundsOffer(game);
      const pick = offer.choices.find((choice) => choice.id === "take")?.pick;
      expect(pick).not.toBeNull();
      const amount = pick!.max;
      const before = fundsItem(game.view());
      expect(before.met).toBe(false);

      game.accept({ type: "offer/choose", offer: offer.id, choice: "take", amount });

      expect(game.state.wallet.pockets.NGN.locked).toBe(amount);
      const held = Object.values(game.state.obligation.items).find((item) => item.entry === "obligation.held-funds");
      expect(held?.principal).toBe(amount);
      const view = game.view();
      expect(fundsItem(view).have).toBe(fundsByHand(game.state, view.rates));
      expect(fundsItem(view).met).toBe(true);
      game.endTurn();
      expect(uk(game).funds.covered).toBe(true);
      expect(uk(game).funds.heldMonths).toBe(1);
    });

    test("[R-OBLIGATION-007] [R-ROUTE-011] given held funds that made the funds covered, when a month's interest cannot be paid, then the lender takes the locked principal back at once, the obligation closes, and that month's funds check goes back to zero", () => {
      const game = heldLife();
      toDeposit(game);
      const offer = toHeldFundsOffer(game);
      const amount = offer.choices.find((choice) => choice.id === "take")!.pick!.max;
      game.accept({ type: "offer/choose", offer: offer.id, choice: "take", amount });
      game.endTurn();
      expect(uk(game).funds.heldMonths).toBe(1);
      const standing = game.state.quality["quality.standing"] ?? 0;

      // No salary and no naira left: the next interest charge is missed.
      game.accept({ type: "activity/quit" });
      const naira = game.state.wallet.pockets.NGN;
      if (naira.bank > 0) game.accept({ type: "wallet/move", currency: "NGN", amount: naira.bank, to: "cash" });
      const cash = game.state.wallet.pockets.NGN.cash;
      if (cash > 0) game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: cash, via: "aboki" });
      expect(game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash).toBe(0);
      const done = game.endTurn();

      expect(game.state.wallet.pockets.NGN.locked).toBe(0);
      expect(Object.values(game.state.obligation.items).some((item) => item.entry === "obligation.held-funds")).toBe(false);
      expect(done.events.some((event) => event.type === "wallet/debited" && "reason" in event && event.reason === "held-funds-return")).toBe(true);
      expect(game.state.quality["quality.standing"]).toBeLessThan(standing);
      expect(uk(game).funds.covered).toBe(false);
      expect(uk(game).funds.heldMonths).toBe(0);
      expect(fundsItem(game.view()).met).toBe(false);
    });
  });

  test("[R-ROUTE-018] [R-CHAPTER-003] [R-CHAPTER-002] given chapter 3 open and a visa refused, when the decision is made, then the confirmation is voided, the route's and the chapter's deposit and applied items come undone, chapter 3 stays current and the chapters before it stay done", () => {
    const options = { from: "scenario.tunde" as Id<"scenario">, tuning: { refusalMinBp: 10000, refusalMaxBp: 10000 } };
    const used = readyContent(content, options);
    const game = readyLife(content, { ...options, seed: offerSeed(used, 3) });
    toOffer(game);
    game.accept({ type: "route/pay-deposit", route: UK, school: NORTHGATE });
    // Chapter 2 closed on the offer, at most one a month: rest until chapter 3 is the current one and the funds were held at a month end.
    for (let month = 0; month < 3 && (game.view().chapter.current !== "chapter.decision-day" || uk(game).funds.heldMonths < 1); month += 1) game.endTurn();
    expect(game.view().chapter.current).toBe("chapter.decision-day");
    const doneBefore = game.view().chapter.done;
    expect(doneBefore).toEqual(expect.arrayContaining(["chapter.find-your-feet", "chapter.build-the-file"]));
    expect(uk(game).funds.heldMonths).toBeGreaterThanOrEqual(1);
    game.endTurn([slot("activity.apply-for-visa")]);
    expect(uk(game).state).toBe("applying");
    expect(game.view().chapter.items.find((item) => item.id === "applied")?.met).toBe(true);
    answerFirst(game);
    game.endTurn();

    const view = game.view();
    expect(uk(game).state).toBe("known");
    expect(uk(game).refusals).toBe(1);
    expect(game.state.document["document.cas"]).toBeUndefined();
    expect(checklistMet(view, "deposit")).toBe(false);
    expect(checklistMet(view, "applied")).toBe(false);
    expect(view.chapter.current).toBe("chapter.decision-day");
    expect(view.chapter.items.find((item) => item.id === "deposit")?.met).toBe(false);
    expect(view.chapter.items.find((item) => item.id === "applied")?.met).toBe(false);
    expect(view.chapter.done).toEqual(doneBefore);
    // The offer stands, so the deposit can be paid again (R-ROUTE-018).
    expect(uk(game).schools[NORTHGATE]?.state).toBe("offer");
    game.accept({ type: "route/pay-deposit", route: UK, school: NORTHGATE });
    expect(checklistMet(game.view(), "deposit")).toBe(true);
  });

  test("[R-RATE-004] [R-ROUTE-010] [R-ROUTE-011] given savings held in naira and a deposit paid, when the float comes into force, then the official rate jumps to 3% under the street rate and that month's funds shown in pence fall with it", () => {
    const worldSeed = seedWhere((seed) => (newsSchedule(seed, content)["news.naira-float"]?.inForce ?? 0) > 12);
    const floatTick = newsSchedule(worldSeed, content)["news.naira-float"]!.inForce;
    const used = readyContent(content, { pockets: { NGN: { bank: 30000000 * UNIT, cash: 1500000 * UNIT }, GBP: { bank: 8000 * UNIT, cash: 0 } } });
    const game = start({ scenario: "scenario.ready", content: used, seed: offerSeed(used, 4), worldSeed });
    toDeposit(game);
    while (game.tick < floatTick) {
      if (game.state.turn.banked === 0) game.grant(1);
      game.endTurn();
    }
    // The month just ended ran at the tick before the float; the next runs at the float's tick.
    const ratesBefore = standInWorld(worldSeed, floatTick - 1, used).rates;
    const ratesAfter = standInWorld(worldSeed, floatTick, used).rates;
    const before = uk(game).funds.shown;
    expect(before).toBe(fundsByHand(game.state, ratesBefore));
    if (game.state.turn.banked === 0) game.grant(1);

    game.endTurn();

    expect(ratesAfter.GBP.official).toBeGreaterThan(ratesBefore.GBP.official);
    expect(ratesAfter.GBP.official).toBe(mulDiv(ratesBefore.GBP.street, 10000, 10000 + content.tuning.rate.floatPremiumBp));
    expect(uk(game).funds.shown).toBe(fundsByHand(game.state, ratesAfter));
    expect(uk(game).funds.shown).toBeLessThan(before);
  });

  test("[R-ACTIVITY-005] [R-OFFER-007] [R-ACTIVITY-001] given Ada with no job, when a month of hunting lands the teaching job, then a job offer opens naming it, accepting starts the job at once, and the next month pays its salary to the bank", () => {
    const seed = seedWhere((candidate) => {
      const trial = start({ scenario: "scenario.ada", seed: candidate, content });
      trial.endTurn([slot("activity.job-hunt", "activity.job-teacher")]);
      return offerOf(trial.view(), "offer.job") !== undefined;
    });
    const game = start({ scenario: "scenario.ada", seed, content });
    game.endTurn([slot("activity.job-hunt", "activity.job-teacher")]);
    const offer = offerOf(game.view(), "offer.job");
    expect(offer?.terms.job).toBe("activity.job-teacher");
    expect(game.view().job.id).toBeNull();

    game.accept({ type: "offer/choose", offer: offer!.id, choice: "accept" });
    expect(game.view().job).toEqual({ id: "activity.job-teacher", months: 0 });
    const salaryBefore = game.state.wallet.totals.in.salary?.NGN ?? 0;

    const month = game.endTurn();

    const pay = content.activity["activity.job-teacher"]!.pay!.amount as number;
    expect(month.events).toContainEqual(expect.objectContaining({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: pay, reason: "salary" }));
    expect((game.state.wallet.totals.in.salary?.NGN ?? 0) - salaryBefore).toBe(pay);
    expect(game.view().job).toEqual({ id: "activity.job-teacher", months: 1 });
  });
});
