// Leaving an overstay: the ban by the way out (place:leaving-an-overstay-bans, place:removal-bans-the-country), the returns service
// (place:returns-service-takes-you-home) and the way home the view forecasts (place:view-carries-way-home).
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import { convertMinor } from "../engine/int";
import type { Content, Effect, Id, ReportLine, StatusEntry } from "../engine/types";
import { flown, playMonths } from "../testing/place.journey";
import type { Game } from "../testing/play";
import { readOf } from "../testing/read";
import type { LifeOptions } from "../testing/route.journey";
import { applyEffects } from "../testing/route.journey";
import { officialRates } from "../wallet/wallet.rates";
import { bannedUntil } from "./place.logic";
import { CANADA_COUNTRY, ITALY, OVERSTAYER, UAE, UK_COUNTRY } from "../testing/ids";

const CANADA_OVERSTAYER: Id<"status"> = "status.canada-overstayer";
const UAE_IRREGULAR: Id<"status"> = "status.uae-irregular";
const EU_IRREGULAR: Id<"status"> = "status.eu-irregular";
const CARE_ROUTE: Id<"route"> = "route.uk-care";
const entryOf = (id: Id<"status">): StatusEntry => content.status[id]!;
const ukFare = content.country[UK_COUNTRY]!.fare;
const grant = entryOf(OVERSTAYER).returnGrant!;

/** No detection and no landlord's check, so nothing but the test's own choices moves the overstay. */
const QUIET = (used: Content): Content => ({ ...used, status: { ...used.status, [OVERSTAYER]: { ...used.status[OVERSTAYER]!, detectBp: 0, rentCheckBp: 0 } } });

function lapsed(options: LifeOptions = {}): Game {
  const game = flown(content, { change: QUIET, ...options });
  applyEffects(game, [{ type: "status/lose" }]);
  return game;
}

/** Every spendable pocket emptied, then these left in the banks. */
function leave(game: Game, nairaBank: number, poundBank: number): void {
  const takes: Effect[] = (["NGN", "GBP", "USD", "CAD", "AED", "EUR"] as const).flatMap((currency): Effect[] => {
    const pocket = game.state.wallet.pockets[currency];
    const held = pocket.bank + pocket.cash;
    return held === 0 ? [] : [{ type: "money/take", currency, pocket: "any", amount: held, reason: "mishap" }];
  });
  applyEffects(game, [
    ...takes,
    ...(nairaBank > 0 ? [{ type: "money/add", currency: "NGN", pocket: "bank", amount: nairaBank, reason: "gift" } as const] : []),
    ...(poundBank > 0 ? [{ type: "money/add", currency: "GBP", pocket: "bank", amount: poundBank, reason: "gift" } as const] : []),
  ]);
}

function placeLines(lines: ReportLine[]): ReportLine[] {
  return lines.filter((line) => line.key.startsWith("line.place."));
}

describe("the ban by the way out", () => {
  test("[place:leaving-an-overstay-bans] given each country's overstayer, when its bans are read, then they are the page's: the UK none, 12, 24 and 120; Canada none, none, 12 and 120; the UAE none, 12, 12 and 60; Italy none, none, none and 36", () => {
    const row = (id: Id<"status">): number[] => [0, entryOf(id).ownFareBanMonths!, entryOf(id).assistedBanMonths!, entryOf(id).banMonths];
    expect(row(OVERSTAYER)).toEqual([0, 12, 24, 120]);
    expect(row(CANADA_OVERSTAYER)).toEqual([0, 0, 12, 120]);
    expect(row(UAE_IRREGULAR)).toEqual([0, 12, 12, 60]);
    expect(row(EU_IRREGULAR)).toEqual([0, 0, 0, 36]);
  });

  test("[place:leaving-an-overstay-bans] given a UK overstayer in the grace with the fare, when the character goes home, then no ban is recorded", () => {
    const game = lapsed();
    game.accept({ type: "return/home" });
    expect(game.state.place.returns.at(-1)?.shape).toBe("by-choice");
    expect(bannedUntil(readOf(game), UK_COUNTRY)).toBeNull();
  });

  test("[place:leaving-an-overstay-bans] [place:removal-bans-the-country] given a UK overstayer past the grace with the fare, when the character goes home, then the UK is banned 12 months from that month, read as a removal's ban is", () => {
    const game = lapsed();
    playMonths(game, 2);
    game.accept({ type: "return/home" });
    const month = game.state.turn.month;
    expect(bannedUntil(readOf(game), UK_COUNTRY)).toBe(month + 12);
    expect(bannedUntil(readOf(game), CANADA_COUNTRY)).toBeNull();
    expect(check(readOf(game), { type: "place/banned", country: UK_COUNTRY }).met).toBe(true);
    applyEffects(game, [{ type: "quality/add", quality: "quality.care", amount: 60 }, { type: "route/hear", route: CARE_ROUTE, via: "test" }]);
    expect(game.state.route[CARE_ROUTE]?.state).toBe("unknown");
  });

  test("[place:leaving-an-overstay-bans] given a UK overstayer past the grace with nothing for the fare, when the assisted return takes the character home, then the UK is banned 24 months", () => {
    const game = lapsed();
    playMonths(game, 2);
    leave(game, 0, 0);
    game.accept({ type: "return/home" });
    expect(game.state.place.returns.at(-1)?.shape).toBe("assisted");
    expect(bannedUntil(readOf(game), UK_COUNTRY)).toBe(game.state.turn.month + 24);
  });

  test("[place:leaving-an-overstay-bans] given a return from a student status, when the character goes home, then no ban is recorded", () => {
    const game = flown(content);
    game.accept({ type: "return/home" });
    expect(bannedUntil(readOf(game), UK_COUNTRY)).toBeNull();
    expect(game.state.place.overstays ?? []).toEqual([]);
  });
});

describe("the returns service", () => {
  test("[place:returns-service-takes-you-home] [place:return-shape-decided-at-once] given a UK overstayer with the fare in hand, when the returns service is asked for, then no fare is paid, the return is assisted, the UK is banned 24 months and £1,500 arrives in the naira bank as a gift, unflagged, with a line", () => {
    expect(grant).toBe(150000);
    const game = lapsed();
    playMonths(game, 2);
    leave(game, 0, ukFare);
    const naira = convertMinor(grant, "GBP", "NGN", officialRates(game.world()));
    const lots = game.state.wallet.lots.length;
    const back = game.accept({ type: "return/home", scheme: true });
    expect(game.state.place.returns.at(-1)?.shape).toBe("assisted");
    expect(game.state.wallet.totals.out.fare).toBeUndefined();
    expect(game.state.wallet.pockets.GBP.bank).toBe(ukFare);
    expect(game.state.wallet.pockets.NGN.bank).toBe(naira);
    expect(game.state.wallet.totals.in.gift?.NGN).toBeGreaterThanOrEqual(naira);
    expect(game.state.wallet.lots.length).toBe(lots);
    expect(bannedUntil(readOf(game), UK_COUNTRY)).toBe(game.state.turn.month + 24);
    expect(placeLines(back.lines)).toContainEqual({ key: "line.place.returns-grant", params: { amount: { currency: "NGN", amount: naira } }, tone: "good", attention: false, counts: [] });
  });

  test("[place:returns-service-takes-you-home] given a UK overstayer in the grace with nothing, when the assisted return is taken, then it is the same service, grant included", () => {
    const game = lapsed();
    leave(game, 0, 0);
    game.accept({ type: "return/home" });
    expect(game.state.place.returns.at(-1)?.shape).toBe("assisted");
    expect(game.state.wallet.pockets.NGN.bank).toBe(convertMinor(grant, "GBP", "NGN", officialRates(game.world())));
  });

  test("[place:returns-service-takes-you-home] [place:return-home-paid-or-assisted] given a student, or an overstayer of a country with no returns service, when the service is asked for, then it is not legal", () => {
    const student = flown(content);
    expect(student.expectRejected({ type: "return/home", scheme: true }, "not-legal").code).toBe("not-legal");
    const uae = flown(content);
    uae.accept({ type: "return/home" });
    applyEffects(uae, [{ type: "place/move", to: "abroad", country: UAE }, { type: "status/grant", status: UAE_IRREGULAR }]);
    expect(uae.expectRejected({ type: "return/home", scheme: true }, "not-legal").code).toBe("not-legal");
  });
});

describe("the way home the view forecasts", () => {
  test("[place:view-carries-way-home] given a UK overstayer with the fare, when the view is read in the grace and past it, then the way home carries the ban it would record, no fine, and the returns service with its grant and ban", () => {
    const game = lapsed();
    const naira = (): number => convertMinor(grant, "GBP", "NGN", officialRates(game.world()));
    expect(game.view().place.wayHome).toMatchObject({ banMonths: 0, fine: null, scheme: { grant: { currency: "NGN", amount: naira() }, banMonths: 24 } });
    playMonths(game, 2);
    expect(game.view().place.wayHome).toMatchObject({ shape: "by-choice", banMonths: 12, fine: null, scheme: { grant: { currency: "NGN", amount: naira() }, banMonths: 24 } });
    const student = flown(content);
    expect(student.view().place.wayHome).toMatchObject({ banMonths: 0, fine: null, scheme: null });
  });

  test("[place:view-carries-way-home] [status:uae-fine-accrues] given the UAE's fine owed, when the view is read, then the fare carries the fine within it and says how much of it is the fine", () => {
    const quiet = (used: Content): Content => ({ ...used, status: { ...used.status, [UAE_IRREGULAR]: { ...used.status[UAE_IRREGULAR]!, detectBp: 0 } } });
    const game = flown(content, { change: quiet });
    game.accept({ type: "return/home" });
    applyEffects(game, [{ type: "place/move", to: "abroad", country: UAE }, { type: "status/grant", status: UAE_IRREGULAR }]);
    playMonths(game, 2);
    const fine = entryOf(UAE_IRREGULAR).finePerMonth!;
    const fare = content.country[UAE]!.fare;
    expect(game.view().place.wayHome).toMatchObject({ fare: { currency: "AED", amount: fare + fine }, fine: { currency: "AED", amount: fine }, banMonths: 12, scheme: null });
  });

  test("[place:view-carries-way-home] [road:sea-arrival-in-italy] given the road's far shore, when the view is read, then the way home is the assisted return with no ban", () => {
    const game = flown(content);
    game.accept({ type: "return/home" });
    applyEffects(game, [{ type: "place/move", to: "abroad", country: ITALY }, { type: "status/grant", status: EU_IRREGULAR }]);
    expect(game.view().place.wayHome).toMatchObject({ shape: "assisted", banMonths: 0, scheme: null });
  });
});

describe("the place kind's overstay words", () => {
  test("[engine:content-checked-before-play] given the returns service's line, when its words are looked up, then they name only the grant", () => {
    const words = text["line.place.returns-grant"] ?? "";
    expect(words.trim()).not.toBe("");
    for (const match of words.matchAll(/\{([^}]+)\}/g)) expect(["amount"]).toContain(match[1]);
  });
});
