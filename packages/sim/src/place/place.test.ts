import { content, text } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { check } from "../engine/check";
import { bp, divCeil, divFloor, mulDiv } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import type { Content, Currency, Effect, Id, ObligationType, ReadCtx, ReportLine, ReturnShape, State } from "../engine/types";
import { applyEffects, readyLife, toDecision } from "../testing/route.journey";
import { legalCommands } from "../testing/legal";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { ALWAYS_GRANTED, flown, offeredSeed, playMonths, recordingCloses } from "../testing/place.journey";
import { readOf } from "../testing/read";
import { setPockets } from "../testing/wallet";
import { appliesHere, bannedUntil, capitalBonus, fareHome, metresApart, returnShape, rideFare, withinMetres } from "./place.logic";
import { CANADA_COUNTRY, DECEMBER_SETPIECE, SETTLED, STANDING, STUDENT, UK_COUNTRY, UK_ROUTE } from "../testing/ids";

/** The four ways of Lagos as the view lists them with no car at home (place:rides-between-city-places). */
function lagosWays(): unknown[] {
  const { fareKobo, farePerKmKobo, metresPerMinute } = content.tuning.city.ride;
  return (["danfo", "keke", "okada", "walk"] as const).map((way) => ({ way, currency: "NGN", fare: fareKobo[way], farePerKm: farePerKmKobo[way], step: 5000, lonMetresPerE3: 111, metresPerMinute: metresPerMinute[way], passed: false }));
}

function at(where: State["place"]["where"], country: Id<"country"> | null): State {
  const game = start({ content });
  return { ...game.state, place: { ...game.state.place, where, country } };
}

describe("where an entry applies", () => {
  test("[place:entries-legal-by-where] given entries for home, abroad, one country and anywhere, when the character is at home, abroad in two countries and on the road, then each applies only where its page says", () => {
    const home = at("home", null);
    const uk = at("abroad", UK_COUNTRY);
    const canada = at("abroad", CANADA_COUNTRY);
    const road = at("road", null);
    const homeEntry = { where: "home" as const };
    const unsaid = {};
    const abroadEntry = { where: "abroad" as const };
    const ukEntry = { where: "abroad" as const, country: UK_COUNTRY };
    const anywhere = { where: "any" as const, country: UK_COUNTRY };
    expect([home, uk, canada, road].map((state) => appliesHere(homeEntry, state))).toEqual([true, false, false, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(unsaid, state))).toEqual([true, false, false, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(abroadEntry, state))).toEqual([false, true, true, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(ukEntry, state))).toEqual([false, true, false, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(anywhere, state))).toEqual([true, true, true, true]);
  });

  test("[place:entries-legal-by-where] given the real content, when every activity, offer and obligation is read at home, then the abroad ones do not apply and the home ones do", () => {
    const home = at("home", null);
    const entries = [...Object.values(content.activity), ...Object.values(content.offer), ...Object.values(content.obligation)];
    for (const entry of entries) {
      expect(appliesHere(entry, home)).toBe((entry.where ?? "home") !== "abroad");
    }
  });
});

const RESIDENT: Id<"status"> = "status.ca-resident";
const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD", "CAD", "AED", "EUR"];
const tuning = content.tuning;
const brokeLine = tuning.place.brokeLine;
const capitalPer = tuning.return.capitalPer;
const ukFare = content.country[UK_COUNTRY]!.fare;

function placeLines(lines: ReportLine[]): ReportLine[] {
  return lines.filter((line) => line.key.startsWith("line.place."));
}

/** Empties every spendable pocket, then leaves the naira bank and the pound bank holding exactly these. */
function leave(game: Game, nairaBank: number, poundBank: number): void {
  const takes: Effect[] = CURRENCIES.flatMap((currency): Effect[] => {
    const pocket = game.state.wallet.pockets[currency];
    const held = pocket.bank + pocket.cash;
    return held === 0 ? [] : [{ type: "money/take", currency, pocket: "any", amount: held, reason: "mishap" }];
  });
  applyEffects(game, [
    ...takes,
    { type: "money/add", currency: "NGN", pocket: "bank", amount: nairaBank, reason: "gift" },
    { type: "money/add", currency: "GBP", pocket: "bank", amount: poundBank, reason: "gift" },
  ]);
}

function standing(game: Game): number {
  return game.state.quality[STANDING] ?? 0;
}

/** Comes home by command: the standing it moved, the shape recorded and the lines. */
function comeHome(game: Game): { moved: number; shape: ReturnShape | undefined; lines: ReportLine[] } {
  const before = standing(game);
  const result = game.accept({ type: "return/home" });
  return { moved: standing(game) - before, shape: game.state.place.returns.at(-1)?.shape, lines: result.lines };
}

function openedThisMonth(game: Game): string[] {
  return Object.values(game.state.obligation.items)
    .filter((item) => item.openedMonth === game.state.turn.month)
    .map((item) => `${item.entry} ${String(item.amount)}`);
}

describe("a new character", () => {
  test("[place:new-character-at-home] given a new life, when it starts, then the character is at home with no country, no move and no return on record", () => {
    const game = start({ content });
    expect(game.state.place).toEqual({ where: "home", country: null, movedMonth: 0, returns: [], heldAbroad: null, decemberMonth: null });
    expect(game.view().place).toEqual({ where: "home", country: null, monthsHere: 0, returns: [], heldAbroad: null, fareHome: null, fareBp: 10000, wayHome: null, ways: lagosWays(), shuttles: [] });
  });
});

describe("leaving", () => {
  test("[place:departure-moves-abroad] [route-gates:departure-grants-status] given Ada with a granted visa, when she departs, then she is abroad in the route's country from that month, the home upkeep and support close, with any rent on a room at home, and the country's upkeep and room open", () => {
    const closed: ObligationType[] = [];
    const game = flown(content, { kinds: recordingCloses(closed) });
    expect(game.state.place).toMatchObject({ where: "abroad", country: UK_COUNTRY, movedMonth: game.state.turn.month });
    // place:departure-moves-abroad: a room's rent at home is let go with them (home:compound-room-is-a-home).
    expect(closed).toEqual(["upkeep", "support", "rent"]);
    const upkeep = content.obligation["obligation.upkeep-uk"]!.amount;
    const room = content.obligation["obligation.rent-room-uk"]!.amount;
    expect(openedThisMonth(game)).toEqual(expect.arrayContaining([`obligation.upkeep-uk ${String(upkeep)}`, `obligation.rent-room-uk ${String(room)}`]));
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[place:departure-moves-abroad] given a life with family support, when it departs, then the support opens again abroad at the remit factor", () => {
    const game = flown(content, { from: "scenario.zainab" });
    expect(openedThisMonth(game)).toContain(`obligation.home-support ${String(bp(60000 * 100, tuning.remit.abroadBp))}`);
  });

  test("[place:departure-moves-abroad] given a departure, when its lines are read, then the arrival asks for attention and names the country; a move to the place already held does nothing", () => {
    const game = readyLife(content, { seed: offeredSeed(content), tuning: { refusalMinBp: 0, refusalMaxBp: 0 } });
    toDecision(game);
    const result = game.accept({ type: "route/depart", route: UK_ROUTE });
    expect(placeLines(result.lines)).toEqual([{ key: "line.place.arrived", params: { country: UK_COUNTRY }, tone: "good", attention: true, counts: [] }]);
    const months = game.state.place.movedMonth;
    playMonths(game, 1);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: UK_COUNTRY }]);
    expect(game.state.place.movedMonth).toBe(months);
  });

  test("[place:departure-moves-abroad] [chapter:met-items-close-the-chapter] given the send-off chapter current, when the character flies and the month ends, then the life goes on and the chapter closes in that month's chapter phase", () => {
    const game = flown(content);
    // The ready life skips the first chapters' play, so the send-off is made current by hand.
    game.state = { ...game.state, chapter: { current: "chapter.send-off", done: ["chapter.find-your-feet", "chapter.build-the-file", "chapter.decision-day"] } };
    expect(game.state.turn.ended).toBe(false);
    if (game.state.turn.banked < 1) game.grant(1);
    const result = game.endTurn();
    expect(game.state.chapter.done).toContain("chapter.send-off");
    expect(result.lines).toContainEqual(expect.objectContaining({ key: "line.chapter.closed", params: { chapter: "chapter.send-off" } }));
  });
});

describe("coming home", () => {
  test("[place:rides-between-city-places] given two places, when a way's fare is read, then it is the flag-down figure plus the figure a kilometre over the straight line, in fifties of naira, more for a farther place, nothing on foot, and the flag-down figure alone for a place with no position", () => {
    const { fareKobo, farePerKmKobo } = content.tuning.city.ride;
    const ojuelegba = content.place["place.ojuelegba"]!.position!;
    const bode = content.place["place.bode-thomas"]!.position!;
    const ikeja = content.place["place.computer-village"]!.position!;
    const near = rideFare(content, ojuelegba, bode, "danfo");
    const far = rideFare(content, ojuelegba, ikeja, "danfo");
    expect(metresApart(ojuelegba, bode)).toBeLessThan(metresApart(ojuelegba, ikeja));
    expect(near).toBeGreaterThan(fareKobo.danfo);
    expect(far).toBeGreaterThan(near);
    expect(near % 5000).toBe(0);
    expect(far % 5000).toBe(0);
    // Ojuelegba to Computer Village is about nine kilometres: the danfo's fare is the flag-down figure plus nine times its kilometre, rounded up to fifty naira.
    const metres = metresApart(ojuelegba, ikeja);
    expect(far).toBe(divCeil(fareKobo.danfo + divFloor(farePerKmKobo.danfo * metres, 1000), 5000) * 5000);
    expect(rideFare(content, ojuelegba, ikeja, "walk")).toBe(0);
    expect(rideFare(content, null, ikeja, "keke")).toBe(fareKobo.keke);
    // The month's factor doubles the rounded figure, so the doubled fare is still in fifties.
    expect(rideFare(content, ojuelegba, ikeja, "okada", 20000)).toBe(2 * rideFare(content, ojuelegba, ikeja, "okada"));
    // Each way dearer than the last at the same distance.
    expect(rideFare(content, ojuelegba, bode, "keke")).toBeGreaterThan(near);
    expect(rideFare(content, ojuelegba, bode, "okada")).toBeGreaterThan(rideFare(content, ojuelegba, bode, "keke"));
  });

  test("[place:rides-between-city-places] given a character at home with the fare in cash, when a ride is sent, then the way's fare for the distance leaves cash as a fare and the ride is on record", () => {
    const game = start({ content });
    const fare = rideFare(content, content.place["place.ojuelegba"]!.position, content.place["place.bode-thomas"]!.position, "keke");
    const before = game.view().pockets.NGN.cash;
    const result = game.accept({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "keke" });
    expect(result.events.filter((event) => event.type === "wallet/debited")).toMatchObject([{ pocket: "cash", amount: fare, reason: "fare" }]);
    expect(result.events.find((event) => event.type === "place/rode")).toMatchObject({ from: "place.ojuelegba", to: "place.bode-thomas", way: "keke", fare });
    expect(game.view().pockets.NGN.cash).toBe(before - fare);
    expect(game.view().place.where).toBe("home");
  });

  test("[place:rides-between-city-places] given the fuel scarcity's ask opened this month, when a ride is sent, then every fare is the scarcity's share of its figure and the view says the month's factor; the month after, the fares stand as they were", () => {
    const game = start({ content });
    const month = game.state.turn.month;
    game.state = { ...game.state, offer: { ...game.state.offer, lastOpened: { ...game.state.offer.lastOpened, "offer.fuel-scarcity": month } } };
    const { scarcityBp, fareKobo } = content.tuning.city.ride;
    expect(scarcityBp).toBe(20000);
    expect(game.view().place.fareBp).toBe(scarcityBp);
    const before = game.view().pockets.NGN.cash;
    const result = game.accept({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "danfo" });
    expect(fareKobo.danfo).toBeGreaterThan(0);
    const doubled = rideFare(content, content.place["place.ojuelegba"]!.position, content.place["place.bode-thomas"]!.position, "danfo", scarcityBp);
    expect(result.events.find((event) => event.type === "place/rode")).toMatchObject({ way: "danfo", fare: doubled });
    expect(game.view().pockets.NGN.cash).toBe(before - doubled);
    game.endTurn([]);
    expect(game.view().place.fareBp).toBe(10000);
  });

  test("[place:rides-between-city-places] given the fare short in cash, the same place twice, a place elsewhere, or a character abroad, when a ride is sent, then it is refused and nothing is paid", () => {
    const game = start({ content });
    const cash = game.view().pockets.NGN.cash;
    game.expectRejected({ type: "place/ride", from: "place.ojuelegba", to: "place.ojuelegba", way: "danfo" }, "not-legal");
    game.expectRejected({ type: "place/ride", from: "place.ojuelegba", to: "place.peckham", way: "danfo" }, "not-legal");
    game.expectRejected({ type: "place/ride", from: "place.ojuelegba", to: "place.nowhere", way: "danfo" }, "unknown-id");
    // A fare over the naira in both pockets together cannot be paid, and nothing leaves either pocket.
    const total = cash + game.view().pockets.NGN.bank;
    const ride = { ...content.tuning.city.ride, fareKobo: { ...content.tuning.city.ride.fareKobo, okada: total + 1 } };
    const dear = start({ content: { ...content, tuning: { ...content.tuning, city: { ...content.tuning.city, ride } } } });
    dear.expectRejected({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "okada" }, "cannot-afford");
    expect(dear.view().pockets.NGN.cash + dear.view().pockets.NGN.bank).toBe(total);
    const abroad = flown(content);
    abroad.expectRejected({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "danfo" }, "not-legal");
  });

  test("[place:rides-between-city-places] given the fare over the cash but within the naira, when a ride is sent, then cash goes first and the bank pays the rest", () => {
    const game = start({ content });
    const fare = rideFare(content, content.place["place.ojuelegba"]!.position, content.place["place.bode-thomas"]!.position, "okada");
    const cash = game.view().pockets.NGN.cash;
    // Leave less than the fare in cash, the rest in the bank.
    const keep = fare - 1;
    game.accept({ type: "wallet/move", currency: "NGN", amount: cash - keep, to: "bank" });
    const bank = game.view().pockets.NGN.bank;
    const result = game.accept({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "okada" });
    expect(result.events.filter((event) => event.type === "wallet/debited")).toMatchObject([
      { pocket: "cash", amount: keep, reason: "fare" },
      { pocket: "bank", amount: 1, reason: "fare" },
    ]);
    expect(game.view().pockets.NGN.cash).toBe(0);
    expect(game.view().pockets.NGN.bank).toBe(bank - 1);
  });

  test("[place:rides-between-city-places] given no naira at all, when the character goes on foot, then the ride is on record with no fare and nothing is debited", () => {
    const ride = { ...content.tuning.city.ride, fareKobo: { ...content.tuning.city.ride.fareKobo, danfo: 1_000_000_000_000 } };
    const game = start({ content: { ...content, tuning: { ...content.tuning, city: { ...content.tuning.city, ride } } } });
    expect(content.tuning.city.ride.fareKobo.walk).toBe(0);
    game.expectRejected({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "danfo" }, "cannot-afford");
    // Tejuosho is within walking distance of Ojuelegba; Bode Thomas Street is not (place:rides-between-city-places).
    const result = game.accept({ type: "place/ride", from: "place.ojuelegba", to: "place.tejuosho-market", way: "walk" });
    expect(result.events.filter((event) => event.type === "wallet/debited")).toEqual([]);
    expect(result.events.find((event) => event.type === "place/rode")).toMatchObject({ way: "walk", fare: 0 });
  });

  test("[place:rides-between-city-places] given a stop past walking distance, when a walk is sent, then it is refused as not legal, while a stop within it is walked and a ride there is taken", () => {
    const game = start({ content });
    const from = content.place["place.ojuelegba"]?.position;
    const near = content.place["place.tejuosho-market"]?.position;
    const far = content.place["place.bode-thomas"]?.position;
    if (from === null || from === undefined || near === null || near === undefined || far === null || far === undefined) throw new Error("A place has no position.");
    const limit = content.tuning.city.ride.walkMetres;
    expect(withinMetres(from, near, limit)).toBe(true);
    expect(withinMetres(from, far, limit)).toBe(false);
    game.expectRejected({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "walk" }, "not-legal");
    expect(game.accept({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "danfo" }).events.find((event) => event.type === "place/rode")).toMatchObject({ way: "danfo" });
    expect(game.accept({ type: "place/ride", from: "place.ojuelegba", to: "place.tejuosho-market", way: "walk" }).events.find((event) => event.type === "place/rode")).toMatchObject({ way: "walk", fare: 0 });
  });

  test("[place:rides-between-city-places] given a life living in Makoko standing at Bode Thomas Street, past walking distance of home, with naira short of the cheapest fare home, when a walk home is sent, then it is accepted with no fare, while a walk to another stop that far is still refused", () => {
    const game = start({ content, scenario: "scenario.ada" });
    game.accept({ type: "home/move", to: "place.makoko" });
    const cheapest = rideFare(content, content.place["place.bode-thomas"]?.position ?? null, content.place["place.makoko"]?.position ?? null, "danfo");
    setPockets(game, { NGN: { cash: cheapest - 1, bank: 0 } });
    const from = content.place["place.bode-thomas"]?.position;
    const home = content.place["place.makoko"]?.position;
    const other = content.place["place.ojuelegba"]?.position;
    if (from === null || from === undefined || home === null || home === undefined || other === null || other === undefined) throw new Error("A place has no position.");
    const limit = content.tuning.city.ride.walkMetres;
    expect(withinMetres(from, home, limit)).toBe(false);
    expect(withinMetres(from, other, limit)).toBe(false);
    game.expectRejected({ type: "place/ride", from: "place.bode-thomas", to: "place.ojuelegba", way: "walk" }, "not-legal");
    const result = game.accept({ type: "place/ride", from: "place.bode-thomas", to: "place.makoko", way: "walk" });
    expect(result.events.filter((event) => event.type === "wallet/debited")).toEqual([]);
    expect(result.events.find((event) => event.type === "place/rode")).toMatchObject({ way: "walk", fare: 0 });
  });

  test("[place:rides-between-city-places] [world:ride-sheet-shows-fares] given a life past walking distance of home with naira for the cheapest fare home, when a walk home is sent, then it is refused as too far; a kobo short, cash and bank together, it is walked", () => {
    const game = start({ content, scenario: "scenario.ada" });
    game.accept({ type: "home/move", to: "place.makoko" });
    const from = content.place["place.bode-thomas"]?.position ?? null;
    const home = content.place["place.makoko"]?.position ?? null;
    const fares = (["danfo", "keke", "okada"] as const).map((way) => rideFare(content, from, home, way));
    const cheapest = Math.min(...fares);
    expect(cheapest).toBe(fares[0]);
    setPockets(game, { NGN: { cash: cheapest - 100, bank: 100 } });
    game.expectRejected({ type: "place/ride", from: "place.bode-thomas", to: "place.makoko", way: "walk" }, "not-legal");
    setPockets(game, { NGN: { cash: cheapest - 101, bank: 100 } });
    expect(game.accept({ type: "place/ride", from: "place.bode-thomas", to: "place.makoko", way: "walk" }).events.find((event) => event.type === "place/rode")).toMatchObject({ way: "walk", fare: 0 });
    // Within walking distance a walk is open whatever is held.
    setPockets(game, { NGN: 100_000_000 });
    expect(game.accept({ type: "place/ride", from: "place.ojuelegba", to: "place.tejuosho-market", way: "walk" }).events.find((event) => event.type === "place/rode")).toMatchObject({ way: "walk", fare: 0 });
  });

  test("[place:rides-between-city-places] given the fuel scarcity's month, when the naira held pays the flat fare but not the month's, then the long walk home is open", () => {
    const game = start({ content, scenario: "scenario.ada" });
    game.accept({ type: "home/move", to: "place.makoko" });
    const month = game.state.turn.month;
    game.state = { ...game.state, offer: { ...game.state.offer, lastOpened: { ...game.state.offer.lastOpened, "offer.fuel-scarcity": month } } };
    const from = content.place["place.bode-thomas"]?.position ?? null;
    const home = content.place["place.makoko"]?.position ?? null;
    const flat = rideFare(content, from, home, "danfo");
    expect(rideFare(content, from, home, "danfo", content.tuning.city.ride.scarcityBp)).toBeGreaterThan(flat);
    setPockets(game, { NGN: flat });
    expect(game.accept({ type: "place/ride", from: "place.bode-thomas", to: "place.makoko", way: "walk" }).events.find((event) => event.type === "place/rode")).toMatchObject({ way: "walk", fare: 0 });
  });

  test("[place:return-home-paid-or-assisted] given a character at home, when return/home is sent, then it is rejected", () => {
    const game = readyLife(content);
    const rejected = game.expectRejected({ type: "return/home" }, "not-legal");
    expect(rejected.ok).toBe(false);
  });

  test("[place:return-home-paid-or-assisted] given a student with nothing to pay the fare, when return/home is sent, then it is rejected; as an overstayer with nothing, it is accepted as an assisted return and no fare is paid", () => {
    const game = flown(content);
    leave(game, 0, 0);
    game.expectRejected({ type: "return/home" }, "cannot-afford");
    applyEffects(game, [{ type: "status/lose" }]);
    const back = comeHome(game);
    expect(back.shape).toBe("assisted");
    expect(game.state.wallet.totals.out.fare).toBeUndefined();
    expect(game.state.place).toMatchObject({ where: "home", country: null });
    expect(game.state.status.current).toBeNull();
  });

  test("[place:return-home-paid-or-assisted] [place:return-shape-decided-at-once] given a student with money, when she comes home, then the fare is paid, every status closes and the return is recorded by choice", () => {
    const game = flown(content);
    leave(game, brokeLine, ukFare);
    const month = game.state.turn.month;
    const back = comeHome(game);
    expect(back.shape).toBe("by-choice");
    expect(game.state.place.returns).toEqual([{ month, shape: "by-choice", country: UK_COUNTRY }]);
    expect(game.state.status.current).toBeNull();
    expect(game.state.wallet.totals.out.fare).toEqual({ GBP: ukFare });
    expect(back.lines).toContainEqual({ key: "line.status.closed", params: { status: STUDENT }, tone: "plain", attention: false, counts: [] });
    expect(placeLines(back.lines)).toEqual([{ key: "line.place.returned-by-choice", params: { country: UK_COUNTRY }, tone: "plain", attention: true, counts: [] }]);
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[place:return-shape-decided-at-once] given a fare paid that leaves one kobo under the broke line, or exactly on it, when the character comes home, then the first is broke and the second by choice", () => {
    const under = flown(content);
    leave(under, brokeLine - 1, ukFare);
    expect(comeHome(under).shape).toBe("broke");
    const on = flown(content);
    leave(on, brokeLine, ukFare);
    expect(comeHome(on).shape).toBe("by-choice");
  });

  test("[place:return-shape-decided-at-once] given a settled status at the moment of leaving, when the character comes home, then the return is with papers; a removal is removed whatever is held", () => {
    const papers = flown(content);
    applyEffects(papers, [{ type: "status/grant", status: SETTLED }]);
    leave(papers, brokeLine, ukFare);
    expect(comeHome(papers).shape).toBe("with-papers");
    const removed = flown(content);
    applyEffects(removed, [{ type: "status/grant", status: SETTLED }, { type: "status/remove" }]);
    expect(removed.state.place.returns.map((back) => back.shape)).toEqual(["removed"]);
  });

  test("[place:return-shape-decided-at-once] given each case, when the shape is judged, then the first match wins in the page's order", () => {
    const game = flown(content);
    // As the fare has just been paid: what is left is one kobo under the line.
    leave(game, brokeLine - 1, 0);
    const read = readOf(game);
    expect(returnShape(read, false)).toBe("by-choice");
    expect(returnShape(read, true)).toBe("broke");
    const overstay: ReadCtx = { ...read, state: { ...read.state, status: { ...read.state.status, current: null } } };
    expect(returnShape(overstay, false)).toBe("assisted");
    expect(returnShape(overstay, true)).toBe("broke");
    const removed: ReadCtx = { ...overstay, state: { ...overstay.state, status: { current: null, removals: [{ country: UK_COUNTRY, month: game.state.turn.month }] } } };
    expect(returnShape(removed, true)).toBe("removed");
  });

  test("[place:fare-home-in-local-currency] given the pound pockets, when the fare is paid, then it is taken cash first from pounds under the reason fare", () => {
    const game = flown(content);
    leave(game, brokeLine, 0);
    applyEffects(game, [{ type: "money/add", currency: "GBP", pocket: "cash", amount: ukFare, reason: "gift" }]);
    expect(fareHome(readOf(game))).toEqual({ currency: "GBP", amount: ukFare });
    expect(game.view().place.fareHome).toEqual({ currency: "GBP", amount: ukFare });
    comeHome(game);
    expect(game.state.wallet.pockets.GBP.cash).toBe(0);
    expect(game.state.wallet.totals.out.fare).toEqual({ GBP: ukFare });
  });

  test("[place:fare-home-in-local-currency] given December in the world, when the fare is read, then it is the fare times the December factor", () => {
    const game = flown(content, { vars: () => ({ "var.season-december": 1 }) });
    expect(fareHome(readOf(game))).toEqual({ currency: "GBP", amount: mulDiv(ukFare, content.country[UK_COUNTRY]!.decemberFactorBp, 10000) });
    expect(fareHome(readOf(readyLife(content)))).toBeNull();
  });

  test("[place:fare-home-in-local-currency] given no pounds and naira in the bank, when the fare is paid, then naira buys it at the official rate plus the charge; with the naira leg turned off, it cannot be paid", () => {
    const game = flown(content);
    leave(game, 1000000000, 0);
    comeHome(game);
    expect(game.state.wallet.totals.out.fare).toEqual({ GBP: ukFare });
    expect(game.state.wallet.totals.out["bank-charge"]?.NGN ?? 0).toBeGreaterThan(0);
    const strict: (used: Content) => Content = (used) => ({ ...used, tuning: { ...used.tuning, place: { ...used.tuning.place, fareFromNaira: false } } });
    const refused = flown(content, { change: strict });
    leave(refused, 1000000000, 0);
    refused.expectRejected({ type: "return/home" }, "cannot-afford");
  });

  test("[place:family-takes-you-back] [return:standing-by-return-shape] given each shape with no capital, when the character comes home, then standing moves by the page's figure for it", () => {
    const shapes: [ReturnShape, (game: Game) => void][] = [
      ["by-choice", (game) => leave(game, brokeLine, ukFare)],
      ["broke", (game) => leave(game, brokeLine - 1, ukFare)],
      ["with-papers", (game) => {
        applyEffects(game, [{ type: "status/grant", status: SETTLED }]);
        leave(game, brokeLine, ukFare);
      }],
      ["assisted", (game) => {
        applyEffects(game, [{ type: "status/lose" }]);
        leave(game, 0, 0);
      }],
    ];
    for (const [shape, setUp] of shapes) {
      const game = flown(content);
      setUp(game);
      const back = comeHome(game);
      expect([back.shape, back.moved]).toEqual([shape, tuning.return.standing[shape]]);
    }
    const removed = flown(content);
    leave(removed, brokeLine, 0);
    const before = standing(removed);
    applyEffects(removed, [{ type: "status/remove" }]);
    expect(standing(removed) - before).toBe(tuning.return.standing.removed);
  });

  test("[return:standing-by-return-shape] given naira in the bank one short of a step above the broke line, one step, and far past the cap, when the character comes home by choice, then standing gains 0, 1 and the cap", () => {
    for (const [bank, gain] of [
      [brokeLine + capitalPer - 1, 0],
      [brokeLine + capitalPer, 1],
      [brokeLine + capitalPer * 25, tuning.return.capitalCap],
    ] as const) {
      const game = flown(content);
      leave(game, bank, ukFare);
      expect(comeHome(game).moved).toBe(gain);
    }
  });

  test.prop([fc.integer({ min: 0, max: 100000000000 })])("[return:standing-by-return-shape] given any naira in the bank, when the capital bonus is worked out, then it is the whole steps above the broke line, never below 0 nor above the cap", (bank) => {
    const game = start({ content });
    const read: ReadCtx = { ...readOf(game), state: { ...game.state, wallet: { ...game.state.wallet, pockets: { ...game.state.wallet.pockets, NGN: { bank, cash: 0, locked: 0 } } } } };
    const steps = bank <= brokeLine ? 0 : divFloor(bank - brokeLine, capitalPer);
    expect(capitalBonus(read)).toBe(Math.min(tuning.return.capitalCap, steps));
  });

  test("[place:family-takes-you-back] [return:return-reopens-home-charges] given a return, when it is made, then everything abroad closes and the home upkeep and support reopen at the starting life's amounts", () => {
    const closed: ObligationType[] = [];
    const game = flown(content, { from: "scenario.zainab", kinds: recordingCloses(closed) });
    closed.length = 0;
    comeHome(game);
    expect(closed).toEqual(["upkeep", "support", "rent", "phone", "surcharge", "tuition", "car"]);
    expect(openedThisMonth(game)).toEqual(expect.arrayContaining([`obligation.upkeep ${String(130000 * 100)}`, `obligation.home-support ${String(60000 * 100)}`]));
  });
});

describe("the sampler", () => {
  test("[place:return-home-paid-or-assisted] given a student with the fare and an overstayer with nothing, when the legal commands are sampled, then return/home is offered to both and accepted", () => {
    const student = flown(content);
    leave(student, 0, 155000);
    expect(legalCommands(student.view())).toContainEqual({ type: "return/home" });
    student.accept({ type: "return/home" });
    expect(legalCommands(student.view())).not.toContainEqual({ type: "return/home" });
    const overstayer = flown(content);
    applyEffects(overstayer, [{ type: "status/lose" }]);
    leave(overstayer, 0, 0);
    expect(legalCommands(overstayer.view())).toContainEqual({ type: "return/home" });
    overstayer.accept({ type: "return/home" });
  });
});

describe("removal and the ban", () => {
  test("[place:removal-bans-the-country] given a removal from the UK, when the ban is read, then the UK's routes are banned for the removal months from that month and no other country is", () => {
    const game = flown(content);
    expect(bannedUntil(readOf(game), UK_COUNTRY)).toBeNull();
    applyEffects(game, [{ type: "status/remove" }]);
    const month = game.state.turn.month;
    expect(bannedUntil(readOf(game), UK_COUNTRY)).toBe(month + content.status["status.uk-overstayer"]!.banMonths);
    expect(bannedUntil(readOf(game), "country.canada")).toBeNull();
  });

  /** The UK overstayer's ban made short, so a test can play past it. */
  const SHORT_BAN = 2;
  const shortBan = (used: Content): Content => ({
    ...used,
    status: { ...used.status, "status.uk-overstayer": { ...used.status["status.uk-overstayer"]!, banMonths: SHORT_BAN } },
  });
  const CARE_ROUTE: Id<"route"> = "route.uk-care";
  /** Enough care that the care route's talk reaches the character by its `hearBy`. */
  const CARE: Effect = { type: "quality/add", quality: "quality.care", amount: 60 };

  test("[place:removal-bans-the-country] [route-gates:deception-bans-country] given a removal with a ban of 2 months and the care route's talk due, when months pass, then nothing about a UK route is heard in the ban's months and it is heard in the month the ban ends", () => {
    const game = flown(content, { change: shortBan });
    applyEffects(game, [CARE, { type: "status/remove" }]);
    const until = game.state.turn.month + SHORT_BAN;
    expect(game.state.route[CARE_ROUTE]?.state).toBe("unknown");
    applyEffects(game, [{ type: "route/hear", route: CARE_ROUTE, via: "test" }]);
    expect(game.state.route[CARE_ROUTE]?.state).toBe("unknown");
    playMonths(game, 1);
    expect(game.state.turn.month).toBe(until - 1);
    expect(game.state.route[CARE_ROUTE]?.state).toBe("unknown");
    applyEffects(game, [{ type: "route/hear", route: CARE_ROUTE, via: "test" }]);
    expect(game.state.route[CARE_ROUTE]?.state).toBe("unknown");
    playMonths(game, 1);
    expect(game.state.turn.month).toBe(until);
    expect(game.state.route[CARE_ROUTE]?.state).toBe("heard");
  });

  test("[place:entries-legal-by-where] given the care route's talk due, when months pass to its `hearBy` on the road and at home, then nothing is heard on the road and the route is heard at home", () => {
    const months = content.route[CARE_ROUTE]!.hearBy!;
    const road = readyLife(content, { quiet: true });
    applyEffects(road, [CARE, { type: "place/move", to: "road", country: null }]);
    const known = Object.entries(road.state.route).filter(([, held]) => held.state !== "unknown").map(([id]) => id);
    playMonths(road, months);
    expect(road.state.place.where).toBe("road");
    expect(Object.entries(road.state.route).filter(([, held]) => held.state !== "unknown").map(([id]) => id)).toEqual(known);
    const home = readyLife(content, { quiet: true });
    applyEffects(home, [CARE]);
    playMonths(home, months);
    expect(home.state.route[CARE_ROUTE]?.state).toBe("heard");
  });
});

describe("the view and the record", () => {
  test("[place:view-shows-place-and-returns] [return:return-record-in-words] given two returns, when the view is read, then it shows where, the country, the months since the move and the record newest first", () => {
    const game = flown(content);
    playMonths(game, 2);
    expect(game.view().place).toMatchObject({ where: "abroad", country: UK_COUNTRY, monthsHere: 2, returns: [] });
    comeHome(game);
    const first = game.state.turn.month;
    playMonths(game, 1);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: UK_COUNTRY }, { type: "status/grant", status: STUDENT }, { type: "status/remove" }]);
    expect(game.view().place).toEqual({
      where: "home",
      country: null,
      monthsHere: 0,
      returns: [
        { month: first + 1, shape: "removed", country: UK_COUNTRY },
        { month: first, shape: "by-choice", country: UK_COUNTRY },
      ],
      heldAbroad: null,
      fareHome: null,
      fareBp: 10000,
      wayHome: null,
      ways: lagosWays(),
      // place:employer-shuttle-rides-free (decision 0017): no shuttle's stop at home.
      shuttles: [],
    });
  });

  const forecastBase = flown(content);
  test.prop([fc.integer({ min: 0, max: 4 * brokeLine }), fc.integer({ min: 0, max: 2 * ukFare }), fc.boolean()], { numRuns: 60 })(
    "[place:view-carries-way-home] given any naira and pounds in the bank, with the visa held or lost, when the way home is read and then taken, then the view said the fare's source, the shape and the standing the return brings, and no way when it is refused",
    (nairaBank, poundBank, lost) => {
      const game = flown(content);
      game.state = forecastBase.state;
      leave(game, nairaBank, poundBank);
      if (lost) applyEffects(game, [{ type: "status/lose" }]);
      const forecast = game.view().place.wayHome;
      if (forecast === null) throw new Error("No way home is forecast abroad.");
      expect(forecast.fare).toEqual(fareHome(readOf(game)));
      const pounds = game.state.wallet.pockets.GBP.bank;
      const naira = game.state.wallet.pockets.NGN.bank;
      if (forecast.shape === null) {
        game.expectRejected({ type: "return/home" }, "cannot-afford");
        return;
      }
      const { moved, shape } = comeHome(game);
      expect(shape).toBe(forecast.shape);
      expect(moved).toBe(forecast.standing);
      if (forecast.paidFrom === "local") expect(game.state.wallet.pockets.GBP.bank).toBe(pounds - forecast.fare.amount);
      if (forecast.paidFrom === "naira") expect(game.state.wallet.pockets.NGN.bank).toBe(naira - forecast.naira);
      if (forecast.paidFrom === null) expect(game.state.wallet.pockets.NGN.bank).toBe(naira);
    },
  );

  test("[return:routes-run-again-from-home] given a return, when the routes are read, then the departed route and its record are as they were", () => {
    const game = flown(content);
    const before = game.state.route;
    comeHome(game);
    expect(game.state.route).toEqual(before);
  });
});

describe("the token kept abroad", () => {
  test("[return:papers-return-keeps-status] given a return with papers, when it is recorded, then the settled status is kept as a token, and flying back to the UK uses it", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "status/grant", status: SETTLED }]);
    const held = game.state.status.current!;
    comeHome(game);
    expect(game.state.place.heldAbroad).toEqual({ status: SETTLED, sinceMonth: game.state.turn.month, monthsHeld: held.monthsHeld, lawfulMonths: held.lawfulMonths });
    expect(game.view().place.heldAbroad).toBe(SETTLED);
    playMonths(game, 30);
    expect(game.state.place.heldAbroad?.status).toBe(SETTLED);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: UK_COUNTRY }]);
    expect(game.state.place.heldAbroad).toBeNull();
  });

  const FLIGHT = ((flight) => {
    if (typeof flight.amount !== "number") throw new Error("The flight's tuning names no fixed amount.");
    return { currency: flight.currency, amount: flight.amount };
  })(tuning.route.flight);
  const paidFor = (result: { events: { type: string }[] }, reason: string) =>
    result.events.filter((event) => event.type === "wallet/debited" && (event as unknown as { reason: string }).reason === reason).map((event) => (event as unknown as { amount: number }).amount);

  test("[return:papers-return-keeps-status] given a return with papers keeping the settled token, when route/depart names the UK route flown before, then the flight alone is paid and the character is in the UK on the settled status, the token used and the route as it was", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "status/grant", status: SETTLED }]);
    comeHome(game);
    playMonths(game, 3);
    leave(game, 2 * FLIGHT.amount, 0);
    const route = game.state.route[UK_ROUTE];
    expect(route?.state).toBe("departed");
    const result = game.accept({ type: "route/depart", route: UK_ROUTE });
    expect(game.state.place).toMatchObject({ where: "abroad", country: UK_COUNTRY, heldAbroad: null });
    expect(game.state.status.current?.entry).toBe(SETTLED);
    expect(paidFor(result, "flight")).toEqual([FLIGHT.amount]);
    expect(result.events.filter((event) => event.type === "wallet/debited").map((event) => (event as unknown as { reason: string }).reason)).toEqual(["flight"]);
    expect(game.state.route[UK_ROUTE]).toEqual(route);
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[return:papers-return-keeps-status] [status:lawful-months-reach-settlement] given the settled token and the UK study route granted, when that route is flown, then the arrival keeps the settled status, the token used, and the route departs as any granted route does", () => {
    const game = readyLife(content, { seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
    toDecision(game);
    expect(game.state.route[UK_ROUTE]?.state).toBe("granted");
    applyEffects(game, [{ type: "place/move", to: "abroad", country: UK_COUNTRY }, { type: "status/grant", status: SETTLED }]);
    comeHome(game);
    expect(game.state.place.heldAbroad?.status).toBe(SETTLED);
    leave(game, 2 * FLIGHT.amount, 0);
    game.accept({ type: "route/depart", route: UK_ROUTE });
    expect(game.state.place).toMatchObject({ where: "abroad", country: UK_COUNTRY, heldAbroad: null });
    expect(game.state.status.current?.entry).toBe(SETTLED);
    expect(game.state.route[UK_ROUTE]?.state).toBe("departed");
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[place:departure-moves-abroad] [route:departure-pays-flight] given the UK study route granted and the character already abroad, when route/depart names it, then it is not legal: no flight leaves from abroad", () => {
    const game = readyLife(content, { seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
    toDecision(game);
    expect(game.state.route[UK_ROUTE]?.state).toBe("granted");
    applyEffects(game, [{ type: "place/move", to: "abroad", country: CANADA_COUNTRY }, { type: "status/grant", status: RESIDENT }]);
    leave(game, 2 * FLIGHT.amount, 0);
    game.expectRejected({ type: "route/depart", route: UK_ROUTE }, "not-legal");
  });

  test("[return:papers-return-keeps-status] [status:lawful-months-reach-settlement] given the settled status held five months and kept on a return with papers, when a route into the UK is flown, then the status carries on with its five months held and its lawful months, so the months to citizenship do not start again", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "status/grant", status: SETTLED }]);
    playMonths(game, 5);
    const held = game.state.status.current;
    expect(held?.monthsHeld).toBe(5);
    comeHome(game);
    playMonths(game, 2);
    leave(game, 2 * FLIGHT.amount, 0);
    game.accept({ type: "route/depart", route: UK_ROUTE });
    expect(game.state.status.current).toMatchObject({ entry: SETTLED, monthsHeld: held?.monthsHeld, lawfulMonths: held?.lawfulMonths });
  });

  test("[return:papers-return-keeps-status] [status:lawful-months-reach-settlement] given the settled status held three months and kept, and the UK study route granted, when that route is flown, then the status carries on with its three months held", () => {
    const game = readyLife(content, { seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
    toDecision(game);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: UK_COUNTRY }, { type: "status/grant", status: SETTLED }]);
    playMonths(game, 3);
    expect(game.state.status.current?.monthsHeld).toBe(3);
    comeHome(game);
    leave(game, 2 * FLIGHT.amount, 0);
    game.accept({ type: "route/depart", route: UK_ROUTE });
    expect(game.state.status.current).toMatchObject({ entry: SETTLED, monthsHeld: 3 });
  });

  test("[return:papers-return-keeps-status] given the settled token, when route/depart names a route into Canada, then it is not legal; after a return by choice with no token, the UK route flown before is not legal either", () => {
    const settled = flown(content);
    applyEffects(settled, [{ type: "status/grant", status: SETTLED }]);
    comeHome(settled);
    leave(settled, 2 * FLIGHT.amount, 0);
    settled.expectRejected({ type: "route/depart", route: "route.canada-points" }, "not-legal");
    const student = flown(content);
    comeHome(student);
    expect(student.state.place.heldAbroad).toBeNull();
    leave(student, 2 * FLIGHT.amount, 0);
    student.expectRejected({ type: "route/depart", route: UK_ROUTE }, "not-legal");
  });

  test("[return:papers-return-keeps-status] given a Canadian resident's token, when 23 and then 24 months pass at home, then it is kept and then lapses", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.canada" }, { type: "status/grant", status: RESIDENT }]);
    leave(game, 1000000000, 0);
    comeHome(game);
    expect(game.state.place.heldAbroad?.status).toBe(RESIDENT);
    playMonths(game, tuning.return.residentLapseMonths - 1);
    expect(game.state.place.heldAbroad?.status).toBe(RESIDENT);
    if (game.state.turn.banked < 1) game.grant(1);
    const result = game.endTurn();
    expect(game.state.place.heldAbroad).toBeNull();
    expect(placeLines(result.lines)).toEqual([
      { key: "line.place.token-lapsed", params: { status: RESIDENT, months: tuning.return.residentLapseMonths }, tone: "bad", attention: true, counts: [] },
    ]);
  });
});

describe("December abroad", () => {
  test("[return:december-visit-set-piece] given the December tick and a character abroad, when the month ends, then the December set piece opens with no route; at home, or out of December, it does not", () => {
    const december = flown(content, { vars: () => ({ "var.season-december": 1 }) });
    december.endTurn();
    expect(december.state.setpiece.open).toMatchObject({ entry: DECEMBER_SETPIECE, route: null });
    const ordinary = flown(content);
    ordinary.endTurn();
    expect(ordinary.state.setpiece.open).toBeNull();
    const home = readyLife(content, { vars: () => ({ "var.season-december": 1 }) });
    home.endTurn();
    expect(home.state.setpiece.open).toBeNull();
  });
});

describe("requirements", () => {
  test("[place:view-shows-place-and-returns] given a character abroad two months and then home after a return, when place/is, place/returned and place/months-here are judged, then each reads the place as it is", () => {
    const game = flown(content);
    const judge = (requirement: Parameters<typeof check>[1]) => check(readOf(game), requirement).met;
    expect(judge({ type: "place/is", where: "abroad" })).toBe(true);
    expect(judge({ type: "place/is", where: "abroad", country: UK_COUNTRY })).toBe(true);
    expect(judge({ type: "place/is", where: "abroad", country: "country.canada" })).toBe(false);
    playMonths(game, 2);
    expect(judge({ type: "place/months-here", where: "abroad", months: 2 })).toBe(true);
    expect(judge({ type: "place/months-here", where: "abroad", months: 3 })).toBe(false);
    expect(judge({ type: "place/months-here", where: "home", months: 0 })).toBe(false);
    expect(judge({ type: "place/returned", shapes: ["by-choice", "with-papers"] })).toBe(false);
    comeHome(game);
    expect(judge({ type: "place/is", where: "home" })).toBe(true);
    expect(judge({ type: "place/returned", shapes: ["by-choice", "with-papers"] })).toBe(true);
    expect(judge({ type: "place/returned", shapes: ["removed"] })).toBe(false);
  });
});

describe("the place kind's words", () => {
  test("[engine:content-checked-before-play] given every line the place kind gives, when the words are looked up, then each has words naming only figures its line carries", () => {
    const params: Record<string, string[]> = {
      "line.place.arrived": ["country"],
      "line.place.on-road": [],
      "line.place.token-used": ["status"],
      "line.place.token-lapsed": ["status", "months"],
    };
    for (const shape of ["with-papers", "by-choice", "broke", "assisted", "removed"]) params[`line.place.returned-${shape}`] = ["country"];
    for (const [key, allowed] of Object.entries(params)) {
      expect((text[key] ?? "").trim()).not.toBe("");
      for (const match of (text[key] ?? "").matchAll(/\{([^}]+)\}/g)) expect(allowed).toContain(match[1]);
    }
  });
});
