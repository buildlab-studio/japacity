// The streets abroad with the real content (docs/rules/streets.md R-STREET-005, 006): shopping on
// the street takes that currency's money and lifts the mood, and something interesting turns up only
// while the character is in that country, never at home.
// R-ACTIVITY-015: a now-act (an application, a paper, a visit) is refused in a slot, so each probe sends one as
// activity/now, and an application checked as applying is read in the month it is sent.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Accepted, BaseEvent, Content, Currency, Id } from "../engine/types";
import { flown } from "../testing/place.journey";
import { applyEffects, slot } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { openOffers } from "../testing/read";

const SHOP_UK: Id<"activity"> = "activity.street-shopping-uk";
const SHOP_UAE: Id<"activity"> = "activity.street-shopping-uae";
const FIND_UK: Id<"offer"> = "offer.street-find-uk";
const FIND_UAE: Id<"offer"> = "offer.street-find-uae";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const CERTAIN = 10000;
const street = content.tuning.street;

interface Debit {
  type: string;
  currency: Currency;
  pocket: string;
  amount: number;
  reason: string;
}

interface Changed {
  type: string;
  quality: string;
  amount: number;
  source: string;
}

function debitsOf(result: Accepted, currency: Currency): Debit[] {
  return result.events.filter((event): event is BaseEvent & Debit => event.type === "wallet/debited" && (event as unknown as Debit).currency === currency);
}

/** What one source did to the mood this month. */
function moodFrom(result: Accepted, source: string): number {
  return result.events
    .filter((event): event is BaseEvent & Changed => event.type === "quality/changed")
    .filter((event) => event.quality === WELLBEING && event.source === source)
    .reduce((sum, event) => sum + event.amount, 0);
}

/** Sets the mood low enough that a lift is never lost to the cap. */
function lowMood(game: Game): void {
  const now = game.state.quality[WELLBEING] ?? 0;
  applyEffects(game, [{ type: "quality/add", quality: WELLBEING, amount: 30 - now }]);
}

/** Ends a turn, granting turns first when the bank is empty. */
function month(game: Game, slots = [] as ReturnType<typeof slot>[]): Accepted {
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn(slots);
}

/** The real content with only the named offers ever rolled, each at the chance given. */
function onlyOffers(chances: Partial<Record<Id<"offer">, number>>): Content {
  const copy = JSON.parse(JSON.stringify(content)) as Content;
  for (const entry of Object.values(copy.offer)) entry.chanceBp = chances[entry.id] ?? 0;
  return copy;
}

describe("shopping on the street abroad", () => {
  test("[R-STREET-005] given a student in London whose pounds are all in cash, when the month's free slot shops on Rye Lane, then the price leaves the pound cash as enjoyment and the mood rises by the street's figure", () => {
    const game = flown(content);
    // R-STREET-005 says the price comes from the currency's cash, but an entry's cost is paid by
    // R-WALLET-009 (the bank pocket first). With the pounds all in cash, the two readings agree.
    const bank = game.state.wallet.pockets.GBP?.bank ?? 0;
    applyEffects(game, [
      { type: "money/take", currency: "GBP", pocket: "bank", amount: bank, reason: "mishap" },
      { type: "money/add", currency: "GBP", pocket: "cash", amount: street.shoppingGbp * 3, reason: "gift" },
    ]);
    lowMood(game);
    expect(game.view().activities.find((option) => option.id === SHOP_UK)?.allowed).toBe(true);
    const result = month(game, [slot(SHOP_UK)]);
    // London's stalls are paid as enjoyment.
    expect(debitsOf(result, "GBP").filter((debit) => debit.reason === "enjoyment")).toEqual([
      { type: "wallet/debited", currency: "GBP", pocket: "cash", amount: street.shoppingGbp, reason: "enjoyment" },
    ]);
    expect(moodFrom(result, SHOP_UK)).toBe(street.shoppingMood);
  });

  test("[R-STREET-005] given a life in Dubai with dirhams in cash, when the month's free slot shops in the souk, then the dirham price is paid and the mood rises; the London shopping is not allowed there", () => {
    const game = start({ content, scenario: "scenario.ada" });
    applyEffects(game, [
      { type: "place/move", to: "abroad", country: "country.uae" },
      { type: "money/add", currency: "AED", pocket: "cash", amount: street.shoppingAed * 3, reason: "gift" },
    ]);
    lowMood(game);
    const options = game.view().activities;
    expect(options.find((option) => option.id === SHOP_UAE)?.allowed).toBe(true);
    expect(options.find((option) => option.id === SHOP_UK)?.allowed ?? false).toBe(false);
    const result = month(game, [slot(SHOP_UAE)]);
    // streets.md R-STREET-014: the souq is paid as enjoyment, as London's stalls are.
    expect(debitsOf(result, "AED").filter((debit) => debit.reason === "enjoyment")).toEqual([
      { type: "wallet/debited", currency: "AED", pocket: "cash", amount: street.shoppingAed, reason: "enjoyment" },
    ]);
    expect(moodFrom(result, SHOP_UAE)).toBe(street.shoppingMood);
  });

  test("[R-STREET-005] given a life at home in Lagos, when the street shopping abroad is put in a slot, then it is rejected", () => {
    const game = start({ content, scenario: "scenario.ada" });
    expect(game.view().activities.filter((option) => (option.id === SHOP_UK || option.id === SHOP_UAE) && option.allowed)).toEqual([]);
    game.expectRejected({ type: "activity/now", activity: SHOP_UK, param: null }, "not-legal");
    game.expectRejected({ type: "activity/now", activity: SHOP_UAE, param: null }, "not-legal");
  });
});

describe("something interesting on the street", () => {
  const certain = onlyOffers({ [FIND_UK]: CERTAIN, [FIND_UAE]: CERTAIN });

  test("[R-STREET-006] given both finds made certain, when months come up at home, then neither ever opens", () => {
    const game = start({ content: certain, scenario: "scenario.ada" });
    for (let n = 0; n < 4; n += 1) {
      month(game);
      expect(openOffers(game)).toEqual([]);
    }
  });

  test("[R-STREET-006] given both finds made certain, when a month comes up in London and then in Dubai, then only that country's find opens", () => {
    const game = start({ content: certain, scenario: "scenario.ada" });
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    month(game);
    expect(openOffers(game)).toEqual([FIND_UK]);

    const dubai = start({ content: certain, scenario: "scenario.ada" });
    applyEffects(dubai, [{ type: "place/move", to: "abroad", country: "country.uae" }]);
    month(dubai);
    expect(openOffers(dubai)).toEqual([FIND_UAE]);
  });

  test("[R-STREET-006] given the find open in London, when the player looks, then the mood rises by the street's figure and it cannot come up again inside its cooldown", () => {
    const game = start({ content: certain, scenario: "scenario.ada" });
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    lowMood(game);
    month(game);
    const item = Object.values(game.state.offer.items).find((held) => held.entry === FIND_UK);
    if (item === undefined) throw new Error("The find did not open.");
    const before = game.state.quality[WELLBEING] ?? 0;
    game.accept({ type: "offer/choose", offer: item.id, choice: "look" });
    expect((game.state.quality[WELLBEING] ?? 0) - before).toBe(street.findMood);
    const cooldown = content.offer[FIND_UK]?.cooldown ?? 0;
    expect(cooldown).toBe(2);
    month(game);
    expect(openOffers(game)).toEqual([]);
    month(game);
    expect(openOffers(game)).toEqual([FIND_UK]);
  });

  test("[R-STREET-006] given the real chance, when its entry is read, then it is the street's chance a month and the find is no blow and no fraud", () => {
    for (const id of [FIND_UK, FIND_UAE]) {
      expect(content.offer[id]).toMatchObject({ group: "life", chanceBp: street.findBp, bad: false, fraudBp: 0 });
    }
  });
});
