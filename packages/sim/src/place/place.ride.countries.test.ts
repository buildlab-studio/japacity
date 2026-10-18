// Rides in Calgary, Dubai and Castel Volturno: docs/rules/place.md R-PLACE-010 (the three countries' ways, design page
// 15 section 4), R-PLACE-012 (the pass covers the country's ways) and R-PLACE-013 (the employer's shuttle),
// decision 0017. Each country's ways and figures are content's; the pass is the country's own act; a bus to or from a
// shuttle's stop asks nothing in any month.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { divCeil, mulDiv } from "../engine/int";
import type { Accepted, CountryRides, Currency, Effect, Id, RideWay } from "../engine/types";
import { applyEffects } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { flown, positionOf } from "../testing/place.journey";
import { debits, rode } from "../testing/read";
import { metresApart, rideFare, shuttleRide, withinMetres } from "./place.logic";
import { CANADA_COUNTRY, ITALY, UAE } from "../testing/ids";

const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD", "CAD", "AED", "EUR"];
const MONEY: Readonly<Record<string, Currency>> = { [CANADA_COUNTRY]: "CAD", [UAE]: "AED", [ITALY]: "EUR" };
const ROOM: Id<"place"> = "place.the-room";
const abroad = content.tuning.city.ride.abroad;

function ridesOf(country: Id<"country">): CountryRides {
  const rides = abroad[country];
  if (rides === undefined) throw new Error(`${country} has no rides.`);
  return rides;
}

/** A life landed in the country, every pocket emptied and the country's money left in cash as given. */
function landed(country: Id<"country">, cash: number): Game {
  const game = start({ content, scenario: "scenario.ada" });
  applyEffects(game, [{ type: "place/move", to: "abroad", country }]);
  money(game, country, cash);
  return game;
}

function money(game: Game, country: Id<"country">, cash: number): void {
  const takes: Effect[] = CURRENCIES.flatMap((currency): Effect[] => {
    const pocket = game.state.wallet.pockets[currency];
    const held = pocket.bank + pocket.cash;
    return held === 0 ? [] : [{ type: "money/take", currency, pocket: "any", amount: held, reason: "mishap" }];
  });
  const currency = MONEY[country];
  if (currency === undefined) throw new Error(`No money for ${country}.`);
  applyEffects(game, [...takes, ...(cash > 0 ? [{ type: "money/add", currency, pocket: "cash", amount: cash, reason: "gift" } as const] : [])]);
}

/** The fare the country's way asks between two places, by the simulation's own function. */
function fareOf(country: Id<"country">, way: "bus" | "train" | "taxi", from: Id<"place">, to: Id<"place">): number {
  const rides = ridesOf(country);
  const figures = rides.ways[way];
  if (figures === undefined) throw new Error(`${country} has no ${way}.`);
  return rideFare({ ...figures, step: rides.step, lonMetresPerE3: rides.lonMetresPerE3 }, content.place[from]?.position ?? null, content.place[to]?.position ?? null);
}

function ride(game: Game, from: Id<"place">, to: Id<"place">, way: RideWay): Accepted {
  return game.accept({ type: "place/ride", from, to, way });
}

describe("the three countries' ways", () => {
  test("[R-PLACE-010] given the tuning, when Canada's, the UAE's and Italy's rides are read, then each has design page 15's ways, figures, step, pass, covered ways and walking pace", () => {
    expect(ridesOf(CANADA_COUNTRY)).toEqual({
      ways: { bus: { fare: 380, farePerKm: 0, metresPerMinute: 300 }, train: { fare: 380, farePerKm: 0, metresPerMinute: 700 }, taxi: { fare: 380, farePerKm: 200, metresPerMinute: 600 } },
      step: 5,
      pass: 11800,
      passWays: ["bus", "train"],
      lonMetresPerE3: 71,
      walkMetresPerMinute: 80,
    });
    expect(ridesOf(UAE)).toEqual({
      ways: { bus: { fare: 400, farePerKm: 50, metresPerMinute: 250 }, train: { fare: 400, farePerKm: 50, metresPerMinute: 700 }, taxi: { fare: 1200, farePerKm: 200, metresPerMinute: 600 } },
      step: 25,
      pass: 14000,
      passWays: ["bus", "train"],
      lonMetresPerE3: 100,
      walkMetresPerMinute: 60,
    });
    expect(ridesOf(ITALY)).toEqual({ ways: { bus: { fare: 160, farePerKm: 0, metresPerMinute: 200 } }, step: 5, pass: null, passWays: [], lonMetresPerE3: 84, walkMetresPerMinute: 80 });
  });

  test("[R-PLACE-010] given a life in each country, when the view is read, then the ways are the country's in its money with on foot at the country's pace, the Gulf's walk the slowest", () => {
    const calgary = landed(CANADA_COUNTRY, 0).view().place.ways?.map((way) => [way.way, way.currency, way.fare, way.metresPerMinute]);
    expect(calgary).toEqual([
      ["bus", "CAD", 380, 300],
      ["train", "CAD", 380, 700],
      ["taxi", "CAD", 380, 600],
      ["walk", "CAD", 0, 80],
    ]);
    const dubai = landed(UAE, 0).view().place.ways?.map((way) => [way.way, way.currency, way.fare, way.step, way.metresPerMinute]);
    expect(dubai).toEqual([
      ["bus", "AED", 400, 25, 250],
      ["train", "AED", 400, 25, 700],
      ["taxi", "AED", 1200, 25, 600],
      ["walk", "AED", 0, 25, 60],
    ]);
    const castel = landed(ITALY, 0).view().place.ways?.map((way) => [way.way, way.currency, way.fare, way.metresPerMinute]);
    expect(castel).toEqual([
      ["bus", "EUR", 160, 200],
      ["walk", "EUR", 0, 80],
    ]);
    // London's walk keeps the pace it had.
    expect(flown(content).view().place.ways?.find((way) => way.way === "walk")?.metresPerMinute).toBe(content.tuning.city.ride.metresPerMinute.walk);
  });

  test("[R-PLACE-010] given a life in Calgary with dollars in cash, when the bus, the CTrain and a taxi are taken, then the bus and the train are one flat fare, the taxi grows with the distance in fives of cents, each paid in dollars as a fare", () => {
    const game = landed(CANADA_COUNTRY, 10000);
    const byBus = ride(game, "place.calgary-north-east", "place.office-ca", "bus");
    expect(debits(byBus)).toMatchObject([{ currency: "CAD", pocket: "cash", amount: 380, reason: "fare" }]);
    expect(rode(byBus)).toEqual({ type: "place/rode", from: "place.calgary-north-east", to: "place.office-ca", way: "bus", fare: 380, currency: "CAD" });
    expect(rode(ride(game, "place.office-ca", "place.ctrain-station-ca", "train"))).toMatchObject({ fare: 380, currency: "CAD" });
    const metres = metresApart(positionOf(content, "place.calgary-north-east"), positionOf(content, "place.calgary-airport"), 71);
    const taxi = divCeil(380 + mulDiv(200, metres, 1000), 5) * 5;
    expect(fareOf(CANADA_COUNTRY, "taxi", "place.calgary-north-east", "place.calgary-airport")).toBe(taxi);
    expect(rode(ride(game, "place.calgary-north-east", "place.calgary-airport", "taxi"))).toMatchObject({ way: "taxi", fare: taxi, currency: "CAD" });
    expect(game.state.wallet.pockets.CAD.cash).toBe(10000 - 380 - 380 - taxi);
  });

  test("[R-PLACE-010] given a life in Dubai, when the bus and the metro are taken, then each is the zone fare read as distance, rounded up to twenty-five fils", () => {
    const game = landed(UAE, 20000);
    const metres = metresApart(positionOf(content, "place.deira"), positionOf(content, "place.dubai-airport"), 100);
    const bus = divCeil(400 + mulDiv(50, metres, 1000), 25) * 25;
    expect(bus % 25).toBe(0);
    expect(bus).toBeGreaterThan(400);
    expect(rode(ride(game, "place.deira", "place.dubai-airport", "bus"))).toMatchObject({ way: "bus", fare: bus, currency: "AED" });
    expect(rode(ride(game, "place.dubai-airport", "place.deira", "train"))).toMatchObject({ way: "train", fare: bus, currency: "AED" });
    // The step's edge: one fil past a step rounds up to the next twenty-five, one on it stays.
    expect(rideFare({ fare: 401, farePerKm: 0, step: 25, lonMetresPerE3: 100 }, null, null)).toBe(425);
    expect(rideFare({ fare: 425, farePerKm: 0, step: 25, lonMetresPerE3: 100 }, null, null)).toBe(425);
  });

  test("[R-PLACE-010] given a life in Castel Volturno, when the bus goes to Naples airport, then it is accepted at the flat fare; the train and the taxi are refused, as the country has neither", () => {
    const game = landed(ITALY, 1000);
    expect(rode(ride(game, "place.castel-volturno", "place.naples-airport", "bus"))).toMatchObject({ way: "bus", fare: 160, currency: "EUR" });
    game.expectRejected({ type: "place/ride", from: "place.castel-volturno", to: "place.via-domitiana", way: "train" }, "not-legal");
    game.expectRejected({ type: "place/ride", from: "place.castel-volturno", to: "place.via-domitiana", way: "taxi" }, "not-legal");
    expect(game.state.wallet.pockets.EUR.cash).toBe(1000 - 160);
  });

  test("[R-PLACE-010] given each country's money one cent short of the bus and then holding it, when the bus is taken, then it is refused as unaffordable and then taken", () => {
    const game = landed(ITALY, 159);
    game.expectRejected({ type: "place/ride", from: "place.castel-volturno", to: "place.via-domitiana", way: "bus" }, "cannot-afford");
    money(game, ITALY, 160);
    expect(rode(ride(game, "place.castel-volturno", "place.via-domitiana", "bus"))).toMatchObject({ fare: 160 });
    expect(game.state.wallet.pockets.EUR.cash).toBe(0);
  });

  test("[R-PLACE-010] given a life in Calgary, when a ride goes to a place of another country, then it is refused", () => {
    const game = landed(CANADA_COUNTRY, 10000);
    game.expectRejected({ type: "place/ride", from: "place.calgary-north-east", to: "place.peckham", way: "bus" }, "not-legal");
    game.expectRejected({ type: "place/ride", from: "place.calgary-north-east", to: "place.deira", way: "bus" }, "not-legal");
    expect(game.state.wallet.pockets.CAD.cash).toBe(10000);
  });
});

const TRANSIT_PASS: Id<"activity"> = "activity.transit-pass-ca";
const ZONE_PASS: Id<"activity"> = "activity.transit-pass-uae";

describe("the pass covers the country's ways", () => {
  test("[R-PLACE-012] given the two new passes, when their entries are read, then each is a now-act once a month in its country at no time, costing the country's pass figure as a fare, staged at its station's machine", () => {
    for (const [act, country, currency, station] of [
      [TRANSIT_PASS, CANADA_COUNTRY, "CAD", "place.ctrain-station-ca"],
      [ZONE_PASS, UAE, "AED", "place.metro-station-uae"],
    ] as const) {
      expect(content.activity[act]).toMatchObject({ slot: "none", when: "now", halfDays: 0, where: "abroad", country, cost: [{ currency, amount: ridesOf(country).pass, reason: "fare" }], effects: [] });
      expect(content.activity[act]?.repeat).toBeUndefined();
      expect(Object.values(content.place).filter((place) => (place.stages as readonly string[]).includes(act)).map((place) => place.id)).toEqual([station]);
    }
    expect([ridesOf(CANADA_COUNTRY).pass, ridesOf(UAE).pass]).toEqual([11800, 14000]);
  });

  test("[R-PLACE-012] given a life in Calgary that buys the transit pass, when the bus and the CTrain are taken that month, then both ask nothing and the view marks both passed; the taxi asks its fare", () => {
    const game = landed(CANADA_COUNTRY, 20000);
    expect(debits(game.accept({ type: "activity/now", activity: TRANSIT_PASS, param: null }))).toMatchObject([{ currency: "CAD", amount: 11800, reason: "fare" }]);
    expect(game.view().place.ways?.map((way) => [way.way, way.passed])).toEqual([
      ["bus", true],
      ["train", true],
      ["taxi", false],
      ["walk", false],
    ]);
    const byBus = ride(game, "place.calgary-north-east", "place.office-ca", "bus");
    expect(debits(byBus)).toEqual([]);
    expect(rode(byBus)).toEqual({ type: "place/rode", from: "place.calgary-north-east", to: "place.office-ca", way: "bus", fare: 0, currency: "CAD" });
    expect(rode(ride(game, "place.office-ca", "place.ctrain-station-ca", "train"))).toMatchObject({ way: "train", fare: 0 });
    const taxi = fareOf(CANADA_COUNTRY, "taxi", "place.ctrain-station-ca", "place.calgary-airport");
    expect(rode(ride(game, "place.ctrain-station-ca", "place.calgary-airport", "taxi"))).toMatchObject({ way: "taxi", fare: taxi });
    expect(game.state.wallet.pockets.CAD.cash).toBe(20000 - 11800 - taxi);
    game.expectRejected({ type: "activity/now", activity: TRANSIT_PASS, param: null }, "not-legal");
  });

  test("[R-PLACE-012] given a life in Dubai that buys the zone pass, when the bus and the metro are taken, then both ask nothing; the taxi asks its fare", () => {
    const game = landed(UAE, 30000);
    game.accept({ type: "activity/now", activity: ZONE_PASS, param: null });
    expect(game.view().place.ways?.filter((way) => way.passed).map((way) => way.way)).toEqual(["bus", "train"]);
    expect(rode(ride(game, "place.deira", "place.dubai-airport", "bus"))).toMatchObject({ fare: 0, currency: "AED" });
    expect(rode(ride(game, "place.dubai-airport", "place.deira", "train"))).toMatchObject({ fare: 0, currency: "AED" });
    expect(rode(ride(game, "place.deira", "place.dubai-airport", "taxi"))).toMatchObject({ fare: fareOf(UAE, "taxi", "place.deira", "place.dubai-airport") });
  });

  test("[R-PLACE-012] given a life in London that buys the bus pass, when the train is taken that month, then the train still asks its fare, as the UK's pass covers the bus alone", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "money/add", currency: "GBP", pocket: "cash", amount: 20000, reason: "gift" }]);
    game.accept({ type: "activity/now", activity: "activity.bus-pass-uk", param: null });
    expect(game.view().place.ways?.filter((way) => way.passed).map((way) => way.way)).toEqual(["bus"]);
    const rides = ridesOf("country.uk");
    const train = rides.ways.train!;
    const fare = rideFare({ ...train, step: rides.step, lonMetresPerE3: rides.lonMetresPerE3 }, positionOf(content, "place.peckham"), positionOf(content, "place.heathrow"));
    expect(rode(ride(game, "place.peckham", "place.heathrow", "train"))).toMatchObject({ way: "train", fare });
    expect(fare).toBeGreaterThan(0);
  });

  test("[R-PLACE-012] given the transit pass bought last month, when the next month comes, then the bus and the CTrain ask their fares again", () => {
    const game = landed(CANADA_COUNTRY, 50000);
    game.accept({ type: "activity/now", activity: TRANSIT_PASS, param: null });
    if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
    game.endTurn();
    money(game, CANADA_COUNTRY, 50000);
    expect(game.view().place.ways?.filter((way) => way.passed)).toEqual([]);
    expect(rode(ride(game, "place.calgary-north-east", "place.office-ca", "train"))).toMatchObject({ fare: 380 });
  });

  test("[R-PLACE-012] given Italy with no pass, when the view is read and the bus is taken, then no way is passed, no pass act exists for Italy, and the bus asks its fare", () => {
    expect(ridesOf(ITALY)).toMatchObject({ pass: null, passWays: [] });
    expect(Object.values(content.activity).filter((entry) => entry.country === ITALY && entry.cost.some((cost) => cost.reason === "fare"))).toEqual([]);
    const game = landed(ITALY, 1000);
    expect(game.view().place.ways?.filter((way) => way.passed)).toEqual([]);
    expect(rode(ride(game, "place.castel-volturno", "place.via-domitiana", "bus"))).toMatchObject({ fare: 160 });
  });

  test("[R-PLACE-012] given a pass act played in a country whose pass covers no way, when the bus is taken, then it still asks its fare", () => {
    const canada = ridesOf(CANADA_COUNTRY);
    const none = { ...content, tuning: { ...content.tuning, city: { ...content.tuning.city, ride: { ...content.tuning.city.ride, abroad: { ...abroad, [CANADA_COUNTRY]: { ...canada, passWays: [] } } } } } };
    const game = start({ content: none, scenario: "scenario.ada" });
    applyEffects(game, [{ type: "place/move", to: "abroad", country: CANADA_COUNTRY }]);
    money(game, CANADA_COUNTRY, 20000);
    game.accept({ type: "activity/now", activity: TRANSIT_PASS, param: null });
    expect(game.view().place.ways?.filter((way) => way.passed)).toEqual([]);
    expect(rode(ride(game, "place.calgary-north-east", "place.office-ca", "bus"))).toMatchObject({ fare: 380 });
  });
});

const SITE: Id<"place"> = "place.site-uae";
const FIELDS: Id<"place"> = "place.farm-it";

describe("the employer's shuttle", () => {
  test("[R-PLACE-013] given the places, when the shuttle is read, then the site in Dubai and the fields in Castel Volturno carry it and no other place does", () => {
    expect(Object.values(content.place).filter((place) => place.shuttle).map((place) => place.id).sort()).toEqual([FIELDS, SITE]);
  });

  test("[R-PLACE-013] given a life in Dubai with no pass, when the bus goes to the site and back, from Deira and from the room, then each asks nothing and is on record at 0; the taxi to the site asks its fare", () => {
    const game = landed(UAE, 20000);
    const there = ride(game, "place.deira", SITE, "bus");
    expect(debits(there)).toEqual([]);
    expect(rode(there)).toEqual({ type: "place/rode", from: "place.deira", to: SITE, way: "bus", fare: 0, currency: "AED" });
    expect(rode(ride(game, SITE, ROOM, "bus"))).toMatchObject({ way: "bus", fare: 0 });
    expect(rode(ride(game, ROOM, SITE, "bus"))).toMatchObject({ way: "bus", fare: 0 });
    const taxi = fareOf(UAE, "taxi", SITE, "place.deira");
    expect(taxi).toBeGreaterThan(0);
    expect(rode(ride(game, SITE, "place.deira", "taxi"))).toMatchObject({ way: "taxi", fare: taxi });
    expect(rode(ride(game, "place.deira", SITE, "train"))).toMatchObject({ way: "train", fare: fareOf(UAE, "train", "place.deira", SITE) });
    expect(game.state.wallet.pockets.AED.cash).toBe(20000 - taxi - fareOf(UAE, "train", "place.deira", SITE));
  });

  test("[R-PLACE-013] given a life in Castel Volturno with no euros, when the bus goes to the fields and back, then each asks nothing in any month; the walk from the roundabout keeps its limit", () => {
    const game = landed(ITALY, 0);
    expect(rode(ride(game, "place.castel-volturno", FIELDS, "bus"))).toMatchObject({ way: "bus", fare: 0, currency: "EUR" });
    expect(rode(ride(game, FIELDS, "place.via-domitiana", "bus"))).toMatchObject({ way: "bus", fare: 0 });
    expect(withinMetres(positionOf(content, "place.castel-volturno"), positionOf(content, FIELDS), content.tuning.city.ride.walkMetres, 84)).toBe(false);
    game.expectRejected({ type: "place/ride", from: "place.castel-volturno", to: FIELDS, way: "walk" }, "not-legal");
    // The next month asks nothing either.
    if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
    game.endTurn();
    money(game, ITALY, 0);
    expect(rode(ride(game, "place.via-domitiana", FIELDS, "bus"))).toMatchObject({ way: "bus", fare: 0 });
  });

  test("[R-PLACE-013] given the shuttle, when a bus goes between two stops neither of which it serves, then the fare is asked: it covers no other stop", () => {
    const game = landed(UAE, 20000);
    expect(rode(ride(game, "place.deira", "place.naif", "bus"))).toMatchObject({ fare: fareOf(UAE, "bus", "place.deira", "place.naif") });
    expect(shuttleRide({ shuttle: false }, { shuttle: false }, "bus")).toBe(false);
    expect(shuttleRide({ shuttle: true }, { shuttle: false }, "bus")).toBe(true);
    expect(shuttleRide({ shuttle: false }, { shuttle: true }, "bus")).toBe(true);
    expect(shuttleRide({ shuttle: true }, { shuttle: true }, "taxi")).toBe(false);
  });

  test("[R-PLACE-013] given a life in each country, at home and in London, when the view is read, then the stops the shuttle serves are the country's alone: the site in Dubai, the fields in Italy, none elsewhere", () => {
    expect(landed(UAE, 0).view().place.shuttles).toEqual([SITE]);
    expect(landed(ITALY, 0).view().place.shuttles).toEqual([FIELDS]);
    expect(landed(CANADA_COUNTRY, 0).view().place.shuttles).toEqual([]);
    expect(flown(content).view().place.shuttles).toEqual([]);
    expect(start({ content }).view().place.shuttles).toEqual([]);
  });
});
