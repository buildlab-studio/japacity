// Every shipped asset, where its source is and how it is built (decision 0005 section 4).
// The export, the shooter, the outline scorer and the check all start here.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type BuildingSpec, lowBox, setFootprint, type SignStyle } from "@japacity/assets";
import { buildBuilding, type BuildingOptions, DEFAULT_DISH_YAW, pole } from "@japacity/assets/kit";
import { drawPattern } from "@japacity/assets/pattern";
import { buildFamilyHouse } from "@japacity/assets-src/bld/family-house/build";
import { buildFlyoverSpan } from "@japacity/assets-src/bld/flyover-span/build";
import { buildStiltHouse } from "@japacity/assets-src/bld/stilt-house/build";
import { buildRoomHouse, buildSchool, buildTallHouse } from "@japacity/assets-src/bld/makoko-house/build";
import { buildTerminalFront } from "@japacity/assets-src/bld/terminal-front/build";
import { type ArcadeSpec, buildArcade } from "@japacity/assets-src/bld/deira-arcade/build";
import { buildRailwayBridge } from "@japacity/assets-src/bld/railway-bridge/build";
import { buildTerrace, type TerraceSpec } from "@japacity/assets-src/bld/rye-lane-terrace/build";
import { buildStadium } from "@japacity/assets-src/lm/national-stadium/build";
import { buildBridgeSpan } from "@japacity/assets-src/lm/third-mainland-span/build";
import { buildPerson } from "@japacity/assets-src/people/people";
import { ALL_PEOPLE } from "@japacity/assets-src/people/people.data";
import type { PersonMesh } from "@japacity/assets-src/people/person.types";
import { buildBales } from "@japacity/assets-src/prop/bales/build";
import { buildBasins } from "@japacity/assets-src/prop/basins/build";
import { buildCanoe } from "@japacity/assets-src/prop/canoe/build";
import { buildCanoeGoods, buildCanoeSchool } from "@japacity/assets-src/prop/canoe-load/build";
import { buildFishRacks } from "@japacity/assets-src/prop/fish-racks/build";
import { buildPlankWalkway } from "@japacity/assets-src/prop/plank-walkway/build";
import { buildFlagpole } from "@japacity/assets-src/prop/flagpole/build";
import { buildMarketStall } from "@japacity/assets-src/prop/market-stall/build";
import { buildRepairTable } from "@japacity/assets-src/prop/repair-table/build";
import { buildBusShelter } from "@japacity/assets-src/prop/bus-shelter/build";
import { buildFlagMast } from "@japacity/assets-src/prop/flag-mast/build";
import { buildCookingFire } from "@japacity/assets-src/prop/cooking-fire/build";
import { buildParlourSet } from "@japacity/assets-src/prop/parlour-set/build";
import { buildPartySet } from "@japacity/assets-src/prop/party-set/build";
import { buildGrid } from "@japacity/assets-src/prop/motion/build";
import { GRID_PIECES, gridFile, GRIDS, type GridPiece, MESH_LEVELS, type MeshLevel } from "@japacity/assets-src/prop/motion/grids";
import { buildPlasticChair } from "@japacity/assets-src/prop/plastic-chair/build";
import { buildRoom } from "@japacity/assets-src/bld/room/build";
import { ROOMS, type RoomName } from "@japacity/assets-src/bld/room/rooms";
import * as furniture from "@japacity/assets-src/prop/furniture";
import * as basics from "@japacity/assets-src/places/room-basics/build";
import { buildStall } from "@japacity/assets-src/prop/stall";
import { buildStreetBench } from "@japacity/assets-src/prop/street-bench/build";
import { buildTrolley } from "@japacity/assets-src/prop/trolley/build";
import { buildContainerPhones } from "@japacity/assets-src/shop/container-phones/build";
import { buildLottoKiosk } from "@japacity/assets-src/shop/lotto-kiosk/build";
import { buildProvisions } from "@japacity/assets-src/shop/provisions/build";
import { buildTaxi, DUBAI_TAXI } from "@japacity/assets-src/veh/taxi/build";
import { buildAbra } from "@japacity/assets-src/veh/abra/build";
import { buildLabourBus } from "@japacity/assets-src/veh/labour-bus/build";
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
const PLACES_A = "Written as code from the kit";
/** Every dish in Peckham faces one way (R-ASSET-019); the terraces stand turned a quarter either way, so the yaw is given per side. */
const PECKHAM_DISH_YAW = 2.4;
/** Deira's blocks also stand turned a quarter either way; one yaw for the place's dishes. */
const DEIRA_DISH_YAW = 1.9;

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
  // A person blocks no ground of the route map: the crowd moves, and keeps apart by its spots (city.md R-CITY-036).
  const model: BakedModel = { name: mesh.name, parts: [{ node: "body", primitives, extras: { smooth: mesh.smooth } }], extras: { footprint: "none" }, bones: mesh.bones };
  if (mesh.pattern !== null && patterned.length > 0) model.pattern = drawPattern(mesh.pattern);
  return model;
}

function buildingEntry(slug: string, place: string, author = LEAD): CatalogEntry {
  const source = join("assets-src", "bld", slug);
  return {
    name: `bld_${slug}`,
    file: `places/${place}/bld_${slug}.glb`,
    place: `place.${place}`,
    source,
    author,
    example: author === LEAD,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => {
      const { spec, options } = readJson<{ spec: BuildingSpec; options: BuildingOptions }>(join(ROOT, source, "spec.json"));
      return staticModel(`bld_${slug}`, buildBuilding(spec, { ...options, dishYaw: HUB_DISH_YAW }));
    },
  };
}

const PLACES_B = "Written as code from the kit";
const MAKOKO = "The Makoko place agent, written as code from the kit";

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

const TOOLS = "Written as code";

/** A moving sheet or the water tile at one mesh level, its motion, pinned edge and level in its extras (R-ASSET-028, R-ASSET-029). */
function gridEntry(piece: GridPiece, level: MeshLevel): CatalogEntry {
  const name = `prop_${piece}_${level}`;
  const { motion, pinned } = GRIDS[piece];
  return {
    name,
    file: gridFile(piece, level),
    place: "shared",
    source: `assets-src/prop/motion/${piece}/${level}`,
    author: TOOLS,
    views: piece === "water" ? [...ELEVATIONS, "plan", "phone"] : [...ELEVATIONS, "phone"],
    build: () => {
      const model = staticModel(name, buildGrid(piece, level));
      model.extras = { ...model.extras, motion, level, ...(pinned === null ? {} : { pinned }), footprint: "none" };
      return model;
    },
  };
}

const PLACES_M6 = "Written as code from the kit for the world-first places";

/** Each interior's room, its folder under places/ by the room's name (R-WORLD-011). */
const ROOM_FOLDERS: Record<RoomName, string> = {
  parlour: "family-house-parlour",
  visa: "visa-centre",
  agent: "agent-office",
  test: "english-test-centre",
  clinic: "tb-clinic",
  bank: "bank-counter",
  hub: "yaba-hub",
  abroad: "the-room",
  compound: "compound-room",
  arrivals: "arrivals-hall",
};

/** The place each room's folder serves, for the register. */
const ROOM_PLACES: Record<RoomName, string> = {
  parlour: "place.family-house",
  visa: "place.visa-centre",
  agent: "place.agent-office",
  test: "place.english-test-centre",
  clinic: "place.tb-clinic",
  bank: "place.olokun-office",
  hub: "place.yaba",
  abroad: "place.the-room",
  compound: "place.compound-room",
  arrivals: "place.airport-lagos",
};

function roomEntry(room: RoomName): CatalogEntry {
  const spec = ROOMS[room];
  return {
    name: spec.name,
    file: `places/${ROOM_FOLDERS[room]}/${spec.name}.glb`,
    place: ROOM_PLACES[room],
    source: `assets-src/bld/room/${room}`,
    author: PLACES_M6,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => staticModel(spec.name, buildRoom(spec)),
  };
}

/** A piece of furniture: shared when more than one room uses it, else in its room's folder. */
/** The room's basics (world.md R-WORLD-029), written as code from the kit beside the rooms they furnish. */
function basicsPiece(name: string, folder: string, place: string, build: () => Group): CatalogEntry {
  return { ...furniturePiece(name, folder, place, build), source: "assets-src/places/room-basics", author: "Written as code from the kit" };
}

function furniturePiece(name: string, folder: string, place: string, build: () => Group): CatalogEntry {
  const shared = folder === "shared";
  return {
    name,
    file: shared ? `shared/prop/${name}.glb` : `places/${folder}/${name}.glb`,
    place: shared ? "shared" : place,
    source: `assets-src/prop/${name.slice("prop_".length)}`,
    author: PLACES_M6,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => staticModel(name, build()),
  };
}

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
  // Makoko on the lagoon (home.md R-HOME-006): its houses, the classroom, the walk, the racks and the canoes that travel the channel.
  ...([
    ["bld_makoko-house_a", "a", () => buildRoomHouse()],
    ["bld_makoko-house_b", "b", () => buildTallHouse("place.makoko.sign.2", { board: "white", ink: "blue", painted: true })],
    ["bld_makoko-school", "school", () => buildSchool("place.makoko.sign.1", { board: "blue", ink: "white", painted: true })],
  ] as const).map(([name, folder, build]): CatalogEntry => ({ ...placePiece(name, "makoko", build, [...ELEVATIONS, "plan", "phone"]), source: `assets-src/bld/makoko-house/${folder}`, author: MAKOKO, ground: "lagoon" })),
  { ...placePiece("prop_plank-walkway", "makoko", buildPlankWalkway), author: MAKOKO, ground: "lagoon" },
  { ...placePiece("prop_fish-racks", "makoko", () => buildFishRacks("place.makoko.sign.3", { board: "danfoYellow", ink: "red", painted: true })), author: MAKOKO, ground: "lagoon" },
  { ...placePiece("prop_canoe-goods", "makoko", buildCanoeGoods), source: "assets-src/prop/canoe-load/goods", author: MAKOKO, ground: "lagoon" },
  { ...placePiece("prop_canoe-school", "makoko", buildCanoeSchool), source: "assets-src/prop/canoe-load/school", author: MAKOKO, ground: "lagoon" },
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
      // The pole's foot; its wires pass overhead.
      return staticModel("prop_pole", setFootprint(g, [lowBox(g)]));
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
  buildingEntry("bode-thomas-betting", "bode-thomas", PLACES_A),
  { name: "shop_lotto-kiosk", file: "places/bode-thomas/shop_lotto-kiosk.glb", place: "place.bode-thomas", source: "assets-src/shop/lotto-kiosk", author: PLACES_A, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("shop_lotto-kiosk", buildLottoKiosk({ board: "place.bode-thomas.sign.1", games: "place.bode-thomas.sign.5" }, { board: { board: "danfoYellow", ink: "green", painted: true }, games: { board: "black", ink: "white", painted: true } }), true) },
  { name: "bld_family-house", file: "places/family-house/bld_family-house.glb", place: "place.family-house", source: "assets-src/bld/family-house", author: PLACES_A, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("bld_family-house", buildFamilyHouse("place.family-house.sign.2", { board: "white", ink: "red", painted: true }, HUB_DISH_YAW)) },
  { name: "prop_party-set", file: "places/family-house/prop_party-set.glb", place: "place.family-house", source: "assets-src/prop/party-set", author: PLACES_A, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("prop_party-set", buildPartySet("place.family-house.sign.1", { board: "cream", ink: "wine" })) },
  { name: "prop_parlour-set", file: "places/family-house/prop_parlour-set.glb", place: "place.family-house", source: "assets-src/prop/parlour-set", author: PLACES_A, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("prop_parlour-set", buildParlourSet()) },
  { name: "prop_cooking-fire", file: "places/family-house/prop_cooking-fire.glb", place: "place.family-house", source: "assets-src/prop/cooking-fire", author: PLACES_A, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_cooking-fire", buildCookingFire()) },
  { name: "prop_plastic-chair", file: "shared/prop/prop_plastic-chair.glb", place: "shared", source: "assets-src/prop/plastic-chair", author: PLACES_A, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_plastic-chair", buildPlasticChair()) },
  ...(["a", "b"] as const).map(
    (variant): CatalogEntry => ({
      name: `bld_rye-lane-terrace_${variant}`,
      file: `places/peckham/bld_rye-lane-terrace_${variant}.glb`,
      place: "place.peckham",
      source: `assets-src/bld/rye-lane-terrace/${variant}`,
      author: PLACES_A,
      views: [...ELEVATIONS, "plan", "phone"],
      build: () => {
        const spec = readJson<TerraceSpec>(join(SOURCE, "bld", "rye-lane-terrace", variant, "spec.json"));
        return staticModel(spec.name, buildTerrace(spec, PECKHAM_DISH_YAW));
      },
    }),
  ),
  {
    name: "bld_railway-bridge",
    file: "places/peckham/bld_railway-bridge.glb",
    place: "place.peckham",
    source: "assets-src/bld/railway-bridge",
    author: PLACES_A,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () =>
      staticModel(
        "bld_railway-bridge",
        buildRailwayBridge(
          { mouth: "place.peckham.sign.30", girder: "place.peckham.sign.31", market: "place.peckham.sign.32", lockup: "place.peckham.sign.33", second: "place.peckham.sign.34" },
          { mouth: { board: "white", ink: "blue", border: "blue" }, girder: { board: "white", ink: "black" }, market: { board: "danfoYellow", ink: "black", painted: true } },
        ),
      ),
  },
  ...(["a", "b", "c"] as const).map(
    (variant): CatalogEntry => ({
      name: `bld_deira-arcade_${variant}`,
      file: `places/deira/bld_deira-arcade_${variant}.glb`,
      place: "place.deira",
      source: `assets-src/bld/deira-arcade/${variant}`,
      author: PLACES_A,
      views: [...ELEVATIONS, "plan", "phone"],
      build: () => {
        const spec = readJson<ArcadeSpec>(join(SOURCE, "bld", "deira-arcade", variant, "spec.json"));
        return staticModel(spec.name, buildArcade(spec, DEIRA_DISH_YAW));
      },
    }),
  ),
  { name: "veh_abra", file: "places/deira/veh_abra.glb", place: "place.deira", source: "assets-src/veh/abra", author: PLACES_A, views: [...ELEVATIONS, "phone"], ground: "lagoon", build: () => staticModel("veh_abra", buildAbra()) },
  { name: "veh_labour-bus", file: "places/deira/veh_labour-bus.glb", place: "place.deira", source: "assets-src/veh/labour-bus", author: PLACES_A, views: [...ELEVATIONS, "phone"], build: () => staticModel("veh_labour-bus", buildLabourBus()) },
  // The pieces the three old places needed when they were rebuilt as frontages (docs/rules/world.md R-WORLD-011).
  { name: "veh_taxi-dubai", file: "places/deira/veh_taxi-dubai.glb", place: "place.deira", source: "assets-src/veh/taxi", author: PLACES_A, views: [...ELEVATIONS, "phone"], build: () => staticModel("veh_taxi-dubai", buildTaxi(DUBAI_TAXI)) },
  placePiece("prop_street-bench", "peckham", buildStreetBench),
  { name: "prop_flag-mast", file: "shared/prop/prop_flag-mast.glb", place: "shared", source: "assets-src/prop/flag-mast", author: PLACES_A, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_flag-mast", buildFlagMast()) },
  { name: "prop_bus-shelter", file: "shared/prop/prop_bus-shelter.glb", place: "shared", source: "assets-src/prop/bus-shelter", author: PLACES_A, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_bus-shelter", buildBusShelter()) },
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
  ...GRID_PIECES.flatMap((piece) => MESH_LEVELS.map((level) => gridEntry(piece, level))),
  ...(Object.keys(ROOMS) as RoomName[]).map(roomEntry),
  furniturePiece("prop_room-door", "shared", "shared", furniture.buildRoomDoor),
  furniturePiece("prop_waiting-chairs", "shared", "shared", furniture.buildWaitingChairs),
  furniturePiece("prop_office-desk", "shared", "shared", furniture.buildOfficeDesk),
  furniturePiece("prop_bed", "shared", "shared", furniture.buildBed),
  furniturePiece("prop_dining-table", "shared", "shared", furniture.buildDiningTable),
  furniturePiece("prop_sofa", "family-house-parlour", "place.family-house", furniture.buildSofa),
  furniturePiece("prop_armchair", "family-house-parlour", "place.family-house", furniture.buildArmchair),
  furniturePiece("prop_centre-table", "family-house-parlour", "place.family-house", furniture.buildCentreTable),
  furniturePiece("prop_tv-stand", "family-house-parlour", "place.family-house", furniture.buildTvStand),
  furniturePiece("prop_papers-box", "family-house-parlour", "place.family-house", furniture.buildPapersBox),
  furniturePiece("prop_test-desk", "english-test-centre", "place.english-test-centre", furniture.buildTestDesk),
  furniturePiece("prop_xray-stand", "tb-clinic", "place.tb-clinic", furniture.buildXrayStand),
  furniturePiece("prop_bank-counter", "bank-counter", "place.olokun-office", furniture.buildBankCounter),
  furniturePiece("prop_long-desk", "yaba-hub", "place.yaba", furniture.buildLongDesk),
  furniturePiece("prop_jobs-board", "yaba-hub", "place.yaba", furniture.buildJobsBoard),
  furniturePiece("prop_meetup-corner", "yaba-hub", "place.yaba", furniture.buildMeetupCorner),
  furniturePiece("prop_window-frame", "the-room", "place.the-room", furniture.buildWindowFrame),
  furniturePiece("prop_side-table", "the-room", "place.the-room", furniture.buildSideTable),
  furniturePiece("prop_post", "the-room", "place.the-room", furniture.buildPost),
  furniturePiece("prop_arrivals-rail", "arrivals-hall", "place.airport-lagos", furniture.buildArrivalsRail),
  furniturePiece("prop_flight-board", "arrivals-hall", "place.airport-lagos", furniture.buildFlightBoard),
  basicsPiece("prop_cooking-corner", "shared", "shared", basics.buildCookingCorner),
  basicsPiece("prop_travel-bag", "shared", "shared", basics.buildTravelBag),
  basicsPiece("prop_lantern", "shared", "shared", basics.buildLantern),
  basicsPiece("prop_water-drum", "family-house-parlour", "place.family-house", basics.buildWaterDrum),
  basicsPiece("prop_drum-water", "family-house-parlour", "place.family-house", basics.buildDrumWater),
];

export function findEntries(names: readonly string[]): CatalogEntry[] {
  if (names.length === 0 || names.includes("all")) return CATALOG;
  const found = new Set<CatalogEntry>();
  for (const name of names) {
    if (name === "examples") {
      for (const entry of CATALOG) if (entry.example === true) found.add(entry);
      continue;
    }
    if (name === "grids") {
      for (const entry of CATALOG) if (entry.source.startsWith("assets-src/prop/motion/")) found.add(entry);
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
