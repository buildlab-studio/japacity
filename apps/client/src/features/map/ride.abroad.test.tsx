// The ride abroad (docs/rules/world.md R-WORLD-039; place.md R-PLACE-010 and R-PLACE-012): the
// ride sheet in London reads the view's ways and prices them with the simulation's own fare, the bus asks nothing in a
// month the pass is bought and says so, and the ride plays in London's red bus and its train.
import { content } from "@japacity/content";
import { type Id, type PlayerView, rideFare } from "@japacity/sim";
import { fireEvent, screen, within } from "@testing-library/react";
import { Vector3 } from "three";
import { describe, expect, test } from "vitest";

import { abroadGame, engineView, setPockets } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf } from "../../shared/words/text";
import type { CountryChoice } from "../../shared/world/contract";
import { Map } from "./Map";
import { mapWords } from "./map.words";
import { fareWords, type MapPin, rideChoices, waysAbroad } from "./pins";
import { alongOf, LINES, lineOf, vehicleFile } from "./Ride";
import { fareTile, WAY_MODEL } from "./RideSheet";
import { anglesOf, buildRide, LONDON_SEAT, PRE_MS, RIDE_MS } from "./rideScene";
import { addLateWords } from "../../shared/words/late";
import { londonText } from "../../shared/words/tables/london.words";

// London's words ride their own chunk in the game (shared/words/late.ts); a test of London adds them as the city does.
addLateWords(londonText);

const UK: CountryChoice = { id: "country.uk", name: "United Kingdom", locked: null };
const PECKHAM = "place.peckham";
const ROOM = "place.the-room";
const HOME_SPOT = { latE3: 51471, lonE3: -73 };
const PASS: Id<"activity"> = "activity.bus-pass-uk";
/** A words key left unsaid, or an en or em dash (docs/rules/text.md), built from their codes so no dash stands in this file. */
const KEY_OR_DASH = new RegExp(`map\\.ride|[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

function positionOf(id: string): { latE3: number; lonE3: number } {
  const position = content.place[id as Id<"place">]?.position;
  if (position === null || position === undefined) throw new Error(`${id} has no position.`);
  return position;
}

/** Ada landed in London with pounds in hand, and, when asked, this month's bus pass bought. */
function londonView(pass = false): PlayerView {
  const game = abroadGame();
  setPockets(game, { GBP: 30_000 });
  if (pass) game.accept({ type: "activity/now", activity: PASS, param: null });
  return game.view();
}

/** The ways from Peckham to a place, as the sheet reads them from the view. */
function from(view: PlayerView, to: string) {
  const at = { from: positionOf(PECKHAM), to: to === ROOM ? HOME_SPOT : positionOf(to) };
  return waysAbroad(view.place.ways ?? [], { from: PECKHAM, to }, at, to === ROOM, view.place.fareBp);
}

const pin = (id: string, state: MapPin["state"]): MapPin => ({ id, name: nameOf(id), state, position: id === ROOM ? HOME_SPOT : positionOf(id), things: 2 });

describe("the ways in London", () => {
  test("[R-WORLD-039] [R-PLACE-010] given Ada landed in London, when the ways from Peckham are read, then they are the bus at its flat £1.75, the train by distance (£3.20 to the office) and on foot, priced by the simulation's own fare, all in pounds", () => {
    const view = londonView();
    expect(view.place.ways?.map((way) => [way.way, way.currency])).toEqual([
      ["bus", "GBP"],
      ["train", "GBP"],
      ["walk", "GBP"],
    ]);
    const office = from(view, "place.office-uk");
    expect(office.map((way) => way.id)).toEqual(["bus", "train", "walk"]);
    const [bus, train, walk] = office;
    expect(bus?.fare).toBe(175);
    expect(train?.fare).toBe(320);
    const figures = view.place.ways?.find((way) => way.way === "train");
    if (figures === undefined) throw new Error("No train");
    expect(train?.fare).toBe(rideFare(figures, positionOf(PECKHAM), positionOf("place.office-uk")));
    // The bus is one fare however far: the big shop next door costs what the office does.
    expect(from(view, "place.big-shop-uk")[0]?.fare).toBe(175);
    expect(walk?.fare).toBe(0);
    expect([bus, train].map((way) => fareWords(way?.fare ?? 0, "GBP"))).toEqual(["£1.75", "£3.20"]);
    expect(bus?.label).toBe(mapWords("map.way.bus"));
    expect(train?.label).toBe(mapWords("map.way.train"));
    // The minutes: the wait plus the metres at the way's pace, the train quicker than the bus.
    expect(train?.minutes).toBeLessThan(bus?.minutes ?? 0);
  });

  test("[R-WORLD-039] [R-PLACE-010] given the walking limit, when a walk from Peckham is read, then Rye Lane and the ward are within reach, the office and the test centre are too far, and the room, the home there, is always walkable", () => {
    const view = londonView();
    const walkTo = (to: string) => from(view, to).find((way) => way.id === "walk");
    expect(walkTo("place.rye-lane")?.shut).toBeUndefined();
    expect(walkTo("place.ward-uk")?.shut).toBeUndefined();
    expect(walkTo("place.office-uk")?.shut).toBe("far");
    expect(walkTo("place.test-centre-uk")?.shut).toBe("far");
    expect(walkTo(ROOM)?.shut).toBeUndefined();
    // The room has no address of its own; a pin standing at another country's spot never times a ride in thousands of minutes.
    const lagosSpot = { latE3: 6507, lonE3: 3359 };
    const home = waysAbroad(view.place.ways ?? [], { from: ROOM, to: PECKHAM }, { from: lagosSpot, to: positionOf(PECKHAM) }, false, view.place.fareBp);
    expect(Math.max(...home.map((way) => way.minutes))).toBeLessThan(60);
  });

  test("[R-PLACE-012] [R-WORLD-039] given the bus pass bought this month, when the ways are read, then the bus asks nothing and its pill says £0, bus pass, while the train still asks its fare", () => {
    const view = londonView(true);
    const [bus, train] = from(view, "place.office-uk");
    expect(bus).toMatchObject({ id: "bus", fare: 0, passed: true });
    expect(train?.fare).toBe(320);
    expect(train?.passed).toBeUndefined();
    const pounds = (amount: number) => formatMoney(amount, "GBP");
    expect(fareTile(bus as NonNullable<typeof bus>, pounds)).toBe("£0, bus pass");
    expect(fareTile(train as NonNullable<typeof train>, pounds, (amount) => fareWords(amount, "GBP"))).toBe("£3.20");
    // Without the pass the bus's tile says its fare.
    const [unpassed] = from(londonView(), "place.office-uk");
    expect(fareTile(unpassed as NonNullable<typeof unpassed>, pounds, (amount) => fareWords(amount, "GBP"))).toBe("£1.75");
  });

  test("[R-WORLD-017] [R-PLACE-010] given a life at home, when the view's ways are priced by the simulation's fare, then each is the fare the sheet has always said, to the kobo", () => {
    const view = engineView();
    const at = { from: positionOf("place.ojuelegba"), to: positionOf("place.bode-thomas") };
    const sheet = rideChoices(at.from, at.to, null, view.place.fareBp, false, { from: "place.ojuelegba", to: "place.bode-thomas" });
    for (const way of view.place.ways ?? []) {
      const said = sheet.find((choice) => choice.id === way.way);
      expect(said?.fare).toBe(rideFare(way, at.from, at.to, view.place.fareBp));
    }
    expect(sheet.map((way) => way.id)).toEqual(["danfo", "keke", "okada", "walk"]);
  });
});

describe("the ride sheet in London", () => {
  test("[R-WORLD-039] [R-PLACE-012] given Ada in London in a pass month, when she picks the office on the map, then the sheet offers the bus at £0, bus pass, the train at £3.20 and the walk too far, the money held in pounds, and Go says the bus", async () => {
    const view = londonView(true);
    const pins = [pin(PECKHAM, "here"), pin("place.office-uk", "can"), pin(ROOM, "home")];
    await renderWithView(<Map pins={pins} country={UK} countries={[UK]} drawing={false} home={ROOM} onGo={() => undefined} onClose={() => undefined} />, view);
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.office-uk") as HTMLElement);
    const sheet = screen.getByRole("dialog");
    const radios = within(sheet).getAllByRole("radio");
    expect(radios.map((radio) => radio.dataset.way)).toEqual(["bus", "train", "walk"]);
    const tile = (way: string) => radios.find((radio) => radio.dataset.way === way) as HTMLButtonElement;
    expect(tile("bus").querySelector("[data-way-fare]")?.textContent).toBe("£0, bus pass");
    expect(tile("train").querySelector("[data-way-fare]")?.textContent).toBe("£3.20");
    expect(tile("walk").disabled).toBe(true);
    expect(tile("bus").getAttribute("aria-checked")).toBe("true");
    expect(sheet.querySelector("[data-ride-main]")?.textContent).toBe(mapWords("map.go", { way: mapWords("map.way.bus").toLowerCase() }));
    // The train's fare comes off the pounds held, struck before and shown after.
    fireEvent.click(tile("train"));
    const held = view.pockets.GBP.cash + view.pockets.GBP.bank;
    expect(sheet.textContent).toContain(formatMoney(held, "GBP"));
    expect(sheet.textContent).toContain(formatMoney(held - 320, "GBP"));
    expect(sheet.querySelector("[data-ride-main]")?.textContent).toContain("£3.20");
  });

  test("[R-WORLD-039] [R-PLACE-010] given a London way chosen, when Go is pressed, then the city is asked for the ride with that way, and the ride plays in that vehicle with its fare as a pill", async () => {
    const view = londonView();
    const pins = [pin(PECKHAM, "here"), pin("place.office-uk", "can"), pin(ROOM, "home")];
    const asked: string[] = [];
    await renderWithView(
      <Map pins={pins} country={UK} countries={[UK]} drawing={false} home={ROOM} onGo={() => undefined} onClose={() => undefined} onRide={(choice) => {
        asked.push(choice.id);
        return true;
      }} />,
      view,
    );
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.office-uk") as HTMLElement);
    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(sheet).getAllByRole("radio").find((radio) => radio.dataset.way === "train") as HTMLElement);
    fireEvent.click(sheet.querySelector("[data-ride-main]") as HTMLElement);
    expect(asked).toEqual(["train"]);
    expect(document.querySelector("[data-ride='train']")).not.toBeNull();
    expect(document.querySelector("[data-ride-fare]")?.textContent).toBe("£3.20");
    expect(document.querySelector("[data-ride-title]")?.textContent).toContain(mapWords("map.way.train"));
  });
});

describe("the ride in London", () => {
  test("[R-WORLD-039] [R-WORLD-032] given the bus and the train, when their cuts are read, then each cuts as the danfo does: the stop, above, the window and the seat, on the ride's own clock", () => {
    for (const way of ["bus", "train"] as const) {
      expect(anglesOf(way)).toEqual(anglesOf("danfo"));
      expect(anglesOf(way).at(-1)?.from).toBeLessThan(RIDE_MS);
    }
    expect(vehicleFile("bus")).toBe("shared/veh/veh_london-bus.glb");
    expect(vehicleFile("train")).toBe("shared/veh/veh_train-carriage.glb");
    expect([WAY_MODEL.bus, WAY_MODEL.train]).toEqual(["veh_london-bus", "veh_train-carriage"]);
  });

  test("[R-WORLD-039] given London's red bus, when its window is shown, then the bus keeps the left lane and the top deck's window looks out of its kerb side, the side its doors are on, at the pavement and the shops", () => {
    const ride = buildRide("bus");
    const windowAt = anglesOf("bus").find((part) => part.angle === "window")?.from ?? 0;
    ride.frame(windowAt + 10, 0.46);
    // The kerb is on -x of the road's middle for a bus on the left, and the vehicle keeps that side.
    expect(ride.vehicle.position.x).toBeLessThan(0);
    const looking = ride.camera.getWorldDirection(new Vector3());
    expect(looking.x).toBeLessThan(-0.5);
    // The camera sits at the top deck's eye, high over the street.
    expect(ride.camera.position.y).toBeGreaterThan(3.3);
    ride.dispose();
  });

  test("[R-WORLD-039] given the train, when its window is shown, then the eye sits at x 0.55 in the carriage, in from the window so its posts frame the view, and looks out of the window", () => {
    expect(LONDON_SEAT.train.eye[0]).toBe(0.55);
    const ride = buildRide("train");
    const windowAt = anglesOf("train").find((part) => part.angle === "window")?.from ?? 0;
    ride.frame(windowAt + 10, 0.46);
    // The carriage turns to face its travel, so its +x side is the world's -x: the eye is 0.55 out from its middle.
    expect(ride.camera.position.x).toBeCloseTo(ride.vehicle.position.x - 0.55, 5);
    expect(Math.abs(ride.camera.getWorldDirection(new Vector3()).x)).toBeGreaterThan(0.5);
    ride.dispose();
  });

  test("[R-WORLD-039] given London's ways, when the pre-roll's lines and the road's are read, then the bus and the train each say six of their own and their own road, plain words with no dash", () => {
    for (const way of ["bus", "train"] as const) {
      const said = Array.from({ length: LINES }, (_, seed) => lineOf(way, seed)).map((key) => mapWords(key ?? ""));
      expect(new Set(said).size).toBe(LINES);
      const road = [0, 1, 2].map((seed) => alongOf(0.5, seed, way).key);
      expect(road.every((key) => key.endsWith(`.${way}`))).toBe(true);
      for (const line of [...said, ...road.map((key) => mapWords(key))]) {
        expect(line).not.toMatch(KEY_OR_DASH);
      }
    }
    expect(alongOf(0.1, 0, "bus").key).toBe("map.ride.along.start");
    expect(PRE_MS).toBeLessThan(RIDE_MS);
  });
});
