// Offers across the whole life: where an offer applies, the groups of life
// abroad and of coming home, the family's asking abroad, the luck rules and
// the slots an offer locks. docs/rules/offer.md, place.md R-PLACE-003,
// return.md R-RETURN-003, abroad-money.md R-ABROAD-007, luck.md, health.md.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp } from "../engine/int";
import { applyOverlay } from "../engine/overlay";
import type { BaseEvent, Content, Effect, Id, OfferEntry, OfferState, ReadCtx, Requirement } from "../engine/types";
import { wealthInNaira } from "../place/place.logic";
import { applyEffects } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import { rollOrder } from "./offer.logic";
import { drySpellBp, luckReadsMoney, markedChanceBp, monthsWithoutLuck } from "./offer.luck";

const ADA: Id<"scenario"> = "scenario.ada";
const UK: Id<"country"> = "country.uk";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const STANDING: Id<"quality"> = "quality.standing";
const CERTAIN = 10000;
const POUNDS = 100;
const luck = content.tuning.luck;

/** The real content with the named offers changed and, when `onlyThese`, every other offer never rolled. */
function variant(changes: Partial<Record<Id<"offer">, Partial<OfferEntry>>>, onlyThese = true): Content {
  const copy = JSON.parse(JSON.stringify(content)) as Content;
  for (const entry of Object.values(copy.offer)) {
    const change = changes[entry.id];
    if (change !== undefined) Object.assign(entry, change);
    else if (onlyThese) entry.chanceBp = 0;
  }
  return copy;
}

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function openedIn(result: { events: BaseEvent[] }): OfferState[] {
  return result.events.filter((event) => event.type === "offer/opened").map((event) => (event as unknown as { item: OfferState }).item);
}

function openEntries(game: Game): Id<"offer">[] {
  return Object.values(game.state.offer.items).map((item) => item.entry);
}

function openOne(game: Game, offer: Id<"offer">): OfferState {
  applyEffects(game, [{ type: "offer/open", offer }]);
  const item = Object.values(game.state.offer.items).find((held) => held.entry === offer);
  if (item === undefined) throw new Error(`${offer} did not open.`);
  return item;
}

/** Moves the character abroad to the UK on a student's visa, as the flight does. */
function flyToUk(game: Game): void {
  applyEffects(game, [
    { type: "place/move", to: "abroad", country: UK },
    { type: "status/grant", status: "status.uk-student" },
  ]);
}

/** Sets a quality to a value through the quality kind. */
function setQuality(game: Game, quality: Id<"quality">, value: number): void {
  const now = game.state.quality[quality] ?? 0;
  if (now !== value) applyEffects(game, [{ type: "quality/add", quality, amount: value - now }]);
  expect(game.state.quality[quality]).toBe(value);
}

/** Takes every unit of every pocket, leaving the character with nothing. */
function emptyPockets(game: Game): void {
  const effects: Effect[] = [];
  for (const [currency, pocket] of Object.entries(game.state.wallet.pockets) as [keyof typeof game.state.wallet.pockets, { bank: number; cash: number }][]) {
    if (pocket.bank > 0) effects.push({ type: "money/take", currency, pocket: "bank", amount: pocket.bank, reason: "mishap" });
    if (pocket.cash > 0) effects.push({ type: "money/take", currency, pocket: "cash", amount: pocket.cash, reason: "mishap" });
  }
  if (effects.length > 0) applyEffects(game, effects);
}

/** Ends a turn, granting turns first when the bank is empty. */
function month(game: Game) {
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn();
}

// ---------------------------------------------------------------------------
// The roll and where an offer applies
// ---------------------------------------------------------------------------

describe("the roll's groups", () => {
  test("[R-OFFER-001] given the real offers, when the roll's order is read, then money, life and family come first, then life abroad and coming home, and the road last", () => {
    const groups = rollOrder(content).map((entry) => entry.group);
    const order = groups.filter((group, index) => groups.indexOf(group) === index);
    expect(order).toEqual(["money", "life", "family", "abroad", "return", "road"]);
    expect(groups).not.toContain("job");
  });
});

describe("where an offer applies", () => {
  const both = variant({ "offer.fuel-scarcity": { chanceBp: CERTAIN }, "offer.nepa-bill": { chanceBp: CERTAIN } });

  test("[R-PLACE-003] given a home offer and an offer of any place both certain, when a month comes up at home, then both open", () => {
    const game = start({ scenario: ADA, content: both });
    // The family asks only of someone not broke.
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 100000000, reason: "gift" }]);
    expect(openedIn(game.endTurn()).map((item) => item.entry)).toEqual(["offer.fuel-scarcity", "offer.nepa-bill"]);
  });

  test("[R-PLACE-003] given the same two abroad, when a month comes up, then only the one of any place opens, and an effect cannot open the home one there", () => {
    const game = start({ scenario: ADA, content: both });
    flyToUk(game);
    expect(openedIn(game.endTurn()).map((item) => item.entry)).toEqual(["offer.nepa-bill"]);
    applyEffects(game, [{ type: "offer/open", offer: "offer.fuel-scarcity" }]);
    expect(openEntries(game)).not.toContain("offer.fuel-scarcity");
  });

  test("[R-PLACE-003] given an offer of abroad that always holds, when a month comes up at home and then abroad, then it opens only abroad", () => {
    const abroad = variant({ "offer.sponsor-licence-lost": { chanceBp: CERTAIN, when: [] } });
    const game = start({ scenario: ADA, content: abroad });
    expect(openedIn(game.endTurn())).toEqual([]);
    flyToUk(game);
    expect(openedIn(game.endTurn()).map((item) => item.entry)).toEqual(["offer.sponsor-licence-lost"]);
  });
});

// ---------------------------------------------------------------------------
// R-ABROAD-007: the family asks more of a relative abroad
// ---------------------------------------------------------------------------

describe("the family's asking abroad", () => {
  const factor = content.tuning.remit.abroadBp;

  test("[R-ABROAD-007] given the NEPA bill at home and then abroad, when each opens, then abroad it asks three times the home amount in its terms", () => {
    expect(factor).toBe(30000);
    const home = start({ scenario: ADA, content });
    const atHome = openOne(home, "offer.nepa-bill");
    expect(atHome.terms).toEqual({ cost: 2500000 });
    const away = start({ scenario: ADA, content });
    flyToUk(away);
    const abroad = openOne(away, "offer.nepa-bill");
    expect(abroad.terms).toEqual({ cost: bp(2500000, factor) });
    expect(abroad.terms.cost).toBe(7500000);
  });

  test("[R-ABROAD-007] given a request with two amounts opened abroad, when each choice is paid, then each debit is the home amount times the factor, from the naira pockets", () => {
    const game = start({ scenario: ADA, content });
    flyToUk(game);
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 100000000, reason: "gift" }]);
    const fees = openOne(game, "offer.brother-fees");
    expect(fees.terms).toEqual({ cost: bp(12000000, factor), half: bp(6000000, factor) });
    const result = game.accept({ type: "offer/choose", offer: fees.id, choice: "half" });
    const debits = result.events.filter((event) => event.type === "wallet/debited") as unknown as { currency: string; amount: number; reason: string }[];
    expect(debits.reduce((sum, debit) => sum + debit.amount, 0)).toBe(18000000);
    expect(debits.every((debit) => debit.currency === "NGN" && debit.reason === "family")).toBe(true);
  });

  test("[R-ABROAD-007] given a request abroad asking more than the naira at home holds, when the view is read and the choice is sent, then it is not allowed and is refused with cannot-afford", () => {
    const game = start({ scenario: ADA, content });
    flyToUk(game);
    const bill = openOne(game, "offer.nepa-bill");
    // Enough for the home amount, short of three times it.
    emptyPockets(game);
    applyEffects(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 5000000, reason: "gift" }]);
    expect(game.view().offers.find((offer) => offer.id === bill.id)?.choices).toContainEqual({ id: "pay", allowed: false, pick: null });
    game.expectRejected({ type: "offer/choose", offer: bill.id, choice: "pay" }, "cannot-afford");
  });
});

// ---------------------------------------------------------------------------
// R-RETURN-003: the returnee offers
// ---------------------------------------------------------------------------

describe("coming home", () => {
  /** A life flown to the UK and home again by choice, its fare paid from a gift of pounds. */
  function returned(used: Content): Game {
    const game = start({ scenario: ADA, content: used });
    flyToUk(game);
    applyEffects(game, [{ type: "money/add", currency: "GBP", pocket: "bank", amount: 10000 * POUNDS, reason: "gift" }]);
    game.accept({ type: "return/home" });
    return game;
  }

  test("[R-RETURN-003] given a return, when months come up, then the question everyone asks comes up for twelve months and not in the thirteenth", () => {
    const every = variant({ "offer.returnee-question": { chanceBp: CERTAIN, cooldown: 0 } });
    const game = returned(every);
    const back = game.state.place.returns[0]!;
    expect(back.shape).toBe("by-choice");
    expect(content.tuning.return.offerMonths).toBe(12);
    const months: number[] = [];
    for (let turn = 0; turn < 14; turn += 1) {
      const result = month(game);
      if (openedIn(result).some((item) => item.entry === "offer.returnee-question")) months.push(game.state.turn.month - back.month);
    }
    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test("[R-RETURN-003] given no return on record, when months come up at home, then no returnee offer comes up", () => {
    const every = variant({ "offer.returnee-question": { chanceBp: CERTAIN, cooldown: 0 } });
    const game = start({ scenario: ADA, content: every });
    for (let turn = 0; turn < 3; turn += 1) expect(openedIn(month(game))).toEqual([]);
  });

  test("[R-RETURN-003] given the cousin's shop, which comes to returns by choice or with papers, when the last return was by choice it comes up; after a broke one it does not, though a return by choice is on the record", () => {
    const shop = variant({ "offer.returnee-business": { chanceBp: CERTAIN, cooldown: 0 } });
    const game = returned(shop);
    expect(openedIn(month(game)).map((item) => item.entry)).toEqual(["offer.returnee-business"]);
    // Off again, and home broke: the fare paid and nothing else left.
    flyToUk(game);
    emptyPockets(game);
    applyEffects(game, [{ type: "money/add", currency: "GBP", pocket: "bank", amount: content.country[UK]!.fare, reason: "gift" }]);
    game.accept({ type: "return/home" });
    expect(game.state.place.returns.map((back) => back.shape)).toEqual(["by-choice", "broke"]);
    for (const item of Object.values(game.state.offer.items)) game.accept({ type: "offer/choose", offer: item.id, choice: "decline" });
    for (let turn = 0; turn < 3; turn += 1) expect(openedIn(month(game)).map((item) => item.entry)).not.toContain("offer.returnee-business");
  });

  test("[R-RETURN-003] given the real returnee offers, when their conditions are read, then each is of the group `return`, at home, and reads the shape of a return", () => {
    const returnee = Object.values(content.offer).filter((entry) => entry.group === "return");
    expect(returnee.map((entry) => entry.id).sort()).toEqual(["offer.returnee-business", "offer.returnee-hire", "offer.returnee-leave-again", "offer.returnee-question"]);
    for (const entry of returnee) {
      expect(entry.where).toBe("home");
      expect(entry.when.some((requirement) => requirement.type === "place/returned")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Luck: luck.md
// ---------------------------------------------------------------------------

describe("luck never reads money", () => {
  const base = content.offer["offer.relative-sends"]!;
  const money: Requirement = { type: "money/min", currency: "NGN", amount: 100 };

  test("[R-LUCK-001] given luck offers reading money directly, inside not or inside any, when the content check reads them, then each is caught", () => {
    expect(luckReadsMoney({ ...base, when: [money] })).toBe(true);
    expect(luckReadsMoney({ ...base, when: [{ type: "not", of: money }] })).toBe(true);
    expect(luckReadsMoney({ ...base, when: [{ type: "any", of: [{ type: "job/any" }, { type: "wallet/total", flow: "out", reason: "remit", currency: "GBP", amount: 1 }] }] })).toBe(true);
    expect(luckReadsMoney({ ...base, when: [{ type: "not", of: { type: "any", of: [{ type: "money/can-pay", currency: "GBP", amount: 1 }] } }] })).toBe(true);
  });

  test("[R-LUCK-001] given an offer that is not luck reading money, or a luck offer reading qualities and routes, when they are read, then neither is caught; the real luck offers pass", () => {
    expect(luckReadsMoney({ ...base, luck: false, when: [money] })).toBe(false);
    expect(luckReadsMoney({ ...base, when: [{ type: "quality/min", quality: STANDING, value: 10 }] })).toBe(false);
    const lucky = Object.values(content.offer).filter((entry) => entry.luck === true);
    expect(lucky.map((entry) => entry.id).sort()).toEqual(["offer.december-bonus", "offer.relative-sends", "offer.scholarship-round", "offer.whip-round"]);
    expect(lucky.filter(luckReadsMoney)).toEqual([]);
  });
});

describe("no kicking while down", () => {
  const plain = content.offer["offer.nepa-bill"]!;
  const blow: OfferEntry = { ...plain, bad: true };
  const win: OfferEntry = { ...plain, luck: true };
  const chance = 3001;

  /** A life whose luck offer opened this month, so no dry spell adds to the chances read. */
  function lifeAt(wellbeing: number, standing: number): Game {
    const game = start({ scenario: ADA, content: variant({ "offer.relative-sends": { when: [], chanceBp: 0 } }) });
    setQuality(game, WELLBEING, wellbeing);
    setQuality(game, STANDING, standing);
    openOne(game, "offer.relative-sends");
    expect(drySpellBp(readOf(game))).toBe(0);
    return game;
  }

  test("[R-LUCK-003] given wellbeing and standing at 30, when the chances are read, then a blow and a win roll at their own chance", () => {
    const read = readOf(lifeAt(30, 30));
    expect([markedChanceBp(read, blow, chance), markedChanceBp(read, win, chance), markedChanceBp(read, plain, chance)]).toEqual([chance, chance, chance]);
  });

  test("[R-LUCK-003] given wellbeing at 29, when the chances are read, then a blow rolls at half, rounded down, a win at double, and the rest as they are", () => {
    const read = readOf(lifeAt(29, 30));
    expect([markedChanceBp(read, blow, chance), markedChanceBp(read, win, chance), markedChanceBp(read, plain, chance)]).toEqual([1500, 6002, chance]);
  });

  test("[R-LUCK-003] given standing at 29, when the chances are read, then the same, and a doubled chance never passes certainty", () => {
    const read = readOf(lifeAt(30, 29));
    expect([markedChanceBp(read, blow, chance), markedChanceBp(read, win, chance)]).toEqual([1500, 6002]);
    expect(markedChanceBp(read, win, 6000)).toBe(CERTAIN);
  });

  test("[R-LUCK-003] [R-ENGINE-017] given the down line moved to 40 in the tuning, when wellbeing is 35, then a blow rolls at half and a win at double", () => {
    const game = lifeAt(35, 60);
    expect(markedChanceBp(readOf(game), blow, chance)).toBe(chance);
    const moved: ReadCtx = { ...readOf(game), content: { ...game.content, tuning: { ...game.content.tuning, luck: { ...luck, downUnder: 40 } } } };
    expect([markedChanceBp(moved, blow, chance), markedChanceBp(moved, win, chance)]).toEqual([1500, 6002]);
  });

  test("[R-LUCK-003] given the real content, when the marks are read, then the blows of daily life are bad and none is both", () => {
    const bad = Object.values(content.offer).filter((entry) => entry.bad === true).map((entry) => entry.id);
    expect(bad).toEqual(expect.arrayContaining(["offer.laptop-fault", "offer.fuel-scarcity", "offer.sponsor-licence-lost"]));
    expect(Object.values(content.offer).filter((entry) => entry.bad === true && entry.luck === true)).toEqual([]);
  });
});

describe("a dry spell ends", () => {
  // No luck offer rolls, and the whip-round, which is luck, has no `when` that holds.
  const dry = variant({ "offer.relative-sends": { when: [], chanceBp: 0 }, "offer.whip-round": { when: [{ type: "month/min", value: 1000 }] } });

  test("[R-LUCK-004] given no luck offer opened, when months pass, then nothing is added up to the dry spell's months, then the step for each further month, up to the cap", () => {
    const game = start({ scenario: ADA, content: dry });
    const added: number[] = [];
    for (let turn = 0; turn < 20; turn += 1) {
      month(game);
      added.push(drySpellBp(readOf(game)));
    }
    const months = luck.drySpellMonths;
    expect(added[months - 1]).toBe(0);
    expect(monthsWithoutLuck(readOf(game))).toBe(20);
    expect(added[months]).toBe(luck.drySpellBp);
    expect(added[months + 1]).toBe(2 * luck.drySpellBp);
    expect(Math.max(...added)).toBe(luck.drySpellCapBp);
    expect(added[19]).toBe(luck.drySpellCapBp);
  });

  test("[R-LUCK-004] given a dry spell, when a luck offer opens, then the count starts again; the spell adds to luck entries only and is never doubled", () => {
    const game = start({ scenario: ADA, content: dry });
    for (let turn = 0; turn < luck.drySpellMonths + 3; turn += 1) month(game);
    const read = readOf(game);
    const added = drySpellBp(read);
    expect(added).toBe(3 * luck.drySpellBp);
    const plain = content.offer["offer.nepa-bill"]!;
    expect(markedChanceBp(read, { ...plain, luck: true }, 100)).toBe(100 + added);
    expect(markedChanceBp(read, plain, 100)).toBe(100);
    setQuality(game, WELLBEING, 10);
    expect(markedChanceBp(readOf(game), { ...plain, luck: true }, 100)).toBe(200 + added);
    openOne(game, "offer.relative-sends");
    expect(monthsWithoutLuck(readOf(game))).toBe(0);
    expect(drySpellBp(readOf(game))).toBe(0);
  });
});

describe("the whip-round", () => {
  const WHIP: Id<"offer"> = "offer.whip-round";

  test("[R-LUCK-002] given the numbers, when the rescue is set against the line it needs, then it pays less than the line times the ratio, so throwing money away to reach it loses", () => {
    expect(luck.rescue).toBeLessThan(bp(luck.rescueUnder, luck.rescueRatio));
    expect(content.offer[WHIP]).toMatchObject({ chanceBp: 0, maxTimes: 1, luck: true, where: "home" });
  });

  /** Ada at home with nothing in any pocket, played to the month before the rescue may come. */
  function brokeAt(months: number, used: Content = content): Game {
    const game = start({ scenario: ADA, content: used });
    emptyPockets(game);
    while (game.state.turn.month < months) {
      month(game);
      emptyPockets(game);
    }
    return game;
  }

  test("[R-LUCK-002] given Ada at home with nothing, when month 11 ends it has not come; when month 12 ends it opens once, and never again", () => {
    const game = brokeAt(10);
    expect(openedIn(month(game)).map((item) => item.entry)).not.toContain(WHIP);
    expect(game.state.turn.month).toBe(11);
    const result = month(game);
    expect(openedIn(result).map((item) => item.entry)).toContain(WHIP);
    const item = Object.values(game.state.offer.items).find((held) => held.entry === WHIP)!;
    expect(item.terms).toEqual({ rescue: luck.rescue });
    game.accept({ type: "offer/choose", offer: item.id, choice: "decline" });
    for (let turn = 0; turn < 3; turn += 1) {
      emptyPockets(game);
      expect(openedIn(month(game)).map((opened) => opened.entry)).not.toContain(WHIP);
    }
  });

  test("[R-LUCK-002] [R-ENGINE-017] given the months before the rescue moved to 6 in the tuning, when month 6 ends with nothing held, then the whip-round opens", () => {
    const overlaid = applyOverlay(content, { version: "test-rescue-months", tuning: { ...content.tuning, luck: { ...luck, rescueAfterMonths: 6 } } });
    const game = brokeAt(4, overlaid);
    expect(openedIn(month(game)).map((item) => item.entry)).not.toContain(WHIP);
    expect(game.state.turn.month).toBe(5);
    emptyPockets(game);
    expect(openedIn(month(game)).map((item) => item.entry)).toContain(WHIP);
  });

  test("[R-LUCK-002] given holdings at the line, when the month comes up, then it does not open; one kobo under, it does", () => {
    for (const [held, opens] of [
      [luck.rescueUnder, false],
      [luck.rescueUnder - 1, true],
    ] as const) {
      const game = brokeAt(11);
      // With the family house's upkeep closed nothing is charged, so what is held at the roll is what was put in.
      applyEffects(game, [
        { type: "obligation/close", obligationType: "upkeep" },
        { type: "money/add", currency: "NGN", pocket: "cash", amount: held, reason: "gift" },
      ]);
      const result = month(game);
      expect(wealthInNaira(readOf(game))).toBe(held);
      expect(openedIn(result).map((item) => item.entry).includes(WHIP)).toBe(opens);
    }
  });

  test("[R-LUCK-002] given Ada abroad with nothing, when month 12 ends, then the whip-round does not come: it is the rescue at home", () => {
    const game = brokeAt(11);
    flyToUk(game);
    emptyPockets(game);
    expect(openedIn(month(game)).map((item) => item.entry)).not.toContain(WHIP);
  });

  test("[R-LUCK-002] given a loan in default, when month 12 ends with nothing held, then the whip-round does not come", () => {
    const game = brokeAt(9);
    applyEffects(game, [{ type: "obligation/open", obligation: "obligation.quick-loan", principal: 5000000 }]);
    emptyPockets(game);
    for (let turn = 0; turn < 3; turn += 1) {
      month(game);
      emptyPockets(game);
    }
    expect(Object.values(game.state.obligation.items).some((item) => item.entry === "obligation.quick-loan" && item.state === "defaulted")).toBe(true);
    expect(game.state.turn.month).toBe(12);
    expect(openEntries(game)).not.toContain(WHIP);
  });

  test("[R-LUCK-002] [R-ENGINE-017] given the whip-round accepted, when it pays, then the tuning's rescue reaches the bank as a flagged gift, and an overlay's figure is the one paid", () => {
    const overlaid = applyOverlay(content, { version: "test-rescue", tuning: { ...content.tuning, luck: { ...luck, rescue: 20000000 } } });
    const game = brokeAt(11, overlaid);
    month(game);
    const item = Object.values(game.state.offer.items).find((held) => held.entry === WHIP)!;
    expect(item.terms.rescue).toBe(20000000);
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: "accept" });
    expect(result.events).toContainEqual({ type: "wallet/credited", currency: "NGN", pocket: "bank", amount: 20000000, reason: "gift" });
    expect(game.state.wallet.lots).toContainEqual({ currency: "NGN", amount: 20000000, month: game.state.turn.month, reason: "gift" });
  });
});

describe("the telco promo", () => {
  const PROMO: Id<"offer"> = "offer.telco-promo";

  test("[R-LUCK-007] given the promo as a fraud, when it is claimed, then the fee goes and nothing follows; honest, the fee goes and the promo is paid", () => {
    for (const fraud of [true, false]) {
      const game = start({ scenario: ADA, content: variant({ [PROMO]: { fraudBp: fraud ? CERTAIN : 0 } }, false) });
      const item = openOne(game, PROMO);
      expect(item.terms).toEqual({ promo: luck.promo });
      const bank = game.state.wallet.pockets.NGN;
      const before = bank.bank + bank.cash;
      game.accept({ type: "offer/choose", offer: item.id, choice: "claim" });
      const after = game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash;
      expect(after - before).toBe(fraud ? -200000 : luck.promo - 200000);
    }
    expect(content.offer[PROMO]).toMatchObject({ group: "life", fraudBp: 8000, chanceBp: 300 });
    expect(content.offer[PROMO]?.signs.map((sign) => [sign.key, sign.honestBp, sign.fraudBp])).toEqual([
      ["shortcode", 8000, 2000],
      ["reply-now", 2000, 9000],
      ["strange-number", 1000, 8500],
    ]);
  });
});

describe("luck native to japa", () => {
  test("[R-LUCK-010] given the real luck entries, when they are read, then each is luck with the page's chance, condition and payment", () => {
    const relative = content.offer["offer.relative-sends"]!;
    expect(relative).toMatchObject({ luck: true, group: "life", chanceBp: 400, cooldown: 9 });
    expect(relative.choices[0]?.effects).toEqual([{ type: "money/add", currency: "USD", pocket: "bank", amount: 50000, reason: "gift", flagged: true }]);
    const bonus = content.offer["offer.december-bonus"]!;
    expect(bonus).toMatchObject({ luck: true, chanceBp: 3000, cooldown: 11 });
    expect(bonus.when).toEqual([{ type: "job/any" }, { type: "var/min", var: "var.season-december", value: 1 }]);
    expect(bonus.choices[0]?.effects).toEqual([{ type: "money/add", currency: "NGN", pocket: "bank", amount: { term: "pay" }, reason: "salary" }]);
    const scholarship = content.offer["offer.scholarship-round"]!;
    expect(scholarship).toMatchObject({ luck: true, chanceBp: 1500 });
    expect(scholarship.when).toContainEqual({ type: "route/offer", route: "route.uk-masters" });
    expect(scholarship.choices[0]?.effects).toEqual([{ type: "money/add", currency: "GBP", pocket: "bank", amount: 300000, reason: "gift" }]);
  });

  test("[R-LUCK-010] given a route known, when the relative's gift is taken, then $500 reaches the dollar bank as a flagged gift", () => {
    const game = start({ scenario: "scenario.tunde", content });
    const used = variant({ "offer.relative-sends": { when: [] } }, false);
    const lucky = start({ scenario: "scenario.tunde", content: used });
    const item = openOne(lucky, "offer.relative-sends");
    const result = lucky.accept({ type: "offer/choose", offer: item.id, choice: "thank" });
    expect(result.events).toContainEqual({ type: "wallet/credited", currency: "USD", pocket: "bank", amount: 50000, reason: "gift" });
    expect(lucky.state.wallet.lots).toContainEqual({ currency: "USD", amount: 50000, month: lucky.state.turn.month, reason: "gift" });
    // At the start no route is known, so the real entry does not open.
    applyEffects(game, [{ type: "offer/open", offer: "offer.relative-sends" }]);
    expect(openEntries(game)).not.toContain("offer.relative-sends");
  });
});

// ---------------------------------------------------------------------------
// R-HEALTH-006: an offer whose choice locks next month's slots
// ---------------------------------------------------------------------------

describe("an offer that locks a slot", () => {
  const lock = { type: "turn/lock" as const, slots: 1, months: 1, why: "village-burial" };
  const locking = ((): Content => {
    const used = variant({ "offer.nepa-bill": { lockNext: { slots: 1, months: 1, why: "village-burial" } } }, false);
    const entry = used.offer["offer.nepa-bill"]!;
    entry.choices = entry.choices.map((choice) => (choice.id === "pay" ? { ...choice, effects: [...choice.effects, lock] } : choice));
    return used;
  })();

  test("[R-HEALTH-006] given a choice that carries a lock, when it is taken, then one slot is locked for the month that follows and freed after it", () => {
    const game = start({ scenario: ADA, content: locking });
    const slots = game.view().freeSlots;
    const item = openOne(game, "offer.nepa-bill");
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: "pay" });
    expect(result.events).toContainEqual({ type: "turn/locked", slots: 1, untilMonth: game.state.turn.month, why: "village-burial" });
    expect(game.view().freeSlots).toBe(slots - 1);
    const rest = { activity: "activity.rest" as const, param: null };
    game.expectRejected({ type: "turn/end", slots: Array.from({ length: slots }, () => rest) }, "not-legal");
    game.endTurn(Array.from({ length: slots - 1 }, () => rest));
    expect(game.view().freeSlots).toBe(slots);
  });

  test("[R-HEALTH-006] given a locking offer left to lapse, when its month comes, then nothing is locked: only a choice taken locks", () => {
    const game = start({ scenario: ADA, content: locking });
    openOne(game, "offer.nepa-bill");
    const result = game.endTurn();
    expect(result.events.filter((event) => event.type === "offer/lapsed")).toHaveLength(1);
    expect(result.events.filter((event) => event.type === "turn/locked")).toEqual([]);
  });

  test("[R-HEALTH-006] given a choice with no lock among its effects, when it is taken, then nothing is locked, whatever the entry says a month ahead", () => {
    const game = start({ scenario: ADA, content: locking });
    const item = openOne(game, "offer.nepa-bill");
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: "leave" });
    expect(result.events.filter((event) => event.type === "turn/locked")).toEqual([]);
  });
});

describe("content that plays", () => {
  test("[R-OBLIGATION-012] [R-LUCK-009] given the real content, when the group loan, the parents' debt, the guarantor and the savings circle are read, then each rolls at the chance its page or its entry gives", () => {
    expect(content.offer["offer.group-loan"]?.chanceBp).toBe(300);
    expect(content.offer["offer.parents-group-debt"]?.chanceBp).toBe(100);
    expect(content.offer["offer.stand-guarantor"]?.chanceBp).toBe(100);
    expect(content.offer["offer.join-ajo"]?.chanceBp).toBe(800);
    const rolled = rollOrder(content).map((entry) => entry.id);
    expect(rolled).toEqual(expect.arrayContaining(["offer.group-loan", "offer.parents-group-debt", "offer.stand-guarantor", "offer.join-ajo"]));
  });

  test("[R-LADDER-005] [R-DIRECTOR-001] given the sponsor's licence risk in the world at 0 and at 10000, when months pass abroad, then the licence is never lost at 0 and lost at once at 10000", () => {
    const LOST: Id<"offer"> = "offer.sponsor-licence-lost";
    const onlyLoss = variant({ [LOST]: { when: [] } });
    for (const [risk, opens] of [
      [0, false],
      [10000, true],
    ] as const) {
      const game = start({
        scenario: ADA,
        content: onlyLoss,
        worldAt: (tick) => {
          const world = standInWorld("world-1", tick, onlyLoss);
          return { ...world, vars: { ...world.vars, "var.uk-care-sponsor-risk": risk } };
        },
      });
      flyToUk(game);
      const seen: Id<"offer">[] = [];
      for (let turn = 0; turn < 6; turn += 1) seen.push(...openedIn(month(game)).map((item) => item.entry));
      expect(seen.includes(LOST)).toBe(opens);
    }
  });
});
