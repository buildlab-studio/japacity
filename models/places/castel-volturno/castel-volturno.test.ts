// Castel Volturno's models and stage files (docs/design/11-the-three-countries-on-the-mold.md sections 3 and 6): the
// pieces of the roundabout, the Domitiana and the fields, the coast road's bus and the gangmaster's van, each standing on
// y = 0 with its footprint and only palette colours, the two vehicles built to be sat in with the ride's seat inside the
// body on the kerb side, and the three stage files held beside their sources inside the world's limits.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Footprint, footprintOf, isPaletteName, signAnchorsOf } from "@japacity/model-kit";
import { Box3, type Group, type Mesh, Vector3 } from "three";
import { describe, expect, test } from "vitest";

import { checkWalkable } from "../../../tools/assets/footprint-check";
import { checkLimits, checkThings } from "../../../tools/assets/world-check";
import { buildGazeboStall } from "../../props/london/build";
import { buildStreetBench } from "../../props/street-bench/build";
import { buildItalyBus, ITALY_BUS, ITALY_BUS_SEAT } from "../../vehicles/italy-bus/build";
import { buildVan, VAN, VAN_SEAT } from "../../vehicles/van/build";
import * as farm from "../farm-italy/build";
import { buildPine } from "../via-domitiana/build";
import * as castel from "./build";

const HERE = import.meta.dirname;
const spec = (folder: string, name: string): castel.PlasterRowSpec => JSON.parse(readFileSync(join(HERE, "..", folder, name, "spec.json"), "utf8")) as castel.PlasterRowSpec;
const ROWS: [string, castel.PlasterRowSpec][] = [
  ["building_castel-row_a", spec("castel-volturno", "row-a")],
  ["building_castel-row_b", spec("castel-volturno", "row-b")],
  ["building_domitiana-block", spec("via-domitiana", "block")],
];
const STOP = { board: "white", ink: "blue" } as const;

/** Every model the three places stand, by its shipped path, with its builder. */
const MODELS: [string, string, () => Group][] = [
  ...ROWS.map(([name, data]): [string, string, () => Group] => [name, `places/${name.includes("domitiana") ? "via-domitiana" : "castel-volturno"}/${name}.glb`, () => castel.buildPlasterRow(data, 2.1)]),
  ["prop_roundabout", "places/castel-volturno/prop_roundabout.glb", () => castel.buildRoundabout("place.castel-volturno.sign.roundabout", { board: "blue", ink: "white" })],
  ["prop_bar-counter", "places/castel-volturno/prop_bar-counter.glb", castel.buildBarCounter],
  ["prop_palm", "places/castel-volturno/prop_palm.glb", castel.buildPalm],
  ["prop_bus-pole", "places/castel-volturno/prop_bus-pole.glb", () => castel.buildBusPole("place.castel-volturno.sign.stop", STOP)],
  ["prop_pine", "places/via-domitiana/prop_pine.glb", buildPine],
  ["prop_crop-row", "places/farm-italy/prop_crop-row.glb", farm.buildCropRow],
  ["prop_tarp-table", "places/farm-italy/prop_tarp-table.glb", () => farm.buildTarpTable("place.farm-italy.sign.table", { board: "tan", ink: "black" })],
  ["prop_field-crates", "places/farm-italy/prop_field-crates.glb", farm.buildFieldCrates],
  ["prop_water-tap", "places/farm-italy/prop_water-tap.glb", farm.buildWaterTap],
  ["prop_shade-tree", "places/farm-italy/prop_shade-tree.glb", farm.buildShadeTree],
  ["vehicle_italy-bus", "shared/vehicle/vehicle_italy-bus.glb", buildItalyBus],
  ["vehicle_van", "shared/vehicle/vehicle_van.glb", buildVan],
];
/** The pieces of London's places the Domitiana and the roundabout stand again, as they are. */
const BORROWED: [string, () => Group][] = [
  ["places/peckham/prop_street-bench.glb", buildStreetBench],
  ["places/rye-lane/prop_gazebo-stall.glb", buildGazeboStall],
];

function bounds(model: Group): Box3 {
  model.updateMatrixWorld(true);
  return new Box3().setFromObject(model);
}

describe("Castel Volturno's models", () => {
  test.each(MODELS)("[assets:metre-units-and-origin] [assets:models-record-their-footprint] given %s, when it is built, then it stands on y = 0 and records the ground it blocks", (name, _, build) => {
    const model = build();
    expect(model.name).toBe(name);
    expect(Math.abs(bounds(model).min.y)).toBeLessThanOrEqual(0.01);
    const footprint = footprintOf(model);
    expect(Array.isArray(footprint) && footprint.length > 0).toBe(true);
  });

  test.each(MODELS)("[assets:colours-from-named-palette] given %s, when it is built, then every part names a palette colour", (_, __, build) => {
    build().traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const colour = (mesh.material as { userData: { palette?: string } }).userData.palette ?? "";
      expect(isPaletteName(colour)).toBe(true);
    });
  });

  test.each(ROWS)("[assets:sign-text-drawn-in-code] given %s's numbers, when the row is built, then it leaves one board for each bar, shop and barber, keyed in unit order", (_, data) => {
    const boards = signAnchorsOf(castel.buildPlasterRow(data, 2.1)).map((anchor) => anchor.key);
    expect(boards).toEqual(data.signs);
    expect(boards).toHaveLength(data.units.filter((unit) => castel.hasBoard(unit.kind)).length);
  });

  test("[assets:dishes-face-one-satellite] given the roundabout's two rows and the Domitiana's block, when they are built with the place's yaw, then every dish faces the same way", () => {
    const dishes = ROWS.flatMap(([, data]) => (castel.buildPlasterRow(data, 2.1).userData.dishes ?? []) as [number, number, number][]);
    expect(dishes.length).toBe(ROWS.length);
    for (const dish of dishes) for (const [axis, value] of dish.entries()) expect(value).toBeCloseTo(dishes[0]?.[axis] ?? 0, 5);
  });

  test("[assets:metre-units-and-origin] given the bus and the van, when they are built, then each faces +Z, its length along z and its footprint centred", () => {
    for (const build of [buildItalyBus, buildVan]) {
      const box = bounds(build());
      const size = box.getSize(new Vector3());
      expect(size.z).toBeGreaterThan(size.x * 2);
      expect(Math.abs(box.min.x + box.max.x)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(box.min.z + box.max.z)).toBeLessThanOrEqual(0.05);
    }
  });

  test("[world:ride-abroad-and-workplace] given the bus's window seat and the van's bench, when the ride's seat is read, then the eye stands inside the body, over the floor and under the roof, and the window it looks out of is on the kerb side, -x, as Italy drives on the right", () => {
    const bus = bounds(buildItalyBus());
    const [bx, by, bz] = ITALY_BUS_SEAT.eye;
    expect(bus.containsPoint(new Vector3(bx, by, bz))).toBe(true);
    expect(by).toBeGreaterThan(ITALY_BUS.sill);
    expect(by).toBeLessThan(ITALY_BUS.head);
    expect(bx).toBeLessThan(0);
    expect(ITALY_BUS_SEAT.window[0]).toBeLessThan(bx);
    const van = bounds(buildVan());
    const [vx, vy, vz] = VAN_SEAT.eye;
    expect(van.containsPoint(new Vector3(vx, vy, vz))).toBe(true);
    // Low on the bench: the eye under the small window's top, so the road shows only in the pane.
    expect(vy).toBeGreaterThan(VAN.bench);
    expect(vy).toBeLessThan(VAN.window[1]);
    expect(VAN_SEAT.window[0]).toBeLessThan(vx);
  });
});

type Spot = [number, number, number];

/** A stage file as these tests read it: the parts the world's checks read, its models' boards and its things. */
interface ParkedFile {
  place: string;
  scope: "exterior" | "interior";
  people: { low: number; high: number };
  instances: { file: string; count: number }[];
  stage: {
    shot?: { width?: number };
    walkable?: [number, number][][];
    ground: { size: [number, number] };
    motion: { kind: string }[];
    start: Spot;
    people: Spot[];
    models: { file: string; at: Spot[]; signs?: string[][] }[];
    things: { id: string; file: string; copy: number; label: string; at: [number, number]; acts: { stages?: string }[] }[];
  };
}

// The stage files are read where the client reads them, under public/assets/places.
const PUBLIC_PLACES = join(HERE, "..", "..", "..", "apps", "client", "public", "assets", "places");
const parked = (folder: string): ParkedFile => JSON.parse(readFileSync(join(PUBLIC_PLACES, folder, "place.json"), "utf8")) as ParkedFile;
const FILES: [string, ParkedFile][] = ["castel-volturno", "via-domitiana", "farm-italy"].map((folder) => [folder, parked(folder)]);
const builders = new Map<string, () => Group>([...MODELS.map(([, file, build]): [string, () => Group] => [file, build]), ...BORROWED]);

describe("Castel Volturno's stage files", () => {
  test.each(FILES)("[world:place-is-one-screen] [world:things-are-tappable-models] given %s's file, when its limits and things are read, then it is one frontage of about 24 metres inside the crowd's caps, and every thing has one or two acts", (_, file) => {
    expect(file.scope).toBe("exterior");
    expect(checkLimits(file)).toEqual([]);
    expect(checkThings(file)).toEqual([]);
  });

  test.each(FILES)("[assets:assets-and-places-within-budget] given %s's file, when its instances are read, then they are the copies its models stand, each a model of the three places or one borrowed from London's", (_, file) => {
    expect(file.instances).toEqual(file.stage.models.map((model) => ({ file: model.file, count: model.at.length })));
    for (const model of file.stage.models) expect(builders.has(model.file)).toBe(true);
  });

  test.each(FILES)("[city:place-words-are-text-keys] given %s's lettered models, when their boards are read, then every copy has a key of the place's own for each board, and no key shows twice", (_, file) => {
    const keys: string[] = [];
    for (const model of file.stage.models.filter((candidate) => candidate.signs !== undefined)) {
      const boards = signAnchorsOf(builders.get(model.file)?.() ?? ({} as Group)).length;
      expect(model.signs).toHaveLength(model.at.length);
      for (const copy of model.signs ?? []) {
        expect(copy).toHaveLength(boards);
        keys.push(...copy);
      }
    }
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((key) => !key.startsWith(`${file.place}.sign.`))).toEqual([]);
  });

  test.each(FILES)("[world:things-are-tappable-models] [assets:models-record-their-footprint] given %s's things and spots, when they are placed, then each thing stands at a copy of a staged model, and the start, every spot and every thing's walk-to stand on walkable ground clear of every footprint", (_, file) => {
    const footprints = new Map<string, Footprint>();
    for (const model of file.stage.models) {
      const footprint = footprintOf(builders.get(model.file)?.() ?? ({} as Group));
      if (footprint !== null) footprints.set(model.file, footprint);
    }
    for (const thing of file.stage.things) {
      const model = file.stage.models.find((candidate) => candidate.file === thing.file);
      expect(model?.at.length ?? 0).toBeGreaterThan(thing.copy);
    }
    const walks = file.stage.things.map((thing): Spot => [thing.at[0], thing.at[1], 0]);
    expect(checkWalkable(file.place, { ...file.stage, people: [...file.stage.people, ...walks] }, footprints)).toEqual([]);
  });
});
