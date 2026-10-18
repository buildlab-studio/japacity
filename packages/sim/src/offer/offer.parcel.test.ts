// Things shipped home: on a birthday, a relative abroad ships the character something, and it waits
// at the cargo office on Bode Thomas Street until it is collected for the clerk's handling charge.
// Played through the harness on the real content. The opening and the answer follow offer.md
// (offer:opening-fixes-terms-and-fraud, offer:choice-needs-conditions-and-funds, offer:lapsed-offer-removed); what each thing does is what the game already gives for it (streets:buy-phone-at-computer-village,
// activity:job-hunt-lands-offer, obligation:cooking-and-fetching-water); and nothing moves between lives (person:money-counted-never-moved).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { huntChanceBp } from "../activity/activity.logic";
import type { Accepted, Content, Id, OfferState, State } from "../engine/types";
import { applyEffects, slot, toKnown } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { setPockets } from "../testing/wallet";
import { cash } from "../testing/read";
import { PARCEL, parcelSender } from "./offer.parcel";
import { ADA } from "../testing/ids";

const { parcel, street, room } = content.tuning;
const MONTHS_A_YEAR = 12;
/** Ada's draw with no sibling abroad, and one with an older sibling settled in the UK (the people kind's draw). */
const NO_ONE_ABROAD = "seed-1";
const SIBLING_ABROAD = "seed-3";
/** Decision 0013 lives the living by hand at home; the foodstuff test reads the charge itself, so it charges it whole. */
const CHARGED: Content = { ...content, tuning: { ...content.tuning, home: { ...content.tuning.home, livingByHandBp: 0 } } };

function life(seed: string, scenario: Id<"scenario"> = ADA, base: Content = content): Game {
  return start({ content: base, scenario, seed });
}

function age(state: State): number {
  return state.quality["quality.age-months"] ?? 0;
}

function parcelOf(state: State): OfferState | undefined {
  return Object.values(state.offer.items).find((item) => item.entry === PARCEL);
}

function openedIn(result: Accepted): OfferState | undefined {
  for (const event of result.events) if (event.type === "offer/opened" && (event as unknown as { item: OfferState }).item.entry === PARCEL) return (event as unknown as { item: OfferState }).item;
  return undefined;
}

/** Plays resting months up to and including the next birthday; the month each parcel opened in, by the age it opened at. */
function toBirthday(game: Game): { opened: number[]; result: Accepted } {
  const opened: number[] = [];
  let result: Accepted | null = null;
  for (let guard = 0; guard < MONTHS_A_YEAR; guard += 1) {
    result = game.endTurn();
    if (openedIn(result) !== undefined) opened.push(age(game.state));
    if (age(game.state) % MONTHS_A_YEAR === 0) break;
  }
  if (result === null) throw new Error("No month was played.");
  return { opened, result };
}

/** A parcel opened by the offer kind's own effect, holding the choice handed over, or the one drawn when none is. */
function withParcel(game: Game, holds: string | null): OfferState {
  applyEffects(game, [{ type: "offer/open", offer: PARCEL }], holds === null ? {} : { holds });
  const item = parcelOf(game.state);
  if (item === undefined) throw new Error("The parcel did not open.");
  return item;
}

function bank(game: Game): number {
  return game.state.wallet.pockets.NGN.bank;
}

/** Enough in the bank for any month's bills, so a charge is never part-paid. */
const PLENTY = 50_000_000;

describe("the parcel: when it is shipped", () => {
  test("[streets:parcels-shipped-home] [offer:opening-fixes-terms-and-fraud] given Ada with a sibling settled in the UK, when her months are played to her birthday, then the parcel opens in the birthday month and in no month before it, from that sibling", () => {
    const game = life(SIBLING_ABROAD);
    const { opened, result } = toBirthday(game);
    expect(age(game.state) % MONTHS_A_YEAR).toBe(0);
    expect(opened).toEqual([age(game.state)]);
    const item = openedIn(result);
    expect(item?.terms["from"]).toBe("person.sib-uk-settled");
    expect(String(item?.terms["holds"]).startsWith("sibling-")).toBe(true);
    expect(item?.expiresMonth).toBe(game.state.turn.month + 3);
  });

  test("[offer:opening-fixes-terms-and-fraud] given Ada with no relative abroad in her story, when her months are played past her birthday, then no parcel opens", () => {
    const game = life(NO_ONE_ABROAD);
    expect(parcelSender({ state: game.state, world: game.world(), content })).toBeNull();
    const { opened } = toBirthday(game);
    expect(age(game.state) % MONTHS_A_YEAR).toBe(0);
    expect(opened).toEqual([]);
    game.endTurn();
    expect(parcelOf(game.state)).toBeUndefined();
  });

  test("[offer:opening-fixes-terms-and-fraud] given Ada with no sibling abroad but the UK route looked into, so her aunty abroad has heard she is travelling, when her birthday comes, then the parcel opens from the aunty", () => {
    const game = life(NO_ONE_ABROAD);
    toKnown(game);
    expect(age(game.state) % MONTHS_A_YEAR).not.toBe(0);
    const { opened, result } = toBirthday(game);
    expect(opened).toEqual([age(game.state)]);
    const item = openedIn(result);
    expect(item?.terms["from"]).toBe(`${PARCEL}.from.aunty`);
    expect(String(item?.terms["holds"]).startsWith("aunty-")).toBe(true);
  });

  test("[offer:opening-fixes-terms-and-fraud] given a sibling abroad, when the months that are not a birthday are played, then nothing opens until the birthday, and a parcel waiting is never opened twice", () => {
    const game = life(SIBLING_ABROAD);
    toBirthday(game);
    const first = parcelOf(game.state);
    expect(first).toBeDefined();
    const next = game.endTurn();
    expect(openedIn(next)).toBeUndefined();
    expect(parcelOf(game.state)?.id).toBe(first?.id);
  });

  test("[offer:opening-fixes-terms-and-fraud] given many lives with a sibling abroad, when each parcel opens, then the thing in it is drawn by the life's seed, and every thing of the sibling's comes up", () => {
    const held = new Set<string>();
    for (let index = 0; index < 400 && held.size < 4; index += 1) {
      const game = life(`parcel-${String(index)}`);
      game.endTurn();
      if (parcelSender({ state: game.state, world: game.world(), content }) === null) continue;
      const item = withParcel(game, null);
      held.add(String(item.terms["holds"]));
      // The same seed draws the same thing again.
      const twin = life(`parcel-${String(index)}`);
      twin.endTurn();
      expect(withParcel(twin, null).terms["holds"]).toBe(item.terms["holds"]);
    }
    expect([...held].sort()).toEqual(["sibling-clothes", "sibling-food", "sibling-laptop", "sibling-phone"]);
  });
});

describe("the parcel: collecting it", () => {
  test("[offer:choice-needs-conditions-and-funds] given a parcel holding a laptop, when the view is read and the other things are asked for, then the view offers only the laptop and the others are not legal", () => {
    const game = life(SIBLING_ABROAD);
    game.endTurn();
    const item = withParcel(game, "sibling-laptop");
    const shown = game.view().offers.find((offer) => offer.entry === PARCEL);
    expect(shown?.choices.map((choice) => [choice.id, choice.allowed])).toEqual([["sibling-laptop", true]]);
    game.expectRejected({ type: "offer/choose", offer: item.id, choice: "sibling-phone" }, "not-legal");
    game.expectRejected({ type: "offer/choose", offer: item.id, choice: "aunty-laptop" }, "not-legal");
  });

  test("[offer:choice-needs-conditions-and-funds] given a parcel and cash enough, when it is collected, then the handling charge leaves the cash and not the bank, and the parcel is gone", () => {
    const game = life(SIBLING_ABROAD);
    game.endTurn();
    setPockets(game, { NGN: { cash: parcel.handling * 4, bank: parcel.handling * 10 } });
    const item = withParcel(game, "sibling-clothes");
    expect(item.terms["handling"]).toBe(parcel.handling);
    game.accept({ type: "offer/choose", offer: item.id, choice: "sibling-clothes" });
    expect(cash(game)).toBe(parcel.handling * 3);
    expect(bank(game)).toBe(parcel.handling * 10);
    expect(parcelOf(game.state)).toBeUndefined();
  });

  test("[offer:choice-needs-conditions-and-funds] given cash under the charge, when the parcel is collected, then the cash goes first and the bank pays the rest", () => {
    const game = life(SIBLING_ABROAD);
    game.endTurn();
    setPockets(game, { NGN: { cash: parcel.handling - 100, bank: parcel.handling } });
    const item = withParcel(game, "sibling-phone");
    game.accept({ type: "offer/choose", offer: item.id, choice: "sibling-phone" });
    expect(cash(game) + bank(game)).toBe(parcel.handling - 100);
  });

  test("[offer:choice-needs-conditions-and-funds] given less naira than the charge in cash and bank together, when the parcel is collected, then it is refused as cannot-afford and nothing changes", () => {
    const game = life(SIBLING_ABROAD);
    game.endTurn();
    setPockets(game, { NGN: { cash: parcel.handling - 1, bank: 0 } });
    const item = withParcel(game, "sibling-food");
    expect(game.view().offers.find((offer) => offer.entry === PARCEL)?.choices[0]?.allowed).toBe(false);
    game.expectRejected({ type: "offer/choose", offer: item.id, choice: "sibling-food" }, "cannot-afford");
  });

  test("[person:money-counted-never-moved] given a parcel from a sibling abroad, when it is collected, then the only money that moves is the charge out of the player's own naira: nothing is credited from anyone", () => {
    const game = life(SIBLING_ABROAD);
    game.endTurn();
    setPockets(game, { NGN: { cash: parcel.handling * 2, bank: 0 } });
    const item = withParcel(game, "sibling-laptop");
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: "sibling-laptop" });
    const money = result.events.filter((event) => event.type.startsWith("wallet/"));
    expect(money.map((event) => event.type)).toEqual(["wallet/debited"]);
    expect(money[0]).toMatchObject({ currency: "NGN", amount: parcel.handling, reason: "upkeep" });
  });
});

describe("the parcel: what each thing gives", () => {
  function collect(holds: string, base: Content = content): { game: Game; before: State; result: Accepted } {
    const game = life(SIBLING_ABROAD, ADA, base);
    game.endTurn();
    setPockets(game, { NGN: { cash: parcel.handling * 10, bank: PLENTY } });
    // Room under the top of every quality, so each gift shows whole.
    applyEffects(game, [{ type: "quality/add", quality: "quality.wellbeing", amount: -40 }]);
    const item = withParcel(game, holds);
    const before = game.state;
    const result = game.accept({ type: "offer/choose", offer: item.id, choice: holds });
    return { game, before, result };
  }

  const quality = (state: State, id: Id<"quality">): number => state.quality[id] ?? 0;

  test("[streets:buy-phone-at-computer-village] given a phone in the parcel, when it is collected, then it gives what buying one at Computer Village gives, and the hunt's chance rises with the network (activity:job-hunt-lands-offer)", () => {
    const { game, before } = collect("sibling-phone");
    const buy = content.activity["activity.buy-phone"]!;
    expect(content.offer[PARCEL]!.choices.find((choice) => choice.id === "sibling-phone")?.effects.slice(1)).toEqual(buy.effects);
    expect(quality(game.state, "quality.network") - quality(before, "quality.network")).toBe(street.phoneNetwork);
    const job = content.activity["activity.job-phone-sales"]!;
    const read = (state: State) => huntChanceBp({ state, world: game.world(), content }, job);
    expect(read(game.state) - read(before)).toBe(street.phoneNetwork * content.tuning.quality.networkHireBp);
  });

  test("[offer:choice-needs-conditions-and-funds] given a laptop in the parcel, when it is collected, then wellbeing rises by the tuning's laptop mood, since no rule asks for a laptop", () => {
    const { game, before } = collect("sibling-laptop");
    expect(quality(game.state, "quality.wellbeing") - quality(before, "quality.wellbeing")).toBe(parcel.laptopMood);
  });

  test("[offer:choice-needs-conditions-and-funds] given clothes in the parcel, when they are collected, then interview prep rises by the tuning's figure", () => {
    const { game, before } = collect("sibling-clothes");
    expect(quality(game.state, "quality.interview-prep") - quality(before, "quality.interview-prep")).toBe(parcel.clothesPrep);
  });

  test("[obligation:cooking-and-fetching-water] given foodstuff in the parcel, when it is collected, then the next month's living costs fall by what cooking gives, once", () => {
    const { game } = collect("sibling-food", CHARGED);
    const twinOf = (): Game => {
      const twin = life(SIBLING_ABROAD, ADA, CHARGED);
      twin.endTurn();
      setPockets(twin, { NGN: { cash: parcel.handling * 10, bank: PLENTY } });
      return twin;
    };
    const twin = twinOf();
    const cook = twinOf();
    const paid = (result: Accepted): number =>
      result.events.filter((event) => event.type === "wallet/debited" && (event as unknown as { reason: string }).reason === "upkeep").reduce((sum, event) => sum + (event as unknown as { amount: number }).amount, 0);
    const fed = game.endTurn();
    const plain = twin.endTurn();
    const cooked = cook.endTurn([slot("activity.cook-at-home")]);
    expect(room.cookedBp).toBeGreaterThan(0);
    expect(paid(plain) - paid(fed)).toBeGreaterThan(0);
    expect(paid(plain) - paid(fed)).toBe(paid(plain) - paid(cooked));
    expect(fed.lines.some((line) => line.key === "line.obligation.relief.parcel-shipped.sibling-food")).toBe(true);
    // Once: the month after, the charge is whole again.
    expect(paid(game.endTurn())).toBe(paid(twin.endTurn()));
  });
});

describe("the parcel: left at the office", () => {
  test("[offer:lapsed-offer-removed] given a parcel left uncollected, when two months pass it still waits, and at the end of the third it lapses with nothing paid", () => {
    const game = life(SIBLING_ABROAD);
    toBirthday(game);
    const item = parcelOf(game.state);
    expect(item).toBeDefined();
    const lapsed = (result: Accepted): { choice: string | null }[] =>
      result.events.filter((event) => event.type === "offer/lapsed" && (event as unknown as { entry: string }).entry === PARCEL).map((event) => ({ choice: (event as unknown as { choice: string | null }).choice }));
    expect(lapsed(game.endTurn())).toEqual([]);
    expect(lapsed(game.endTurn())).toEqual([]);
    expect(parcelOf(game.state)?.id).toBe(item?.id);
    const third = game.endTurn();
    // No choice is taken as it lapses, so no charge is paid and nothing is given.
    expect(lapsed(third)).toEqual([{ choice: null }]);
    expect(third.events.some((event) => event.type === "offer/taken")).toBe(false);
    expect(parcelOf(game.state)).toBeUndefined();
  });
});
