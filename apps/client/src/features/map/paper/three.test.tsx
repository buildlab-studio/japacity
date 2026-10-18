// The painted maps of Calgary, Dubai and Castel Volturno (world:painted-maps-abroad): each its own fit
// at the country's true shape, its land and water, its cards, every built place of the country as its sticker on its own
// card, the home sticker at the country's home spot from content, Naples on an inset in Castel Volturno's paper, each
// its own chunk, and each drawn by the map with the stops kept for a screen reader alone.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { uiCalgaryMapText, uiCastelMapText, uiDubaiMapText } from "@japacity/content/ui/paper";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { nameOf } from "../../../shared/words/text";
import type { CountryChoice } from "../../../shared/world/contract";
import { Map } from "../Map";
import { type MapPin, mapPins } from "../pins";
import { CALGARY, CALGARY_FIT, CALGARY_HOME_SPOT, CALGARY_PAPER } from "./calgary";
import { CASTEL, CASTEL_FIT, CASTEL_HOME_SPOT, CASTEL_PAPER, INSET, NAPLES } from "./castel";
import type { PaperCity } from "./city";
import { onCard } from "./districts";
import { drawingOf } from "./draw";
import { DUBAI, DUBAI_FIT, DUBAI_HOME_SPOT, DUBAI_PAPER } from "./dubai";
import { calgaryMapWords, castelMapWords, dubaiMapWords } from "./paper.words";
import type { Fit, Position } from "./fit";
import { inside } from "./scatter";
import { placeStops } from "./stops";

// Loaded here, so the map screen's own lazy loads of them settle at once.
import "./PaperMap";
import "./calgary";
import "./dubai";
import "./castel";

const CARD = { width: 350, height: 614 };
const ROOM = "place.the-room";
/** Where City.tsx stands a home with no position: Lagos's home spot, which no paper abroad may follow. */
const LAGOS_HOME_SPOT = { latE3: 6507, lonE3: 3359 };

interface Country {
  id: "country.canada" | "country.uae" | "country.italy";
  name: string;
  city: PaperCity;
  fit: Fit;
  paper: { width: number; height: number };
  home: Position;
  lonMetres: number;
  words: (key: string) => string;
  text: Record<string, string>;
  cards: string[];
  cardWords: string[];
  /** The card the home sticker shows on. */
  homeCard: string;
  /** Each place's own card. */
  of: Record<string, string>;
  /** Places off the fit's own spots: Naples on its inset. */
  aside: string[];
}

const COUNTRIES: readonly Country[] = [
  {
    id: "country.canada",
    name: "Canada",
    city: CALGARY,
    fit: CALGARY_FIT,
    paper: CALGARY_PAPER,
    home: CALGARY_HOME_SPOT,
    lonMetres: 71,
    words: calgaryMapWords,
    text: uiCalgaryMapText,
    cards: ["airport", "north-east", "downtown"],
    cardWords: ["The airport", "The north-east", "Downtown"],
    homeCard: "north-east",
    of: {
      "place.calgary-north-east": "north-east",
      "place.ctrain-station-ca": "north-east",
      "place.big-shop-ca": "north-east",
      "place.care-home-ca": "north-east",
      "place.library-ca": "north-east",
      "place.church-ca": "north-east",
      "place.warehouse-ca": "airport",
      "place.calgary-airport": "airport",
      "place.office-ca": "downtown",
    },
    aside: [],
  },
  {
    id: "country.uae",
    name: "United Arab Emirates",
    city: DUBAI,
    fit: DUBAI_FIT,
    paper: DUBAI_PAPER,
    home: DUBAI_HOME_SPOT,
    lonMetres: 100,
    words: dubaiMapWords,
    text: uiDubaiMapText,
    cards: ["deira", "airport", "camp", "site"],
    cardWords: ["Deira", "The airport", "The camp", "The site"],
    homeCard: "camp",
    of: {
      "place.deira": "deira",
      "place.naif": "deira",
      "place.metro-station-uae": "deira",
      "place.big-shop-uae": "deira",
      "place.dubai-airport": "airport",
      "place.site-uae": "site",
    },
    aside: [],
  },
  {
    id: "country.italy",
    name: "Italy",
    city: CASTEL,
    fit: CASTEL_FIT,
    paper: CASTEL_PAPER,
    home: CASTEL_HOME_SPOT,
    lonMetres: 84,
    words: castelMapWords,
    text: uiCastelMapText,
    cards: ["town", "fields", "domitiana"],
    cardWords: ["The town", "The fields", "The Domitiana"],
    homeCard: "domitiana",
    of: {
      "place.castel-volturno": "town",
      "place.big-shop-it": "town",
      "place.church-it": "town",
      "place.farm-it": "fields",
      "place.via-domitiana": "domitiana",
    },
    aside: [NAPLES],
  },
];

/** A country's places with a position, every one of them a stop on its paper. */
function placesOf(country: Country) {
  return Object.values(content.place).filter((place) => place.where === "abroad" && place.country === country.id && place.position !== null);
}

describe.each(COUNTRIES)("$name's paper", (country) => {
  const { city } = country;
  const cardOf = (id: string) => city.cards.find((card) => card.id === id);

  test(`[world:painted-maps-abroad] given ${country.name}'s fit, when a position is laid on its paper, then it keeps the country's true shape in whole numbers, north up, and undoing it gives the position back`, () => {
    expect(country.fit.xLon / -country.fit.yLat).toBeCloseTo(country.lonMetres / 111, 1);
    expect(country.fit.xLat).toBe(0);
    expect(country.fit.yLon).toBe(0);
    for (const value of Object.values(country.fit)) expect(Number.isInteger(value)).toBe(true);
    const [x, y] = city.toPaper(country.home);
    expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
    expect(city.fromPaper([x, y])).toEqual(country.home);
    // North is up: the place furthest north stands highest on the paper.
    const places = placesOf(country).filter((place) => !country.aside.includes(place.id));
    const north = places.reduce((best, place) => ((place.position?.latE3 ?? 0) > (best.position?.latE3 ?? 0) ? place : best));
    const south = places.reduce((best, place) => ((place.position?.latE3 ?? 0) < (best.position?.latE3 ?? 0) ? place : best));
    expect(city.toPaper(north.position ?? country.home)[1]).toBeLessThan(city.toPaper(south.position ?? country.home)[1]);
  });

  test(`[world:painted-maps-abroad] given every place of ${country.name} with a position, when its map stands them, then each is on the paper, on the land, and shows on its own district's card`, () => {
    const places = placesOf(country);
    expect(places.map((place) => place.id).sort()).toEqual([...Object.keys(country.of), ...country.aside].sort());
    const placed = placeStops(places.map((place) => ({ id: place.id, state: "can", position: place.position ?? country.home })), city);
    const land = Object.values(city.draw.land);
    for (const stop of placed) {
      const card = cardOf(stop.card);
      if (card === undefined) throw new Error(`${stop.id} has no card`);
      const onPaper = stop.at[0] > 0 && stop.at[0] < country.paper.width && stop.at[1] > 0 && stop.at[1] < country.paper.height;
      const onLand = country.aside.includes(stop.id) || land.some((ring) => inside(ring, stop.at));
      expect({ id: stop.id, onPaper, onLand, shows: onCard(card, stop.at, CARD.width, CARD.height, 16) }).toEqual({ id: stop.id, onPaper: true, onLand: true, shows: true });
      expect({ id: stop.id, card: stop.card }).toEqual({ id: stop.id, card: country.of[stop.id] ?? (country.aside.includes(stop.id) ? stop.card : "its own") });
    }
  });

  test(`[world:painted-maps-abroad] given ${country.name}'s cards, when they are read, then they are in the swipe's order, each named in the paper's own words, and every district name and water name has words`, () => {
    expect(city.cards.map((card) => card.id)).toEqual(country.cards);
    expect(city.cards.map((card) => country.words(card.key))).toEqual(country.cardWords);
    for (const label of [...city.labels, ...city.waterLabels]) expect(country.words(label.key)).not.toBe(label.key);
    // The paper's words never shadow the map's own: each key is the paper's alone.
    for (const key of Object.keys(country.text)) expect(country.words(key)).toBe(country.text[key]);
    for (const words of Object.values(country.text)) expect(words).not.toMatch(/\u2014|\u2013/);
    expect(city.fallbackCard).toBe(city.cards.find((card) => card.id === city.fallbackCard)?.id);
    // A painted city of the country: no lantern canoe, its rails drawn where it has a line.
    expect(city.canoe).toBeNull();
    expect(city.id).toBe(country.id);
  });

  test(`[world:painted-maps-abroad] given the room abroad, which has no position of its own, when ${country.name}'s map stands it however it is handed, then its sticker is at the country's home spot from content, never Lagos's, on its own card`, () => {
    expect(country.home).toEqual(content.country[country.id]?.homeSpot);
    const [room] = placeStops([{ id: ROOM, state: "home", position: LAGOS_HOME_SPOT }], city);
    expect(room?.at).toEqual(city.toPaper(country.home));
    expect(room?.at).not.toEqual(city.toPaper(LAGOS_HOME_SPOT));
    expect(room?.card).toBe(country.homeCard);
    const card = cardOf(country.homeCard);
    if (card === undefined || room === undefined) throw new Error("No home card");
    expect(onCard(card, room.at, CARD.width, CARD.height, 16)).toBe(true);
    expect(Object.values(city.draw.land).some((ring) => inside(ring, room.at))).toBe(true);
  });
});

describe("the three papers' land and water", () => {
  test("[world:painted-maps-abroad] given Calgary's paper, when its drawing is read, then the Bow runs between the north-east and downtown, and the CTrain's line is drawn", () => {
    const north = CALGARY.draw.land.north ?? [];
    const south = CALGARY.draw.land.south ?? [];
    const office = content.place["place.office-ca"]?.position;
    const mall = content.place["place.calgary-north-east"]?.position;
    if (office === undefined || office === null || mall === undefined || mall === null) throw new Error("No positions");
    expect(inside(south, CALGARY.toPaper(office))).toBe(true);
    expect(inside(north, CALGARY.toPaper(mall))).toBe(true);
    // The river itself is water: a point on the Bow by downtown is on neither bank.
    const river = CALGARY.toPaper({ latE3: 51053, lonE3: -114070 });
    expect(inside(north, river) || inside(south, river)).toBe(false);
    expect(drawingOf(CALGARY.draw).rails).not.toBe("");
  });

  test("[world:painted-maps-abroad] given Dubai's paper, when its drawing is read, then the creek cuts between Deira and Bur Dubai, the Gulf is water, and the metro's lines are drawn", () => {
    const land = DUBAI.draw.land.dubai ?? [];
    expect(inside(land, DUBAI.toPaper({ latE3: 25273, lonE3: 55305 }))).toBe(true);
    // The creek between the two banks, and the Gulf off the shore.
    expect(inside(land, DUBAI.toPaper({ latE3: 25255, lonE3: 55314 }))).toBe(false);
    expect(inside(land, DUBAI.toPaper({ latE3: 25285, lonE3: 55262 }))).toBe(false);
    expect(drawingOf(DUBAI.draw).rails).not.toBe("");
  });

  test("[world:painted-maps-abroad] given Castel Volturno's paper, when its drawing is read, then the sea lies west of the Domitiana, the Volturno runs across the top, and no railway is drawn", () => {
    const south = CASTEL.draw.land.south ?? [];
    expect(inside(south, CASTEL.toPaper({ latE3: 40990, lonE3: 13930 }))).toBe(false);
    expect(inside(south, CASTEL.toPaper({ latE3: 40990, lonE3: 13990 }))).toBe(true);
    const river = CASTEL.toPaper({ latE3: 41045, lonE3: 13990 });
    expect(inside(south, river) || inside(CASTEL.draw.land.north ?? [], river)).toBe(false);
    expect(drawingOf(CASTEL.draw).rails).toBe("");
  });

  test("[world:painted-maps-abroad] given Naples' airport, far inland for the coast's paper, when Castel Volturno's map stands it, then its sticker is on the inset in the paper's south-east corner, on the Domitiana's card, never where the fit alone would put it", () => {
    const naples = content.place[NAPLES]?.position;
    if (naples === undefined || naples === null) throw new Error("Naples has no position");
    // By the fit alone it would stand far off the paper's east edge.
    expect(CASTEL_FIT.xLon * naples.lonE3 + CASTEL_FIT.x0).toBeGreaterThan(CASTEL_PAPER.width + 1000);
    const [stop] = placeStops([{ id: NAPLES, state: "can", position: naples }], CASTEL);
    expect(stop?.at).toEqual(INSET.at);
    const [x0, y0, x1, y1] = INSET.box;
    expect(stop !== undefined && stop.at[0] > x0 && stop.at[0] < x1 && stop.at[1] > y0 && stop.at[1] < y1).toBe(true);
    // In a corner: the paper's east edge and its foot are the nearest.
    expect(x1).toBeGreaterThan((CASTEL_PAPER.width * 3) / 4);
    expect(x1).toBeLessThanOrEqual(CASTEL_PAPER.width);
    expect(y1).toBeGreaterThan((CASTEL_PAPER.height * 3) / 4);
    expect(stop?.card).toBe("domitiana");
    const domitiana = CASTEL.cards.find((card) => card.id === "domitiana");
    if (domitiana === undefined || stop === undefined) throw new Error("No Domitiana card");
    expect(onCard(domitiana, stop.at, CARD.width, CARD.height, 16)).toBe(true);
    for (const key of ["map.inset.naples", "map.inset.inland"]) expect(castelMapWords(key)).not.toBe(key);
  });

  test("[world:painted-maps-abroad] given the client's code, when what imports the three papers is read, then only the map's lazy loads do, so each rides a chunk of its own and a first visit at home carries none of them", () => {
    const SRC = join(import.meta.dirname, "..", "..", "..");
    const files = (readdirSync(SRC, { recursive: true }) as string[]).filter((path) => /\.(ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path));
    const map = readFileSync(join(SRC, "features", "map", "Map.tsx"), "utf8");
    for (const chunk of ["calgary", "dubai", "castel"]) {
      const importers = files.filter((path) => new RegExp(`from\\s+["'][./a-z]*\\/?${chunk}["']`).test(readFileSync(join(SRC, path), "utf8")));
      expect({ chunk, importers }).toEqual({ chunk, importers: [] });
      expect(map).toContain(`import("./paper/${chunk}")`);
    }
  });
});

function pinsOf(country: Country, here: string): MapPin[] {
  const places = Object.values(content.place).filter((place) => place.where === "abroad" && (place.country === country.id || place.id === ROOM));
  const built = new Set([...placesOf(country).map((place) => place.id), ROOM]);
  return mapPins({ places, here, home: ROOM, homeSpot: LAGOS_HOME_SPOT, been: [], built, name: nameOf });
}

async function settle(selector: string): Promise<void> {
  for (let tries = 0; tries < 200 && document.querySelector(selector) === null; tries += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const HUBS: Record<Country["id"], { hub: string; card: string; title: string }> = {
  "country.canada": { hub: "place.calgary-north-east", card: "north-east", title: "The north-east" },
  "country.uae": { hub: "place.deira", card: "deira", title: "Deira" },
  "country.italy": { hub: "place.castel-volturno", card: "town", title: "The town" },
};

describe.each(COUNTRIES)("the map in $name", (country) => {
  test(`[world:painted-maps-abroad] given a life at ${country.name}'s hub, when the map opens there, then it is the country's painted map folded on the hub's card with the strip and the home, the stops kept as a list for a screen reader alone, and no hint`, async () => {
    const choice: CountryChoice = { id: country.id, name: country.name, locked: null };
    const { hub, card, title } = HUBS[country.id];
    await renderWithView(<Map pins={pinsOf(country, hub)} country={choice} countries={[choice]} drawing={false} onGo={() => undefined} onClose={() => undefined} home={ROOM} />, engineView("scenario.ada"));
    await settle("[data-paper-map]");
    expect(document.querySelector("[data-paper-map]")).not.toBeNull();
    expect(document.querySelector('[data-card][data-current="true"]')?.getAttribute("data-card")).toBe(card);
    expect(document.querySelectorAll("[data-pager] i")).toHaveLength(country.cards.length);
    expect(document.querySelector("[data-strip-home]")).not.toBeNull();
    const list = screen.getByRole("list", { name: "Stops" });
    expect(list.className).toContain("sr-only");
    expect(document.querySelector("[data-map-hint]")).toBeNull();
    const stops = window.__map?.stops ?? [];
    for (const [id, own] of Object.entries(country.of)) expect({ id, card: stops.find((stop) => stop.id === id)?.card }).toEqual({ id, card: own });
    expect(stops.find((stop) => stop.id === ROOM)?.at).toEqual(country.city.toPaper(country.home));
    expect(window.__map?.canoe).toBeNull();
    expect(document.querySelector(`[data-card="${card}"] [data-card-title]`)?.textContent).toBe(title);
  });
});

describe("Naples on the open map", () => {
  test("[world:painted-maps-abroad] [world:ride-sheet-shows-fares] given Castel Volturno's open map, when Naples' sticker on the inset is tapped, then its stop is picked with the ride sheet at the foot", async () => {
    const italy = COUNTRIES[2];
    if (italy === undefined) throw new Error("No Italy");
    const choice: CountryChoice = { id: italy.id, name: italy.name, locked: null };
    await renderWithView(<Map pins={pinsOf(italy, "place.castel-volturno")} country={choice} countries={[choice]} drawing={false} onGo={() => undefined} onClose={() => undefined} home={ROOM} />, engineView("scenario.ada"));
    await settle("[data-paper-map]");
    fireEvent.click(document.querySelector("[data-strip]") as HTMLElement);
    await settle("[data-open-map]");
    const open = document.querySelector("[data-open-map]");
    expect(open?.querySelector(`[data-inset="${NAPLES}"]`)).not.toBeNull();
    fireEvent.click(open?.querySelector(`[data-pin="${NAPLES}"]`) as HTMLElement);
    expect(document.querySelector(`[data-ride-sheet="${NAPLES}"]`)).not.toBeNull();
  });
});
