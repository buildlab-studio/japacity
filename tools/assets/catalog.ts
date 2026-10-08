// Every shipped asset, where its source is and how it is built (decision 0005 section 4).
// The export, the shooter, the outline scorer and the check all start here.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { BuildingSpec, SignStyle } from "@japacity/assets";
import { buildBuilding, type BuildingOptions, DEFAULT_DISH_YAW, pole } from "@japacity/assets/kit";
import { drawPattern } from "@japacity/assets/pattern";
import { buildFlyoverSpan } from "@japacity/assets-src/bld/flyover-span/build";
import { buildStiltHouse } from "@japacity/assets-src/bld/stilt-house/build";
import { buildTerminalFront } from "@japacity/assets-src/bld/terminal-front/build";
import { buildStadium } from "@japacity/assets-src/lm/national-stadium/build";
import { buildBridgeSpan } from "@japacity/assets-src/lm/third-mainland-span/build";
import { buildPerson } from "@japacity/assets-src/people/people";
import { ALL_PEOPLE } from "@japacity/assets-src/people/people.data";
import type { PersonMesh } from "@japacity/assets-src/people/person.types";
import { buildBales } from "@japacity/assets-src/prop/bales/build";
import { buildBasins } from "@japacity/assets-src/prop/basins/build";
import { buildCanoe } from "@japacity/assets-src/prop/canoe/build";
import { buildFlagpole } from "@japacity/assets-src/prop/flagpole/build";
import { buildMarketStall } from "@japacity/assets-src/prop/market-stall/build";
import { buildRepairTable } from "@japacity/assets-src/prop/repair-table/build";
import { buildStall } from "@japacity/assets-src/prop/stall";
import { buildTrolley } from "@japacity/assets-src/prop/trolley/build";
import { buildContainerPhones } from "@japacity/assets-src/shop/container-phones/build";
import { buildProvisions } from "@japacity/assets-src/shop/provisions/build";
import { buildTaxi } from "@japacity/assets-src/veh/taxi/build";
import { buildDanfo, buildKeke, buildOkada } from "@japacity/assets-src/veh/vehicles";
import { Group } from "three";

import { type BakedModel, bakeGroup, linearColour } from "./bake";

export const ROOT = join(import.meta.dirname, "..", "..");
export const SOURCE = join(ROOT, "assets-src");
export const PUBLIC = join(ROOT, "apps", "client", "public", "assets");

/** The way every dish in the hub faces, in the frame of its unturned buildings (R-ASSET-019). */
export const HUB_DISH_YAW = DEFAULT_DISH_YAW;

export type ViewName = "front" | "back" | "left" | "right" | "threeQuarter" | "plan" | "phone" | "phoneFar";

export interface CatalogEntry {
  /** The shipped name without extension: `bld_plaza`. */
  name: string;
  /** The shipped path under public/assets. */
  file: string;
  place: string;
  /** The source folder under assets-src: specs, outlines, renders, the review. */
  source: string;
  /** Who made it, for the register (R-ASSET-015). */
  author: string;
  build: () => BakedModel;
  views: ViewName[];
  /** A pose for a person in the shots. */
  pose?: "stand" | "tray";
  /** Is one of the six examples later pieces are judged against. */
  example?: boolean;
  /** The ground in the shots, when it is not sand. */
  ground?: "lagoon";
  /** Where the far phone shot stands, when the landmark is first seen from somewhere particular. */
  farView?: { position: [number, number, number]; target: [number, number, number] };
}

const LEAD = "The lead, written as code in the design; ported to the pipeline by the pipeline work";
const LAB = "Written as code; ported to the pipeline by the pipeline work";
const ELEVATIONS: ViewName[] = ["front", "back", "left", "right", "threeQuarter"];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function staticModel(name: string, group: Group, shipSigns = false): BakedModel {
  return bakeGroup(group, name, { shipSigns });
}

/** A person's arrays as a baked model: the flat colours on the vertices, the one pattern as the second material. */
export function personModel(mesh: PersonMesh): BakedModel {
  const colours = mesh.colours.flatMap((name) => linearColour(name));
  const [flat, patterned] = mesh.groups;
  const shared = { positions: mesh.positions, normals: mesh.normals, colours, joints: mesh.joints, weights: mesh.weights };
  const primitives: BakedModel["parts"][number]["primitives"] = [{ material: "body", ...shared, indices: flat }];
  if (patterned.length > 0) primitives.push({ material: "pattern", ...shared, uvs: mesh.uvs, indices: patterned });
  const model: BakedModel = { name: mesh.name, parts: [{ node: "body", primitives, extras: { smooth: mesh.smooth } }], extras: {}, bones: mesh.bones };
  if (mesh.pattern !== null && patterned.length > 0) model.pattern = drawPattern(mesh.pattern);
  return model;
}

function buildingEntry(slug: string, place: string): CatalogEntry {
  const source = join("assets-src", "bld", slug);
  return {
    name: `bld_${slug}`,
    file: `places/${place}/bld_${slug}.glb`,
    place: `place.${place}`,
    source,
    author: LEAD,
    example: true,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => {
      const { spec, options } = readJson<{ spec: BuildingSpec; options: BuildingOptions }>(join(ROOT, source, "spec.json"));
      return staticModel(`bld_${slug}`, buildBuilding(spec, { ...options, dishYaw: HUB_DISH_YAW }));
    },
  };
}

const PLACES_B = "Written as code from the kit";

/** A piece one of the staged places needed, built from the kit by the agent that staged it. */
function placePiece(name: string, place: string, build: () => Group, views: ViewName[] = [...ELEVATIONS, "phone"]): CatalogEntry {
  const [prefix = "", slug = ""] = name.split("_");
  return { name, file: `places/${place}/${name}.glb`, place: `place.${place}`, source: `assets-src/${prefix}/${slug}`, author: PLACES_B, views, build: () => staticModel(name, build()) };
}

/** A building a staged place needed, as kit data in its spec.json (R-ASSET-014). */
function placeBuilding(slug: string, place: string): CatalogEntry {
  const build = (): Group => {
    const { spec, options } = readJson<{ spec: BuildingSpec; options: BuildingOptions }>(join(SOURCE, "bld", slug, "spec.json"));
    return buildBuilding(spec, { ...options, dishYaw: HUB_DISH_YAW });
  };
  return placePiece(`bld_${slug}`, place, build, [...ELEVATIONS, "plan", "phone"]);
}

interface OutlineFile {
  views: { view: "front" | "side" | "plan"; polygon: [number, number][] }[];
}

const SIGN = {
  painted: { board: "danfoYellow", ink: "red", painted: true, glyph: "tin" } satisfies SignStyle,
  notice: { board: "white", ink: "black", painted: true } satisfies SignStyle,
  printed: { board: "white", ink: "blue", border: "blue", glyph: "phone" } satisfies SignStyle,
  cards: { board: "danfoYellow", ink: "black" } satisfies SignStyle,
  terminal: { board: "white", ink: "green", border: "green" } satisfies SignStyle,
  canopy: { board: "green", ink: "white" } satisfies SignStyle,
  hanging: { board: "black", ink: "danfoYellow" } satisfies SignStyle,
};

export const CATALOG: CatalogEntry[] = [
  buildingEntry("shop-row", "ojuelegba"),
  buildingEntry("plaza", "ojuelegba"),
  {
    name: "bld_flyover-span",
    file: "places/ojuelegba/bld_flyover-span.glb",
    place: "place.ojuelegba",
    source: "assets-src/bld/flyover-span",
    author: "The makers, written as code from the kit; the plan from OpenStreetMap",
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => staticModel("bld_flyover-span", buildFlyoverSpan()),
  },
  {
    name: "shop_provisions",
    file: "places/ojuelegba/shop_provisions.glb",
    place: "place.ojuelegba",
    source: "assets-src/shop/provisions",
    author: LEAD,
    example: true,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () =>
      staticModel(
        "shop_provisions",
        buildProvisions({ board: "place.ojuelegba.sign.9", notice: "place.ojuelegba.sign.10" }, { board: SIGN.painted, notice: SIGN.notice }),
        true,
      ),
  },
  {
    name: "shop_container-phones",
    file: "places/ojuelegba/shop_container-phones.glb",
    place: "place.ojuelegba",
    source: "assets-src/shop/container-phones",
    author: LEAD,
    example: true,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () =>
      staticModel(
        "shop_container-phones",
        buildContainerPhones({ board: "place.ojuelegba.sign.11", card: "place.ojuelegba.sign.12" }, { board: SIGN.printed, card: SIGN.cards }, HUB_DISH_YAW),
        true,
      ),
  },
  {
    name: "lm_national-stadium",
    file: "places/national-stadium/lm_national-stadium.glb",
    place: "place.national-stadium",
    source: "assets-src/lm/national-stadium",
    author: LEAD,
    example: true,
    views: [...ELEVATIONS, "plan", "phone", "phoneFar"],
    build: () => {
      const outline = readJson<OutlineFile>(join(SOURCE, "lm", "national-stadium", "outline.json"));
      const plan = outline.views.find((view) => view.view === "plan");
      if (plan === undefined) throw new Error("lm_national-stadium: no plan outline");
      // The plan outline's picture coordinates are [x, -z].
      return staticModel("lm_national-stadium", buildStadium(plan.polygon.map(([u, v]) => [u, -v] as const)));
    },
  },
  {
    name: "lm_third-mainland-span",
    file: "places/third-mainland-bridge/lm_third-mainland-span.glb",
    place: "place.third-mainland-bridge",
    source: "assets-src/lm/third-mainland-span",
    author: LEAD,
    example: true,
    views: [...ELEVATIONS, "plan", "phone", "phoneFar"],
    // The lagoon, until the palette names a water colour; seen from a canoe, as the photographs are, so the arches show.
    ground: "lagoon",
    farView: { position: [40, 2, 260], target: [-90, 6, 0] },
    build: () => staticModel("lm_third-mainland-span", buildBridgeSpan()),
  },
  placeBuilding("market-block", "tejuosho-market"),
  placePiece("prop_market-stall", "tejuosho-market", buildMarketStall),
  placePiece("prop_bales", "tejuosho-market", buildBales),
  placePiece("prop_basins", "tejuosho-market", buildBasins),
  placeBuilding("phone-plaza", "computer-village"),
  placeBuilding("laptop-house", "computer-village"),
  placePiece("prop_repair-table", "computer-village", buildRepairTable),
  placePiece("bld_terminal-front", "airport-lagos", () => buildTerminalFront({ fascia: "place.airport-lagos.sign.1", canopy: "place.airport-lagos.sign.2", left: "place.airport-lagos.sign.3", right: "place.airport-lagos.sign.4" }, { fascia: SIGN.terminal, canopy: SIGN.canopy, hanging: SIGN.hanging }), [...ELEVATIONS, "plan", "phone"]),
  placePiece("prop_trolley", "airport-lagos", buildTrolley),
  placePiece("prop_flagpole", "airport-lagos", buildFlagpole),
  placePiece("veh_taxi", "airport-lagos", buildTaxi),
  placePiece("bld_stilt-house", "third-mainland-bridge", buildStiltHouse, [...ELEVATIONS, "plan", "phone"]),
  placePiece("prop_canoe", "third-mainland-bridge", buildCanoe),
  {
    name: "prop_pole",
    file: "shared/prop/prop_pole.glb",
    place: "shared",
    source: "assets-src/prop/pole",
    author: "The pipeline work, from the kit's pole part",
    views: [...ELEVATIONS, "phone"],
    build: () => {
      const g = new Group();
      g.name = "prop_pole";
      pole(g, 0, 0, 0, 35);
      return staticModel("prop_pole", g);
    },
  },
  {
    name: "prop_stall",
    file: "shared/prop/prop_stall.glb",
    place: "shared",
    source: "assets-src/prop/stall",
    author: LAB,
    views: [...ELEVATIONS, "phone"],
    build: () => staticModel("prop_stall", buildStall()),
  },
  ...([
    ["veh_danfo", buildDanfo],
    ["veh_keke", buildKeke],
    ["veh_okada", buildOkada],
  ] as const).map(
    ([name, build]): CatalogEntry => ({
      name,
      file: `shared/veh/${name}.glb`,
      place: "shared",
      source: `assets-src/veh/${name.slice(4)}`,
      author: LAB,
      views: [...ELEVATIONS, "phone"],
      build: () => staticModel(name, build()),
    }),
  ),
  ...ALL_PEOPLE.map(
    (spec): CatalogEntry => ({
      name: spec.name,
      file: `shared/chr/${spec.name}.glb`,
      place: "shared",
      source: `assets-src/people/${spec.name.slice(4)}`,
      author: LAB,
      views: [...ELEVATIONS, "phone"],
      pose: spec.carry === undefined ? "stand" : "tray",
      build: () => personModel(buildPerson(spec)),
    }),
  ),
];

export function findEntries(names: readonly string[]): CatalogEntry[] {
  if (names.length === 0 || names.includes("all")) return CATALOG;
  const found = new Set<CatalogEntry>();
  for (const name of names) {
    if (name === "examples") {
      for (const entry of CATALOG) if (entry.example === true) found.add(entry);
      continue;
    }
    if (name === "people" || name === "vehicles") {
      for (const entry of CATALOG) if (entry.name.startsWith(name === "people" ? "chr_" : "veh_")) found.add(entry);
      continue;
    }
    const entry = CATALOG.find((candidate) => candidate.name === name);
    if (entry === undefined) throw new Error(`No asset named ${name}. Known: ${CATALOG.map((e) => e.name).join(", ")}`);
    found.add(entry);
  }
  return [...found];
}
