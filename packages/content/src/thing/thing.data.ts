// The market's things for the home (the design, design page 12 sections 2 and 4): the catalogue the
// owner asked for before launch. Prices are working figures from Lagos listings of 2025 and 2026 (a standing fan about
// 30,000 to 45,000 naira, a 32-inch TV about 150,000 to 220,000, a small petrol generator about 200,000 to 300,000, a
// 1.5 kVA inverter with batteries about 700,000 to 1.2 million, a home solar set about 2 to 3 million, a 1 hp standing
// AC about 500,000 to 700,000, a used laptop about 250,000 to 400,000, a used car about 5 to 8 million), to be tuned by
// play. What each does is a lift on acts the simulation has (the nap, the meals, the TV, the study), a lift each month
// it is lived with, or a lift once when it lands; the light and the cool air do not add up (one generator, inverter or
// solar set lights the room; the AC or the fan cools it). Where each may stand: the family house holds only the small
// things, in your corner, and the car in the carport; a home of your own holds what fits it (the compound's room and yard
// hold everything; a hostel room no dish, gas cylinder, wardrobe, generator, inverter, solar, AC or car; Makoko's deck only a fan, a radio, the router and the phone).
import type { HomePlace, Id, ThingEntry, ThingMod } from "@japacity/sim";

import { naira, pct } from "../units";

const FAMILY: HomePlace = "place.family-house";
const MAKOKO: HomePlace = "place.makoko";
const COMPOUND: HomePlace = "place.compound-room";
const HOSTEL: HomePlace = "place.hostel-room";
/** A small thing: in your corner at the family house, on Makoko's deck, in any room of your own. */
const SMALL: HomePlace[] = [FAMILY, MAKOKO, COMPOUND, HOSTEL];
/** A small thing with no room on Makoko's deck, which holds only the smallest: a fan, a radio, the router and the phone. */
const SMALL_INDOOR: HomePlace[] = [FAMILY, COMPOUND, HOSTEL];
/** A thing of a room of your own: the room in a compound and the hostel room. */
const OWN: HomePlace[] = [COMPOUND, HOSTEL];
/** A thing only the compound's room and yard hold: a hostel room bans the gas cylinder and has no wiring for an AC or an inverter. */
const ROOM: HomePlace[] = [COMPOUND];

const WELLBEING = "quality.wellbeing";
const ENERGY = "quality.energy";
const BELLY = "quality.belly";
const STANDING = "quality.standing";

/** Studying under a bulb tires less than by the lantern: the light when NEPA takes it. */
const LIGHT_ACTS: ThingMod[] = ["activity.study-english", "activity.learn-tech", "activity.build-portfolio"].map((activity) => ({ activity: activity as Id<"activity">, adds: [{ quality: ENERGY, amount: 2 }] }));

function thing(entry: Omit<ThingEntry, "needs" | "group" | "bought" | "monthly" | "acts"> & Partial<Pick<ThingEntry, "needs" | "group" | "bought" | "monthly" | "acts">>): ThingEntry {
  return { needs: [], group: null, bought: [], monthly: [], acts: [], ...entry };
}

export const thingTable: Record<Id<"thing">, ThingEntry> = {
  // A standing fan: the nap gives more, and the nights are cooler.
  "thing.fan": thing({
    id: "thing.fan",
    price: naira(35000),
    resaleBp: pct(40),
    running: 0,
    homes: SMALL,
    group: "cool",
    monthly: [{ quality: WELLBEING, amount: 1 }],
    acts: [{ activity: "activity.nap", adds: [{ quality: ENERGY, amount: 10 }] }],
  }),
  // A small radio for the evening: the news, the music, the football.
  "thing.radio": thing({ id: "thing.radio", price: naira(12000), resaleBp: pct(40), running: 0, homes: SMALL, monthly: [{ quality: WELLBEING, amount: 1 }] }),
  // A big pot: the pot of your own, or the house's, feeds more, and the compound greets you for it.
  "thing.big-pot": thing({
    id: "thing.big-pot",
    price: naira(18000),
    resaleBp: pct(50),
    running: 0,
    homes: SMALL_INDOOR,
    acts: [
      { activity: "activity.cook-own-pot", adds: [{ quality: WELLBEING, amount: 2 }, { quality: STANDING, amount: 1 }] },
      { activity: "activity.cook-jollof", adds: [{ quality: WELLBEING, amount: 2 }, { quality: STANDING, amount: 1 }] },
    ],
  }),
  // A data router and its plan: courses online cost less; the plan is a month's charge.
  "thing.data": thing({ id: "thing.data", price: naira(25000), resaleBp: pct(30), running: naira(10000), homes: SMALL, acts: [{ activity: "activity.learn-tech", costBp: pct(60) }] }),
  // A TV of your own: Nollywood in your own room.
  "thing.tv": thing({
    id: "thing.tv",
    price: naira(180000),
    resaleBp: pct(45),
    running: 0,
    homes: OWN,
    monthly: [{ quality: WELLBEING, amount: 2 }],
    acts: [{ activity: "activity.watch-tv", adds: [{ quality: WELLBEING, amount: 2 }] }],
  }),
  // The decoder and its dish: the football and the films, at a bouquet a month. It needs the TV.
  "thing.decoder": thing({
    id: "thing.decoder",
    price: naira(30000),
    resaleBp: pct(30),
    running: naira(9000),
    homes: ROOM,
    needs: ["thing.tv"],
    monthly: [{ quality: WELLBEING, amount: 1 }],
    acts: [{ activity: "activity.watch-tv", adds: [{ quality: WELLBEING, amount: 3 }] }],
  }),
  // A gas cooker and its cylinder: the pot takes a day, not the weekend, and gas costs less than kerosene; refills a month.
  "thing.gas-cooker": thing({
    id: "thing.gas-cooker",
    price: naira(95000),
    resaleBp: pct(45),
    running: naira(12000),
    homes: ROOM,
    acts: [
      { activity: "activity.cook-own-pot", halfDays: 2 },
      { activity: "activity.cook-own", costBp: pct(80) },
    ],
  }),
  // A small fridge: the pot lasts, so a pot fills you for longer; it pulls a little light.
  "thing.fridge": thing({
    id: "thing.fridge",
    price: naira(380000),
    resaleBp: pct(45),
    running: naira(4000),
    homes: OWN,
    acts: [
      { activity: "activity.cook-own-pot", adds: [{ quality: BELLY, amount: 20 }] },
      { activity: "activity.cook-own", adds: [{ quality: BELLY, amount: 5 }] },
    ],
  }),
  // A proper foam mattress on a frame: better sleep, and a nap that gives more.
  "thing.mattress": thing({
    id: "thing.mattress",
    price: naira(90000),
    resaleBp: pct(30),
    running: 0,
    homes: [FAMILY, COMPOUND],
    monthly: [{ quality: WELLBEING, amount: 1 }],
    acts: [{ activity: "activity.nap", adds: [{ quality: ENERGY, amount: 5 }] }],
  }),
  // A wardrobe: your clothes kept well, and you dress like it.
  "thing.wardrobe": thing({ id: "thing.wardrobe", price: naira(120000), resaleBp: pct(40), running: 0, homes: ROOM, bought: [{ quality: STANDING, amount: 2 }] }),
  // A standing mirror: you go out looking right.
  "thing.mirror": thing({ id: "thing.mirror", price: naira(15000), resaleBp: pct(40), running: 0, homes: SMALL_INDOOR, bought: [{ quality: STANDING, amount: 1 }] }),
  // A party speaker: the evening loud, and the street knows whose music it is.
  "thing.speaker": thing({ id: "thing.speaker", price: naira(45000), resaleBp: pct(40), running: 0, homes: SMALL_INDOOR, bought: [{ quality: STANDING, amount: 1 }], monthly: [{ quality: WELLBEING, amount: 1 }] }),
  // A small petrol generator: light when NEPA takes it, fuel a month.
  "thing.generator": thing({
    id: "thing.generator",
    price: naira(230000),
    resaleBp: pct(45),
    running: naira(30000),
    homes: ROOM,
    group: "light",
    monthly: [{ quality: WELLBEING, amount: 2 }],
    acts: LIGHT_ACTS,
  }),
  // An inverter and its batteries: quiet light when NEPA takes it, nothing to buy a month.
  "thing.inverter": thing({ id: "thing.inverter", price: naira(850000), resaleBp: pct(45), running: 0, homes: ROOM, group: "light", monthly: [{ quality: WELLBEING, amount: 2 }], acts: LIGHT_ACTS }),
  // A solar set in the yard: light with no fuel and no noise.
  "thing.solar": thing({ id: "thing.solar", price: naira(2400000), resaleBp: pct(50), running: 0, homes: ROOM, group: "light", monthly: [{ quality: WELLBEING, amount: 2 }], acts: LIGHT_ACTS }),
  // A standing AC: cool nights and naps that give the most; it pulls light a month.
  "thing.ac": thing({
    id: "thing.ac",
    price: naira(600000),
    resaleBp: pct(40),
    running: naira(18000),
    homes: ROOM,
    group: "cool",
    monthly: [{ quality: WELLBEING, amount: 3 }],
    acts: [{ activity: "activity.nap", adds: [{ quality: ENERGY, amount: 20 }] }],
  }),
  // A used laptop on a small desk: the portfolio's pieces made at home in less time, and more learnt from a course.
  "thing.laptop": thing({
    id: "thing.laptop",
    price: naira(320000),
    resaleBp: pct(50),
    running: 0,
    homes: SMALL_INDOOR,
    acts: [
      { activity: "activity.build-portfolio", halfDays: 3 },
      { activity: "activity.learn-tech", adds: [{ quality: "quality.tech", amount: 1 }] },
    ],
  }),
  // A good phone: you are reachable and seen, and the data goes twice as far.
  "thing.phone": thing({ id: "thing.phone", price: naira(180000), resaleBp: pct(45), running: 0, homes: SMALL, bought: [{ quality: "quality.network", amount: 3 }], eases: { thing: "thing.data", bp: pct(50) } }),
  // A used car: a way of your own on the map at the fuel's cost, and the street sees it. It stands at home's car spot.
  "thing.car": thing({ id: "thing.car", price: naira(6500000), resaleBp: pct(60), running: 0, homes: [FAMILY, COMPOUND], bought: [{ quality: STANDING, amount: 5 }], drive: true }),
};
