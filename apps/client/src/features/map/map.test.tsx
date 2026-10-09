import { readdirSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say } from "../../shared/words/text";
import type { CountryChoice, RideChoice } from "../../shared/world/contract";
import { Countries } from "./Countries";
import { buildGrid, isWater, nearestNode, nodePoint, routeBetween, toXZ, type XZ } from "./layout";
import { Map } from "./Map";
import { mapWords } from "./map.words";
import { mapPins, type MapPin, rideChoices } from "./pins";
import { Ride, RIDE_MS } from "./Ride";
import { headingOf } from "./RideSheet";
import { buildCityMap, drawCallsOf, readColours } from "./scene";

afterEach(() => {
  vi.useRealTimers();
});

const PUBLIC = join(import.meta.dirname, "..", "..", "..", "public", "assets", "places");
/** The places with a published model, as the manifest tells the city. */
const BUILT = new Set(
  readdirSync(PUBLIC)
    .map((folder) => Object.values(content.place).find((place) => place.assets === folder)?.id)
    .filter((id): id is NonNullable<typeof id> => id !== undefined),
);
const HOME = "place.family-house";
const HOME_SPOT = { latE3: 6507, lonE3: 3359 };

/** The pins for a life at home standing at the hub, with the kept list given. */
function lagosPins(been: readonly string[] = [], open?: ReadonlySet<string>): MapPin[] {
  const view = engineView();
  const places = Object.values(content.place).filter((place) => place.where === view.place.where);
  return mapPins({ places, here: "place.ojuelegba", home: HOME, homeSpot: HOME_SPOT, been, built: BUILT, name: nameOf, ...(open === undefined ? {} : { open }) });
}

const LAGOS: CountryChoice = { id: "lagos", name: "Lagos", locked: null };
const COUNTRIES: CountryChoice[] = [LAGOS, { id: "country.uk", name: "United Kingdom", locked: "No visa yet" }];

function drawn(pins: readonly MapPin[]) {
  return buildCityMap(pins, { colours: readColours(null), home: HOME, districts: [], boardText: (pin) => pin.name, districtText: (area) => area, canvas: null });
}

describe("the city as the map", () => {
  test("[R-WORLD-015] given every built place of Lagos, when the city is drawn, then it costs at most 20 draw calls, lit route and all, with the buildings instanced", () => {
    const pins = lagosPins();
    const map = drawn(pins);
    expect(drawCallsOf(map.scene)).toBeLessThanOrEqual(20);
    const here = map.stops.find((stop) => stop.pin.state === "here");
    const there = map.stops.find((stop) => stop.pin.id === "place.computer-village");
    if (here === undefined || there === undefined) throw new Error("No stops to route between");
    map.setRoute(routeBetween(map.grid, here.at, there.at));
    map.tick(1);
    expect(drawCallsOf(map.scene)).toBeLessThanOrEqual(20);
    // Hundreds of buildings, a handful of meshes.
    let copies = 0;
    map.scene.traverse((object) => {
      if (object.name.startsWith("buildings-")) copies += (object as unknown as { count: number }).count;
    });
    expect(copies).toBeGreaterThan(500);
    map.dispose();
  });

  test("[R-WORLD-015] given the view at home, the kept list and the built places, when the pins are read, then only built places stand, each here, home, been, can go or not yet", () => {
    const pins = lagosPins(["place.bode-thomas"], new Set([...BUILT].filter((id) => id !== "place.airport-lagos")));
    const state = (id: string): string | undefined => pins.find((pin) => pin.id === id)?.state;
    expect(state("place.ojuelegba")).toBe("here");
    expect(state(HOME)).toBe("home");
    expect(state("place.bode-thomas")).toBe("been");
    expect(state("place.tejuosho-market")).toBe("can");
    expect(state("place.airport-lagos")).toBe("not");
    // Unbuilt places are not on the map (Costain has no scene yet), and nothing from abroad is.
    expect(state("place.costain")).toBeUndefined();
    expect(state("place.peckham")).toBeUndefined();
    expect(pins.every((pin) => pin.id === HOME || BUILT.has(pin.id as never))).toBe(true);
    // The home has no position of its own; it stands where the city puts it.
    expect(pins.find((pin) => pin.id === HOME)?.position).toEqual(HOME_SPOT);
  });

  test("[R-WORLD-015] given the pins, when the map opens where nothing draws, then each stop shows its state and the home shows as home", async () => {
    await renderWithView(<Map pins={lagosPins(["place.bode-thomas"])} country={LAGOS} countries={COUNTRIES} drawing={false} onGo={() => undefined} onClose={() => undefined} />, engineView());
    const stops = within(screen.getByRole("list", { name: mapWords("map.stops") }));
    const stop = (id: string): HTMLElement => {
      const found = stops.getAllByRole("button").find((button) => button.dataset.stop === id);
      if (found === undefined) throw new Error(`No stop ${id}`);
      return found;
    };
    expect(stop("place.ojuelegba").dataset.state).toBe("here");
    expect(stop("place.bode-thomas").dataset.state).toBe("been");
    expect(stop("place.tejuosho-market").dataset.state).toBe("can");
    expect(stop(HOME).dataset.home).toBe("true");
    expect(stop(HOME).textContent).toContain(mapWords("map.state.home"));
  });

  test("[R-WORLD-015] given the city drawn, when the home is drawn, then it is a small house, and the player's place carries the ring", () => {
    const map = drawn(lagosPins());
    const house = map.scene.getObjectByName("home");
    const ring = map.scene.getObjectByName("here");
    const home = map.stops.find((stop) => stop.pin.id === HOME);
    const here = map.stops.find((stop) => stop.pin.state === "here");
    expect(house?.visible).toBe(true);
    expect(Math.hypot((house?.position.x ?? 0) - (home?.at[0] ?? 99), (house?.position.z ?? 0) - (home?.at[1] ?? 99))).toBeLessThan(4);
    expect(ring?.visible).toBe(true);
    expect([ring?.position.x, ring?.position.z]).toEqual([here?.at[0], here?.at[1]]);
    // The ring breathes.
    map.tick(0);
    const small = ring?.scale.x ?? 0;
    map.tick(0.6);
    expect(ring?.scale.x).not.toBe(small);
    map.dispose();
  });

  test("[R-WORLD-015] given a stop picked, when the route is found, then it runs along the roads from the player's stop to the stop picked", () => {
    const grid = buildGrid();
    const pins = lagosPins();
    const at = (id: string): XZ => toXZ(pins.find((pin) => pin.id === id)?.position ?? { latE3: 0, lonE3: 0 });
    for (const target of ["place.computer-village", "place.third-mainland-bridge", "place.bode-thomas"]) {
      const route = routeBetween(grid, at("place.ojuelegba"), at(target));
      expect(route[0]).toEqual(at("place.ojuelegba"));
      expect(route[route.length - 1]).toEqual(at(target));
      // Between the two stubs every leg runs along one road of the grid, joined node to node.
      const legs = route.slice(1, -1);
      expect(legs[0]).toEqual(nodePoint(nearestNode(grid, at("place.ojuelegba"))));
      expect(legs[legs.length - 1]).toEqual(nodePoint(nearestNode(grid, at(target))));
      for (let index = 1; index < legs.length; index += 1) {
        const [ax, az] = legs[index - 1] ?? [0, 0];
        const [bx, bz] = legs[index] ?? [0, 0];
        expect(ax === bx || az === bz).toBe(true);
      }
    }
    // The route to Computer Village never crosses open water.
    const north = routeBetween(grid, at("place.ojuelegba"), at("place.computer-village")).slice(1, -1);
    for (let index = 1; index < north.length; index += 1) {
      const [ax, az] = north[index - 1] ?? [0, 0];
      const [bx, bz] = north[index] ?? [0, 0];
      expect(isWater((ax + bx) / 2, (az + bz) / 2)).toBe(false);
    }
  });

  test("[R-WORLD-015] given a route lit, when the map moves on, then its dots run along it from the player's stop, and putting it out hides them", () => {
    const map = drawn(lagosPins());
    const here = map.stops.find((stop) => stop.pin.state === "here");
    const there = map.stops.find((stop) => stop.pin.id === "place.national-stadium");
    if (here === undefined || there === undefined) throw new Error("No stops to route between");
    const dots = map.scene.getObjectByName("route") as unknown as { visible: boolean; count: number; getMatrixAt: (index: number, matrix: import("three").Matrix4) => void };
    expect(dots.visible).toBe(false);
    map.setRoute(routeBetween(map.grid, here.at, there.at));
    map.tick(0);
    expect(dots.visible).toBe(true);
    expect(dots.count).toBeGreaterThan(2);
    map.setRoute(null);
    expect(dots.visible).toBe(false);
    map.dispose();
  });
});

describe("one country at a time", () => {
  test("[R-WORLD-016] given a locked country in the dropdown, when it is tapped, then it shakes and stays shut, and the country shown stays the button", () => {
    const onCountry = vi.fn();
    render(<Countries country={LAGOS} countries={COUNTRIES} onCountry={onCountry} />);
    const button = screen.getByRole("button", { name: /Lagos/ });
    fireEvent.click(button);
    const list = screen.getByRole("listbox", { name: mapWords("map.country") });
    const locked = within(list).getByRole("button", { name: /United Kingdom/ });
    expect(locked.textContent).toContain("No visa yet");
    fireEvent.click(locked);
    expect(onCountry).not.toHaveBeenCalled();
    expect(locked.dataset.shake).toBe("true");
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(button.textContent).toContain("Lagos");
    expect(button.dataset.country).toBe("lagos");
  });
});

describe("the ride", () => {
  test("[R-WORLD-017] given two places, when the ways are priced, then there are a danfo, a keke and an okada, each with a fare in fifties of naira and minutes, the okada quickest", () => {
    const from = { latE3: 6511, lonE3: 3362 };
    const to = { latE3: 6594, lonE3: 3340 };
    const ways = rideChoices(from, to);
    expect(ways.map((way) => way.id)).toEqual(["danfo", "keke", "okada"]);
    for (const way of ways) {
      expect(way.fare % 5000).toBe(0);
      expect(way.fare).toBeGreaterThan(0);
      expect(way.minutes).toBeGreaterThan(0);
    }
    const [danfo, keke, okada] = ways as [RideChoice, RideChoice, RideChoice];
    expect(danfo.fare).toBeLessThan(keke.fare);
    expect(keke.fare).toBeLessThan(okada.fare);
    expect(okada.minutes).toBeLessThan(danfo.minutes);
  });

  test("[R-WORLD-017] given a country abroad, when the ways are priced, then there is one way named for the country at no fare, and the sheet says so", async () => {
    const ways = rideChoices({ latE3: 51473, lonE3: -70 }, { latE3: 51480, lonE3: -60 }, "country.uk");
    expect(ways).toHaveLength(1);
    expect(ways[0]).toMatchObject({ label: mapWords("map.way.abroad.country.uk"), fare: 0 });
    expect(ways[0]?.minutes).toBeGreaterThan(0);
    const uk: CountryChoice = { id: "country.uk", name: "United Kingdom", locked: null };
    const pins = [
      { id: "place.the-room", name: "The room", state: "here" as const, position: { latE3: 51473, lonE3: -70 }, things: 1 },
      { id: "place.peckham", name: "Peckham", state: "can" as const, position: { latE3: 51480, lonE3: -60 }, things: 4 },
    ];
    await renderWithView(<Map pins={pins} country={uk} countries={[uk]} drawing={false} onGo={() => undefined} onClose={() => undefined} />, engineView());
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.peckham") as HTMLElement);
    const sheet = screen.getByRole("dialog", { name: headingOf("Peckham") });
    expect(within(sheet).getAllByRole("radio")).toHaveLength(1);
    expect(within(sheet).getByText(say("ui.world.free"))).toBeTruthy();
    expect((sheet.querySelector("[data-ride-main]") as HTMLButtonElement).disabled).toBe(false);
    expect(sheet.querySelector("[data-ride-main]")?.textContent).not.toContain(say("ui.world.left", { amount: "" }).trim());
  });

  test("[R-WORLD-017] given a stop picked, when the ride sheet shows, then it names the place, gives each way's fare and minutes, and the main button says what is left after", async () => {
    const view = engineView();
    const pins = lagosPins();
    const onRide = vi.fn();
    await renderWithView(<Map pins={pins} country={LAGOS} countries={COUNTRIES} drawing={false} onGo={() => undefined} onClose={() => undefined} onRide={onRide} />, view);
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.bode-thomas") as HTMLElement);
    const sheet = screen.getByRole("dialog", { name: headingOf(nameOf("place.bode-thomas")) });
    const here = pins.find((pin) => pin.state === "here");
    const bode = pins.find((pin) => pin.id === "place.bode-thomas");
    if (here === undefined || bode === undefined) throw new Error("No pins");
    const ways = rideChoices(here.position, bode.position);
    const radios = within(sheet).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    for (const way of ways) {
      const radio = radios.find((candidate) => candidate.dataset.way === way.id);
      expect(radio?.textContent).toContain(formatMoney(way.fare, "NGN"));
      expect(radio?.textContent).toContain(mapWords("map.way.minutes", { minutes: way.minutes }));
    }
    const cash = view.pockets.NGN.cash;
    const main = (): HTMLElement => sheet.querySelector("[data-ride-main]") as HTMLElement;
    const danfo = ways[0] as RideChoice;
    expect(main().textContent).toContain(mapWords("map.go", { way: "danfo" }));
    expect(main().textContent).toContain(say("ui.world.left", { amount: formatMoney(cash - danfo.fare, "NGN") }));
    const keke = ways[1] as RideChoice;
    fireEvent.click(radios.find((radio) => radio.dataset.way === "keke") as HTMLElement);
    expect(main().textContent).toContain(say("ui.world.left", { amount: formatMoney(cash - keke.fare, "NGN") }));
    fireEvent.click(main());
    expect(onRide).toHaveBeenCalledWith(keke, "place.bode-thomas");
    expect(screen.getByText(mapWords("map.ride.to", { way: "Keke", place: headingOf(nameOf("place.bode-thomas")) }))).toBeTruthy();
  });

  test("[R-WORLD-017] given too little money for a way, when the sheet shows, then the main button is shut and says how much is short", async () => {
    const view = engineView();
    const poor = { ...view, pockets: { ...view.pockets, NGN: { ...view.pockets.NGN, cash: 10_000 } } };
    await renderWithView(<Map pins={lagosPins()} country={LAGOS} countries={COUNTRIES} drawing={false} onGo={() => undefined} onClose={() => undefined} />, poor);
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.computer-village") as HTMLElement);
    const main = document.querySelector("[data-ride-main]") as HTMLButtonElement;
    expect(main.disabled).toBe(true);
    expect(main.textContent).toContain(mapWords("map.short", { amount: "" }).trim());
  });

  test("[R-WORLD-017] given a ride, when it plays, then it lasts about six seconds and ends once, with the way and the place in its band", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Ride way="danfo" place="Bode Thomas Street" drawing={false} onDone={onDone} />);
    expect(screen.getByText("Danfo to Bode Thomas Street")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RIDE_MS - 200);
    });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(RIDE_MS).toBeGreaterThanOrEqual(5000);
    expect(RIDE_MS).toBeLessThanOrEqual(7000);
  });

  test("[R-WORLD-017] given a ride playing, when Skip is tapped, then it ends at once and not again", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Ride way="okada" place="Tejuosho Market" drawing={false} onDone={onDone} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.skip") }));
    expect(onDone).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RIDE_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test("[R-WORLD-017] given the city refusing the fare, when a way is chosen, then no ride plays and the sheet closes", async () => {
    const onRide = vi.fn(() => Promise.resolve(false));
    await renderWithView(<Map pins={lagosPins()} country={LAGOS} countries={COUNTRIES} drawing={false} onGo={() => undefined} onClose={() => undefined} onRide={onRide} />, engineView());
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.bode-thomas") as HTMLElement);
    const sheet = screen.getByRole("dialog", { name: headingOf(nameOf("place.bode-thomas")) });
    fireEvent.click(sheet.querySelector("[data-ride-main]") as HTMLElement);
    await act(async () => {
      await Promise.resolve();
    });
    expect(onRide).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: headingOf(nameOf("place.bode-thomas")) })).toBeNull();
    expect(screen.queryByText(mapWords("map.ride.to", { way: "Danfo", place: headingOf(nameOf("place.bode-thomas")) }))).toBeNull();
  });

  test("[R-WORLD-017] given a ride already chosen from a danfo in the place, when the map opens, then the same ride plays and the place opens at its end", async () => {
    const onGo = vi.fn();
    const onRide = vi.fn();
    await renderWithView(<Map pins={lagosPins()} country={LAGOS} countries={COUNTRIES} drawing={false} diveTo="place.tejuosho-market" onGo={onGo} onClose={() => undefined} onRide={onRide} />, engineView());
    expect(screen.getByText(mapWords("map.ride.to", { way: "Danfo", place: headingOf(nameOf("place.tejuosho-market")) }))).toBeTruthy();
    expect(onRide).toHaveBeenCalledTimes(1);
    expect((onRide.mock.calls[0] as [RideChoice, string])[0].id).toBe("danfo");
    fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.skip") }));
    expect(onGo).toHaveBeenCalledWith("place.tejuosho-market");
  });
});
