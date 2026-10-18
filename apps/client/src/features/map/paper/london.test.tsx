// The painted map of London (docs/rules/world.md R-WORLD-038): its own fit, land and districts, its cards, the home
// sticker at the home spot, Heathrow on its inset, its own chunk, and Lagos drawn as before beside it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { nameOf } from "../../../shared/words/text";
import type { CountryChoice } from "../../../shared/world/contract";
import { Map } from "../Map";
import { type MapPin, mapPins } from "../pins";
import { CARDS, onCard } from "./districts";
import { drawing, drawingOf } from "./draw";
import { fromPaper, PAPER, toPaper } from "./fit";
import { LANTERN_CANOE } from "./geometry";
import { LAGOS } from "./lagos";
import { HEATHROW, INSET, LONDON, LONDON_FIT, LONDON_HOME_SPOT, LONDON_PAPER } from "./london";
import { londonMapText, londonMapWords } from "./paper.words";
import { inside } from "./scatter";
import { placeStops } from "./stops";
import { stripFrame } from "./Strip";

// Loaded here, so the map screen's own lazy loads of them settle at once.
import "./PaperMap";
import "./london";

const PUBLIC = join(import.meta.dirname, "..", "..", "..", "..", "public", "assets", "places");
const FOLDERS = new Set(readdirSync(PUBLIC));
/** The UK's places with a built scene and a position of their own, Heathrow aside. */
const UK = Object.values(content.place).filter((place) => place.where === "abroad" && place.country === "country.uk" && place.position !== null && FOLDERS.has(place.assets) && place.id !== HEATHROW);
const CARD = { width: 350, height: 614 };
const ROOM = "place.the-room";
/** Where City.tsx stands a home with no position today: Lagos's home spot, which London's map must not follow. */
const LAGOS_HOME_SPOT = { latE3: 6507, lonE3: 3359 };

const cardOf = (id: string) => LONDON.cards.find((card) => card.id === id);

describe("London's fit and districts", () => {
  test("[R-WORLD-038] given London's fit, when a position is laid on its paper, then it keeps London's true shape in whole numbers, north up, and undoing it gives the position back", () => {
    // A thousandth of a degree of longitude is about 69 m at 51.5 degrees north against 111 m of latitude.
    expect(LONDON_FIT.xLon / -LONDON_FIT.yLat).toBeCloseTo(69 / 111, 1);
    const [x, y] = LONDON.toPaper(LONDON_HOME_SPOT);
    expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
    expect(LONDON.fromPaper([x, y])).toEqual(LONDON_HOME_SPOT);
    // North is up: the office at London Bridge stands above Peckham.
    const office = content.place["place.office-uk"]?.position;
    if (office === undefined || office === null) throw new Error("The office has no position");
    expect(LONDON.toPaper(office)[1]).toBeLessThan(y);
  });

  test("[R-WORLD-038] given every built place of the UK with a position, when London's map stands them, then each is on the paper, on the land south of the Thames, and shows on its own district's card", () => {
    expect(UK.length).toBeGreaterThanOrEqual(9);
    const placed = placeStops(UK.map((place) => ({ id: place.id, state: "can", position: place.position ?? LONDON_HOME_SPOT })), LONDON);
    const south = LONDON.draw.land.south ?? [];
    for (const stop of placed) {
      const card = cardOf(stop.card);
      if (card === undefined) throw new Error(`${stop.id} has no card`);
      expect({ id: stop.id, onPaper: stop.at[0] > 0 && stop.at[0] < LONDON_PAPER.width && stop.at[1] > 0 && stop.at[1] < LONDON_PAPER.height, onLand: inside(south, stop.at), shows: onCard(card, stop.at, CARD.width, CARD.height, 16) }).toEqual({ id: stop.id, onPaper: true, onLand: true, shows: true });
    }
    const of = (id: string) => placed.find((stop) => stop.id === id)?.card;
    expect(of("place.peckham")).toBe("peckham");
    expect(of("place.rye-lane")).toBe("peckham");
    expect(of("place.big-shop-uk")).toBe("peckham");
    expect(of("place.ward-uk")).toBe("camberwell");
    expect(of("place.care-home-uk")).toBe("nunhead");
    expect(of("place.warehouse-uk")).toBe("old-kent-road");
    expect(of("place.church-uk")).toBe("old-kent-road");
    expect(of("place.office-uk")).toBe("elephant");
    expect(of("place.test-centre-uk")).toBe("elephant");
  });

  test("[R-WORLD-038] given London's cards, when they are read, then there are five in the order north to south, each named in London's own words, and every district name, the river and the inset have words", () => {
    expect(LONDON.cards.map((card) => card.id)).toEqual(["elephant", "old-kent-road", "camberwell", "peckham", "nunhead"]);
    expect(LONDON.cards.map((card) => londonMapWords(card.key))).toEqual(["Elephant and London Bridge", "Old Kent Road", "Camberwell", "Peckham", "Nunhead"]);
    const keys = [...LONDON.labels, ...LONDON.waterLabels].map((label) => label.key);
    expect(keys.map((key) => londonMapWords(key))).toEqual(["Peckham", "Camberwell", "Nunhead", "Old Kent Road", "Elephant and Castle", "London Bridge", "The City", "The Thames"]);
    for (const key of ["map.inset.heathrow", "map.inset.west"]) expect(londonMapWords(key)).not.toBe(key);
    // London's words never shadow the map's own: each key is London's alone.
    for (const key of Object.keys(londonMapText)) expect(londonMapWords(key)).toBe(londonMapText[key]);
    // The river runs across the top with the City across it: the north bank's land stands above the south's.
    const north = LONDON.draw.land.north ?? [];
    expect(inside(north, LONDON.toPaper({ latE3: 51515, lonE3: -90 }))).toBe(true);
    expect(inside(LONDON.draw.land.south ?? [], LONDON.toPaper({ latE3: 51515, lonE3: -90 }))).toBe(false);
  });

  test("[R-WORLD-038] given the room abroad, which has no position of its own, when London's map stands it however it is handed, then its sticker is at the home spot off Choumert Road, on Peckham's card", () => {
    const [room] = placeStops([{ id: ROOM, state: "home", position: LAGOS_HOME_SPOT }], LONDON);
    expect(room?.at).toEqual(LONDON.toPaper(LONDON_HOME_SPOT));
    expect(LONDON_HOME_SPOT).toEqual({ latE3: 51471, lonE3: -73 });
    expect(room?.card).toBe("peckham");
    const peckham = cardOf("peckham");
    if (peckham === undefined || room === undefined) throw new Error("No Peckham card");
    expect(onCard(peckham, room.at, CARD.width, CARD.height, 16)).toBe(true);
  });

  test("[R-WORLD-038] given Heathrow, too far west for the paper, when London's map stands it, then its sticker is on the inset in the paper's south-west corner, on Camberwell's card, never where the fit alone would put it", () => {
    const heathrow = content.place[HEATHROW]?.position;
    if (heathrow === undefined || heathrow === null) throw new Error("Heathrow has no position");
    // By the fit alone it would stand far off the paper's west edge.
    expect(toPaperByFit(heathrow)[0]).toBeLessThan(-1000);
    const [stop] = placeStops([{ id: HEATHROW, state: "can", position: heathrow }], LONDON);
    expect(stop?.at).toEqual(INSET.at);
    const [x0, y0, x1, y1] = INSET.box;
    expect(stop !== undefined && stop.at[0] > x0 && stop.at[0] < x1 && stop.at[1] > y0 && stop.at[1] < y1).toBe(true);
    // In a corner: the paper's west edge and its foot are the nearest.
    expect(x0).toBeLessThan(LONDON_PAPER.width / 4);
    expect(y1).toBeGreaterThan((LONDON_PAPER.height * 3) / 4);
    expect(stop?.card).toBe("camberwell");
    const camberwell = cardOf("camberwell");
    if (camberwell === undefined || stop === undefined) throw new Error("No Camberwell card");
    expect(onCard(camberwell, stop.at, CARD.width, CARD.height, 16)).toBe(true);
  });
});

/** A position by London's fit alone, with no keeping on the paper. */
function toPaperByFit(position: { latE3: number; lonE3: number }): [number, number] {
  return [LONDON_FIT.xLon * position.lonE3 + LONDON_FIT.x0, LONDON_FIT.yLat * position.latE3 + LONDON_FIT.y0];
}

describe("Lagos beside London", () => {
  test("[R-WORLD-015] [R-WORLD-038] given the painted city the map draws by default, when it is read, then it is Lagos's own fit, paper, cards, drawing, strip and lantern canoe, so Lagos is drawn as its own", () => {
    expect(LAGOS.toPaper).toBe(toPaper);
    expect(LAGOS.fromPaper).toBe(fromPaper);
    expect(LAGOS.paper).toBe(PAPER);
    expect(LAGOS.cards).toBe(CARDS);
    expect(drawingOf(LAGOS.draw)).toBe(drawing());
    expect(LAGOS.canoe).toEqual(LANTERN_CANOE.at);
    expect(LAGOS.seaFrom).not.toBeNull();
    expect(drawing().rails).toBe("");
    // The strip folds the rows from the top of Ikeja to the beach, as before.
    expect(stripFrame(300)).toEqual(stripFrame(300, 84, LAGOS.strip, PAPER.width));
    // London has no canoe, no sea and no palms (R-WORLD-036 is Lagos's alone).
    expect(LONDON.canoe).toBeNull();
    expect(LONDON.seaFrom).toBeNull();
    expect(drawingOf(LONDON.draw).palmFronds).toBe("");
    expect(drawingOf(LONDON.draw).rails).not.toBe("");
  });

  test("[R-WORLD-038] given the client's code, when what imports London's drawing is read, then only the map's lazy load does, so it rides a chunk of its own and a first visit at home carries none of it", () => {
    const SRC = join(import.meta.dirname, "..", "..", "..");
    const files = (readdirSync(SRC, { recursive: true }) as string[]).filter((path) => /\.(ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path));
    const importers = files.filter((path) => /from\s+["'][./a-z]*\/?london["']/.test(readFileSync(join(SRC, path), "utf8")));
    expect(importers).toEqual([]);
    const map = readFileSync(join(SRC, "features", "map", "Map.tsx"), "utf8");
    expect(map).toContain('import("./paper/london")');
  });
});

const UK_CHOICE: CountryChoice = { id: "country.uk", name: "United Kingdom", locked: null };
const CANADA: CountryChoice = { id: "country.canada", name: "Canada", locked: null };

function ukPins(here: string): MapPin[] {
  const places = Object.values(content.place).filter((place) => place.where === "abroad" && (place.country === "country.uk" || place.id === ROOM));
  const built = new Set([...UK.map((place) => place.id), HEATHROW, ROOM]);
  return mapPins({ places, here, home: ROOM, homeSpot: LAGOS_HOME_SPOT, been: [], built, name: nameOf });
}

async function settle(selector: string): Promise<void> {
  for (let tries = 0; tries < 200 && document.querySelector(selector) === null; tries += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("the map abroad", () => {
  test("[R-WORLD-038] given Ada in Peckham, when the map opens in the UK, then it is London's painted map folded on Peckham's card with the strip, the stops kept as a list for a screen reader, and the probe names London's cards", async () => {
    await renderWithView(<Map pins={ukPins("place.peckham")} country={UK_CHOICE} countries={[UK_CHOICE, CANADA]} drawing={false} onGo={() => undefined} onClose={() => undefined} home={ROOM} />, engineView("scenario.ada"));
    await settle("[data-paper-map]");
    expect(document.querySelector("[data-paper-map]")).not.toBeNull();
    expect(document.querySelector('[data-card][data-current="true"]')?.getAttribute("data-card")).toBe("peckham");
    expect(document.querySelectorAll("[data-pager] i")).toHaveLength(5);
    expect(document.querySelector("[data-strip-home]")).not.toBeNull();
    expect(document.querySelector('[data-strip-landmark="city"]')).not.toBeNull();
    const list = screen.getByRole("list", { name: "Stops" });
    expect(list.className).toContain("sr-only");
    expect(list.querySelector('[data-stop="place.heathrow"]')).not.toBeNull();
    expect(document.querySelector("[data-map-hint]")).toBeNull();
    const stops = window.__map?.stops ?? [];
    expect(stops.find((stop) => stop.id === "place.office-uk")?.card).toBe("elephant");
    expect(stops.find((stop) => stop.id === HEATHROW)?.at).toEqual(INSET.at);
    expect(window.__map?.canoe).toBeNull();
    // The card's title and the district names are London's.
    expect(document.querySelector('[data-card="peckham"] [data-card-title]')?.textContent).toBe("Peckham");
  });

  test("[R-WORLD-038] [R-WORLD-017] given London's open map, when Heathrow's sticker on the inset is tapped, then its stop is picked with the ride sheet at the foot", async () => {
    await renderWithView(<Map pins={ukPins("place.peckham")} country={UK_CHOICE} countries={[UK_CHOICE]} drawing={false} onGo={() => undefined} onClose={() => undefined} home={ROOM} />, engineView("scenario.ada"));
    await settle("[data-paper-map]");
    fireEvent.click(document.querySelector("[data-strip]") as HTMLElement);
    await settle("[data-open-map]");
    const open = document.querySelector("[data-open-map]");
    expect(open?.querySelector(`[data-inset="${HEATHROW}"]`)).not.toBeNull();
    fireEvent.click(open?.querySelector(`[data-pin="${HEATHROW}"]`) as HTMLElement);
    expect(document.querySelector(`[data-ride-sheet="${HEATHROW}"]`)).not.toBeNull();
  });

  test("[R-WORLD-038] given Canada, which has its own painted map, when the map opens there, then the stops stand as a list for a screen reader alone, with no hint, and Calgary's paper is drawn, not London's", async () => {
    const pins: MapPin[] = [{ id: "place.calgary-north-east", name: "north-east Calgary", state: "here", position: { latE3: 51090, lonE3: -113960 }, things: 1 }];
    await renderWithView(<Map pins={pins} country={CANADA} countries={[CANADA]} drawing={false} onGo={() => undefined} onClose={() => undefined} />, engineView("scenario.ada"));
    await settle("[data-paper-map]");
    const list = screen.getByRole("list", { name: "Stops" });
    expect(list.className).toContain("sr-only");
    expect(document.querySelector("[data-map-hint]")).toBeNull();
    expect(document.querySelector("[data-paper-map]")).not.toBeNull();
    expect(document.querySelector('[data-strip-landmark="city"]')).toBeNull();
    expect(document.querySelector('[data-card][data-current="true"]')?.getAttribute("data-card")).toBe("north-east");
  });
});
