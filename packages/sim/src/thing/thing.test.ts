// The things a life owns at home (home.md R-HOME-013; design page 12 sections 2 and 4). The market sells a thing
// delivered at once; it stands in the home lived in when that home may hold it; while it stands it lifts acts the
// simulation already has, lifts each month it is lived with, or lifts once when it lands; some cost to run a month;
// selling it back or leaving Lagos brings in its resale figure.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import type { Accepted, BaseEvent, Effect, Id } from "../engine/types";
import { rideFare } from "../place/place.logic";
import { stepWith } from "../engine/step";
import { applyEffects, withEffects } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import type { WalletEvent } from "../wallet/wallet.events";
import { compoundMoveIn } from "../home/home.logic";

const FAMILY = "place.family-house";
const COMPOUND = "place.compound-room";
const HOSTEL = "place.hostel-room";
const ENERGY: Id<"quality"> = "quality.energy";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const STANDING: Id<"quality"> = "quality.standing";
const TECH: Id<"quality"> = "quality.tech";
const NAP: Id<"activity"> = "activity.nap";

/** The catalogue the first plan names, in its order. */
const CATALOGUE = [
  "thing.fan",
  "thing.radio",
  "thing.big-pot",
  "thing.data",
  "thing.tv",
  "thing.decoder",
  "thing.gas-cooker",
  "thing.fridge",
  "thing.mattress",
  "thing.wardrobe",
  "thing.mirror",
  "thing.speaker",
  "thing.generator",
  "thing.inverter",
  "thing.solar",
  "thing.ac",
  "thing.laptop",
  "thing.phone",
  "thing.car",
];

function ada(): Game {
  return start({ content, scenario: "scenario.ada", seed: "seed-1" });
}

function naira(game: Game): number {
  const { cash, bank } = game.state.wallet.pockets.NGN;
  return cash + bank;
}

/** Leaves exactly this much naira, all in the bank. */
function setNaira(game: Game, bank: number): void {
  const pocket = game.state.wallet.pockets.NGN;
  const effects: Effect[] = [];
  if (pocket.cash > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "cash", amount: pocket.cash, reason: "mishap" });
  if (pocket.bank > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "bank", amount: pocket.bank, reason: "mishap" });
  if (bank > 0) effects.push({ type: "money/add", currency: "NGN", pocket: "bank", amount: bank, reason: "gift" });
  applyEffects(game, effects);
}

function quality(game: Game, id: Id<"quality">): number {
  return game.state.quality[id] ?? 0;
}

function setQuality(game: Game, id: Id<"quality">, value: number): void {
  applyEffects(game, [{ type: "quality/add", quality: id, amount: value - quality(game, id) }]);
}

function price(thing: Id<"thing">): number {
  const entry = content.thing[thing];
  if (entry === undefined) throw new Error(`No ${thing}.`);
  return entry.price;
}

function buy(game: Game, thing: Id<"thing">): Accepted {
  return game.accept({ type: "thing/buy", thing });
}

/** Money moved by a result, by reason and way. */
function moved(result: { events: BaseEvent[] }): { type: string; reason: string; amount: number }[] {
  return result.events
    .filter((event): event is BaseEvent & Extract<WalletEvent, { type: "wallet/debited" | "wallet/credited" }> => event.type === "wallet/debited" || event.type === "wallet/credited")
    .map((event) => ({ type: event.type, reason: event.reason, amount: event.amount }));
}

function eventsOf(result: { events: BaseEvent[] }, type: string): (BaseEvent & Record<string, unknown>)[] {
  return result.events.filter((event) => event.type === type) as (BaseEvent & Record<string, unknown>)[];
}

function month(game: Game): Accepted {
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn();
}

/** Ada moved into the room in a compound with `spare` naira left. */
function inTheRoom(spare: number): Game {
  const game = ada();
  setNaira(game, compoundMoveIn(content.tuning.home) + spare);
  game.accept({ type: "home/move", to: COMPOUND });
  expect(naira(game)).toBe(spare);
  return game;
}

/** A nap's energy gained from a low start, so the cap never hides it. */
function napGives(game: Game): number {
  setQuality(game, ENERGY, 20);
  game.accept({ type: "activity/now", activity: NAP, param: null });
  return quality(game, ENERGY) - 20;
}

describe("the market's catalogue", () => {
  test("[R-HOME-013] [R-HOME-001] given the content, when the market's things are read, then the catalogue is the listed one, each priced in whole kobo with a resale under its price and a running cost where real", () => {
    expect(Object.keys(content.thing)).toEqual(CATALOGUE);
    for (const entry of Object.values(content.thing)) {
      expect(Number.isSafeInteger(entry.price)).toBe(true);
      expect(entry.price).toBeGreaterThan(0);
      expect(bp(entry.price, entry.resaleBp)).toBeLessThan(entry.price);
      expect(Number.isSafeInteger(entry.running)).toBe(true);
    }
    const running = Object.values(content.thing)
      .filter((entry) => entry.running > 0)
      .map((entry) => entry.id);
    expect(running).toEqual(["thing.data", "thing.decoder", "thing.gas-cooker", "thing.fridge", "thing.generator", "thing.ac"]);
  });

  test("[R-HOME-013] [R-HOME-001] [R-HOME-012] given each thing's changes to acts, when read against the acts, then every act exists, a time is never longer than the act's own and a price cut is a cut", () => {
    const problems: string[] = [];
    for (const entry of Object.values(content.thing)) {
      for (const mod of entry.acts) {
        const act = content.activity[mod.activity];
        if (act === undefined) problems.push(`${entry.id} names ${mod.activity}, no act`);
        if (mod.halfDays !== undefined && mod.halfDays > (act?.halfDays ?? 1)) problems.push(`${entry.id} makes ${mod.activity} longer`);
        if (mod.costBp !== undefined && mod.costBp >= 10000) problems.push(`${entry.id} cuts nothing off ${mod.activity}`);
      }
      for (const need of entry.needs) if (content.thing[need] === undefined) problems.push(`${entry.id} needs ${need}, no thing`);
      if (entry.eases !== undefined && (content.thing[entry.eases.thing]?.running ?? 0) === 0) problems.push(`${entry.id} eases a thing that costs nothing to run`);
    }
    expect(problems).toEqual([]);
  });

  test("[R-HOME-013] [R-HOME-001] given where each thing may stand, when the family house is read, then it holds only the small things, in your corner, and the car in its carport; the yard's solar and the generator only the compound", () => {
    const atFamily = Object.values(content.thing)
      .filter((entry) => entry.homes.includes(FAMILY))
      .map((entry) => entry.id);
    expect(atFamily).toEqual(["thing.fan", "thing.radio", "thing.big-pot", "thing.data", "thing.mattress", "thing.mirror", "thing.speaker", "thing.laptop", "thing.phone", "thing.car"]);
    expect(content.thing["thing.solar"]?.homes).toEqual([COMPOUND]);
    expect(content.thing["thing.generator"]?.homes).toEqual([COMPOUND]);
    expect(content.thing["thing.car"]?.homes).not.toContain(HOSTEL);
  });
});

describe("buying and selling", () => {
  test("[R-HOME-013] [R-HOME-006] given Ada at the family house, when she buys a fan, then its price goes out under goods at once, it is hers and the market says so", () => {
    const game = ada();
    const before = naira(game);
    const result = buy(game, "thing.fan");
    expect(moved(result)).toEqual([{ type: "wallet/debited", reason: "goods", amount: price("thing.fan") }]);
    expect(naira(game)).toBe(before - price("thing.fan"));
    expect(eventsOf(result, "things/bought")).toEqual([{ type: "things/bought", thing: "thing.fan", month: game.state.turn.month, paid: price("thing.fan") }]);
    const view = game.view().things;
    expect(view.owned).toEqual([{ thing: "thing.fan", month: game.state.turn.month, stored: false, resale: bp(price("thing.fan"), content.thing["thing.fan"]!.resaleBp) }]);
    expect(view.market.find((one) => one.thing === "thing.fan")?.shut).toBe("owned");
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[R-HOME-013] [R-HOME-006] given Ada at the family house, when she tries a TV, a fridge or a generator, then each is refused: the parlour is Mama's and Papa's, and the market says why", () => {
    const game = ada();
    setNaira(game, 5_000_000_00);
    for (const thing of ["thing.tv", "thing.fridge", "thing.generator", "thing.solar"] as const) {
      game.expectRejected({ type: "thing/buy", thing }, "not-legal");
      expect(game.view().things.market.find((one) => one.thing === thing)?.shut).toBe("home");
    }
    expect(game.state.things.owned).toEqual([]);
  });

  test("[R-HOME-013] [R-HOME-006] given the market, when the price is not held, a thing is owned, a need is missing or the thing is unknown, then each refusal is its own and nothing moves", () => {
    const game = inTheRoom(price("thing.decoder"));
    game.expectRejected({ type: "thing/buy", thing: "thing.decoder" }, "not-legal");
    expect(game.view().things.market.find((one) => one.thing === "thing.decoder")?.shut).toBe("needs");
    setNaira(game, price("thing.tv") - 1);
    game.expectRejected({ type: "thing/buy", thing: "thing.tv" }, "cannot-afford");
    expect(game.view().things.market.find((one) => one.thing === "thing.tv")?.shut).toBe("short");
    setNaira(game, price("thing.tv") + price("thing.decoder"));
    buy(game, "thing.tv");
    buy(game, "thing.decoder");
    expect(naira(game)).toBe(0);
    game.expectRejected({ type: "thing/buy", thing: "thing.tv" }, "not-legal");
    game.expectRejected({ type: "thing/buy", thing: "thing.nothing" }, "unknown-id");
    game.expectRejected({ type: "thing/buy", thing: "constructor" as Id<"thing"> }, "unknown-id");
  });

  test("[R-HOME-013] [R-HOME-006] given a thing owned, when it is sold back, then its resale share of what was paid comes in under sale and it is gone; one not owned is refused", () => {
    const game = ada();
    buy(game, "thing.speaker");
    const before = naira(game);
    const result = game.accept({ type: "thing/sell", thing: "thing.speaker" });
    const resale = bp(price("thing.speaker"), content.thing["thing.speaker"]!.resaleBp);
    expect(moved(result)).toEqual([{ type: "wallet/credited", reason: "sale", amount: resale }]);
    expect(naira(game)).toBe(before + resale);
    expect(game.state.things.owned).toEqual([]);
    game.expectRejected({ type: "thing/sell", thing: "thing.speaker" }, "not-legal");
  });

  test("[R-HOME-013] [R-HOME-006] given a mirror and a car bought, when they land, then each lifts standing once, as its entry says", () => {
    const game = ada();
    setNaira(game, price("thing.car") + price("thing.mirror"));
    setQuality(game, STANDING, 40);
    buy(game, "thing.mirror");
    expect(quality(game, STANDING)).toBe(41);
    buy(game, "thing.car");
    expect(quality(game, STANDING)).toBe(46);
    expect(game.view().things.drive).toBe(true);
  });

  test("[R-HOME-013] [R-PLACE-002] given things owned in Lagos, when the life flies out, then all are sold at once at their resale figures in one line, and nothing is owned abroad", () => {
    const game = ada();
    buy(game, "thing.fan");
    buy(game, "thing.radio");
    const before = naira(game);
    const resale = ["thing.fan", "thing.radio"].reduce((sum, thing) => sum + bp(price(thing as Id<"thing">), content.thing[thing as Id<"thing">]!.resaleBp), 0);
    const result = stepWith(withEffects([{ type: "place/move", to: "abroad", country: "country.uk" }]), game.state, { type: "offer/choose", offer: "x", choice: "y", basedOn: game.state.v }, game.world(), game.content);
    if (!result.ok) throw new Error(result.detail);
    game.state = result.state;
    expect(eventsOf(result, "things/sold-off")).toEqual([{ type: "things/sold-off", things: ["thing.fan", "thing.radio"], amount: resale }]);
    expect(naira(game)).toBe(before + resale);
    expect(game.state.things.owned).toEqual([]);
    expect(game.view().things.market.every((one) => one.shut === "away")).toBe(true);
  });
});

describe("what a thing does in life", () => {
  test("[R-HOME-013] [R-HOME-012] [R-WORLD-005] given a fan at the family house, when Ada naps, then the nap gives its own energy and the fan's more", () => {
    const plain = ada();
    const withFan = ada();
    buy(withFan, "thing.fan");
    expect(napGives(withFan) - napGives(plain)).toBe(10);
  });

  test("[R-HOME-013] [R-HOME-012] given a fan and a standing AC in the room, when Ada naps, then only the dearer cools: the AC's lift alone counts", () => {
    const plain = inTheRoom(0);
    const game = inTheRoom(price("thing.fan") + price("thing.ac"));
    buy(game, "thing.fan");
    buy(game, "thing.ac");
    expect(napGives(game) - napGives(plain)).toBe(20);
  });

  test("[R-HOME-013] [R-HOME-012] [R-ACTIVITY-018] given a gas cooker in the room, when the pot of your own is cooked, then it spends a day, not the weekend, and the meal costs less; the view says the same", () => {
    const game = inTheRoom(price("thing.gas-cooker") + 50_000_00);
    const pot = game.view().activities.find((one) => one.id === "activity.cook-own-pot");
    expect(pot?.halfDays).toBeUndefined();
    buy(game, "thing.gas-cooker");
    expect(game.view().activities.find((one) => one.id === "activity.cook-own-pot")?.halfDays).toBe(2);
    const meal = content.activity["activity.cook-own"]!.cost[0]!.amount as number;
    expect(game.view().activities.find((one) => one.id === "activity.cook-own")?.cost).toEqual([{ currency: "NGN", amount: bp(meal, 8000) }]);
    const days = game.state.turn.spent;
    game.accept({ type: "activity/now", activity: "activity.cook-own-pot", param: null });
    expect(game.state.turn.spent - days).toBe(2);
  });

  test("[R-HOME-013] [R-HOME-012] given a data router, then a phone too, when the month closes, then the plan's month is taken under running, halved with the phone, and a course online costs less", () => {
    const game = ada();
    setNaira(game, price("thing.data") + price("thing.phone") + 100_000_00);
    buy(game, "thing.data");
    const course = content.activity["activity.learn-tech"]!.cost[0]!.amount as number;
    expect(game.view().activities.find((one) => one.id === "activity.learn-tech")?.cost).toEqual([{ currency: "NGN", amount: bp(course, 6000) }]);
    expect(game.view().things.running).toBe(content.thing["thing.data"]!.running);
    let result = month(game);
    expect(eventsOf(result, "things/ran")).toEqual([{ type: "things/ran", thing: "thing.data", amount: content.thing["thing.data"]!.running }]);
    expect(moved(result).filter((one) => one.reason === "running")).toEqual([{ type: "wallet/debited", reason: "running", amount: content.thing["thing.data"]!.running }]);
    buy(game, "thing.phone");
    result = month(game);
    expect(eventsOf(result, "things/ran")).toEqual([{ type: "things/ran", thing: "thing.data", amount: bp(content.thing["thing.data"]!.running, 5000) }]);
  });

  test("[R-HOME-013] [R-HOME-012] given a generator in the room and no money for its fuel, when the month closes, then it stands idle, nothing is taken and its light gives nothing; with the fuel held it lifts the month", () => {
    const fuel = content.thing["thing.generator"]!.running;
    const game = inTheRoom(price("thing.generator"));
    buy(game, "thing.generator");
    expect(naira(game)).toBe(0);
    let result = month(game);
    expect(eventsOf(result, "things/stood")).toEqual([{ type: "things/stood", thing: "thing.generator", amount: fuel }]);
    expect(moved(result).filter((one) => one.reason === "running")).toEqual([]);
    setNaira(game, fuel);
    result = month(game);
    expect(eventsOf(result, "things/ran")).toEqual([{ type: "things/ran", thing: "thing.generator", amount: fuel }]);
    expect(result.events.some((event) => event.type === "quality/changed" && (event as unknown as { quality: string }).quality === WELLBEING)).toBe(true);
  });

  test("[R-HOME-013] [R-HOME-002] [R-HOME-012] given a TV and a laptop in the room, when Ada moves back to the family house, then the TV is kept but stored and does nothing, the laptop stands in her corner and still works", () => {
    const game = inTheRoom(price("thing.tv") + price("thing.laptop"));
    buy(game, "thing.tv");
    buy(game, "thing.laptop");
    month(game);
    game.accept({ type: "home/move", to: FAMILY });
    const owned = game.view().things.owned;
    expect(owned.map((one) => [one.thing, one.stored])).toEqual([
      ["thing.tv", true],
      ["thing.laptop", false],
    ]);
    setQuality(game, TECH, 50);
    setNaira(game, 50_000_00);
    game.accept({ type: "activity/now", activity: "activity.learn-tech", param: null });
    expect(quality(game, TECH)).toBe(53);
  });

  test("[R-HOME-013] [R-HOME-001] given a life that owns nothing, when the month closes, then the things kind tells and moves nothing, so a life with no things plays as if there were no market", () => {
    const game = ada();
    const result = month(game);
    expect(result.events.filter((event) => event.type.startsWith("things/"))).toEqual([]);
    expect(game.view().things).toMatchObject({ owned: [], drive: false, running: 0 });
  });
});

describe("the car on the map (R-PLACE-010 and R-WORLD-017)", () => {
  const FROM: Id<"place"> = "place.ojuelegba";
  const TO: Id<"place"> = "place.yaba";

  test("[R-HOME-013] [R-PLACE-010] given no car, when Drive is sent, then it is refused; with the car at the room's spot, the fuel is the fare, by distance, dearer than the danfo and cheaper than the okada", () => {
    const game = inTheRoom(price("thing.car") + 50_000_00);
    game.expectRejected({ type: "place/ride", from: FROM, to: TO, way: "drive" }, "not-legal");
    buy(game, "thing.car");
    const from = content.place[FROM]!.position;
    const to = content.place[TO]!.position;
    const fare = rideFare(content, from, to, "drive");
    expect(fare).toBeGreaterThan(rideFare(content, from, to, "danfo"));
    expect(fare).toBeLessThan(rideFare(content, from, to, "okada"));
    const before = naira(game);
    const result = game.accept({ type: "place/ride", from: FROM, to: TO, way: "drive" });
    expect(eventsOf(result, "place/rode")).toEqual([{ type: "place/rode", from: FROM, to: TO, way: "drive", fare, currency: "NGN" }]);
    expect(naira(game)).toBe(before - fare);
  });

  test("[R-HOME-013] [R-PLACE-010] given a car bought at the room, when Ada moves to the hostel, which has no car spot, then the car is stored there and Drive is not offered", () => {
    const game = inTheRoom(price("thing.car") + content.tuning.home.hostelRentKobo);
    buy(game, "thing.car");
    month(game);
    setNaira(game, content.tuning.home.hostelRentKobo + 10_000_00);
    game.accept({ type: "home/move", to: HOSTEL });
    expect(game.view().things.drive).toBe(false);
    expect(game.view().things.owned).toMatchObject([{ thing: "thing.car", stored: true }]);
    game.expectRejected({ type: "place/ride", from: FROM, to: TO, way: "drive" }, "not-legal");
  });
});
