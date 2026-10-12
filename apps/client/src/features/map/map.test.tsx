import { readdirSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Group, Vector3 } from "three";
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
import { alongOf, LINES, lineOf, LONG_WALK_MS, PRE_MS, Ride, RIDE_MS } from "./Ride";
import { firstWay, headingOf } from "./RideSheet";
import { type Angle, angleAt, anglesOf, buildRide, CUT_DARK_MS, darkAt, figuresOn, STEP_MS, stepClock } from "./rideScene";
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
  test("[R-WORLD-017] [R-WORLD-003] given a stop in walking distance and no fare held, when the ride sheet opens, then it opens on Walk; with the fare held on the danfo, and a tapped vehicle keeps its own way", () => {
    const from = { latE3: 6490, lonE3: 3355 };
    const near = rideChoices(from, { latE3: 6507, lonE3: 3359 });
    const fare = near[0]!.fare;
    expect(near.find((way) => way.id === "walk")?.shut).toBeUndefined();
    expect(firstWay(near, 0)).toBe("walk");
    expect(firstWay(near, fare - 1)).toBe("walk");
    expect(firstWay(near, fare)).toBe("danfo");
    expect(firstWay(near, 0, "okada")).toBe("okada");
    // Too far to walk and no fare: the first way stays, its button shut with what it lacks.
    const far = rideChoices(from, { latE3: 6594, lonE3: 3340 });
    expect(firstWay(far, 0)).toBe("danfo");
  });

  test("[R-WORLD-017] [R-PLACE-010] given the month's fare factor from the view, when the ways are priced, then each vehicle's fare is that share of its flat figure and walking stays free", () => {
    const from = { latE3: 6511, lonE3: 3362 };
    const to = { latE3: 6594, lonE3: 3340 };
    const plain = rideChoices(from, to);
    const dear = rideChoices(from, to, null, 20000);
    for (const [index, way] of dear.entries()) expect(way.fare).toBe((plain[index]?.fare ?? 0) * 2);
    expect(dear.find((way) => way.id === "walk")?.fare).toBe(0);
  });

  test("[R-WORLD-017] given two places, when the ways are priced, then there are a danfo, a keke, an okada and on foot, the vehicles each with a fare in fifties of naira and minutes, the okada quickest, on foot free and slowest", () => {
    const from = { latE3: 6511, lonE3: 3362 };
    const to = { latE3: 6594, lonE3: 3340 };
    const ways = rideChoices(from, to);
    expect(ways.map((way) => way.id)).toEqual(["danfo", "keke", "okada", "walk"]);
    for (const way of ways) {
      expect(way.fare % 5000).toBe(0);
      expect(way.minutes).toBeGreaterThan(0);
    }
    const [danfo, keke, okada, walk] = ways as [RideChoice, RideChoice, RideChoice, RideChoice];
    expect(danfo.fare).toBeGreaterThan(0);
    expect(danfo.fare).toBeLessThan(keke.fare);
    expect(keke.fare).toBeLessThan(okada.fare);
    expect(okada.minutes).toBeLessThan(danfo.minutes);
    expect(walk.fare).toBe(0);
    expect(walk.minutes).toBeGreaterThan(danfo.minutes);
    expect(walk.label).toBe(mapWords("map.way.walk"));
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
    expect(within(sheet).getByText(say("ui.world.pass"))).toBeTruthy();
    expect((sheet.querySelector("[data-ride-main]") as HTMLButtonElement).disabled).toBe(false);
    expect(sheet.querySelector("[data-ride-main]")?.textContent).not.toContain(say("ui.world.left", { amount: "" }).trim());
  });

  test("[R-WORLD-017] [R-WORLD-006] given a stop picked, when the ride sheet shows, then it names the place, gives each way's fare and minutes, and the main button says the ride and its fare over the balance before, struck, and after", async () => {
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
    expect(radios).toHaveLength(4);
    for (const way of ways) {
      const radio = radios.find((candidate) => candidate.dataset.way === way.id);
      expect(radio?.textContent).toContain(way.fare === 0 ? say("ui.world.free") : formatMoney(way.fare, "NGN"));
      // A walk past walking distance is shut and says so in place of its minutes (R-WORLD-017).
      expect(radio?.textContent).toContain(way.shut === "far" ? mapWords("map.way.walk-far") : mapWords("map.way.minutes", { minutes: way.minutes }));
    }
    // All the naira pay the fare, cash first (R-PLACE-010).
    const cash = view.pockets.NGN.cash + view.pockets.NGN.bank;
    const main = (): HTMLElement => sheet.querySelector("[data-ride-main]") as HTMLElement;
    const danfo = ways[0] as RideChoice;
    const balance = (which: "before" | "after"): string | null => sheet.querySelector(`[data-balance-${which}]`)?.textContent ?? null;
    expect(main().textContent).toBe(say("ui.act.priced", { act: mapWords("map.go", { way: "danfo" }), price: formatMoney(danfo.fare, "NGN") }));
    expect([balance("before"), balance("after")]).toEqual([formatMoney(cash, "NGN"), formatMoney(cash - danfo.fare, "NGN")]);
    const keke = ways[1] as RideChoice;
    fireEvent.click(radios.find((radio) => radio.dataset.way === "keke") as HTMLElement);
    expect(main().textContent).toBe(say("ui.act.priced", { act: mapWords("map.go", { way: "keke" }), price: formatMoney(keke.fare, "NGN") }));
    expect([balance("before"), balance("after")]).toEqual([formatMoney(cash, "NGN"), formatMoney(cash - keke.fare, "NGN")]);
    fireEvent.click(main());
    expect(onRide).toHaveBeenCalledWith(keke, "place.bode-thomas");
    expect(screen.getByText(mapWords("map.ride.to", { way: "Keke", place: headingOf(nameOf("place.bode-thomas")) }))).toBeTruthy();
  });

  test("[R-WORLD-017] given too little money for a way, when the sheet shows, then the main button is shut and says how much is short", async () => {
    const view = engineView();
    const poor = { ...view, pockets: { ...view.pockets, NGN: { ...view.pockets.NGN, cash: 10_000, bank: 0 } } };
    await renderWithView(<Map pins={lagosPins()} country={LAGOS} countries={COUNTRIES} drawing={false} onGo={() => undefined} onClose={() => undefined} />, poor);
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.computer-village") as HTMLElement);
    const main = document.querySelector("[data-ride-main]") as HTMLButtonElement;
    expect(main.disabled).toBe(true);
    expect(main.textContent).toContain(mapWords("map.short", { amount: "" }).trim());
  });

  test("[R-WORLD-002] [R-TEXT-008] given a ride to a place with a long name, when its band shows, then the title says the whole name, wrapping to a second line rather than cut", () => {
    render(<Ride way="danfo" place="Murtala Muhammed International Airport" drawing={false} onDone={() => undefined} />);
    const title = document.querySelector<HTMLElement>("[data-ride-title]");
    expect(title?.textContent).toBe("Danfo to Murtala Muhammed International Airport");
    expect(title?.className).not.toMatch(/\btruncate\b/);
    expect(title?.className).toContain("line-clamp-2");
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

  test("[R-WORLD-017] given the stop the character stands at, when Stay here is tapped on its sheet, then the map closes with it, back to the place", async () => {
    const onClose = vi.fn();
    const pins = lagosPins();
    const here = pins.find((pin) => pin.state === "here");
    if (here === undefined) throw new Error("No here");
    await renderWithView(<Map pins={pins} country={LAGOS} countries={COUNTRIES} drawing={false} onGo={() => undefined} onClose={onClose} />, engineView());
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === here.id) as HTMLElement);
    const sheet = screen.getByRole("dialog", { name: headingOf(here.name) });
    expect((sheet.querySelector("[data-ride-main]") as HTMLElement).textContent).toContain(mapWords("map.stay"));
    fireEvent.click(sheet.querySelector("[data-ride-main]") as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("[R-WORLD-017] given a stop past walking distance, when the ride sheet shows, then the walk is shut and says it is too far, is never the chosen way, and a near stop keeps it open", async () => {
    const pins = lagosPins();
    const here = pins.find((pin) => pin.state === "here");
    if (here === undefined) throw new Error("No here");
    const limit = content.tuning.city.ride.walkMetres;
    const far = { ...here.position, latE3: here.position.latE3 + Math.ceil((limit * 1.5) / 111.32) };
    const near = { ...here.position, latE3: here.position.latE3 + Math.floor((limit * 0.5) / 111.32) };
    expect(rideChoices(here.position, far).find((way) => way.id === "walk")?.shut).toBe("far");
    expect(rideChoices(here.position, near).find((way) => way.id === "walk")?.shut).toBeUndefined();
    const farPins = pins.map((pin) => (pin.id === "place.bode-thomas" ? { ...pin, position: far } : pin));
    await renderWithView(<Map pins={farPins} country={LAGOS} countries={COUNTRIES} drawing={false} onGo={() => undefined} onClose={() => undefined} />, engineView());
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.bode-thomas") as HTMLElement);
    const sheet = screen.getByRole("dialog", { name: headingOf(nameOf("place.bode-thomas")) });
    const walk = within(sheet).getAllByRole("radio").find((radio) => radio.dataset.way === "walk") as HTMLButtonElement;
    expect(walk.disabled).toBe(true);
    expect(walk.textContent).toContain(mapWords("map.way.walk-far"));
    fireEvent.click(walk);
    expect(walk.getAttribute("aria-checked")).toBe("false");
  });

  test("[R-WORLD-017] given home past walking distance and no fare held, when its ride sheet shows, then Walk home is open and chosen, never Too far to walk, while another stop as far keeps the limit", async () => {
    const pins = lagosPins();
    const here = pins.find((pin) => pin.state === "here");
    if (here === undefined) throw new Error("No here");
    const limit = content.tuning.city.ride.walkMetres;
    const far = { ...here.position, latE3: here.position.latE3 + Math.ceil((limit * 3) / 111.32) };
    const home = rideChoices(here.position, far, null, 10000, true).find((way) => way.id === "walk");
    expect(home?.shut).toBeUndefined();
    expect(home?.long).toBe(true);
    expect(rideChoices(here.position, far).find((way) => way.id === "walk")?.shut).toBe("far");
    const farPins = pins.map((pin) => (pin.id === HOME || pin.id === "place.bode-thomas" ? { ...pin, position: far } : pin));
    const view = engineView();
    const broke = { ...view, pockets: { ...view.pockets, NGN: { ...view.pockets.NGN, cash: 0, bank: 0 } } };
    await renderWithView(<Map pins={farPins} country={LAGOS} countries={COUNTRIES} drawing={false} home={HOME} onGo={() => undefined} onClose={() => undefined} />, broke);
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === HOME) as HTMLElement);
    const sheet = screen.getByRole("dialog");
    const walk = within(sheet).getAllByRole("radio").find((radio) => radio.dataset.way === "walk") as HTMLButtonElement;
    expect(walk.disabled).toBe(false);
    expect(walk.textContent).not.toContain(mapWords("map.way.walk-far"));
    expect(walk.getAttribute("aria-checked")).toBe("true");
    const main = sheet.querySelector<HTMLButtonElement>("[data-ride-main]");
    expect(main?.textContent).toContain(mapWords("map.walk-home"));
    expect(main?.disabled).toBe(false);
    // Another stop as far keeps the walking limit.
    fireEvent.click(within(sheet).getByRole("button", { name: mapWords("map.not-now") }));
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.bode-thomas") as HTMLElement);
    const other = within(screen.getByRole("dialog")).getAllByRole("radio").find((radio) => radio.dataset.way === "walk") as HTMLButtonElement;
    expect(other.disabled).toBe(true);
    expect(other.textContent).toContain(mapWords("map.way.walk-far"));
  });

  test("[R-WORLD-017] given a walk home past walking distance, when it plays, then it runs longer than a ride, has no Skip, and ends once by itself; a walk within reach keeps the ride's six seconds and its Skip", async () => {
    vi.useFakeTimers();
    expect(LONG_WALK_MS).toBeGreaterThan(RIDE_MS);
    const onRide = vi.fn();
    const onGo = vi.fn();
    const pins = lagosPins();
    const here = pins.find((pin) => pin.state === "here");
    if (here === undefined) throw new Error("No here");
    const far = { ...here.position, latE3: here.position.latE3 + Math.ceil((content.tuning.city.ride.walkMetres * 3) / 111.32) };
    const farPins = pins.map((pin) => (pin.id === HOME ? { ...pin, position: far } : pin));
    const view = engineView();
    const broke = { ...view, pockets: { ...view.pockets, NGN: { ...view.pockets.NGN, cash: 0, bank: 0 } } };
    await renderWithView(<Map pins={farPins} country={LAGOS} countries={COUNTRIES} drawing={false} home={HOME} onGo={onGo} onClose={() => undefined} onRide={onRide} />, broke);
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === HOME) as HTMLElement);
    fireEvent.click(screen.getByRole("dialog").querySelector("[data-ride-main]") as HTMLElement);
    expect((onRide.mock.calls[0] as [RideChoice, string])[0]).toMatchObject({ id: "walk", long: true });
    expect(document.querySelector("[data-ride='walk']")).not.toBeNull();
    expect(document.querySelector("[data-ride-skip]")).toBeNull();
    expect(screen.queryByRole("button", { name: mapWords("map.ride.skip") })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RIDE_MS + 500);
    });
    expect(onGo).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LONG_WALK_MS - RIDE_MS);
    });
    expect(onGo).toHaveBeenCalledTimes(1);
    expect(onGo).toHaveBeenCalledWith(HOME);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LONG_WALK_MS);
    });
    expect(onGo).toHaveBeenCalledTimes(1);
    // A walk within reach is a ride's length and can be skipped.
    document.body.innerHTML = "";
    const onDone = vi.fn();
    render(<Ride way="walk" place="Tejuosho Market" drawing={false} onDone={onDone} />);
    expect(screen.getByRole("button", { name: mapWords("map.ride.skip") })).toBeTruthy();
  });

  test("[R-WORLD-017] given a walk, short or the long walk home, when it sets off, then the card says it sets off on foot from the place left, never that it pulls out; a ride still pulls out", async () => {
    expect(alongOf(0, 1, "walk")).toEqual({ key: "map.ride.along.start.walk", needs: "from" });
    expect(alongOf(0, 1, "danfo").key).toBe("map.ride.along.start");
    expect(mapWords("map.ride.along.start.walk", { from: "Computer Village" })).toBe("Setting off from Computer Village on foot.");
    vi.useFakeTimers();
    for (const long of [false, true]) {
      document.body.innerHTML = "";
      render(<Ride way="walk" long={long} place="The family house" from="Computer Village" drawing={false} onDone={() => undefined} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(document.querySelector("[data-ride-line]")?.textContent).toBe("Setting off from Computer Village on foot.");
      expect(document.body.textContent).not.toContain("Pulling out");
    }
  });

  test("[R-WORLD-017] given a ride with the place it left, when it plays, then the card says where you are on the ride's own clock: pulling out, a road line, the stop near the end", async () => {
    vi.useFakeTimers();
    render(<Ride way="danfo" place="Bode Thomas Street" from="Ojuelegba" drawing={false} seed={1} onDone={() => undefined} />);
    expect(alongOf(0, 1, "danfo")).toEqual({ key: "map.ride.along.start", needs: "from" });
    expect(alongOf(0.5, 1, "danfo").key).toMatch(/^map\.ride\.along\.road\.[1-3](\.danfo)?$/);
    expect(alongOf(0.9, 1, "danfo")).toEqual({ key: "map.ride.along.near", needs: "to" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRE_MS + 400);
    });
    expect(screen.getByText(mapWords("map.ride.along.start", { from: "Ojuelegba" }))).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2400);
    });
    expect(screen.getByText(mapWords(alongOf(0.5, 1, "danfo").key))).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800);
    });
    expect(screen.getByText(mapWords("map.ride.along.near", { to: "Bode Thomas Street" }))).toBeTruthy();
  });

  test("[R-WORLD-017] given a ride playing, when Turn back is tapped, then the ride ends once by turning back and never arrives; without a way back there is no such button", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const onTurnBack = vi.fn();
    const { unmount } = render(<Ride way="keke" place="Tejuosho Market" from="Ojuelegba" drawing={false} onDone={onDone} onTurnBack={onTurnBack} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.turn-back") }));
    expect(onTurnBack).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.skip") }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RIDE_MS);
    });
    expect(onDone).not.toHaveBeenCalled();
    expect(onTurnBack).toHaveBeenCalledTimes(1);
    unmount();
    render(<Ride way="keke" place="Tejuosho Market" drawing={false} onDone={onDone} />);
    expect(screen.queryByRole("button", { name: mapWords("map.ride.turn-back") })).toBeNull();
  });

  test("[R-WORLD-017] given the map with a way back, when a ride's Turn back is tapped, then the map says where the walk goes back to, and nothing arrives", async () => {
    vi.useFakeTimers();
    const onGo = vi.fn();
    const onTurnBack = vi.fn();
    const pins = lagosPins();
    await renderWithView(<Map pins={pins} country={LAGOS} countries={COUNTRIES} drawing={false} onGo={onGo} onClose={() => undefined} onTurnBack={onTurnBack} />, engineView());
    fireEvent.click(screen.getAllByRole("button").find((button) => button.dataset.stop === "place.bode-thomas") as HTMLElement);
    const sheet = screen.getByRole("dialog", { name: headingOf(nameOf("place.bode-thomas")) });
    fireEvent.click(sheet.querySelector("[data-ride-main]") as HTMLElement);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.turn-back") }));
    const here = pins.find((pin) => pin.state === "here");
    expect(onTurnBack).toHaveBeenCalledWith(here?.id, "place.bode-thomas");
    expect(onGo).not.toHaveBeenCalled();
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

describe("the ride carries people", () => {
  const BAD = /[\u2013\u2014]/;

  async function ride(way: RideChoice["id"], seed: number, onDone: () => void = () => undefined) {
    vi.useFakeTimers();
    render(<Ride way={way} place="Tejuosho Market" drawing={false} seed={seed} onDone={onDone} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    const probe = window.__ride;
    if (probe === undefined) throw new Error("The ride set no probe");
    return probe;
  }

  test("[R-WORLD-017] given each speaker, when his lines are read, then there are six, each in the words with no dash, and the seed picks one", () => {
    expect(LINES).toBe(6);
    for (const way of ["okada", "keke", "danfo"] as const) {
      const seen = new Set<string>();
      for (let seed = 0; seed < LINES; seed += 1) {
        const key = lineOf(way, seed);
        if (key === null) throw new Error(`No line for ${way}`);
        expect(key.startsWith(`map.ride.line.${way}.`)).toBe(true);
        const said = mapWords(key);
        expect(said).not.toBe(key);
        expect(said).not.toMatch(BAD);
        seen.add(said);
      }
      expect(seen.size).toBe(LINES);
      expect(lineOf(way, 7)).toBe(lineOf(way, 7 + LINES));
    }
    expect(lineOf("walk", 3)).toBeNull();
  });

  test("[R-WORLD-017] given an okada ride, when it plays, then the pre-roll shows the rider's line, the rider and the character are on the bike throughout, and the line goes with the pre-roll", async () => {
    const probe = await ride("okada", 4);
    const key = lineOf("okada", 4) ?? "";
    expect(screen.getByText(mapWords(key))).toBeTruthy();
    expect(probe.phase).toBe("pre");
    expect(probe.line).toBe(key);
    expect([...probe.figures].sort()).toEqual(["own", "rider"]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRE_MS);
    });
    expect(probe.phase).toBe("ride");
    expect(probe.line).toBeNull();
    expect(screen.queryByText(mapWords(key))).toBeNull();
    expect([...probe.figures].sort()).toEqual(["own", "rider"]);
  });

  test("[R-WORLD-017] given a danfo ride, when it plays, then the pre-roll shows the conductor's line with the character and the driver in the cab, and from above nothing is drawn inside", async () => {
    const probe = await ride("danfo", 2);
    const key = lineOf("danfo", 2) ?? "";
    expect(key.startsWith("map.ride.line.danfo.")).toBe(true);
    expect(screen.getByText(mapWords(key))).toBeTruthy();
    expect([...probe.figures].sort()).toEqual(["driver", "own"]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRE_MS);
    });
    expect(probe.phase).toBe("ride");
    expect(probe.figures).toEqual([]);
    expect(document.querySelector("[data-ride-line]")).toBeNull();
  });

  test("[R-WORLD-017] given a keke ride, when it plays, then the driver's line shows with the driver in front and the character on the back bench", async () => {
    const probe = await ride("keke", 0);
    expect(screen.getByText(mapWords(lineOf("keke", 0) ?? ""))).toBeTruthy();
    expect([...probe.figures].sort()).toEqual(["driver", "own"]);
  });

  test("[R-WORLD-017] given a ride on foot, when it plays, then there is no pre-roll and no line, and the character walks", async () => {
    const probe = await ride("walk", 5);
    expect(probe.phase).toBe("ride");
    expect(probe.preMs).toBe(0);
    expect(probe.line).toBeNull();
    expect(document.querySelector("[data-ride-line]")).toBeNull();
    expect(probe.figures).toEqual(["own"]);
  });

  test("[R-WORLD-017] given each way's scene before its people load, when either part plays, then it costs no more draw calls than the ride did before people, seven, so the people add only their own", () => {
    for (const way of ["danfo", "keke", "okada", "walk"] as const) {
      const scene = buildRide(way);
      for (const phase of ["pre", "ride"] as const) {
        scene.setPhase(phase);
        scene.frame(phase === "pre" ? 300 : 3000, 0.46);
        expect(drawCallsOf(scene.scene)).toBeLessThanOrEqual(7);
      }
      scene.dispose();
    }
  });

  test("[R-WORLD-017] given an okada's pre-roll cut short mid-climb, when the ride plays, then the character sits behind the rider facing ahead", () => {
    const scene = buildRide("okada");
    scene.setPerson("rider", new Group());
    scene.setPerson("own", new Group());
    scene.frame(500, 0.46);
    const own = scene.seats.find((seat) => seat.role === "own")?.group;
    const rider = scene.seats.find((seat) => seat.role === "rider")?.group;
    if (own === undefined || rider === undefined) throw new Error("No seats");
    expect(own.rotation.y).toBeGreaterThan(0);
    scene.setPhase("ride");
    scene.frame(3000, 0.46);
    expect(own.rotation.y).toBe(0);
    expect(own.position.x).toBeCloseTo(rider.position.x, 5);
    expect(own.position.z).toBeLessThan(rider.position.z);
    scene.dispose();
  });

  test("[R-WORLD-017] given an okada ride, when it plays out, then the pre-roll is at most a second and a half and counts inside the six seconds", async () => {
    const onDone = vi.fn();
    await ride("okada", 1, onDone);
    expect(PRE_MS).toBeLessThanOrEqual(1500);
    expect(RIDE_MS).toBeGreaterThanOrEqual(5000);
    expect(RIDE_MS).toBeLessThanOrEqual(7000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RIDE_MS - 260);
    });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(260);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test("[R-WORLD-017] given the okada's pre-roll, when Skip is tapped, then the pre-roll and the ride end at once and not again", async () => {
    const onDone = vi.fn();
    await ride("okada", 3, onDone);
    expect(document.querySelector("[data-ride-line]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.skip") }));
    expect(onDone).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RIDE_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("the ride cuts between its angles by itself", () => {
  /** The angles a ride shows in order, read off its clock every few milliseconds. */
  function seenOn(way: RideChoice["id"]): { angle: Angle; from: number; to: number }[] {
    const seen: { angle: Angle; from: number; to: number }[] = [];
    for (let ms = 0; ms <= RIDE_MS; ms += 10) {
      const angle = angleAt(way, ms);
      const last = seen[seen.length - 1];
      if (last?.angle === angle) last.to = ms;
      else seen.push({ angle, from: ms, to: ms });
    }
    return seen;
  }

  /** The camera in the vehicle's own frame: facing +z, the ground at y 0, the kerb on -x. */
  function cameraIn(scene: ReturnType<typeof buildRide>): { at: Vector3; facing: Vector3 } {
    scene.vehicle.updateMatrixWorld(true);
    const at = scene.vehicle.worldToLocal(scene.camera.position.clone());
    const facing = scene.camera.getWorldDirection(new Vector3());
    // The vehicle's body is turned half a circle inside it, so its own frame is the vehicle's turned.
    return { at: new Vector3(-at.x, at.y, -at.z), facing: new Vector3(-facing.x, facing.y, -facing.z) };
  }

  test("[R-WORLD-032] given a danfo ride, when its clock is read at each moment, then it is outside at the stop for the pre-roll, then above, then the window, then the seat, each once and each for a share of the six seconds", () => {
    const seen = seenOn("danfo");
    expect(seen.map((part) => part.angle)).toEqual(["outside", "above", "window", "seat"]);
    expect(seen[0]?.to).toBeLessThan(PRE_MS);
    expect(seen[1]?.from).toBeGreaterThanOrEqual(PRE_MS);
    for (const part of seen) expect(part.to - part.from).toBeGreaterThanOrEqual(1000);
    expect(angleAt("danfo", 0)).toBe("outside");
    expect(angleAt("danfo", RIDE_MS)).toBe("seat");
    expect(anglesOf("danfo").map((part) => part.angle)).toEqual(["outside", "above", "window", "seat"]);
  });

  test("[R-WORLD-032] given an okada ride and a keke ride, when the clock is read at each moment, then each is outside at the stop for the pre-roll, then above, then the rider ahead and the open street; on foot it is above throughout", () => {
    for (const way of ["okada", "keke"] as const) {
      const seen = seenOn(way);
      expect(seen.map((part) => part.angle)).toEqual(["outside", "above", "ahead"]);
      expect(seen[0]?.to).toBeLessThan(PRE_MS);
      for (const part of seen) expect(part.to - part.from).toBeGreaterThanOrEqual(1000);
    }
    expect(seenOn("walk").map((part) => part.angle)).toEqual(["above"]);
  });

  test("[R-WORLD-032] [R-WORLD-013] given each cut of a ride, when the dark is read across it, then the screen is fully dark at the cut, clear between cuts, and dark for under half a second each time", () => {
    for (const way of ["danfo", "okada", "keke"] as const) {
      const cuts = anglesOf(way).slice(1).map((part) => part.from);
      for (const cut of cuts) {
        expect(darkAt(way, cut)).toBe(1);
        let dark = 0;
        for (let ms = cut - 600; ms <= cut + 600; ms += 1) if (darkAt(way, ms) > 0) dark += 1;
        expect(dark).toBeGreaterThan(0);
        expect(dark).toBeLessThan(500);
      }
      const parts = anglesOf(way);
      parts.forEach((part, index) => {
        const next = parts[index + 1]?.from ?? RIDE_MS;
        expect(darkAt(way, (part.from + next) / 2)).toBe(0);
      });
    }
    expect(CUT_DARK_MS).toBeLessThan(500);
    expect(darkAt("walk", 3000)).toBe(0);
  });

  test("[R-WORLD-032] given a danfo's scene, when each angle is framed, then the stop is seen from outside, above from high over the street, the window from the aisle out to the road with the cab's pillars drawn, and the seat from a back seat facing the road with the row in front", () => {
    const scene = buildRide("danfo");
    scene.setPerson("own", new Group());
    scene.setPerson("driver", new Group());
    const at = (angle: Angle): number => {
      const parts = anglesOf("danfo");
      const index = parts.findIndex((part) => part.angle === angle);
      return ((parts[index]?.from ?? 0) + (parts[index + 1]?.from ?? RIDE_MS)) / 2;
    };
    const inside = (point: Vector3): boolean => Math.abs(point.x) < 1.1 && point.y > 0.3 && point.y < 2.3 && Math.abs(point.z) < 2.35;
    const cab = scene.scene.getObjectByName("cab");
    if (cab === undefined) throw new Error("No cab");

    scene.frame(at("outside"), 0.46);
    expect(inside(cameraIn(scene).at)).toBe(false);
    expect(Math.abs(cameraIn(scene).at.x)).toBeGreaterThan(1.2);
    expect(cab.visible).toBe(false);

    scene.frame(at("above"), 0.46);
    expect(scene.camera.position.y).toBeGreaterThan(20);
    expect(cab.visible).toBe(false);
    expect(figuresOn(scene)).toEqual([]);

    scene.frame(at("window"), 0.46);
    const window_ = cameraIn(scene);
    expect(inside(window_.at)).toBe(true);
    // Out of a window on the road's side, so the street slides past rather than a wall of shops.
    expect(window_.facing.x).toBeGreaterThan(0.7);
    expect(cab.visible).toBe(true);
    expect([...figuresOn(scene)].sort()).toEqual(["driver", "own"]);

    scene.frame(at("seat"), 0.46);
    const seat = cameraIn(scene);
    expect(inside(seat.at)).toBe(true);
    expect(seat.facing.z).toBeGreaterThan(0.8);
    const own = scene.seats.find((one) => one.role === "own")?.group.position.z ?? 0;
    expect(seat.at.z).toBeLessThan(own);
    expect(cab.visible).toBe(true);
    expect([...figuresOn(scene)].sort()).toEqual(["driver", "own"]);
    scene.dispose();
  });

  // Restated for the keke's last angle is its window out of the open side, tested in
  // rideScene.keke.test.ts; the okada keeps the character's own seat behind the rider.
  test("[R-WORLD-032] given an okada's scene, when the last angle is framed, then the camera sits where the character sits, behind the rider, facing the open street ahead with him in view", () => {
    for (const way of ["okada"] as const) {
      const scene = buildRide(way);
      const carrier = way === "okada" ? "rider" : "driver";
      scene.setPerson("own", new Group());
      scene.setPerson(carrier, new Group());
      const ahead = anglesOf(way).find((part) => part.angle === "ahead")?.from ?? 0;
      scene.frame((ahead + RIDE_MS) / 2, 0.46);
      const { at, facing } = cameraIn(scene);
      const own = scene.seats.find((one) => one.role === "own")?.group.position ?? new Vector3();
      const front = scene.seats.find((one) => one.role === carrier)?.group;
      if (front === undefined) throw new Error("No carrier");
      expect(Math.abs(at.z - own.z)).toBeLessThan(0.4);
      expect(at.y).toBeGreaterThan(1);
      expect(facing.z).toBeGreaterThan(0.8);
      const seen = front.getWorldPosition(new Vector3()).add(new Vector3(0, 1.2, 0)).project(scene.camera);
      expect(Math.abs(seen.x)).toBeLessThan(1);
      expect(Math.abs(seen.y)).toBeLessThan(1);
      expect(seen.z).toBeLessThan(1);
      expect([...figuresOn(scene)].sort()).toEqual([carrier, "own"].sort());
      scene.dispose();
    }
  });

  test("[R-WORLD-032] given each way's scene before its people load, when each angle plays, then it costs no more draw calls than the ride did, seven", () => {
    for (const way of ["danfo", "keke", "okada", "walk"] as const) {
      const scene = buildRide(way);
      for (const part of anglesOf(way)) {
        scene.frame(part.from + 50, 0.46);
        expect(drawCallsOf(scene.scene)).toBeLessThanOrEqual(7);
      }
      scene.dispose();
    }
  });

  test("[R-WORLD-032] given the ride's clock, when a frame comes late, then the step is clamped and the clock never passes the ride's end", () => {
    expect(stepClock(0, 16)).toBe(16);
    // A slow but steady frame counts whole (a device at two frames a second keeps the ride's pace); a stall moves one step only.
    expect(stepClock(1000, 500)).toBe(1500);
    expect(stepClock(1000, 2000)).toBe(1000 + STEP_MS);
    expect(stepClock(RIDE_MS - 10, 50)).toBe(RIDE_MS);
    expect(stepClock(500, -40)).toBe(500);
    expect(STEP_MS).toBeLessThanOrEqual(100);
  });

  test("[R-WORLD-032] given a danfo ride playing, when a slow frame of three seconds comes, then the ride does not jump ahead: the angle, the card's line and the end keep the ride's own clock", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Ride way="danfo" place="Bode Thomas Street" from="Ojuelegba" drawing={false} seed={1} onDone={onDone} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PRE_MS + 200);
    });
    const probe = window.__ride;
    if (probe === undefined) throw new Error("The ride set no probe");
    expect(probe.angle).toBe("above");
    vi.setSystemTime(Date.now() + 3000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(probe.angle).toBe("above");
    expect(screen.getByText(mapWords("map.ride.along.start", { from: "Ojuelegba" }))).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RIDE_MS - PRE_MS - 200 - 60 - STEP_MS - 100);
    });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test("[R-WORLD-032] given a danfo ride, when it plays out, then the probe says each angle once in order, the card's buttons are only Turn back and Skip, and no view switch shows", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Ride way="danfo" place="Bode Thomas Street" from="Ojuelegba" drawing={false} seed={2} onDone={onDone} onTurnBack={() => undefined} />);
    const ride = document.querySelector("[data-ride]") as HTMLElement;
    const names = within(ride)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(names).toEqual([mapWords("map.ride.turn-back"), mapWords("map.ride.skip")]);
    const seen: (string | undefined)[] = [];
    for (let ms = 0; ms < RIDE_MS - 100; ms += 100) {
      seen.push(window.__ride?.angle);
      expect(ride.dataset.rideAngle).toBe(window.__ride?.angle);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
    }
    expect(seen.filter((angle, index) => angle !== seen[index - 1])).toEqual(["outside", "above", "window", "seat"]);
    expect(window.__ride?.angles).toEqual(["outside", "above", "window", "seat"]);
    expect(onDone).not.toHaveBeenCalled();
  });

  test("[R-WORLD-032] given a danfo ride in each of its angles, when Skip is tapped, then it ends at once and not again", async () => {
    for (const part of anglesOf("danfo")) {
      vi.useFakeTimers();
      const onDone = vi.fn();
      const { unmount } = render(<Ride way="danfo" place="Bode Thomas Street" drawing={false} onDone={onDone} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(part.from + 300);
      });
      expect(window.__ride?.angle).toBe(part.angle);
      fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.skip") }));
      expect(onDone).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(RIDE_MS);
      });
      expect(onDone).toHaveBeenCalledTimes(1);
      unmount();
      vi.useRealTimers();
    }
  });

  test("[R-WORLD-032] given an okada ride, when Turn back is tapped from the rider-ahead angle, then the ride turns back once and never arrives", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const onTurnBack = vi.fn();
    render(<Ride way="okada" place="Tejuosho Market" from="Ojuelegba" drawing={false} onDone={onDone} onTurnBack={onTurnBack} />);
    const ahead = anglesOf("okada").find((part) => part.angle === "ahead")?.from ?? 0;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ahead + 300);
    });
    expect(window.__ride?.angle).toBe("ahead");
    fireEvent.click(screen.getByRole("button", { name: mapWords("map.ride.turn-back") }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RIDE_MS);
    });
    expect(onTurnBack).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});
