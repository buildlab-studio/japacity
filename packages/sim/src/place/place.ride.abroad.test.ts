// Rides abroad: docs/rules/place.md R-PLACE-010 as amended 16 Oct 2026 (decision 0042, design page 14 section 5). A ride
// is accepted in the country the character is in, between two places of that country, on the ways it lists or on foot,
// the fare taken from the country's money; the scarcity factor is Lagos's only.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { BP_WHOLE, divCeil, mulDiv } from "../engine/int";
import type { Accepted, BaseEvent, Currency, Effect, Id } from "../engine/types";
import { applyEffects } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { flown } from "./place.journey";
import { metresApart, rideFare, withinMetres } from "./place.logic";

const UK: Id<"country"> = "country.uk";
const PECKHAM: Id<"place"> = "place.peckham";
const RYE_LANE: Id<"place"> = "place.rye-lane";
const HEATHROW: Id<"place"> = "place.heathrow";
const ROOM: Id<"place"> = "place.the-room";
const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD", "CAD", "AED", "EUR"];
const rides = content.tuning.city.ride.abroad[UK]!;
const bus = rides.ways.bus!;
const train = rides.ways.train!;
/** The UK's metres for a thousandth of a degree of longitude (R-PLACE-010 as amended 16 Oct 2026). */
const LON = rides.lonMetresPerE3;

function positionOf(id: Id<"place">): { latE3: number; lonE3: number } {
  const position = content.place[id]?.position;
  if (position === null || position === undefined) throw new Error(`${id} has no position.`);
  return position;
}

/** Empties every pocket, then leaves the pounds in cash and the bank as given. */
function pounds(game: Game, cash: number, bank = 0): void {
  const takes: Effect[] = CURRENCIES.flatMap((currency): Effect[] => {
    const pocket = game.state.wallet.pockets[currency];
    const held = pocket.bank + pocket.cash;
    return held === 0 ? [] : [{ type: "money/take", currency, pocket: "any", amount: held, reason: "mishap" }];
  });
  const adds: Effect[] = [
    ...(cash > 0 ? [{ type: "money/add", currency: "GBP", pocket: "cash", amount: cash, reason: "gift" } as const] : []),
    ...(bank > 0 ? [{ type: "money/add", currency: "GBP", pocket: "bank", amount: bank, reason: "gift" } as const] : []),
  ];
  applyEffects(game, [...takes, ...adds]);
}

function rode(result: Accepted): BaseEvent | undefined {
  return result.events.find((event) => event.type === "place/rode");
}

function debits(result: Accepted): BaseEvent[] {
  return result.events.filter((event) => event.type === "wallet/debited");
}

describe("the fare abroad", () => {
  test("[R-PLACE-010] given the UK's ways, when their figures are read, then the bus is £1.75 flat at 250 m a minute, the train £2.80 and 10p a kilometre at 600 m a minute, fares in fives of pence, and the pass £95", () => {
    // the pass covers the bus alone, and on foot is 80 m a minute.
    expect(rides).toEqual({ ways: { bus: { fare: 175, farePerKm: 0, metresPerMinute: 250 }, train: { fare: 280, farePerKm: 10, metresPerMinute: 600 } }, step: 5, pass: 9500, passWays: ["bus"], lonMetresPerE3: 69, walkMetresPerMinute: 80 });
    // Canada, the UAE and Italy list their ways now (place.ride.three.test.ts).
    for (const country of ["country.canada", "country.uae", "country.italy"] as const) expect(Object.keys(content.tuning.city.ride.abroad[country]?.ways ?? {}).length).toBeGreaterThan(0);
    expect(content.tuning.city.ride.abroad["country.uae"]?.step).toBe(25);
  });

  test("[R-PLACE-010] given two places in London, when a way's fare is read with the country's figures, then the bus is one fare whatever the distance, the train grows with it rounded up to five pence, a place with no position stands at the flag-down figure, and the month's factor is the caller's", () => {
    const peckham = positionOf(PECKHAM);
    const rye = positionOf(RYE_LANE);
    const heathrow = positionOf(HEATHROW);
    const busFare = { ...bus, step: rides.step, lonMetresPerE3: LON };
    const trainFare = { ...train, step: rides.step, lonMetresPerE3: LON };
    expect(rideFare(busFare, peckham, rye)).toBe(175);
    expect(rideFare(busFare, peckham, heathrow)).toBe(175);
    const near = rideFare(trainFare, peckham, rye);
    const far = rideFare(trainFare, peckham, heathrow);
    expect(near).toBe(divCeil(280 + mulDiv(10, metresApart(peckham, rye, LON), 1000), 5) * 5);
    expect(far).toBe(divCeil(280 + mulDiv(10, metresApart(peckham, heathrow, LON), 1000), 5) * 5);
    expect(far).toBeGreaterThan(near);
    expect([near % 5, far % 5]).toEqual([0, 0]);
    // The step's edge: a figure one penny past a step rounds up to the next five, one on it stays.
    expect(rideFare({ fare: 281, farePerKm: 0, step: 5, lonMetresPerE3: LON }, null, null)).toBe(285);
    expect(rideFare({ fare: 285, farePerKm: 0, step: 5, lonMetresPerE3: LON }, null, null)).toBe(285);
    expect(rideFare(trainFare, null, heathrow)).toBe(280);
    expect(rideFare({ fare: 0, farePerKm: 0, step: 5, lonMetresPerE3: LON }, peckham, heathrow)).toBe(0);
    expect(rideFare(busFare, peckham, rye, 20000)).toBe(350);
    // Lagos's ways price as before from content and the way.
    expect(rideFare(content, positionOf("place.ojuelegba"), positionOf("place.bode-thomas"), "danfo")).toBe(
      rideFare({ fare: content.tuning.city.ride.fareKobo.danfo, farePerKm: content.tuning.city.ride.farePerKmKobo.danfo, step: 5000, lonMetresPerE3: content.tuning.city.ride.lonMetresPerE3 }, positionOf("place.ojuelegba"), positionOf("place.bode-thomas"), BP_WHOLE),
    );
  });
});

describe("the metres of a degree of longitude", () => {
  test("[R-PLACE-010] given each country's figure for a thousandth of a degree of longitude, when it is read, then Lagos is 111, the UK 69, Canada 71, the UAE 100 and Italy 84, latitude 111 everywhere", () => {
    expect(content.tuning.city.ride.lonMetresPerE3).toBe(111);
    const abroad = content.tuning.city.ride.abroad;
    expect([abroad["country.uk"]?.lonMetresPerE3, abroad["country.canada"]?.lonMetresPerE3, abroad["country.uae"]?.lonMetresPerE3, abroad["country.italy"]?.lonMetresPerE3]).toEqual([69, 71, 100, 84]);
    // A step due north is 111 metres a thousandth whatever the country's figure.
    expect(metresApart({ latE3: 51000, lonE3: 0 }, { latE3: 51010, lonE3: 0 }, LON)).toBe(1110);
    expect(metresApart({ latE3: 51000, lonE3: 0 }, { latE3: 51000, lonE3: 10 }, LON)).toBe(690);
  });

  test("[R-PLACE-010] given London at the UK's 69 metres, when the train to Heathrow and a walk to the ward are read, then the train from Peckham prices £5.50, and the ward is within a walk of Peckham at 69 and would not be at 111", () => {
    expect(rideFare({ ...train, step: rides.step, lonMetresPerE3: LON }, positionOf(PECKHAM), positionOf(HEATHROW))).toBe(550);
    const limit = content.tuning.city.ride.walkMetres;
    expect(withinMetres(positionOf(PECKHAM), positionOf("place.ward-uk"), limit, LON)).toBe(true);
    expect(withinMetres(positionOf(PECKHAM), positionOf("place.ward-uk"), limit, 111)).toBe(false);
    const game = flown(content);
    pounds(game, 0);
    expect(rode(game.accept({ type: "place/ride", from: PECKHAM, to: "place.ward-uk", way: "walk" }))).toMatchObject({ way: "walk", fare: 0 });
    pounds(game, 1000);
    expect(rode(game.accept({ type: "place/ride", from: PECKHAM, to: HEATHROW, way: "train" }))).toMatchObject({ fare: 550, currency: "GBP" });
  });

  test("[R-PLACE-010] given Lagos at 111, when a fare is read from content, then it is the fare as before, the figure passed or not", () => {
    const from = positionOf("place.ojuelegba");
    const to = positionOf("place.computer-village");
    const { fareKobo, farePerKmKobo } = content.tuning.city.ride;
    const metres = metresApart(from, to, 111);
    expect(metresApart(from, to)).toBe(metres);
    expect(rideFare(content, from, to, "danfo")).toBe(divCeil(fareKobo.danfo + mulDiv(farePerKmKobo.danfo, metres, 1000), 5000) * 5000);
  });
});

describe("a ride abroad", () => {
  test("[R-PLACE-010] given a life in London with pounds in cash, when the bus and the train are taken, then each fare leaves the pound cash as a fare and the ride is on record in pounds", () => {
    const game = flown(content);
    pounds(game, 5000);
    const byBus = game.accept({ type: "place/ride", from: PECKHAM, to: RYE_LANE, way: "bus" });
    expect(debits(byBus)).toMatchObject([{ currency: "GBP", pocket: "cash", amount: 175, reason: "fare" }]);
    expect(rode(byBus)).toEqual({ type: "place/rode", from: PECKHAM, to: RYE_LANE, way: "bus", fare: 175, currency: "GBP" });
    const fare = rideFare({ ...train, step: rides.step, lonMetresPerE3: LON }, positionOf(PECKHAM), positionOf(HEATHROW));
    const byTrain = game.accept({ type: "place/ride", from: PECKHAM, to: HEATHROW, way: "train" });
    expect(debits(byTrain)).toMatchObject([{ currency: "GBP", pocket: "cash", amount: fare, reason: "fare" }]);
    expect(rode(byTrain)).toEqual({ type: "place/rode", from: PECKHAM, to: HEATHROW, way: "train", fare, currency: "GBP" });
    expect(game.state.wallet.pockets.GBP.cash).toBe(5000 - 175 - fare);
    expect(game.state.wallet.pockets.NGN.cash + game.state.wallet.pockets.NGN.bank).toBe(0);
  });

  test("[R-PLACE-010] given the fare over the pound cash but within the pounds, when a ride is sent, then cash goes first and the bank pays the rest", () => {
    const game = flown(content);
    pounds(game, 100, 1000);
    const result = game.accept({ type: "place/ride", from: PECKHAM, to: RYE_LANE, way: "bus" });
    expect(debits(result)).toMatchObject([
      { currency: "GBP", pocket: "cash", amount: 100, reason: "fare" },
      { currency: "GBP", pocket: "bank", amount: 75, reason: "fare" },
    ]);
  });

  test("[R-PLACE-010] given a country-less place abroad, when a ride goes there, then it is accepted at the flag-down figure, and walked to with no fare", () => {
    // The country-less test centre is gone (design page 15); the room is the country-less place abroad with no position.
    const game = flown(content);
    pounds(game, 5000);
    expect(content.place[ROOM]).toMatchObject({ where: "abroad", country: null, position: null });
    expect(rode(game.accept({ type: "place/ride", from: PECKHAM, to: ROOM, way: "train" }))).toMatchObject({ way: "train", fare: train.fare, currency: "GBP" });
    expect(rode(game.accept({ type: "place/ride", from: ROOM, to: PECKHAM, way: "walk" }))).toMatchObject({ way: "walk", fare: 0, currency: "GBP" });
  });

  test("[R-PLACE-010] given a life in London, when a ride goes to another country's place, to a place in Lagos, by a way of Lagos, or to the same place, then it is refused and nothing is paid", () => {
    const game = flown(content);
    pounds(game, 5000);
    game.expectRejected({ type: "place/ride", from: PECKHAM, to: "place.deira", way: "bus" }, "not-legal");
    game.expectRejected({ type: "place/ride", from: "place.deira", to: PECKHAM, way: "bus" }, "not-legal");
    game.expectRejected({ type: "place/ride", from: PECKHAM, to: "place.ojuelegba", way: "bus" }, "not-legal");
    game.expectRejected({ type: "place/ride", from: PECKHAM, to: RYE_LANE, way: "danfo" }, "not-legal");
    game.expectRejected({ type: "place/ride", from: PECKHAM, to: RYE_LANE, way: "taxi" }, "not-legal");
    game.expectRejected({ type: "place/ride", from: PECKHAM, to: PECKHAM, way: "bus" }, "not-legal");
    expect(game.state.wallet.pockets.GBP.cash).toBe(5000);
  });

  test("[R-PLACE-010] given pounds short of the fare, when the bus is taken, then it is refused as unaffordable and nothing is paid; one penny more and it is taken", () => {
    const game = flown(content);
    pounds(game, 174);
    game.expectRejected({ type: "place/ride", from: PECKHAM, to: RYE_LANE, way: "bus" }, "cannot-afford");
    expect(game.state.wallet.pockets.GBP.cash).toBe(174);
    pounds(game, 175);
    expect(rode(game.accept({ type: "place/ride", from: PECKHAM, to: RYE_LANE, way: "bus" }))).toMatchObject({ fare: 175 });
    expect(game.state.wallet.pockets.GBP.cash).toBe(0);
  });

  test("[R-PLACE-010] given no pounds at all, when a walk goes home to the room from Heathrow, then it is accepted with no fare however far; a walk from Peckham to Heathrow is refused, and one to Rye Lane is walked", () => {
    const game = flown(content);
    pounds(game, 0);
    const limit = content.tuning.city.ride.walkMetres;
    expect(withinMetres(positionOf(PECKHAM), positionOf(HEATHROW), limit, LON)).toBe(false);
    expect(withinMetres(positionOf(PECKHAM), positionOf(RYE_LANE), limit, LON)).toBe(true);
    const home = game.accept({ type: "place/ride", from: HEATHROW, to: ROOM, way: "walk" });
    expect(debits(home)).toEqual([]);
    expect(rode(home)).toMatchObject({ way: "walk", fare: 0, currency: "GBP" });
    game.expectRejected({ type: "place/ride", from: PECKHAM, to: HEATHROW, way: "walk" }, "not-legal");
    expect(rode(game.accept({ type: "place/ride", from: PECKHAM, to: RYE_LANE, way: "walk" }))).toMatchObject({ way: "walk", fare: 0 });
  });

  test("[R-PLACE-010] given the fuel scarcity's month carried abroad, when the bus is taken in London, then the fare stands at its figure and the view's factor is whole", () => {
    const game = flown(content);
    pounds(game, 5000);
    const month = game.state.turn.month;
    game.state = { ...game.state, offer: { ...game.state.offer, lastOpened: { ...game.state.offer.lastOpened, "offer.fuel-scarcity": month } } };
    expect(game.view().place.fareBp).toBe(BP_WHOLE);
    expect(rode(game.accept({ type: "place/ride", from: PECKHAM, to: RYE_LANE, way: "bus" }))).toMatchObject({ fare: 175 });
  });

  test("[R-PLACE-010] given a country that lists no ways, when any ride is sent there, then it is refused as before, and the view lists no way", () => {
    // Every country lists its ways since 16 Oct 2026 (design page 15), so Canada's are taken away for this edge.
    const canada = content.tuning.city.ride.abroad["country.canada"]!;
    const none = { ...content, tuning: { ...content.tuning, city: { ...content.tuning.city, ride: { ...content.tuning.city.ride, abroad: { ...content.tuning.city.ride.abroad, "country.canada": { ...canada, ways: {} } } } } } };
    const game = start({ content: none });
    game.state = { ...game.state, place: { ...game.state.place, where: "abroad", country: "country.canada" } };
    game.expectRejected({ type: "place/ride", from: "place.calgary-airport", to: "place.calgary-north-east", way: "bus" }, "not-legal");
    game.expectRejected({ type: "place/ride", from: "place.calgary-airport", to: "place.calgary-north-east", way: "walk" }, "not-legal");
    expect(game.view().place.ways).toEqual([]);
  });

  test("[R-PLACE-010] given a life at home, when the bus or the train is sent in Lagos, then it is refused; a danfo's ride is on record in naira", () => {
    const game = start({ content });
    game.expectRejected({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "bus" }, "not-legal");
    game.expectRejected({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "train" }, "not-legal");
    expect(rode(game.accept({ type: "place/ride", from: "place.ojuelegba", to: "place.bode-thomas", way: "danfo" }))).toMatchObject({ way: "danfo", currency: "NGN" });
  });
});

describe("the ways in the view", () => {
  test("[R-PLACE-010] given a life in London, at home and on the road, when the view is read, then the ways are the country's with their figures and on foot, the four of Lagos, and none", () => {
    const abroad = flown(content);
    const walkPace = content.tuning.city.ride.metresPerMinute.walk;
    expect(abroad.view().place.ways).toEqual([
      { way: "bus", currency: "GBP", fare: 175, farePerKm: 0, step: 5, lonMetresPerE3: 69, metresPerMinute: 250, passed: false },
      { way: "train", currency: "GBP", fare: 280, farePerKm: 10, step: 5, lonMetresPerE3: 69, metresPerMinute: 600, passed: false },
      { way: "walk", currency: "GBP", fare: 0, farePerKm: 0, step: 5, lonMetresPerE3: 69, metresPerMinute: walkPace, passed: false },
    ]);
    const { fareKobo, farePerKmKobo, metresPerMinute } = content.tuning.city.ride;
    const home = start({ content });
    expect(home.view().place.ways).toEqual(
      (["danfo", "keke", "okada", "walk"] as const).map((way) => ({ way, currency: "NGN", fare: fareKobo[way], farePerKm: farePerKmKobo[way], step: 5000, lonMetresPerE3: 111, metresPerMinute: metresPerMinute[way], passed: false })),
    );
    const road = start({ content });
    road.state = { ...road.state, place: { ...road.state.place, where: "road", country: null } };
    expect(road.view().place.ways).toEqual([]);
  });

  test("[R-PLACE-010] given a way from the view, when the ride sheet prices it with rideFare and the ride is sent, then the fare taken is the one priced", () => {
    const game = flown(content);
    pounds(game, 5000);
    const way = game.view().place.ways?.find((one) => one.way === "train");
    if (way === undefined) throw new Error("No train in the view.");
    const priced = rideFare(way, positionOf(PECKHAM), positionOf(HEATHROW), game.view().place.fareBp);
    expect(rode(game.accept({ type: "place/ride", from: PECKHAM, to: HEATHROW, way: "train" }))).toMatchObject({ fare: priced });
  });
});

const PASS: Id<"activity"> = "activity.bus-pass-uk";

describe("the bus pass", () => {
  test("[R-PLACE-012] given the bus pass, when its entry is read, then it is a now-act once a month in the UK, costing the UK's pass figure in pounds as a fare, staged at the station's machine", () => {
    expect(content.activity[PASS]).toMatchObject({ slot: "none", when: "now", halfDays: 0, where: "abroad", country: UK, cost: [{ currency: "GBP", amount: rides.pass, reason: "fare" }], effects: [] });
    expect(content.activity[PASS]?.repeat).toBeUndefined();
    expect(content.activity[PASS]?.purchase).toBeUndefined();
    expect(Object.values(content.place).filter((place) => (place.stages as readonly string[]).includes(PASS)).map((place) => place.id)).toEqual(["place.peckham-rye-station"]);
  });

  test("[R-PLACE-012] given a life in London that buys the pass, when the bus and the train are taken that month, then the pass is paid as a fare, the bus asks nothing and says so, the train asks its fare, and the view marks the bus passed", () => {
    const game = flown(content);
    pounds(game, 20000);
    const bought = game.accept({ type: "activity/now", activity: PASS, param: null });
    expect(debits(bought)).toMatchObject([{ currency: "GBP", amount: 9500, reason: "fare" }]);
    expect(game.view().place.ways?.map((way) => [way.way, way.passed])).toEqual([
      ["bus", true],
      ["train", false],
      ["walk", false],
    ]);
    const byBus = game.accept({ type: "place/ride", from: PECKHAM, to: HEATHROW, way: "bus" });
    expect(debits(byBus)).toEqual([]);
    expect(rode(byBus)).toEqual({ type: "place/rode", from: PECKHAM, to: HEATHROW, way: "bus", fare: 0, currency: "GBP" });
    const fare = rideFare({ ...train, step: rides.step, lonMetresPerE3: LON }, positionOf(PECKHAM), positionOf(RYE_LANE));
    expect(rode(game.accept({ type: "place/ride", from: PECKHAM, to: RYE_LANE, way: "train" }))).toMatchObject({ way: "train", fare });
    expect(game.state.wallet.pockets.GBP.cash + game.state.wallet.pockets.GBP.bank).toBe(20000 - 9500 - fare);
    // Once a month: a second pass the same month is refused.
    game.expectRejected({ type: "activity/now", activity: PASS, param: null }, "not-legal");
  });

  test("[R-PLACE-012] given the pass bought last month, when the next month comes, then the bus asks its fare again and the pass may be bought again", () => {
    const game = flown(content);
    pounds(game, 50000);
    game.accept({ type: "activity/now", activity: PASS, param: null });
    if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
    game.endTurn();
    pounds(game, 50000);
    expect(game.view().place.ways?.find((way) => way.way === "bus")?.passed).toBe(false);
    expect(rode(game.accept({ type: "place/ride", from: PECKHAM, to: RYE_LANE, way: "bus" }))).toMatchObject({ fare: bus.fare });
    expect(debits(game.accept({ type: "activity/now", activity: PASS, param: null }))).toMatchObject([{ amount: 9500, reason: "fare" }]);
  });

  test("[R-PLACE-012] given a life at home, when the pass is asked for, then it is refused; and given a UK with no pass figure, when the act is played, then the bus still asks its fare", () => {
    start({ content }).expectRejected({ type: "activity/now", activity: PASS, param: null }, "not-legal");
    const noPass = { ...content, tuning: { ...content.tuning, city: { ...content.tuning.city, ride: { ...content.tuning.city.ride, abroad: { ...content.tuning.city.ride.abroad, [UK]: { ...rides, pass: null } } } } } };
    const game = flown(noPass);
    pounds(game, 20000);
    game.accept({ type: "activity/now", activity: PASS, param: null });
    expect(game.view().place.ways?.find((way) => way.way === "bus")?.passed).toBe(false);
    expect(rode(game.accept({ type: "place/ride", from: PECKHAM, to: RYE_LANE, way: "bus" }))).toMatchObject({ fare: bus.fare });
  });
});
