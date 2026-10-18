import { join } from "node:path";

import { type Footprint, inBox, isFootprint, onWalkable, placeFootprint } from "@japacity/model-kit";
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { measureFile } from "../../../../../../tools/assets/assets-check";
import hubFile from "../../../../public/assets/places/ojuelegba/place.json";
import { hash } from "../crowd";
import type { PlaceFile, Stage } from "../placeFile";
import { WALK_SPEED } from "../walk";
import { CELL, CLEARANCE, FREE, groundAt, HARD, type Point, routeMap } from "./map";
import { findRoute } from "./route";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..", "..", "..");
const PATHS = { root: ROOT, source: join(ROOT, "models"), public: join(ROOT, "apps", "client", "public", "assets"), dist: "" };
const hub = (hubFile as unknown as PlaceFile).stage as Stage;

/** Every footprint a stage's models carry, read from the shipped files as the city reads them. */
async function footprintsOf(stage: Stage): Promise<Map<string, Footprint>> {
  const found = new Map<string, Footprint>();
  for (const model of stage.models) {
    const { extras } = await measureFile(PATHS, model.file);
    if (isFootprint(extras.footprint)) found.set(model.file, extras.footprint);
  }
  return found;
}

const hubFootprints = await footprintsOf(hub);
const hubMap = routeMap(hub, (file) => hubFootprints.get(file) ?? null);
const danfos = (hub.models.find((model) => model.file === "shared/vehicle/vehicle_danfo.glb")?.at ?? []).flatMap((at) => placeFootprint(hubFootprints.get("shared/vehicle/vehicle_danfo.glb") ?? "none", at));

/** A small yard: 20 m square, a 4 m wall across its middle from the left, a stall's 2 m box on the right. */
const yard: Stage = {
  ground: { size: [40, 40], colour: "laterite" },
  roads: [],
  light: { sun: [0, 10, 0], sky: "sky", ground: "laterite" },
  start: [0, 8, 0],
  walkable: [[[-10, -10], [10, -10], [10, 10], [-10, 10]], [[20, 0], [22, 0], [22, 2], [20, 2]]],
  models: [{ file: "wall", at: [[-4, 0, 0]] }, { file: "stall", at: [[6, 0, 0]] }],
  people: [],
  motion: [],
};
const yardMap = routeMap(yard, (file) => (file === "wall" ? [{ x: 0, z: 0, width: 12, depth: 0.4 }] : file === "stall" ? [{ x: 0, z: 0, width: 2, depth: 2 }] : null));

/** Every point along a route, from where the walker stands, a few centimetres apart. */
function along(from: Point, route: readonly Point[]): Point[] {
  const points: Point[] = [];
  let at = from;
  for (const next of route) {
    const steps = Math.max(1, Math.ceil(Math.hypot(next.x - at.x, next.z - at.z) / 0.02));
    for (let step = 0; step <= steps; step += 1) points.push({ x: at.x + ((next.x - at.x) * step) / steps, z: at.z + ((next.z - at.z) * step) / steps });
    at = next;
  }
  return points;
}

function length(from: Point, route: readonly Point[]): number {
  let at = from;
  let total = 0;
  for (const next of route) {
    total += Math.hypot(next.x - at.x, next.z - at.z);
    at = next;
  }
  return total;
}

describe("the route map", () => {
  test("[city:tap-to-walk] given the route map, when its figures are read, then cells are 25 cm, the clearance is the tuning's stop-short distance and the pace its walking pace", () => {
    expect(CELL).toBe(0.25);
    expect(CLEARANCE * 1000).toBe(content.tuning.city.stopShortMm);
    expect(WALK_SPEED * 1000).toBe(content.tuning.city.walkMmPerS);
  });

  test("[city:tap-to-walk] given a yard with a wall and a stall, when the map is built, then the wall is hard, the band within the clearance is not free, open ground is free and off the walkable ground is hard", () => {
    expect(groundAt(yardMap, -4, 0)).toBe(HARD);
    expect(groundAt(yardMap, -4, 0.35)).not.toBe(FREE);
    expect(groundAt(yardMap, -4, 0.6)).toBe(FREE);
    expect(groundAt(yardMap, 6.9, 0)).toBe(HARD);
    expect(groundAt(yardMap, 0, -9.9)).toBe(FREE);
    expect(groundAt(yardMap, 15, 0)).toBe(HARD);
    expect(groundAt(yardMap, 30, 0)).toBe(HARD);
  });
});

describe("tap to walk", () => {
  test("[city:tap-to-walk] given open ground between the character and the tap, when the tap is routed, then it is one straight leg to the tap", () => {
    expect(findRoute(yardMap, { x: 0, z: 8 }, { x: 4, z: 5 })).toEqual([{ x: 4, z: 5 }]);
  });

  test("[city:tap-to-walk] given a wall between the character and the tap, when the tap is routed, then the route goes round its end, keeps the clearance and ends at the tap", () => {
    const from = { x: -4, z: 6 };
    const to = { x: -4, z: -6 };
    const route = findRoute(yardMap, from, to);
    expect(route[route.length - 1]).toEqual(to);
    expect(length(from, route)).toBeGreaterThan(12 + 2);
    const wall = placeFootprint([{ x: 0, z: 0, width: 12, depth: 0.4 }], [-4, 0, 0]);
    for (const point of along(from, route)) expect(wall.some((box) => inBox(box, point.x, point.z, CLEARANCE - CELL))).toBe(false);
  });

  test("[city:tap-to-walk] given a tap on the stall itself, when it is routed, then the character stops at the nearest free ground, the clearance short of it", () => {
    const route = findRoute(yardMap, { x: 6, z: 6 }, { x: 6, z: 0.5 });
    const end = route[route.length - 1] ?? { x: 0, z: 0 };
    expect(groundAt(yardMap, end.x, end.z)).toBe(FREE);
    expect(end.z).toBeGreaterThan(1 + CLEARANCE - 0.01);
    expect(end.z).toBeLessThan(1 + CLEARANCE + CELL + 0.01);
  });

  test("[city:tap-to-walk] given a spot beside the stall inside its clearance, when a tap and a stroll are routed to it, then the tap stops short of the stall and the stroll ends on the spot", () => {
    const spot = { x: 6, z: 1.15 };
    const tap = findRoute(yardMap, { x: 6, z: 6 }, spot);
    expect(tap[tap.length - 1]).not.toEqual(spot);
    const stroll = findRoute(yardMap, { x: 6, z: 6 }, spot, true);
    expect(stroll[stroll.length - 1]).toEqual(spot);
  });

  test("[city:tap-to-walk] given a tap off the walkable ground or on ground the character cannot reach, when it is routed, then the walk ends on the character's own part of the ground", () => {
    for (const to of [{ x: 15, z: 1 }, { x: 21, z: 1 }]) {
      const route = findRoute(yardMap, { x: 0, z: 8 }, to);
      const end = route[route.length - 1] ?? { x: 0, z: 0 };
      expect(groundAt(yardMap, end.x, end.z)).toBe(FREE);
      expect(end.x).toBeLessThanOrEqual(10);
    }
  });

  test("[city:tap-to-walk] given the hub's route map and 300 taps anywhere on and around its ground one after another from the start, when each is routed, then no route passes through a danfo or leaves the walkable ground", () => {
    let at: Point = { x: hub.start[0], z: hub.start[1] };
    for (let tap = 0; tap < 300; tap += 1) {
      const to = { x: -26 + (hash(`hub|${String(tap)}|x`) % 5000) / 100, z: -28 + (hash(`hub|${String(tap)}|z`) % 4400) / 100 };
      const route = findRoute(hubMap, at, to);
      const points = along(at, route);
      expect(points.filter((point) => danfos.some((box) => inBox(box, point.x, point.z)))).toEqual([]);
      expect(points.filter((point) => !onWalkable(hub.walkable ?? [], point.x, point.z))).toEqual([]);
      at = route[route.length - 1] ?? at;
    }
  });

  test("[city:tap-to-walk] given the hub, when the character on the pavement is sent across the bay behind a danfo, then the route goes round them rather than through", () => {
    const from = { x: 1.6, z: 6.2 };
    const to = { x: 1.6, z: 1.4 };
    const through = [from, to];
    expect(along(from, [to]).some((point) => danfos.some((box) => inBox(box, point.x, point.z)))).toBe(true);
    const route = findRoute(hubMap, from, to);
    expect(route.length).toBeGreaterThan(through.length - 1);
    expect(along(from, route).some((point) => danfos.some((box) => inBox(box, point.x, point.z)))).toBe(false);
  });
});
