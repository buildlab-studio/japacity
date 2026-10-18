// When nothing can be paid, the nudge names a free step (world:nudge-says-one-thing): the
// step's stop needs a fare the naira held cannot pay and is too far to walk, so the nudge says what can be done on foot:
// walking home whenever home is not here, however far (world:ride-sheet-shows-fares), the racks for a life in Makoko with no
// job, a job on a board within reach, and at home the month's end.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { setPockets } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { archetypeOf } from "../../../shared/frontdoor/archetypes";
import { playTile } from "../../../shared/frontdoor/archetypes.testing";
import { landedGame, newGame, openOffer } from "../../../shared/testing/fixtures";
import { say } from "../../../shared/words/text";
import { BOARD_WAY, freeStep, nudgeOf, type Reach } from "./nudge";

const FARE = content.tuning.city.ride.fareKobo.danfo;
/** Where the city stands a home with no position of its own (City.tsx's home spot). */
const HOME_SPOT = { latE3: 6507, lonE3: 3359 };
const FAR = { latE3: 6600, lonE3: 3300 };
const BODE_THOMAS = content.place["place.bode-thomas"]!.position!;
const YABA = content.place["place.yaba"]!.position!;
const MAKOKO = content.place["place.makoko"]!.position!;

/** Ada with this much naira, cash and bank together. */
function ada(naira: number): PlayerView {
  const game = newGame();
  setPockets(game, { NGN: naira });
  return { ...game.view(), offers: [] };
}

/** A view whose chapter's next step is the TB test at the clinic, a ride away from anywhere these tests stand. */
function atTheClinicStep(view: PlayerView): PlayerView {
  return { ...view, chapter: { ...view.chapter, current: "chapter.decision-day", items: [{ id: "tb", met: false }] } };
}

describe("an offer out of reach", () => {
  test("[world:nudge-says-one-thing] given Ada with no naira at the hub and a parcel waiting at the cargo office a ride away, when the nudge is read, then it does not point at the parcel", () => {
    const game = newGame("scenario.ada", "seed-3");
    game.endTurn();
    openOffer(game, "offer.parcel-shipped");
    setPockets(game, { NGN: 0 });
    // The parcel alone waits; another offer answerable anywhere would rightly lead.
    const view = { ...game.view(), offers: game.view().offers.filter((offer) => offer.entry === "offer.parcel-shipped") };
    expect(view.offers).toHaveLength(1);
    const reach: Reach = { here: "place.yaba", home: "place.family-house", stops: [{ id: "place.bode-thomas", position: BODE_THOMAS }, { id: "place.family-house", position: HOME_SPOT }, { id: "place.yaba", position: YABA }] };
    expect(nudgeOf(view, undefined, [], false, reach).about).not.toBe("offer");
    // With the fare in hand the parcel leads again.
    setPockets(game, { NGN: 100_000_00 });
    expect(nudgeOf({ ...view, pockets: game.view().pockets }, undefined, [], false, reach)).toEqual({ key: "ui.nudge.offer", about: "offer" });
  });
});

describe("the free step", () => {
  // A life may always walk home, however far, so far from
  // home the free step is the walk home; "end the month" stays only for a life already at home (world:ride-sheet-shows-fares).
  test("[world:nudge-says-one-thing] [world:ride-sheet-shows-fares] given Ada with no naira somewhere far from home with nothing on foot, when the nudge is read, then it says to walk home, however far, never a ride she cannot pay; at home with nothing near it says to end the month", () => {
    const view = atTheClinicStep(ada(0));
    const reach: Reach = { here: "place.passport-office", home: "place.family-house", stops: [{ id: "place.passport-office", position: FAR }, { id: "place.family-house", position: HOME_SPOT }, { id: "place.yaba", position: YABA }, { id: "place.bode-thomas", position: BODE_THOMAS }] };
    expect(nudgeOf(view, undefined, [], false, reach)).toEqual({ key: "ui.nudge.broke.home", about: "step", way: { go: "place.family-house", at: [] } });
    const atHome: Reach = { here: "place.family-house", home: "place.family-house", stops: [{ id: "place.family-house", position: FAR }, { id: "place.tb-clinic", position: HOME_SPOT }] };
    expect(nudgeOf(view, undefined, [], false, atHome)).toEqual({ key: "ui.nudge.broke.wait", about: "end", way: { go: null, at: [] } });
    const said = say("ui.nudge.broke.wait");
    expect(said.split(/\s+/).length).toBeLessThanOrEqual(8);
  });

  test("[world:nudge-says-one-thing] [world:ride-sheet-shows-fares] given a life with no naira away from home, when the free step is read, then it is the walk home whether home is near or a long way off, before the racks and the board", () => {
    const view = atTheClinicStep(ada(0));
    for (const homeAt of [HOME_SPOT, FAR]) {
      const reach: Reach = { here: "place.akoka", home: "place.family-house", stops: [{ id: "place.akoka", position: { latE3: YABA.latE3 + 3, lonE3: YABA.lonE3 } }, { id: "place.yaba", position: YABA }, { id: "place.family-house", position: homeAt }, { id: "place.tb-clinic", position: FAR }] };
      expect(freeStep(view, reach)).toEqual({ key: "ui.nudge.broke.home", about: "step", way: { go: "place.family-house", at: [] } });
    }
  });

  test("[world:nudge-says-one-thing] given Ada with no naira at Bode Thomas and the hub a ride away, when the nudge is read, then it says to walk home, home being near enough, and its way is home", () => {
    const view = ada(0);
    const reach: Reach = { here: "place.bode-thomas", home: "place.family-house", stops: [{ id: "place.bode-thomas", position: BODE_THOMAS }, { id: "place.family-house", position: HOME_SPOT }, { id: "place.yaba", position: YABA }] };
    expect(nudgeOf(view, undefined, [], false, reach)).toEqual({ key: "ui.nudge.broke.home", about: "step", way: { go: "place.family-house", at: [] } });
    const said = say("ui.nudge.broke.home");
    expect(said.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(said.split(". ")).toHaveLength(1);
  });

  test("[world:nudge-says-one-thing] given Ada at Bode Thomas with the danfo's fare held, when the nudge is read, then it keeps the chapter's step; a kobo short, the free step comes", () => {
    const reach: Reach = { here: "place.bode-thomas", home: "place.family-house", stops: [{ id: "place.bode-thomas", position: BODE_THOMAS }, { id: "place.family-house", position: HOME_SPOT }, { id: "place.yaba", position: YABA }] };
    expect(freeStep(ada(FARE), reach)).toBeNull();
    expect(nudgeOf(ada(FARE), undefined, [], false, reach).key).not.toMatch(/^ui\.nudge\.broke/);
    expect(freeStep(ada(FARE - 1), reach)?.key).toBe("ui.nudge.broke.home");
  });

  test("[world:nudge-says-one-thing] given the fares doubled this month, when the naira held covers the usual fare but not the month's, then the free step comes", () => {
    const view = ada(FARE);
    const reach: Reach = { here: "place.bode-thomas", home: "place.family-house", stops: [{ id: "place.bode-thomas", position: BODE_THOMAS }, { id: "place.family-house", position: HOME_SPOT }, { id: "place.yaba", position: YABA }] };
    expect(freeStep({ ...view, place: { ...view.place, fareBp: 20_000 } }, reach)?.key).toBe("ui.nudge.broke.home");
  });

  test("[world:nudge-says-one-thing] given Ada with no naira standing where the step is, or with the step's stop on foot, when the nudge is read, then no free step is named", () => {
    const view = ada(0);
    expect(freeStep(view, { here: "place.yaba", home: "place.family-house", stops: [{ id: "place.yaba", position: YABA }, { id: "place.family-house", position: HOME_SPOT }] })).toBeNull();
    expect(freeStep(view, { here: "place.akoka", home: null, stops: [{ id: "place.akoka", position: { latE3: YABA.latE3 + 3, lonE3: YABA.lonE3 } }, { id: "place.yaba", position: YABA }] })).toBeNull();
  });

  // Away from home the walk home comes first, so the board is named from home.
  test("[world:nudge-says-one-thing] given Ada with no naira and no job at home near the hub's board, the step's stop a ride away, when the nudge is read, then it names work nearby and its way is the board", () => {
    const view = atTheClinicStep(ada(0));
    const reach: Reach = { here: "place.family-house", home: "place.family-house", stops: [{ id: "place.family-house", position: { latE3: YABA.latE3 + 3, lonE3: YABA.lonE3 } }, { id: "place.yaba", position: YABA }, { id: "place.tb-clinic", position: FAR }] };
    expect(nudgeOf(view, undefined, [], false, reach)).toEqual({ key: "ui.nudge.broke.job", about: "step", way: BOARD_WAY });
  });

  test("[world:nudge-says-one-thing] [activity:fish-racks-at-makoko] given the child of the water at home in Makoko with no naira and no job, the step a ride away, when the nudge is read, then it names the racks beside her room", () => {
    const archetype = archetypeOf("water")!;
    const game = newGame("scenario.prologue", "broke-racks-0");
    playTile(game, archetype);
    setPockets(game, { NGN: 0 });
    const view = atTheClinicStep({ ...game.view(), offers: [] });
    expect(view.job.id).toBeNull();
    const reach: Reach = { here: "place.makoko", home: "place.makoko", stops: [{ id: "place.makoko", position: MAKOKO }, { id: "place.tb-clinic", position: FAR }] };
    const free = nudgeOf(view, undefined, [], false, reach);
    expect(free.key).toBe("ui.nudge.broke.racks");
    expect(free.way?.at[0]).toBe("place.makoko:racks");
  });
});

describe("the free step abroad", () => {
  const PECKHAM = content.place["place.peckham"]!.position!;
  const ROOM_SPOT = content.country["country.uk"]!.homeSpot!;
  /** A stop 28 thousandths of a degree east of Peckham: about 1,930 m at London's 69 m, about 3,100 m at Lagos's 111. */
  const EAST = { latE3: PECKHAM.latE3, lonE3: PECKHAM.lonE3 + 28 };
  /** A stop past any walk in London. */
  const OUT = { latE3: PECKHAM.latE3 + 40, lonE3: PECKHAM.lonE3 };
  const BUS = content.tuning.city.ride.abroad["country.uk"]!.ways.bus!.fare;

  /** Ada landed in London with this many pence and no naira, the chapter's step at the clinic. */
  function inLondon(pence: number): PlayerView {
    return atTheClinicStep({ ...landedGame("country.uk", pence).view(), offers: [] });
  }
  const reachTo = (clinic: { latE3: number; lonE3: number }): Reach => ({
    here: "place.peckham",
    home: "place.the-room",
    stops: [{ id: "place.peckham", position: PECKHAM }, { id: "place.the-room", position: ROOM_SPOT }, { id: "place.tb-clinic", position: clinic }],
  });

  test("[world:nudge-says-one-thing] [place:rides-between-city-places] given Ada in London with pounds and no naira, the step's stop 1.9 km away, when the nudge is read, then the step is named, never the walk home", () => {
    const view = inLondon(1000);
    expect(view.pockets.NGN.cash + view.pockets.NGN.bank).toBe(0);
    expect(freeStep(view, reachTo(EAST))).toBeNull();
    expect(nudgeOf(view, undefined, [], false, reachTo(EAST)).key).not.toMatch(/^ui\.nudge\.broke/);
    // Pounds for the bus pay a ride however far the stop.
    expect(freeStep(inLondon(BUS), reachTo(OUT))).toBeNull();
  });

  test("[world:nudge-says-one-thing] [place:rides-between-city-places] given Ada in London with no pounds, when the nudge is read, then a stop 1.9 km away is on foot by London's own measure, and a stop past walking distance gets the walk home to the room", () => {
    expect(freeStep(inLondon(0), reachTo(EAST))).toBeNull();
    expect(freeStep(inLondon(BUS - 1), reachTo(OUT))).toEqual({ key: "ui.nudge.broke.home", about: "step", way: { go: "place.the-room", at: [] } });
  });

  test("[world:nudge-says-one-thing] [place:country-pass-covers-ways] given Ada in London with no pounds in a month the bus pass is bought, when the nudge is read, then the bus asks nothing and no free step is named", () => {
    const view = inLondon(0);
    const ways = (view.place.ways ?? []).map((way) => (way.way === "bus" ? { ...way, passed: true } : way));
    expect(freeStep({ ...view, place: { ...view.place, ways } }, reachTo(OUT))).toBeNull();
  });
});
