// Rules that cross kinds, played end to end on the real content: an offer
// that changes the funds, a lender that takes money back, a refusal that
// undoes the checklist, a float that moves the funds, a hunt that ends in pay.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import { checkInvariants } from "../engine/invariants";
import { applyOverlay } from "../engine/overlay";
import { bp, convertMinor, mulDiv } from "../engine/int";
import type { Accepted, Content, Currency, ForeignCurrency, Id, PlayerView, State } from "../engine/types";
import { flownAda } from "../goal/goal.journey";
import { abroad, closeTypes, markBy, setPounds, settledAbroad } from "../obligation/obligation.journey";
import { applyEffects, draw, NORTHGATE, offeredWith, READY_PAPERS, readyContent, readyLife, seedWhere, slot, answerFirst, toDeposit, toHeld, toOffer, uk, UK, UNIT } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { firstTick, seedWhere as seedWhereStory } from "../testing/world";
import { standInWorld } from "../world/standIn";
import { eventsOf, month, owing, replayTo } from "./crossing.journey";

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
    const found = seedWhereStory(content, "news.naira-float", "in-force");
    const worldSeed = found.seed;
    const floatTick = found.tick;
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

  test("[R-ACTIVITY-005] [R-OFFER-007] [R-ACTIVITY-001] [R-WALLET-016] given Ada with no job, when a month of hunting lands the teaching job, then a job offer opens naming it, accepting starts the job at once, and the next month pays its salary to the bank", () => {
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

    const pay = content.activity["activity.job-teacher"]!.pay!.amount as number;
    // the offer and the job held say the month's pay as the wallet will book it.
    expect(offer?.pay).toEqual({ currency: "NGN", amount: pay });
    game.accept({ type: "offer/choose", offer: offer!.id, choice: "accept" });
    expect(game.view().job).toEqual({ id: "activity.job-teacher", months: 0, side: null, pay: { currency: "NGN", amount: pay }, sidePay: null });
    const salaryBefore = game.state.wallet.totals.in.salary?.NGN ?? 0;

    const month = game.endTurn();

    expect(month.events).toContainEqual(expect.objectContaining({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: pay, reason: "salary" }));
    expect((game.state.wallet.totals.in.salary?.NGN ?? 0) - salaryBefore).toBe(pay);
    expect(game.view().job).toEqual({ id: "activity.job-teacher", months: 1, side: null, pay: { currency: "NGN", amount: pay }, sidePay: null });
  });
});

// ---------------------------------------------------------------------------
// The whole life: rules that cross kinds abroad, on the road and before month 1
// ---------------------------------------------------------------------------

const SPONSORED: Id<"status"> = "status.uk-sponsored";
const OVERSTAYER: Id<"status"> = "status.uk-overstayer";
const STUDENT: Id<"status"> = "status.uk-student";
const TUITION: Id<"obligation"> = "obligation.tuition";
const CAR: Id<"obligation"> = "obligation.car";
const SHORTFALL: Id<"obligation"> = "obligation.car-shortfall";

describe("whole-life rules that cross kinds", () => {
  test("[R-STATUS-003] [R-LADDER-005] [R-ACTIVITY-006] given Tunde's recorded life on the sponsored worker's status, when he quits the sponsor's job, then the status clock starts at the entry's months, runs one a month, and at its end the status lapses to the overstayer", () => {
    const game = replayTo("tunde-abroad", content, (played) => played.state.status.current?.entry === SPONSORED && played.state.activity.job === played.state.status.current.job);
    const clock = content.status[SPONSORED]?.clockMonths ?? 0;
    expect(clock).toBeGreaterThan(0);
    const quit = game.accept({ type: "activity/quit" });
    expect(eventsOf(quit, "status/clock-started")).toEqual([expect.objectContaining({ months: clock })]);
    expect(game.state.status.current?.clock).toBe(clock);
    for (let left = clock - 1; left > 0; left -= 1) {
      month(game);
      expect(game.state.status.current).toMatchObject({ entry: SPONSORED, clock: left });
    }
    const last = month(game);
    expect(eventsOf(last, "status/lapsed")).toEqual([expect.objectContaining({ status: SPONSORED, why: "clock" })]);
    expect(game.state.status.current).toMatchObject({ entry: OVERSTAYER, clock: null, expiresMonth: null });
  });

  test("[R-STATUS-011] [R-OBLIGATION-005] [R-ABROAD-005] given Ada's recorded flight on the student status with no pounds to pay her tuition, when the instalment is missed past its grace, then the tuition defaults and the student is withdrawn the same month: the status lapses at once to the overstayer", () => {
    const game = replayTo("ada-careful", content, (played) => played.state.place.where === "abroad");
    expect(game.state.status.current?.entry).toBe(STUDENT);
    const grace = content.obligation[TUITION]?.grace ?? 0;
    let defaulted: Accepted | null = null;
    const statuses: (Id<"status"> | undefined)[] = [];
    for (let played = 0; played <= grace + 1 && defaulted === null; played += 1) {
      const result = month(game);
      if (eventsOf(result, "obligation/defaulted").some((event) => event.entry === TUITION)) defaulted = result;
      else statuses.push(game.state.status.current?.entry);
    }
    // Every month before the default the student status stands.
    expect(statuses.filter((status) => status !== STUDENT)).toEqual([]);
    if (defaulted === null) throw new Error("The tuition never defaulted.");
    expect(eventsOf(defaulted, "status/lapsed")).toEqual([expect.objectContaining({ status: STUDENT, why: "lost" })]);
    expect(game.state.status.current?.entry).toBe(OVERSTAYER);
  });

  test("[R-CAR-001] [R-CAR-003] [R-CAR-006] [R-CREDIT-006] given Tunde abroad, who drives, and a mark of 30 who buys a car on finance, when three payments in a row are missed under a third of the price, then the car is taken, the shortfall is owed with a judgment, and the judgment holds credit/min above its cap unmet whatever the mark", () => {
    const game = settledAbroad(content, { from: "scenario.tunde" });
    closeTypes(game, "rent", "upkeep", "phone");
    // R-CAR-006: the home licence comes with the first month abroad.
    month(game);
    expect(game.state.document["document.home-licence"]?.state).toBe("held");
    markBy(game, 30);
    const deposit = game.view().activities.find((option) => option.id === "activity.buy-car-finance")?.cost[0]?.amount ?? 0;
    expect(deposit).toBeGreaterThan(0);
    setPounds(game, deposit);
    month(game, [slot("activity.buy-car-finance")]);
    expect(owing(game, CAR)).toBeDefined();
    setPounds(game, 0);
    const grace = content.obligation[CAR]?.grace ?? 0;
    let taken: Accepted | null = null;
    for (let missed = 0; missed <= grace && taken === null; missed += 1) {
      const result = month(game);
      if (eventsOf(result, "obligation/repossessed").length > 0) taken = result;
    }
    if (taken === null) throw new Error("The car was never taken.");
    expect(owing(game, CAR)).toBeUndefined();
    const shortfall = owing(game, SHORTFALL);
    expect(shortfall?.outstanding).toBeGreaterThan(0);
    const file = game.state.credit.byCountry["country.uk"];
    expect(file?.judgmentUntil).toBe(game.state.turn.month + content.tuning.credit.judgmentMonths);
    markBy(game, 100);
    const cap = content.tuning.credit.judgmentCap;
    const read = { state: game.state, world: game.world(), content };
    expect(check(read, { type: "credit/min", value: cap }).met).toBe(true);
    expect(check(read, { type: "credit/min", value: cap + 1 }).met).toBe(false);
    expect(game.view().activities.find((option) => option.id === "activity.buy-car-finance")?.allowed).toBe(false);
  });

  test("[R-ABROAD-006] [R-WALLET-002] given a character abroad with pounds in the bank, when the same sum is sent home by the app, the bank and the informal channel, then the app pays the official rate less its margin to the naira bank now, the bank pays the official rate less its fee next month, and the informal channel pays the street rate in cash unless it is lost", () => {
    const remit = content.tuning.remit;
    const sum = 10000;
    const game = settledAbroad(content);
    closeTypes(game, "rent", "upkeep", "phone");
    setPounds(game, sum * 3);
    const rates = game.world().rates.GBP;
    const before = game.state.wallet.pockets.NGN;
    game.accept({ type: "wallet/remit", currency: "GBP", amount: sum, channel: "app" });
    const app = mulDiv(sum - bp(sum, remit.appFeeBp), rates.official - bp(rates.official, remit.appMarginBp), 100);
    expect(game.state.wallet.pockets.NGN.bank - before.bank).toBe(app);
    game.accept({ type: "wallet/remit", currency: "GBP", amount: sum, channel: "bank" });
    expect(game.state.wallet.pockets.NGN.bank - before.bank).toBe(app);
    const informal = game.accept({ type: "wallet/remit", currency: "GBP", amount: sum, channel: "informal" });
    const lost = eventsOf(informal, "wallet/remitted")[0]?.lost === true;
    expect(game.state.wallet.pockets.NGN.cash - before.cash).toBe(lost ? 0 : mulDiv(sum, rates.street, 100));
    expect(game.state.wallet.pockets.GBP.bank).toBe(0);
    month(game);
    const bankNaira = mulDiv(sum - bp(sum, remit.bankFeeBp), rates.official, 100);
    expect(game.state.wallet.pockets.NGN.bank - before.bank).toBe(app + bankNaira);
    expect(game.state.wallet.totals.out.remit?.GBP).toBe(sum * 3 - bp(sum, remit.appFeeBp) - bp(sum, remit.bankFeeBp));
  });
  test("[R-RETURN-005] [R-PLACE-006] [R-PLACE-009] given Ada's recorded flight with December in the first month abroad, when the December scene opens and she goes, then the fare home in the view carries the December factor, the visit takes that fare both ways in pounds as `fare`, and each answer's price leaves the pound pockets", () => {
    const game = flownAda(content);
    const country = content.country["country.uk"]!;
    expect(game.view().place.fareHome).toEqual({ currency: "GBP", amount: bp(country.fare, country.decemberFactorBp) });
    setPounds(game, 1000000);
    if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
    game.endTurn();
    expect(game.state.setpiece.open?.entry).toBe("setpiece.december");
    const held = game.state.wallet.pockets.GBP.bank + game.state.wallet.pockets.GBP.cash;
    const entry = content.setpiece["setpiece.december"]!;
    let priced = 0;
    for (let guard = 0; guard < 10 && game.state.setpiece.open !== null; guard += 1) {
      const question = game.view().setpiece?.question;
      if (question === undefined || question === null) throw new Error("The December scene has no question.");
      // The dearest answer of each question: going, the big party, every gift, the outfit.
      const answers = entry.questions.find((item) => item.id === question.id)?.answers ?? [];
      const cost = (id: string): number =>
        (answers.find((item) => item.id === id)?.effects ?? []).reduce((sum, effect) => sum + (effect.type === "money/take" && typeof effect.amount === "number" ? effect.amount : 0), 0);
      const dearest = [...question.answers].sort((left, right) => cost(right) - cost(left))[0]!;
      priced += cost(dearest);
      game.accept({ type: "setpiece/answer", question: question.id, answer: dearest });
    }
    expect(game.state.wallet.totals.out.fare?.GBP).toBe(2 * bp(country.fare, country.decemberFactorBp));
    expect(held - game.state.wallet.pockets.GBP.bank - game.state.wallet.pockets.GBP.cash).toBe(priced);
    expect(priced).toBeGreaterThan(2 * bp(country.fare, country.decemberFactorBp));
    game.endTurn();
    expect(game.view().place.fareHome).toEqual({ currency: "GBP", amount: country.fare });
  });

  test("[R-RETURN-003] [R-PLACE-004] given a student abroad with pounds for the fare, when she comes home by choice, then the returnee offers come up within the window in some life and never after it", () => {
    const window = content.tuning.return.offerMonths;
    const returnees = Object.values(content.offer).filter((entry) => entry.group === "return").map((entry) => entry.id);
    expect(returnees.length).toBeGreaterThan(0);
    let inside = 0;
    const after: string[] = [];
    for (const months of [0, 1, 2]) {
      const game = abroad(content);
      // A different month abroad before the return gives each life its own draws.
      for (let played = 0; played < months; played += 1) month(game);
      setPounds(game, 600000);
      game.accept({ type: "return/home" });
      expect(game.state.place.returns.map((entry) => entry.shape)).toEqual(["by-choice"]);
      const back = game.state.turn.month;
      for (let played = 0; played < window + 12; played += 1) {
        const result = month(game);
        const opened = eventsOf(result, "offer/opened").filter((event) => returnees.includes((event.item as { entry: Id<"offer"> }).entry));
        if (game.state.turn.month - back <= window) inside += opened.length;
        else after.push(...opened.map((event) => `${String((event.item as { entry: string }).entry)} in month ${String(game.state.turn.month - back)}`));
      }
    }
    expect(inside).toBeGreaterThan(0);
    expect(after).toEqual([]);
  });
  test("[R-ROAD-005] [R-ROAD-006] [R-ROAD-007] [R-PLACE-001] [R-RETURN-002] given a character at home who takes a pitch that is the road, pays at the truth and is held at the compound, when the authorities turn her back and the exit comes, then the return is on record as assisted with no country, the standing falls by the shape, and the agent's debt is still owed in naira at home", () => {
    const debtEntry: Id<"obligation"> = "obligation.agent-debt";
    const play = (seed: string): Game | null => {
      const game = readyLife(content, { seed, quiet: true, pockets: { NGN: { bank: 0, cash: 3000000 * UNIT } } });
      // The man at the park asks only someone who has asked around there.
      game.accept({ type: "activity/now", activity: "activity.ask-around", param: null });
      applyEffects(game, [{ type: "offer/open", offer: "offer.road-park" }]);
      const pitch = game.view().offers.find((offer) => offer.entry === "offer.road-park");
      if (pitch === undefined) return null;
      game.accept({ type: "offer/choose", offer: pitch.id, choice: "take" });
      for (let played = 0; played < 40 && game.state.place.returns.length === 0 && !game.state.turn.ended; played += 1) {
        const question = game.view().setpiece?.question;
        if (question !== undefined && question !== null) {
          const reply = ["go", "pay", "cannot"].find((item) => question.answers.includes(item)) ?? question.answers[0]!;
          game.accept({ type: "setpiece/answer", question: question.id, answer: reply });
          continue;
        }
        for (const offer of game.view().offers.filter((item) => item.entry === "offer.road-ransom-call")) game.accept({ type: "offer/choose", offer: offer.id, choice: "cannot" });
        if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
        game.endTurn();
      }
      return game;
    };
    const seed = seedWhere((candidate) => {
      const game = play(candidate);
      return game !== null && game.state.place.returns.length > 0 && owing(game, debtEntry) !== undefined;
    });
    const game = play(seed)!;
    expect(game.state.place.where).toBe("home");
    expect(game.state.place.returns).toEqual([expect.objectContaining({ shape: "assisted", country: null })]);
    const debt = owing(game, debtEntry);
    expect(debt?.outstanding).toBeGreaterThan(0);
    expect(content.obligation[debtEntry]?.currency).toBe("NGN");
    expect(game.view().place.returns[0]?.country).toBeNull();
  });

  test("[R-HEALTH-001] [R-HEALTH-002] [R-HEALTH-005] [R-TURN-009] [R-ENGINE-016] given Ada run down two months in a row, when the warning is given, the illness opens the month after and she goes to hospital, then a slot is locked for the next month, the turn refuses a slot past the ones left free, and the lock lifts the month after", () => {
    const health = content.tuning.health;
    // the hunt that filled every slot and moved no quality is an act done at once now, so
    // the month's slots rest, at nothing under this content, and the lock is counted with a month-act.
    const quiet = applyOverlay(content, { version: "crossing-quiet", tuning: { offer: { maxNewPerMonth: 0 }, quality: { wellbeingRest: 0 } } });
    const hunt = slot("activity.learn-tech");
    const seed = seedWhere((candidate) => draw(candidate, "health", 0, 10000) < health.illnessBp);
    const game = start({ content: quiet, scenario: "scenario.ada", seed });
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 5000000 * UNIT, reason: "gift" }]);
    const under = (): Accepted => {
      const wellbeing = game.state.quality["quality.wellbeing"] ?? 0;
      applyEffects(game, [{ type: "quality/add", quality: "quality.wellbeing", amount: health.runDownBelow - 1 - content.tuning.quality.wellbeingDrift - wellbeing }]);
      return game.endTurn();
    };
    expect(under().lines.map((line) => line.key)).not.toContain("line.quality.run-down");
    expect(under().lines.map((line) => line.key)).toContain("line.quality.run-down");
    expect(game.view().runDown).toBe(true);
    under();
    const illness = game.view().offers.find((offer) => offer.entry === "offer.illness");
    if (illness === undefined) throw new Error("The illness did not open.");
    const free = game.view().freeSlots;
    game.accept({ type: "offer/choose", offer: illness.id, choice: "hospital" });
    expect(game.view().locks.length).toBe(1);
    expect(game.view().freeSlots).toBe(free - 1);
    game.expectRejected({ type: "turn/end", slots: Array.from({ length: free }, () => hunt) }, "not-legal");
    game.endTurn(Array.from({ length: free - 1 }, () => hunt));
    expect(game.view().locks).toEqual([]);
    expect(game.view().freeSlots).toBe(free);
  });
  test("[R-DIRECTOR-004] [R-GATE-002] [R-ROUTE-014] given a world where the dependants ban comes into force, when a visa is sent in the month it lands, then the application records the study strictness with the story's addition, which the month before did not have", () => {
    const story: Id<"news"> = "news.uk-dependants-ban";
    const strictness: Id<"var"> = "var.uk-study-strictness";
    let found: { seed: string; tick: number } | null = null;
    for (let index = 0; index < 100; index += 1) {
      const seed = `world-${String(index)}`;
      const tick = firstTick(seed, content, story, "in-force");
      if (tick !== null && tick >= 8 && (found === null || tick < found.tick)) found = { seed, tick };
    }
    if (found === null) throw new Error(`No world brings ${story} into force.`);
    const { seed: worldSeed, tick } = found;
    const papers = READY_PAPERS.map((paper) => ({ ...paper, monthsLeft: paper.monthsLeft === null ? null : 240 }));
    const used = readyContent(content, { documents: papers });
    const game = start({ scenario: "scenario.ready", content: used, seed: offerSeed(used, 4), worldSeed });
    toHeld(game);
    while (game.tick < tick) {
      if (game.state.turn.banked === 0) game.grant(1);
      game.endTurn();
    }
    const before = standInWorld(worldSeed, tick - 1, used).vars[strictness] ?? 0;
    const after = standInWorld(worldSeed, tick, used).vars[strictness] ?? 0;
    expect(after - before).toBe(content.news[story]?.director?.adds.find((item) => item.var === strictness)?.value);
    if (game.state.turn.banked === 0) game.grant(1);
    game.endTurn([slot("activity.apply-for-visa")]);
    expect(uk(game).state).toBe("applying");
    expect(uk(game).visa?.submittedMonth).toBe(game.state.turn.month);
    expect(uk(game).visa?.rules.strictness).toBe(after);
  });
  test("[R-PROLOGUE-002] [R-PROLOGUE-003] [R-PROLOGUE-005] [R-PROLOGUE-006] given a life from sixteen on the real content, when the nurse's path is answered step by step, then the draw sets the family's figures, each answer moves the qualities, money and documents the page gives it, the friend's route is heard, and the last answer opens the upkeep at the family house", () => {
    const quality = (game: Game, id: string): number => game.state.quality[id as Id<"quality">] ?? 0;
    const choose = (game: Game, answer: string): void => {
      const step = game.state.prologue.step;
      if (step === null) throw new Error("The prologue has no step open.");
      game.accept({ type: "prologue/choose", step, answer });
    };
    /** The prologue to the course card on a seed whose exam passes the first time. */
    const toCourse = (seed: string): Game => {
      const game = start({ scenario: "scenario.prologue", seed, content });
      choose(game, "begin");
      choose(game, "science");
      choose(game, "jamb");
      choose(game, "study");
      return game;
    };
    const seed = seedWhere((candidate) => toCourse(candidate).state.prologue.step === "course");
    const game = start({ scenario: "scenario.prologue", seed, content });
    choose(game, "begin");
    const drawn = game.state.prologue.draw;
    if (drawn === null) throw new Error("No draw was made.");
    expect(quality(game, "quality.family-means")).toBe(drawn.familyMeans);
    expect(quality(game, "quality.network")).toBe((drawn.town === "city" ? 15 : 5) + (drawn.parentsEducated ? 10 : 0));
    expect(quality(game, "quality.standing")).toBe(50);

    const moved = (answer: string, ids: string[]): number[] => {
      const before = ids.map((id) => quality(game, id));
      choose(game, answer);
      return ids.map((id, index) => quality(game, id) - before[index]!);
    };
    expect(moved("science", ["quality.tech", "quality.english"])).toEqual([10, 5]);
    choose(game, "jamb");
    choose(game, "study");
    expect(game.state.prologue.step).toBe("course");
    expect(moved("nursing", ["quality.care"])).toEqual([30]);
    expect(game.state.prologue.flags).toContain("nurse");
    choose(game, "federal");
    choose(game, "learn");
    if (game.state.prologue.step === "strike-drag") choose(game, "back");
    expect(moved("code", ["quality.tech"])).toEqual([15]);
    choose(game, "focus");
    expect(moved("results-nurse", ["quality.edu-level", "quality.care"])).toEqual([3, 30]);
    expect(game.view().documents.find((paper) => paper.id === "document.nursing-licence")?.state).toBe("held");
    const cash = game.state.wallet.pockets.NGN.cash;
    expect(moved("serve", ["quality.standing", "quality.network", "quality.wellbeing"])).toEqual([8, 8, 4]);
    expect(game.state.wallet.pockets.NGN.cash - cash).toBe(500000 * UNIT);
    choose(game, "uk");
    // The age step keeps the age the path reached (R-PROLOGUE-004).
    choose(game, "as-is");
    expect(uk(game).state).toBe("heard");
    expect(moved("family-house", ["quality.standing"])).toEqual([3]);
    expect(game.state.prologue.open).toBe(false);
    const upkeep = owing(game, "obligation.upkeep");
    expect(upkeep?.amount).toBe(95000 * UNIT);
    expect(game.state.turn.banked).toBe(content.tuning.turn.start);
    expect(checkInvariants(game.state, content)).toEqual([]);
  });
});
