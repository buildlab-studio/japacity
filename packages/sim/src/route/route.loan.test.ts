// The regulated education loan on the master's route (route:education-loan-pays-the-school): it pays the school, never the student, lowers the
// funds required and the tuition owed on arrival, and is repaid from the Graduate status.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import { checkInvariants } from "../engine/invariants";
import type { Id, ObligationState } from "../engine/types";
import type { Game } from "../testing/play";
import { ALWAYS_GRANTED, offeredSeed, playMonths } from "../testing/place.journey";
import { readOf, routeOf } from "../testing/read";
import { answerFirst, applyEffects, readyLife, slot, toDeposit } from "../testing/route.journey";
import type { LifeOptions } from "../testing/route.journey";
import { fundsRequired } from "./route.logic";
import { NORTHGATE, STUDENT, UK_GRADUATE, UK_ROUTE } from "../testing/ids";

const LOAN_OFFER: Id<"offer"> = "offer.education-loan";
const LOAN: Id<"obligation"> = "obligation.education-loan";
const TUITION: Id<"obligation"> = "obligation.tuition";
const { loanProcessing, loanFeeBp } = content.tuning.route;
const LENT = 500000;

function life(options: LifeOptions = {}): Game {
  return readyLife(content, { seed: offeredSeed(content), quiet: true, ...options });
}

function openOffer(game: Game, offer: Id<"offer">): string | null {
  applyEffects(game, [{ type: "offer/open", offer }]);
  return Object.values(game.state.offer.items).find((item) => item.entry === offer)?.id ?? null;
}

function loanOf(game: Game): ObligationState | undefined {
  return Object.values(game.state.obligation.items).find((item) => item.entry === LOAN);
}

/** The deposit paid at Northgate and the loan taken for `amount`. */
function borrowed(amount: number, options: LifeOptions = {}): Game {
  const game = life(options);
  toDeposit(game, NORTHGATE);
  const id = openOffer(game, LOAN_OFFER);
  if (id === null) throw new Error("The loan's offer did not open.");
  game.accept({ type: "offer/choose", offer: id, choice: "take", amount });
  return game;
}

/** From a loan taken to the flight: the funds held a month, the visa sent and granted, the plane. */
function flownOnLoan(amount: number): Game {
  const game = borrowed(amount, { tuning: ALWAYS_GRANTED });
  game.endTurn();
  game.endTurn([slot("activity.apply-for-visa")]);
  answerFirst(game);
  game.endTurn();
  expect(routeOf(game, UK_ROUTE).state).toBe("granted");
  game.accept({ type: "route/depart", route: UK_ROUTE });
  return game;
}

describe("route:education-loan-pays-the-school: the education loan", () => {
  test("[route:education-loan-pays-the-school] given the loan's offer and its obligation, when they are read, then the offer comes up with the deposit paid, picks between £1,000 and the tuition left, and the loan is 0.8% a month flat over 180 months, paid to the school", () => {
    const offer = content.offer[LOAN_OFFER]!;
    expect(offer).toMatchObject({ chanceBp: 10000, cooldown: 3, expiresAfter: 2, terms: { min: 100000, max: { from: "tuition-left", route: UK_ROUTE }, fee: loanProcessing } });
    expect(offer.when).toEqual(
      expect.arrayContaining([
        { type: "route/deposit", route: UK_ROUTE },
        { type: "not", of: { type: "route/state", route: UK_ROUTE, in: ["granted", "departed"] } },
        { type: "quality/max", quality: "quality.credit-mark", value: 0 },
        { type: "not", of: { type: "obligation/has", obligationType: "loan", obligation: LOAN } },
      ]),
    );
    expect(loanProcessing).toBe(38000);
    expect(loanFeeBp).toBe(420);
    expect(content.obligation[LOAN]).toMatchObject({ type: "loan", currency: "GBP", rateBp: 80, term: 180, grace: 2, paysSchool: true, deferWhile: STUDENT });
  });

  test("[route:education-loan-pays-the-school] given the master's known with no deposit, when the loan's conditions are judged, then it does not come up; with the deposit paid it does, its most the tuition left", () => {
    const game = life();
    toDeposit(game, NORTHGATE);
    const held = routeOf(game, UK_ROUTE);
    expect(content.offer[LOAN_OFFER]!.when.every((requirement) => check(readOf(game), requirement).met)).toBe(true);
    const id = openOffer(game, LOAN_OFFER)!;
    const school = content.school[NORTHGATE]!;
    expect(game.state.offer.items[id]!.terms["max"]).toBe(school.tuition - (held.schools[NORTHGATE]?.discount ?? 0) - held.depositPaid);
    const early = life();
    expect(content.offer[LOAN_OFFER]!.when.every((requirement) => check(readOf(early), requirement).met)).toBe(false);
  });

  test("[route:education-loan-pays-the-school] [route:funds-required] given the loan taken, when it opens, then the processing fee is paid under fee-agent, the loan owes the amount plus the lender's fee, nothing is credited, and the route records it: the funds required fall by it and the unexplained share does not move", () => {
    const game = life();
    toDeposit(game, NORTHGATE);
    const id = openOffer(game, LOAN_OFFER)!;
    const required = fundsRequired(readOf(game), UK_ROUTE);
    const lots = game.state.wallet.lots;
    const pounds = game.state.wallet.pockets.GBP;
    game.accept({ type: "offer/choose", offer: id, choice: "take", amount: LENT });
    expect(game.state.wallet.totals.out["fee-agent"]?.GBP).toBe(loanProcessing);
    expect(game.state.wallet.pockets.GBP.bank + game.state.wallet.pockets.GBP.cash).toBe(pounds.bank + pounds.cash - loanProcessing);
    expect(loanOf(game)).toMatchObject({ principal: LENT + (LENT * loanFeeBp) / 10000, outstanding: LENT + (LENT * loanFeeBp) / 10000 });
    expect(routeOf(game, UK_ROUTE).loanPaid).toBe(LENT);
    expect(fundsRequired(readOf(game), UK_ROUTE)).toBe(required - LENT);
    // A loan is not money shown: it records no lot, so it adds nothing to the unexplained share.
    expect(game.state.wallet.lots).toEqual(lots);
    expect(game.view().routes.find((route) => route.id === UK_ROUTE)?.loanPaid).toBe(LENT);
    // One loan a route.
    expect(content.offer[LOAN_OFFER]!.when.every((requirement) => check(readOf(game), requirement).met)).toBe(false);
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[route:education-loan-pays-the-school] [abroad-money:tuition-paid-in-instalments] given the loan taken and the visa granted, when the student departs, then the tuition owed is the school's tuition less its discount, the deposit and what the loan paid", () => {
    const game = flownOnLoan(LENT);
    const tuition = Object.values(game.state.obligation.items).find((item) => item.entry === TUITION)!;
    const school = content.school[NORTHGATE]!;
    const discount = Object.values(game.state.route[UK_ROUTE]!.schools)[0]?.discount ?? 0;
    expect(tuition.principal).toBe(school.tuition - discount - school.deposit - LENT);
  });

  test("[route:education-loan-pays-the-school] given the loan while the student status holds, when the months pass, then nothing is charged; from the month after the Graduate status is granted it is charged 0.8% flat and a 180th of what is owed", () => {
    const game = flownOnLoan(LENT);
    const owed = loanOf(game)!.principal;
    playMonths(game, 12);
    expect(loanOf(game)).toMatchObject({ outstanding: owed, missed: 0 });
    expect(game.state.wallet.totals.out["loan-repay"]?.GBP ?? 0).toBe(0);
    game.accept({ type: "activity/now", activity: "activity.apply-graduate", param: null });
    expect(game.state.status.current?.entry).toBe(UK_GRADUATE);
    playMonths(game, 1);
    expect(loanOf(game)!.outstanding).toBe(owed);
    playMonths(game, 1);
    expect(loanOf(game)!.outstanding).toBe(owed - Math.ceil(owed / 180));
  });

  test("[route:education-loan-pays-the-school] [route:refusal-refunds-and-resets] given the loan taken, when the visa is refused, then the school sends the money back to the lender: the loan closes with nothing owed, the route's loan is cleared, and only the processing fee is lost", () => {
    const game = borrowed(LENT, { tuning: { refusalMinBp: 10000, refusalMaxBp: 10000 } });
    game.endTurn();
    game.endTurn([slot("activity.apply-for-visa")]);
    answerFirst(game);
    game.endTurn();
    expect(routeOf(game, UK_ROUTE).state).toBe("known");
    expect(loanOf(game)).toBeUndefined();
    expect(routeOf(game, UK_ROUTE).loanPaid ?? 0).toBe(0);
    expect(game.state.wallet.totals.out["fee-agent"]?.GBP).toBe(loanProcessing);
    expect(game.state.wallet.totals.out["loan-repay"]?.GBP ?? 0).toBe(0);
  });
});
