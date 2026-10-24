import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id, ObligationState, ReportLine } from "../engine/types";
import { applyAs, BOND, facts, joint, life, setFacts, setPeople } from "../testing/person.journey";
import { partnerGate } from "../route/gates/partner";
import type { LifeOptions } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { isSponsorUndertaking } from "./obligation.undertaking";
import { CA_SPOUSE, STANDING, UNDERTAKING } from "../testing/ids";

const used = content;
const entry = content.obligation[UNDERTAKING]!;
const ASSISTANCE = content.var["var.canada-assistance"]!.start;
const MONTHS = content.tuning.undertaking.months;

/**
 * The graduate settled in Canada as a resident, sponsoring its spouse: the bond's facts
 * hold what the partner's life reports. Upkeep and rent are closed, so only the
 * undertaking asks for Canadian money.
 */
function sponsor(cad: { bank: number; cash: number }, options: LifeOptions = {}): Game {
  const game = life(used, { pockets: { NGN: { bank: 200000000, cash: 150000000 }, CAD: cad }, ...options });
  applyAs(game, [{ type: "place/move", to: "abroad", country: "country.canada" }, { type: "status/grant", status: "status.canada-resident" }]);
  applyAs(game, [{ type: "obligation/close", obligationType: "upkeep" }, { type: "obligation/close", obligationType: "rent" }]);
  joint(game, CA_SPOUSE, "me", { stage: "married", facts: facts({ where: "abroad", country: "country.canada", status: "status.canada-resident" }) });
  setPeople(game, (slice) => ({ ...slice, sponsoring: { bond: BOND, route: CA_SPOUSE, month: game.state.turn.month } }));
  return game;
}

/** The undertaking opened as the people kind opens it on `people/agreed` with `landed`: the effect names the bond. */
function landed(game: Game): ObligationState {
  applyAs(game, [{ type: "obligation/open", obligation: UNDERTAKING, bond: BOND }], { source: "people/agreed", param: BOND });
  return undertaking(game)!;
}

function undertaking(game: Game): ObligationState | undefined {
  return Object.values(game.state.obligation.items).find((item) => item.entry === UNDERTAKING);
}

function taken(game: Game, assistanceTaken: number): void {
  setFacts(game, (now) => ({ ...now, assistanceTaken }));
}

function cad(game: Game): number {
  const pocket = game.state.wallet.pockets.CAD;
  return pocket.bank + pocket.cash;
}

/** The standing points lost, line by line. */
function standingLosses(lines: readonly ReportLine[]): number[] {
  return lines.filter((line) => line.key === "line.quality.loss" && line.params["quality"] === STANDING).map((line) => line.params["points"] as number);
}

/** A month ends, with a turn granted when the bank is empty; a set piece that opened in December is answered with its first allowed answer first. */
function month(game: Game): ReportLine[] {
  if (game.state.turn.banked < 1) game.grant(1);
  for (let guard = 0; guard < 10; guard += 1) {
    const question = game.view().setpiece?.question;
    if (question === undefined || question === null) break;
    game.accept({ type: "setpiece/answer", question: question.id, answer: question.allowed[0]! });
  }
  return game.endTurn().lines;
}

function obligationLines(lines: readonly ReportLine[]): string[] {
  return lines.filter((line) => line.key.startsWith("line.obligation.")).map((line) => line.key);
}

describe("undertaking:landing-opens-undertaking: the undertaking opens as the partner lands", () => {
  test("[undertaking:landing-opens-undertaking] given the partner landed, when the undertaking opens, then it names the bond, owes nothing, and runs the tuning's 36 months", () => {
    const game = sponsor({ bank: 0, cash: 0 });
    const opened = landed(game);
    expect(opened).toMatchObject({ bond: BOND, outstanding: 0, principal: 0, charged: 0, state: "active", openedMonth: game.state.turn.month });
    expect(entry.term).toBe(MONTHS);
    expect(game.view().obligations.find((item) => item.entry === UNDERTAKING)).toMatchObject({ monthsLeft: MONTHS, charged: 0, due: 0 });
  });

  test("[undertaking:landing-opens-undertaking] given no bond named by the cause, when the undertaking opens, then it names the sponsorship's bond", () => {
    const game = sponsor({ bank: 0, cash: 0 });
    applyAs(game, [{ type: "obligation/open", obligation: UNDERTAKING }]);
    expect(undertaking(game)?.bond).toBe(BOND);
  });

  test("[undertaking:landing-opens-undertaking] given no assistance taken, when a month passes, then nothing is charged and nothing recorded", () => {
    const game = sponsor({ bank: 0, cash: 0 });
    landed(game);
    const before = undertaking(game);
    const month = game.endTurn();
    expect(obligationLines(month.lines)).toEqual([]);
    expect(undertaking(game)).toEqual(before);
  });
});

describe("undertaking:assistance-charged-to-sponsor: charged for each month of assistance taken", () => {
  test("[undertaking:assistance-charged-to-sponsor] given two months of assistance taken, when the month ends, then two months are charged under `undertaking`, bank first and then cash, and the same two never again", () => {
    const game = sponsor({ bank: ASSISTANCE, cash: 2 * ASSISTANCE });
    landed(game);
    taken(game, 2);
    game.endTurn();
    expect(game.state.wallet.pockets.CAD).toMatchObject({ bank: 0, cash: ASSISTANCE });
    expect(game.state.wallet.totals.out.undertaking?.CAD).toBe(2 * ASSISTANCE);
    expect(undertaking(game)).toMatchObject({ charged: 2, outstanding: 0 });
    const month = game.endTurn();
    expect(cad(game)).toBe(ASSISTANCE);
    expect(obligationLines(month.lines)).toEqual([]);
  });

  test("[undertaking:assistance-charged-to-sponsor] given a third month taken later, when the month ends, then only that month is charged", () => {
    const game = sponsor({ bank: 10 * ASSISTANCE, cash: 0 });
    landed(game);
    taken(game, 2);
    game.endTurn();
    taken(game, 3);
    const month = game.endTurn();
    expect(game.state.wallet.totals.out.undertaking?.CAD).toBe(3 * ASSISTANCE);
    expect(undertaking(game)?.charged).toBe(3);
    expect(obligationLines(month.lines)).toEqual(["line.obligation.assessed", "line.obligation.charged"]);
  });
});

describe("undertaking:missed-charges-lead-to-default: missed, in default, and paid down", () => {
  test("[undertaking:missed-charges-lead-to-default] given no Canadian money, when the charge is missed twice, then it stays owed and costs standing 3 each time, and the third miss is a default costing 10 and a mark on the file", () => {
    const game = sponsor({ bank: 0, cash: 0 });
    landed(game);
    taken(game, 1);
    for (let miss = 1; miss <= entry.grace; miss += 1) {
      const lines = game.endTurn().lines;
      expect(undertaking(game)).toMatchObject({ state: "grace", missed: miss, outstanding: ASSISTANCE });
      expect(obligationLines(lines)).toContain("line.obligation.missed");
      expect(standingLosses(lines)).toContain(3);
    }
    const last = game.endTurn().lines;
    expect(undertaking(game)?.state).toBe("defaulted");
    expect(obligationLines(last)).toEqual(expect.arrayContaining(["line.obligation.missed", "line.obligation.undertaking-default"]));
    expect(standingLosses(last)).toEqual(expect.arrayContaining([3, 10]));
    expect(last.map((line) => line.key)).toContain("line.credit.missed");
  });

  test("[undertaking:missed-charges-lead-to-default] given a default, when money reaches the bank, then it is taken from the next month, and paying the rest lifts the default", () => {
    const game = sponsor({ bank: 0, cash: 0 });
    landed(game);
    taken(game, 1);
    for (let miss = 0; miss <= entry.grace; miss += 1) game.endTurn();
    game.state = { ...game.state, wallet: { ...game.state.wallet, pockets: { ...game.state.wallet.pockets, CAD: { bank: 50000, cash: 30000, locked: 0 } } } };
    const month = game.endTurn();
    expect(obligationLines(month.lines)).toContain("line.obligation.undertaking-seized");
    expect(undertaking(game)).toMatchObject({ state: "defaulted", outstanding: ASSISTANCE - 50000 });
    const owed = undertaking(game)!;
    game.expectRejected({ type: "obligation/pay", obligation: owed.id, amount: owed.outstanding + 1 }, "bad-amount");
    game.expectRejected({ type: "obligation/pay", obligation: owed.id, amount: 0 }, "bad-amount");
    game.accept({ type: "obligation/pay", obligation: owed.id, amount: owed.outstanding });
    expect(undertaking(game)).toMatchObject({ state: "active", missed: 0, outstanding: 0 });
  });

  test("[undertaking:missed-charges-lead-to-default] given one miss, when the money is there next month, then the whole of it is paid and the grace ends", () => {
    const game = sponsor({ bank: 0, cash: 0 });
    landed(game);
    taken(game, 1);
    game.endTurn();
    expect(undertaking(game)?.state).toBe("grace");
    taken(game, 2);
    game.state = { ...game.state, wallet: { ...game.state.wallet, pockets: { ...game.state.wallet.pockets, CAD: { bank: 2 * ASSISTANCE, cash: 0, locked: 0 } } } };
    game.endTurn();
    expect(undertaking(game)).toMatchObject({ state: "active", missed: 0, outstanding: 0, charged: 2 });
    expect(cad(game)).toBe(0);
  });

  test("[undertaking:missed-charges-lead-to-default] given nothing owed, when the sponsor tries to pay, then it is not legal; a guarantee still cannot be paid ahead", () => {
    const game = sponsor({ bank: ASSISTANCE, cash: 0 });
    const opened = landed(game);
    game.expectRejected({ type: "obligation/pay", obligation: opened.id, amount: 1 }, "not-legal");
    expect(isSponsorUndertaking(content.obligation["obligation.guarantee"]!)).toBe(false);
  });
});

describe("undertaking:undertaking-outlives-relationship: it outlives the relationship", () => {
  test("[undertaking:undertaking-outlives-relationship] given the bond ended and the sponsor gone home, when the partner takes assistance, then the sponsor is still charged in Canadian dollars", () => {
    const game = sponsor({ bank: 10 * ASSISTANCE, cash: 0 });
    landed(game);
    setPeople(game, (slice) => ({ ...slice, bonds: { [BOND]: { ...slice.bonds[BOND]!, stage: "ended" } }, joint: null }));
    applyAs(game, [{ type: "place/move", to: "home", country: null }]);
    expect(game.state.place.where).toBe("home");
    taken(game, 1);
    game.endTurn();
    expect(undertaking(game)).toMatchObject({ charged: 1, outstanding: 0 });
    expect(game.state.wallet.totals.out.undertaking?.CAD).toBe(ASSISTANCE);
  });

  test("[undertaking:undertaking-outlives-relationship] given 36 months with nothing owed, when the last of them ends, then it closes; one month short, it is still open", () => {
    const game = sponsor({ bank: 0, cash: 0 });
    const opened = landed(game);
    while (game.state.turn.month < opened.openedMonth + MONTHS - 1) month(game);
    expect(undertaking(game)).toBeDefined();
    month(game);
    expect(undertaking(game)).toBeUndefined();
  });

  test("[undertaking:undertaking-outlives-relationship] given something still owed when the 36 months end, when it is paid, then it closes only after that", () => {
    const game = sponsor({ bank: 0, cash: 0 });
    const opened = landed(game);
    while (game.state.turn.month < opened.openedMonth + MONTHS - 1) month(game);
    taken(game, 1);
    month(game);
    expect(undertaking(game)?.outstanding).toBe(ASSISTANCE);
    game.state = { ...game.state, wallet: { ...game.state.wallet, pockets: { ...game.state.wallet.pockets, CAD: { bank: ASSISTANCE, cash: 0, locked: 0 } } } };
    month(game);
    expect(undertaking(game)).toBeUndefined();
  });
});

describe("undertaking:social-assistance-offer: social assistance", () => {
  const OFFER: Id<"offer"> = "offer.canada-assistance";

  test("[undertaking:social-assistance-offer] given the offer, when it is read, then it comes up every month in Canada for a resident or citizen under the tuning's line, and take credits the assistance figure", () => {
    const offer = used.offer[OFFER]!;
    expect(offer).toMatchObject({ group: "abroad", where: "abroad", chanceBp: 10000, cooldown: 1, expiresAfter: 1, terms: { amount: ASSISTANCE } });
    expect(offer.when).toContainEqual({ type: "not", of: { type: "money/min", currency: "CAD", amount: content.tuning.undertaking.assistanceUnder } });
    expect(offer.when).toContainEqual({ type: "status/is", statuses: ["status.canada-resident", "status.canada-citizen"] });
    const take = offer.choices.find((choice) => choice.id === "take")!;
    expect(take.effects).toContainEqual({ type: "money/add", currency: "CAD", pocket: "bank", amount: { term: "amount" }, reason: "assistance" });
  });

  test("[undertaking:social-assistance-offer] given a resident with C$999.99 and one with C$1,000, when a month ends, then only the first is offered assistance, and taking it credits the bank", () => {
    const under = content.tuning.undertaking.assistanceUnder;
    const poor = sponsor({ bank: under - 1, cash: 0 });
    poor.endTurn();
    const offered = Object.values(poor.state.offer.items).find((open) => open.entry === OFFER);
    expect(offered).toBeDefined();
    const bank = poor.state.wallet.pockets.CAD.bank;
    poor.accept({ type: "offer/choose", offer: offered!.id, choice: "take" });
    expect(poor.state.wallet.pockets.CAD.bank - bank).toBe(ASSISTANCE);
    expect(poor.state.wallet.totals.in.assistance?.CAD).toBe(ASSISTANCE);
    const enough = sponsor({ bank: under, cash: 0 });
    enough.endTurn();
    expect(Object.values(enough.state.offer.items).some((open) => open.entry === OFFER)).toBe(false);
  });
  test("[undertaking:social-assistance-offer] given a partner who arrived on Canada's spouse route, when assistance is taken inside the term and after it, then only the months inside count in the people slice; one who came another way counts none", () => {
    const under = content.tuning.undertaking.assistanceUnder;
    const takeOne = (game: Game): void => {
      game.endTurn();
      const offered = Object.values(game.state.offer.items).find((open) => open.entry === OFFER);
      expect(offered).toBeDefined();
      game.accept({ type: "offer/choose", offer: offered!.id, choice: "take" });
    };
    // Calgary's street find (docs/design/11-calgary-dubai-and-castel-volturno.md) rolls before the abroad group and may take the month's rolls;
    // it is kept from rolling here so each month's roll is the assistance's.
    const noFind: LifeOptions = { change: (base) => ({ ...base, offer: { ...base.offer, "offer.street-find-canada": { ...base.offer["offer.street-find-canada"]!, chanceBp: 0 } } }) };
    const arrived = sponsor({ bank: under - 1, cash: 0 }, noFind);
    setPeople(arrived, (slice) => ({ ...slice, arrived: { route: CA_SPOUSE, month: arrived.state.turn.month } }));
    takeOne(arrived);
    expect(arrived.state.people.assistanceTaken).toBe(1);
    // The term has run: the months since arriving are the tuning's months.
    setPeople(arrived, (slice) => ({ ...slice, arrived: { route: CA_SPOUSE, month: arrived.state.turn.month + 1 - content.tuning.undertaking.months } }));
    arrived.state = { ...arrived.state, wallet: { ...arrived.state.wallet, pockets: { ...arrived.state.wallet.pockets, CAD: { ...arrived.state.wallet.pockets.CAD, bank: under - 1 } } } };
    takeOne(arrived);
    expect(arrived.state.people.assistanceTaken).toBe(1);
    const resident = sponsor({ bank: under - 1, cash: 0 }, noFind);
    takeOne(resident);
    expect(resident.state.people.assistanceTaken).toBe(0);
  });
});

describe("undertaking:uk-partner-has-no-undertaking: the UK asks for no undertaking", () => {
  test("[undertaking:uk-partner-has-no-undertaking] given the obligations and the partner gate, when they are read, then the only sponsor's undertaking is Canada's and departing on a partner route opens nothing of the gate's own", () => {
    const undertakings = Object.values(content.obligation).filter(isSponsorUndertaking);
    expect(undertakings.map((item) => [item.id, item.currency])).toEqual([[UNDERTAKING, "CAD"]]);
    expect("onDepart" in partnerGate).toBe(false);
  });
});

describe("undertaking:view-lists-undertaking: the undertaking in the view", () => {
  test("[undertaking:view-lists-undertaking] given an undertaking with a month charged and one owed, when the view is read, then it shows the months left, the months charged and what is owed", () => {
    const game = sponsor({ bank: ASSISTANCE, cash: 0 });
    const opened = landed(game);
    taken(game, 1);
    game.endTurn();
    taken(game, 2);
    game.endTurn();
    const shown = game.view().obligations.find((item) => item.entry === UNDERTAKING);
    expect(shown).toMatchObject({ charged: 2, outstanding: ASSISTANCE, due: ASSISTANCE, monthsLeft: opened.openedMonth + MONTHS - game.state.turn.month });
  });
});
