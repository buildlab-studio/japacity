// The painted map's pure parts (docs/rules/world.md R-WORLD-015): the one fit from positions to the paper, the seeded
// layout, which card a place belongs to, the spread of close places, the ring and name rule, the fold's states, the
// route along the roads and its channel.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { CARD_IDS, CARDS, cardById, cardOf, onCard } from "./districts";
import { groundOf } from "./draw";
import { fold, folded, openingCard, PULL_OPENS, DRAG_FULL, unfolded } from "./fold";
import { at, fromPaper, PAPER, toPaper } from "./fit";
import { LAND, ROADS } from "./geometry";
import { buildGraph, midway, routeBetween, routeChannel } from "./route";
import { inside, near, nearLine, scatter, sequence, TUNING } from "./scatter";
import { curve, loop } from "./smooth";
import { APART, nameOf, namesShown, placeStops, ringOf, spread } from "./stops";

const PUBLIC = join(import.meta.dirname, "..", "..", "..", "..", "public", "assets", "places");
/** The places of Lagos with a published model and a position, as the map stands them. */
const BUILT = (() => {
  const folders = new Set(readdirSync(PUBLIC));
  return Object.values(content.place).filter((place) => place.where === "home" && place.position !== null && folders.has(place.assets));
})();
const whole = (value: number): boolean => Number.isInteger(value);
const onLand = (point: readonly [number, number]): boolean => Object.values(LAND).some((piece) => inside(piece, point));
/** A phone's card, as the folding map lays it out at 390 by 844. */
const CARD = { width: 350, height: 614 };

describe("the painted map's fit", () => {
  test("[R-WORLD-015] given a position, when it is laid on the paper, then the one affine fit gives whole numbers, north up, the paper's corners at its edges, and undoing it gives the position back", () => {
    expect(toPaper({ latE3: 6625, lonE3: 3290 })).toEqual([0, 0]);
    expect(toPaper({ latE3: 6395, lonE3: 3480 })).toEqual([PAPER.width, PAPER.height]);
    for (const place of BUILT) {
      const point = toPaper(place.position ?? { latE3: 0, lonE3: 0 });
      expect(point.every(whole)).toBe(true);
      expect(fromPaper(point)).toEqual(place.position);
    }
    // Further north is higher on the paper, further east is further right.
    const [ojuelegbaX, ojuelegbaY] = at([6511, 3362]);
    const [ikejaX, ikejaY] = at([6594, 3340]);
    const [ikoyiX, ikoyiY] = at([6452, 3428]);
    expect(ikejaY).toBeLessThan(ojuelegbaY);
    expect(ikoyiY).toBeGreaterThan(ojuelegbaY);
    expect(ikoyiX).toBeGreaterThan(ojuelegbaX);
    expect(ikejaX).toBeLessThan(ojuelegbaX);
  });

  test("[R-WORLD-015] given every built place of Lagos, when the fit lays it on the drawing, then each stands on land, but Makoko's stilts and the bridge stand on the lagoon, and the landmarks are where Lagos has them", () => {
    const water = new Set(["place.makoko", "place.third-mainland-bridge"]);
    for (const place of BUILT) {
      const point = toPaper(place.position ?? { latE3: 0, lonE3: 0 });
      expect({ id: place.id, land: onLand(point) }).toEqual({ id: place.id, land: !water.has(place.id) });
    }
    const piece = (id: string): string | undefined => {
      const point = toPaper(content.place[id as keyof typeof content.place]?.position ?? { latE3: 0, lonE3: 0 });
      return Object.entries(LAND).find(([, ring]) => inside(ring, point))?.[0];
    };
    expect(piece("place.national-stadium")).toBe("mainland");
    expect(piece("place.computer-village")).toBe("mainland");
    expect(piece("place.passport-office")).toBe("island");
    expect(piece("place.visa-centre")).toBe("coast");
  });

  test("[R-WORLD-015] given a new place with a position, when it is placed, then it falls in its district's card by itself, and every built place shows on its own card", () => {
    expect(cardOf({ latE3: 6452, lonE3: 3428 })).toBe("island");
    expect(cardOf({ latE3: 6430, lonE3: 3426 })).toBe("island");
    expect(cardOf({ latE3: 6595, lonE3: 3345 })).toBe("ikeja");
    expect(cardOf({ latE3: 6505, lonE3: 3374 })).toBe("yaba");
    expect(cardOf({ latE3: 6448, lonE3: 3460 })).toBe("lekki");
    expect(cardOf({ latE3: 6496, lonE3: 3391 })).toBe("makoko");
    expect(cardOf({ latE3: 6475, lonE3: 3369 })).toBe("ebute");
    expect(cardOf({ latE3: 6488, lonE3: 3354 })).toBe("bode");
    expect(cardOf({ latE3: 6514, lonE3: 3360 })).toBe("ojuelegba");
    const cardOfId = (id: string): string => cardOf(content.place[id as keyof typeof content.place]?.position ?? { latE3: 0, lonE3: 0 });
    expect(cardOfId("place.family-house")).toBe("surulere");
    expect(cardOfId("place.national-stadium")).toBe("surulere");
    expect(cardOfId("place.ojuelegba")).toBe("ojuelegba");
    expect(cardOfId("place.tejuosho-market")).toBe("yaba");
    expect(cardOfId("place.bode-thomas")).toBe("bode");
    expect(cardOfId("place.third-mainland-bridge")).toBe("makoko");
    expect(cardOfId("place.passport-office")).toBe("island");
    expect(cardOfId("place.airport-lagos")).toBe("ikeja");
    const placed = placeStops(BUILT.map((place) => ({ id: place.id, state: "can", position: place.position ?? { latE3: 0, lonE3: 0 } })));
    for (const stop of placed) expect({ id: stop.id, shows: onCard(cardById(stop.card), stop.at, CARD.width, CARD.height, 16) }).toEqual({ id: stop.id, shows: true });
    // The cards swipe in the city's order, one for each neighbourhood.
    expect(CARDS.map((card) => card.id)).toEqual([...CARD_IDS]);
  });
});

describe("the seeded layout", () => {
  test("[R-WORLD-015] given the same ground and seed, when the houses, trees and waves are placed twice, then they are the same, in whole numbers, and another seed gives another city", () => {
    const ground = groundOf();
    const first = scatter(ground);
    const second = scatter(ground);
    expect(second).toEqual(first);
    expect(first.houses.length).toBeGreaterThan(400);
    expect(first.closeHouses.length).toBeGreaterThan(200);
    expect(first.waves.length).toBeGreaterThan(50);
    for (const house of [...first.houses, ...first.closeHouses]) expect([house.x, house.y, house.roof].every(whole)).toBe(true);
    const other = scatter(ground, { ...TUNING, seed: TUNING.seed + 1 });
    expect(other.houses).not.toEqual(first.houses);
    // The sequence itself: whole numbers below the bound, the same from the same seed.
    const a = sequence(7);
    const b = sequence(7);
    const drawn = Array.from({ length: 50 }, () => a(10));
    expect(drawn).toEqual(Array.from({ length: 50 }, () => b(10)));
    expect(drawn.every((value) => whole(value) && value >= 0 && value < 10)).toBe(true);
  });

  test("[R-WORLD-015] given the layout, when it is read, then every house and tree stands on land clear of the coast, the roads and the places, and every wave is on open water", () => {
    const ground = groundOf();
    const { houses, trees, waves, closeHouses, closeTrees } = scatter(ground);
    const grain: (readonly [number, number])[] = [...houses.map((house) => [house.x, house.y] as const), ...trees, ...closeHouses.map((house) => [house.x, house.y] as const), ...closeTrees];
    for (const point of grain) {
      expect(onLand(point)).toBe(true);
      expect(ground.roads.some((road) => nearLine(point, road.points, road.reach))).toBe(false);
      expect(ground.clear.some(([x, y, radius]) => (x - point[0]) ** 2 + (y - point[1]) ** 2 < radius * radius)).toBe(false);
    }
    for (const point of waves) expect(onLand(point)).toBe(false);
  });

  test("[R-WORLD-015] given the drawing's lines, when they are softened into curves, then every number in the path is whole", () => {
    const paths = [...Object.values(LAND).map(loop), ...ROADS.map((road) => curve(road.points))];
    for (const d of paths) expect(d).not.toMatch(/\d\.\d/);
    expect(near([0, 5], [-10, 0], [10, 0], 5)).toBe(true);
    expect(near([0, 6], [-10, 0], [10, 0], 5)).toBe(false);
  });
});

describe("the stickers, the rings and the names", () => {
  test("[R-WORLD-015] given places a few hundred metres apart, when they are spread, then the spread is the same each time, in whole numbers, leaves each near its own point and no two closer than the stickers need", () => {
    const points = BUILT.map((place) => ({ id: place.id, at: toPaper(place.position ?? { latE3: 0, lonE3: 0 }) }));
    const once = spread(points);
    expect(spread([...points].reverse())).toEqual(once);
    for (const { id, at: from } of points) {
      const to = once.get(id) ?? [0, 0];
      expect(to.every(whole)).toBe(true);
      expect(Math.hypot(to[0] - from[0], to[1] - from[1])).toBeLessThanOrEqual(APART);
    }
    const spots = [...once.values()];
    for (let first = 0; first < spots.length; first += 1) {
      for (let second = first + 1; second < spots.length; second += 1) {
        const a = spots[first] ?? [0, 0];
        const b = spots[second] ?? [0, 0];
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(APART - 2);
      }
    }
  });

  test("[R-WORLD-015] given the stops, when the ring and the name are read, then a ring is only where the player stands, on the stop picked and on the step's place, and a name is on those, on home and on a place never visited", () => {
    const marks = { home: "place.family-house", picked: "place.passport-office", step: "place.visa-centre" };
    expect(ringOf({ id: "place.ojuelegba", state: "here" }, marks)).toBe("here");
    expect(ringOf({ id: "place.passport-office", state: "can" }, marks)).toBe("picked");
    expect(ringOf({ id: "place.visa-centre", state: "not" }, marks)).toBe("step");
    expect(ringOf({ id: "place.family-house", state: "home" }, marks)).toBeNull();
    expect(ringOf({ id: "place.tejuosho-market", state: "can" }, marks)).toBeNull();
    expect(nameOf({ id: "place.ojuelegba", state: "here" }, marks)).toBe("here");
    expect(nameOf({ id: "place.passport-office", state: "can" }, marks)).toBe("picked");
    expect(nameOf({ id: "place.visa-centre", state: "not" }, marks)).toBe("step");
    expect(nameOf({ id: "place.family-house", state: "home" }, marks)).toBe("home");
    expect(nameOf({ id: "place.tejuosho-market", state: "can" }, marks)).toBe("new");
    expect(nameOf({ id: "place.bode-thomas", state: "been" }, marks)).toBeNull();
    expect(nameOf({ id: "place.airport-lagos", state: "not" }, marks)).toBeNull();
  });

  test("[R-WORLD-015] given names that would cover each other, when the names to show are chosen, then every name that matters shows and a never-visited place's name shows only where it covers none", () => {
    const box = (id: string, x: number, y: number, name: "here" | "home" | "picked" | "step" | "new") => ({ id, x, y, width: 80, height: 20, name });
    const shown = namesShown([box("here", 100, 100, "here"), box("home", 110, 104, "home"), box("covered", 120, 98, "new"), box("clear", 300, 300, "new"), box("second", 305, 302, "new")]);
    // Of two never-visited names on each other, the one nearer the foot of the screen shows.
    expect([...shown].sort()).toEqual(["here", "home", "second"]);
  });
});

describe("the fold", () => {
  test("[R-WORLD-015] given the map folded on a card, when the strip is tapped, then it opens and settles open; a tap on a district folds it back on that district's card and it settles folded", () => {
    let state = folded("ojuelegba");
    expect(unfolded(state)).toBe(false);
    state = fold(state, { type: "tap-strip" });
    expect(state.phase).toBe("opening");
    expect(unfolded(state)).toBe(true);
    state = fold(state, { type: "settled" });
    expect(state.phase).toBe("open");
    // A swipe does nothing while the map is open.
    expect(fold(state, { type: "swipe", card: "lekki" })).toEqual(state);
    state = fold(state, { type: "tap-district", card: "island" });
    expect(state).toMatchObject({ phase: "closing", card: "island" });
    state = fold(state, { type: "settled" });
    expect(state).toEqual({ phase: "folded", card: "island", pull: 0 });
    expect(fold(state, { type: "swipe", card: "lekki" }).card).toBe("lekki");
  });

  test("[R-WORLD-015] given a drag down on the strip, when it is let go, then past the pull that opens it the map opens, and short of it the map folds back, the pull in whole numbers", () => {
    const start = folded("yaba");
    const short = fold(start, { type: "drag", dy: Math.floor((DRAG_FULL * (PULL_OPENS - 1)) / 100) });
    expect(short.pull).toBe(PULL_OPENS - 1);
    expect(unfolded(short)).toBe(true);
    expect(fold(short, { type: "release" })).toEqual(start);
    const far = fold(start, { type: "drag", dy: DRAG_FULL });
    expect(far.pull).toBe(100);
    expect(fold(far, { type: "release" }).phase).toBe("opening");
    expect(fold(start, { type: "drag", dy: DRAG_FULL * 3 }).pull).toBe(100);
    expect(fold(start, { type: "drag", dy: -40 }).pull).toBe(0);
  });

  test("[R-WORLD-015] given what is live, when the map opens, then it opens on the stop picked, else the step's neighbourhood, else where the player stands", () => {
    expect(openingCard({ picked: "island", step: "yaba", here: "surulere", fallback: "ojuelegba" })).toBe("island");
    expect(openingCard({ picked: null, step: "yaba", here: "surulere", fallback: "ojuelegba" })).toBe("yaba");
    expect(openingCard({ picked: null, step: null, here: "surulere", fallback: "ojuelegba" })).toBe("surulere");
    expect(openingCard({ picked: null, step: null, here: null, fallback: "ojuelegba" })).toBe("ojuelegba");
  });
});

describe("the route", () => {
  const graph = buildGraph();
  const spot = (id: string): readonly [number, number] => toPaper(content.place[id as keyof typeof content.place]?.position ?? { latE3: 0, lonE3: 0 });

  test("[R-WORLD-015] [R-WORLD-017] given a stop across the water, when the route is found, then it runs from the player's stop along the roads and over a bridge to the stop, every leg a road's own", () => {
    const route = routeBetween(graph, spot("place.ojuelegba"), spot("place.passport-office"));
    expect(route[0]).toEqual(spot("place.ojuelegba"));
    expect(route[route.length - 1]).toEqual(spot("place.passport-office"));
    const legs = new Set(ROADS.flatMap((road) => road.points.slice(1).map((point, index) => `${String(road.points[index])}>${String(point)}`)));
    const inner = route.slice(1, -1);
    for (let index = 1; index < inner.length; index += 1) {
      const a = String(inner[index - 1]);
      const b = String(inner[index]);
      expect(legs.has(`${a}>${b}`) || legs.has(`${b}>${a}`)).toBe(true);
    }
    // It crosses to the island on a bridge.
    const bridged = ROADS.filter((road) => road.bridge !== undefined).flatMap((road) => road.points.map(String));
    expect(inner.some((point) => bridged.includes(String(point)))).toBe(true);
    expect(midway(route).at.every(whole)).toBe(true);
  });

  test("[R-WORLD-015] given a stop picked, when the route's channel is read, then it is the card within the neighbourhood, the strip across the city, and the open map whenever it is open or on a laptop", () => {
    expect(routeChannel({ open: false, wide: false, sameCard: true })).toBe("card");
    expect(routeChannel({ open: false, wide: false, sameCard: false })).toBe("strip");
    expect(routeChannel({ open: true, wide: false, sameCard: true })).toBe("open");
    expect(routeChannel({ open: true, wide: false, sameCard: false })).toBe("open");
    expect(routeChannel({ open: false, wide: true, sameCard: false })).toBe("open");
  });
});

describe("the night paint", () => {
  test("[R-WORLD-015] given the night paint, when the map's colours are read, then the paper darkens, the windows light and the stickers glow", () => {
    const css = readFileSync(join(import.meta.dirname, "paper.css"), "utf8");
    const night = css.slice(css.indexOf('[data-paint="night"] .paper,'), css.indexOf("}", css.indexOf('[data-paint="night"] .paper,')));
    expect(night).toContain("--map-paper: #223056");
    expect(night).toContain("--win: #ffd66b");
    expect(night).toContain("--glow-sticker: rgba(255, 205, 110, 0.6)");
    expect(night).toContain("--lamps: #ffd66b");
  });
});
