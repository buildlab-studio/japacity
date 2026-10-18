// The rides of Calgary, Dubai and Castel Volturno (world:ride-abroad-and-workplace; place:rides-between-city-places,
// place:country-pass-covers-ways and place:employer-shuttle-rides-free; design page 15 sections 4 and 6): the ride sheet lists each country's ways from
// the view, the pass's pill names the country's pass on every way it covers, the shuttle's pill says the employer's bus
// asks nothing, and the ride plays inside the country's own vehicle from the seat the models give, in the right-hand lane.
import { content } from "@japacity/content";
import { uiCalgaryText } from "@japacity/content/ui/calgary";
import { uiCastelText } from "@japacity/content/ui/castel";
import { uiDubaiText } from "@japacity/content/ui/dubai";
import { type Id, type PlayerView, rideFare } from "@japacity/sim";
import { positionOf } from "@japacity/sim/testing";
import { fireEvent, screen, within } from "@testing-library/react";
import { Vector3 } from "three";
import { describe, expect, test } from "vitest";

import { CALGARY_BUS_SEAT } from "../../../../../assets-src/veh/calgary-bus/build";
import { CTRAIN_SEAT } from "../../../../../assets-src/veh/ctrain-car/build";
import { METRO_SEAT } from "../../../../../assets-src/veh/dubai-metro/build";
import { ITALY_BUS_SEAT } from "../../../../../assets-src/veh/italy-bus/build";
import { LABOUR_BUS_SEAT } from "../../../../../assets-src/veh/labour-bus/build";
import { TAXI_SEAT } from "../../../../../assets-src/veh/taxi/build";
import { VAN_SEAT } from "../../../../../assets-src/veh/van/build";
import { landedGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { addLateWords } from "../../shared/words/late";
import { nameOf } from "../../shared/words/text";
import type { CountryChoice } from "../../shared/world/contract";
import { Map } from "./Map";
import { mapWords } from "./map.words";
import { fareWords, type MapPin, waysAbroad } from "./pins";
import { alongOf, LINES, lineOf, ROAD_LINES, vehicleFile } from "./Ride";
import { fareTile } from "./RideSheet";
import { anglesOf, buildRide } from "./rideScene";
import { type AbroadVehicle, SEATS, VEHICLES, vehicleFor, wayModelFor } from "./rideVehicles";

// Each country's words ride their own chunk in the game (shared/words/late.ts); the tests add them as the city does.
for (const table of [uiCalgaryText, uiDubaiText, uiCastelText]) addLateWords(table);

/** A words key left unsaid, or an en or em dash (docs/rules/text.md), built from their codes so no dash stands in this file. */
const KEY_OR_DASH = new RegExp(`map\\.ride|[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
const ROOM = "place.the-room";
const PASSES: Readonly<Record<string, Id<"activity">>> = { "country.canada": "activity.transit-pass-ca", "country.uae": "activity.transit-pass-uae" };

/** A life landed in the country with its money in hand, and, when asked, this month's pass bought. */
function landed(country: Id<"country">, pass = false): PlayerView {
  const game = landedGame(country, 50_000);
  const act = PASSES[country];
  if (pass && act !== undefined) {
    const bought = game.accept({ type: "activity/now", activity: act, param: null });
    if (!bought.ok) throw new Error(`The pass was refused in ${country}.`);
  }
  return game.view();
}

/** The ways between two places of the country, as the sheet reads them from the view. */
function ways(view: PlayerView, fromId: string, to: string) {
  const at = { from: positionOf(content, fromId), to: positionOf(content, to) };
  return waysAbroad(view.place.ways ?? [], { from: fromId, to }, at, to === ROOM, view.place.fareBp, { country: view.place.country, shuttles: view.place.shuttles ?? [] });
}

describe("the ways in Calgary, Dubai and Castel Volturno", () => {
  test("[world:ride-abroad-and-workplace] [place:rides-between-city-places] given a life in Calgary, when the ways from the strip mall to the office downtown are read, then they are the bus and the CTrain at one flat C$3.80, the taxi by distance and on foot too far, priced by the simulation's own fare, the train named the CTrain", () => {
    const view = landed("country.canada");
    const office = ways(view, "place.calgary-north-east", "place.office-ca");
    expect(office.map((way) => [way.id, way.label])).toEqual([
      ["bus", "Bus"],
      ["train", "CTrain"],
      ["taxi", "Taxi"],
      ["walk", "Walk"],
    ]);
    const [bus, train, taxi, walk] = office;
    expect([bus?.fare, train?.fare]).toEqual([380, 380]);
    const figures = view.place.ways?.find((way) => way.way === "taxi");
    if (figures === undefined) throw new Error("No taxi");
    expect(taxi?.fare).toBe(rideFare(figures, positionOf(content, "place.calgary-north-east"), positionOf(content, "place.office-ca")));
    expect(walk?.shut).toBe("far");
    expect(fareWords(bus?.fare ?? 0, "CAD")).toBe(fareWords(380, "CAD"));
    expect([bus, train, taxi].some((way) => way?.pill !== undefined)).toBe(false);
  });

  test("[place:country-pass-covers-ways] [world:ride-abroad-and-workplace] given Calgary's transit pass and Dubai's zone pass bought this month, when the ways are read, then the bus and the train ask nothing and each pill names the country's pass, while the taxi still asks its fare", () => {
    const cases: [Id<"country">, string, string, string][] = [
      ["country.canada", "place.calgary-north-east", "place.office-ca", "transit pass"],
      ["country.uae", "place.deira", "place.big-shop-uae", "zone pass"],
    ];
    for (const [country, fromId, to, pass] of cases) {
      const view = landed(country, true);
      const sheet = ways(view, fromId, to);
      const currency = view.place.ways?.[0]?.currency ?? "NGN";
      for (const id of ["bus", "train"] as const) {
        const way = sheet.find((choice) => choice.id === id);
        expect([country, id, way?.fare, way?.passed, way?.pill]).toEqual([country, id, 0, true, `${formatMoney(0, currency)}, ${pass}`]);
        expect(fareTile(way as NonNullable<typeof way>, (amount) => formatMoney(amount, currency))).toBe(`${formatMoney(0, currency)}, ${pass}`);
      }
      const taxi = sheet.find((choice) => choice.id === "taxi");
      expect([country, taxi?.passed, (taxi?.fare ?? 0) > 0]).toEqual([country, undefined, true]);
    }
  });

  test("[place:employer-shuttle-rides-free] [world:ride-abroad-and-workplace] given the site in Dubai and the fields in Castel Volturno, when the bus to or from them is read in a month with no pass, then it asks nothing and its pill says the site bus or the van, every other way to them is priced, and no other stop is freed", () => {
    const uae = landed("country.uae");
    for (const [fromId, to] of [["place.deira", "place.site-uae"], ["place.site-uae", "place.deira"]] as const) {
      const sheet = ways(uae, fromId, to);
      const bus = sheet.find((way) => way.id === "bus");
      expect([fromId, bus?.fare, bus?.shuttle, bus?.pill]).toEqual([fromId, 0, true, `${formatMoney(0, "AED")}, site bus`]);
      expect(sheet.filter((way) => way.id === "train" || way.id === "taxi").every((way) => way.fare > 0)).toBe(true);
    }
    expect(ways(uae, "place.deira", "place.big-shop-uae").find((way) => way.id === "bus")?.shuttle).toBeUndefined();
    const italy = landed("country.italy");
    const van = ways(italy, "place.castel-volturno", "place.farm-it");
    expect(van.map((way) => way.id)).toEqual(["bus", "walk"]);
    expect(van[0]).toMatchObject({ fare: 0, shuttle: true, pill: `${formatMoney(0, "EUR")}, the van` });
    // The coast road's bus elsewhere asks its flat fare, Naples airport too, and Italy has no pass.
    expect(ways(italy, "place.castel-volturno", "place.via-domitiana")[0]?.fare).toBe(160);
    expect(ways(italy, "place.castel-volturno", "place.naples-airport")[0]?.fare).toBe(160);
    expect(PASSES["country.italy"]).toBeUndefined();
  });
});

describe("the country's own vehicle", () => {
  test("[world:ride-abroad-and-workplace] given each country's ways, when the vehicle a ride plays in is read, then Calgary rides its bus, the CTrain car and the taxi, Dubai its city bus, the metro car, the taxi and the labour bus on the shuttle, Castel Volturno its coast bus and the van on the shuttle, and Lagos and London keep their own", () => {
    expect(["bus", "train", "taxi"].map((way) => vehicleFor("country.canada", way as "bus", false))).toEqual(["calgary-bus", "ctrain", "canada-taxi"]);
    expect(["bus", "train", "taxi"].map((way) => vehicleFor("country.uae", way as "bus", false))).toEqual(["dubai-bus", "dubai-metro", "dubai-taxi"]);
    expect(vehicleFor("country.uae", "bus", true)).toBe("labour-bus");
    expect(vehicleFor("country.italy", "bus", false)).toBe("italy-bus");
    expect(vehicleFor("country.italy", "bus", true)).toBe("van");
    expect(vehicleFor("country.uk", "bus", false)).toBeNull();
    expect(vehicleFor(null, "danfo", false)).toBeNull();
    expect(vehicleFor("country.canada", "walk", false)).toBeNull();
    expect(wayModelFor("country.uae", "train", false)).toBe("veh_dubai-metro");
    expect(wayModelFor("country.italy", "bus", true)).toBe("veh_van");
    expect(vehicleFile("bus", "labour-bus")).toBe("places/deira/veh_labour-bus.glb");
    expect(vehicleFile("train", "ctrain")).toBe("shared/veh/veh_ctrain-car.glb");
    expect(vehicleFile("bus")).toBe("shared/veh/veh_london-bus.glb");
  });

  test("[world:ride-abroad-and-workplace] given the seats exported with the models, when the ride's copies are read, then each is the same eye, window and ahead", () => {
    expect(SEATS).toEqual({ CALGARY_BUS_SEAT, CTRAIN_SEAT, METRO_SEAT, LABOUR_BUS_SEAT, TAXI_SEAT, ITALY_BUS_SEAT, VAN_SEAT });
  });

  test.each(Object.keys(VEHICLES) as AbroadVehicle[])("[world:ride-abroad-and-workplace] [world:ride-cuts-between-angles] given the %s, when its window and its seat are shown, then it keeps the right-hand lane (or the rails' middle), the camera sits at the seat's eye, the window looks out of the kerb side, and the character's figure is not drawn around the camera", (kind) => {
    const spec = VEHICLES[kind];
    const way = spec.rail ? "train" : kind.endsWith("taxi") ? "taxi" : "bus";
    expect(anglesOf(way)).toEqual(anglesOf("danfo"));
    const ride = buildRide(way, undefined, kind);
    // On rails the car keeps the middle; on the road the right-hand lane, the world's +x.
    expect(spec.rail ? ride.vehicle.position.x === 0 : ride.vehicle.position.x > 0).toBe(true);
    const windowAt = anglesOf(way).find((part) => part.angle === "window")?.from ?? 0;
    ride.frame(windowAt + 10, 0.46);
    // The body turns to face its travel, so the seat's -x side, the kerb's, is the world's +x.
    expect(ride.camera.position.x).toBeCloseTo(ride.vehicle.position.x - spec.seat.eye[0], 5);
    expect(ride.camera.getWorldDirection(new Vector3()).x).toBeGreaterThan(0.5);
    expect(ride.seats.every((seat) => !seat.group.visible)).toBe(true);
    const seatAt = anglesOf(way).find((part) => part.angle === "seat")?.from ?? 0;
    ride.frame(seatAt + 10, 0.46);
    // From the seat the camera looks ahead along the travel, the world's -z.
    expect(ride.camera.getWorldDirection(new Vector3()).z).toBeLessThan(-0.5);
    ride.frame(100, 0.46);
    expect(ride.seats.every((seat) => seat.group.visible)).toBe(true);
    ride.dispose();
  });

  test.each(Object.keys(VEHICLES) as AbroadVehicle[])("[world:ride-abroad-and-workplace] given the %s, when its pre-roll's lines and its road's are read, then it says six of its own and three of its own road, plain words with no dash", (kind) => {
    const way = VEHICLES[kind].rail ? "train" : "bus";
    const said = Array.from({ length: LINES }, (_, seed) => lineOf(way, seed, kind)).map((key) => mapWords(key ?? ""));
    expect(new Set(said).size).toBe(LINES);
    const road = Array.from({ length: ROAD_LINES }, (_, seed) => alongOf(0.5, seed, way, kind).key);
    expect(new Set(road).size).toBe(ROAD_LINES);
    expect(road.every((key) => key.endsWith(`.${kind}`))).toBe(true);
    for (const line of [...said, ...road.map((key) => mapWords(key))]) expect(line).not.toMatch(KEY_OR_DASH);
  });
});

describe("the ride sheet and the ride abroad", () => {
  const pin = (id: string, state: MapPin["state"]): MapPin => ({ id, name: nameOf(id), state, position: positionOf(content, id), things: 2 });

  test("[world:ride-abroad-and-workplace] [place:employer-shuttle-rides-free] given a life in Dubai at Deira, when it picks the site and goes by bus, then the sheet's bus tile shows the labour bus at AED 0, site bus, and the ride plays in the labour bus with that pill under the site bus's title", async () => {
    const view = landed("country.uae");
    const UAE: CountryChoice = { id: "country.uae", name: "United Arab Emirates", locked: null };
    const pins = [pin("place.deira", "here"), pin("place.site-uae", "can")];
    const asked: string[] = [];
    await renderWithView(
      <Map pins={pins} country={UAE} countries={[UAE]} drawing={false} onGo={() => undefined} onClose={() => undefined} onRide={(choice) => {
        asked.push(choice.id);
        return true;
      }} />,
      view,
    );
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.site-uae") as HTMLElement);
    const sheet = screen.getByRole("dialog");
    const radios = within(sheet).getAllByRole("radio");
    expect(radios.map((radio) => radio.dataset.way)).toEqual(["bus", "train", "taxi", "walk"]);
    const bus = radios.find((radio) => radio.dataset.way === "bus") as HTMLButtonElement;
    expect(bus.querySelector("[data-way-fare]")?.textContent).toBe(`${formatMoney(0, "AED")}, site bus`);
    fireEvent.click(bus);
    fireEvent.click(sheet.querySelector("[data-ride-main]") as HTMLElement);
    expect(asked).toEqual(["bus"]);
    expect(document.querySelector("[data-ride-vehicle='labour-bus']")).not.toBeNull();
    expect(document.querySelector("[data-ride-fare]")?.textContent).toBe(`${formatMoney(0, "AED")}, site bus`);
    expect(document.querySelector("[data-ride-title]")?.textContent).toContain("Site bus");
  });

  test("[world:ride-abroad-and-workplace] [place:rides-between-city-places] given a life in Calgary at the strip mall, when it takes the CTrain downtown, then the ride plays in the CTrain car, its fare a pill in dollars and its title the CTrain's", async () => {
    const view = landed("country.canada");
    const CANADA: CountryChoice = { id: "country.canada", name: "Canada", locked: null };
    const pins = [pin("place.calgary-north-east", "here"), pin("place.office-ca", "can")];
    await renderWithView(<Map pins={pins} country={CANADA} countries={[CANADA]} drawing={false} onGo={() => undefined} onClose={() => undefined} onRide={() => true} />, view);
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.office-ca") as HTMLElement);
    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(sheet).getAllByRole("radio").find((radio) => radio.dataset.way === "train") as HTMLElement);
    fireEvent.click(sheet.querySelector("[data-ride-main]") as HTMLElement);
    expect(document.querySelector("[data-ride-vehicle='ctrain']")).not.toBeNull();
    expect(document.querySelector("[data-ride-fare]")?.textContent).toBe(fareWords(380, "CAD"));
    expect(document.querySelector("[data-ride-title]")?.textContent).toContain("CTrain");
  });
});
