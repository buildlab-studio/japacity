// The car of your own on the map (place:rides-between-city-places, world:ride-sheet-shows-fares): while the life's car stands
// at home the ride sheet offers Drive, its fuel the fare by distance as the simulation takes it, dearer than the danfo and
// cheaper than the okada, with no wait at a stop; the button says Drive there; the ride is in the car, alone at the wheel.
import { content } from "@japacity/content";
import { rideFare } from "@japacity/sim";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { mapWords } from "./map.words";
import { type MapPin, rideChoices } from "./pins";
import { lineOf, LINES, vehicleFile } from "./Ride";
import { RideSheet, WAY_MODEL } from "./RideSheet";
import { anglesOf, buildRide, figuresOn, peopleOf, PRE_MS } from "./rideScene";

const FROM = "place.ojuelegba";
const TO = "place.yaba";
const at = (id: string) => content.place[id as keyof typeof content.place]!.position!;

describe("Drive on the ride sheet (world:ride-sheet-shows-fares)", () => {
  test("[place:rides-between-city-places] [world:ride-sheet-shows-fares] given no car at home, when the ways are read, then Drive is not among them; with the car, Drive comes first at the simulation's own fuel fare, between the danfo's and the okada's, with no wait", () => {
    const plain = rideChoices(at(FROM), at(TO), null, 10000, false, { from: FROM, to: TO });
    expect(plain.map((way) => way.id)).toEqual(["danfo", "keke", "okada", "walk"]);
    const ways = rideChoices(at(FROM), at(TO), null, 10000, false, { from: FROM, to: TO }, true);
    expect(ways.map((way) => way.id)).toEqual(["drive", "danfo", "keke", "okada", "walk"]);
    const drive = ways[0]!;
    expect(drive.label).toBe(mapWords("map.way.drive"));
    expect(drive.fare).toBe(rideFare(content, at(FROM), at(TO), "drive"));
    expect(drive.fare).toBeGreaterThan(ways.find((way) => way.id === "danfo")!.fare);
    expect(drive.fare).toBeLessThan(ways.find((way) => way.id === "okada")!.fare);
    expect(drive.minutes).toBeLessThan(ways.find((way) => way.id === "danfo")!.minutes);
    // The month's factor (the fuel scarcity) raises the drive as it raises the rides.
    expect(rideChoices(at(FROM), at(TO), null, 20000, false, { from: FROM, to: TO }, true)[0]!.fare).toBe(rideFare(content, at(FROM), at(TO), "drive", 20000));
  });

  test("[world:ride-sheet-shows-fares] given Drive picked on the sheet, when it is read, then its tile is the car, the button says Drive there with the fare, the balance before and after shows, and the route hears the way picked", () => {
    const pin: MapPin = { id: TO, name: "Yaba", state: "can", position: at(TO), things: 2 };
    const ways = rideChoices(at(FROM), at(TO), null, 10000, false, { from: FROM, to: TO }, true);
    const heard: string[] = [];
    const chosen: string[] = [];
    render(<RideSheet pin={pin} home={false} ways={ways} have={100_000_00} formatMoney={(amount) => formatMoney(amount, "NGN")} onChoose={(way) => chosen.push(way.id)} onClose={() => undefined} onWay={(way) => heard.push(way)} />);
    expect(WAY_MODEL.drive).toBe("vehicle_car");
    expect(document.querySelector('[data-way="drive"]')?.getAttribute("aria-checked")).toBe("true");
    const main = document.querySelector<HTMLButtonElement>("[data-ride-main]")!;
    expect(main.textContent).toContain(mapWords("map.drive"));
    expect(main.textContent).toContain(formatMoney(ways[0]!.fare, "NGN"));
    expect(document.querySelector("[data-balance-after]")?.getAttribute("data-balance-after")).toBe(String(100_000_00 - ways[0]!.fare));
    expect(heard).toEqual(["drive"]);
    fireEvent.click(document.querySelector<HTMLElement>('[data-way="danfo"]')!);
    expect(heard).toEqual(["drive", "danfo"]);
    fireEvent.click(document.querySelector<HTMLElement>('[data-way="drive"]')!);
    fireEvent.click(document.querySelector<HTMLElement>("[data-ride-main]")!);
    expect(chosen).toEqual(["drive"]);
  });

  test("[world:ride-cuts-between-angles] given a drive, when the ride is built, then it is the car, you alone at the wheel, seen at the kerb then from above, and the boy who parks you out has his own lines", () => {
    expect(vehicleFile("drive")).toBe("shared/vehicle/vehicle_car.glb");
    expect(vehicleFile("danfo")).toBe("shared/vehicle/vehicle_danfo.glb");
    expect(peopleOf("drive", "shared/person/person_ada.glb")).toEqual({ own: "shared/person/person_ada.glb" });
    expect(anglesOf("drive")).toEqual([
      { angle: "outside", from: 0 },
      { angle: "above", from: PRE_MS },
    ]);
    // In the car the glass is dark: no figure is drawn on it, from the kerb or from above.
    expect(figuresOn(buildRide("drive"))).toEqual([]);
    for (let seed = 0; seed < LINES; seed++) expect(mapWords(lineOf("drive", seed)!)).not.toBe(lineOf("drive", seed));
  });
});
