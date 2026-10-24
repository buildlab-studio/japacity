// Every shipped asset, where its source is and how it is built (decision 0009 section 4).
// The export, the shooter, the outline scorer and the check all start here.
import { join } from "node:path";

import { type BuildingSpec, lowBox, setFootprint, type SignStyle } from "@japacity/model-kit";
import { buildBuilding, type BuildingOptions, DEFAULT_DISH_YAW, pole } from "@japacity/model-kit/kit";
import { drawPattern } from "@japacity/model-kit/pattern";
import { buildFamilyHouse } from "@japacity/models/buildings/family-house/build";
import { buildFlyoverSpan } from "@japacity/models/buildings/flyover-span/build";
import { buildStiltHouse } from "@japacity/models/buildings/stilt-house/build";
import { buildRoomHouse, buildSchool, buildTallHouse } from "@japacity/models/buildings/makoko-house/build";
import { buildTerminalFront } from "@japacity/models/buildings/terminal-front/build";
import { type ArcadeSpec, buildArcade } from "@japacity/models/buildings/deira-arcade/build";
import { buildRailwayBridge } from "@japacity/models/buildings/railway-bridge/build";
import { buildTerrace, type TerraceSpec } from "@japacity/models/buildings/rye-lane-terrace/build";
import { buildStadium } from "@japacity/models/landmarks/national-stadium/build";
import { buildBridgeSpan } from "@japacity/models/landmarks/third-mainland-span/build";
import { buildPerson, faceStyleFrom } from "@japacity/models/people/people";
import { ALL_PEOPLE } from "@japacity/models/people/people.data";
import type { PersonMesh } from "@japacity/models/people/person.types";
import { buildBales } from "@japacity/models/props/bales/build";
import { buildBasins } from "@japacity/models/props/basins/build";
import { buildCanoe } from "@japacity/models/props/canoe/build";
import { buildCanoeGoods, buildCanoeSchool } from "@japacity/models/props/canoe-load/build";
import { buildFishRacks } from "@japacity/models/props/fish-racks/build";
import { buildPlankWalkway } from "@japacity/models/props/plank-walkway/build";
import { buildFlagpole } from "@japacity/models/props/flagpole/build";
import { buildMarketStall } from "@japacity/models/props/market-stall/build";
import { buildRepairTable } from "@japacity/models/props/repair-table/build";
import { buildBusShelter } from "@japacity/models/props/bus-shelter/build";
import { buildFlagMast } from "@japacity/models/props/flag-mast/build";
import { buildCookingFire } from "@japacity/models/props/cooking-fire/build";
import { buildParlourSet } from "@japacity/models/props/parlour-set/build";
import { buildPartySet } from "@japacity/models/props/party-set/build";
import { buildGrid } from "@japacity/models/props/motion/build";
import { GRID_PIECES, gridFile, GRIDS, type GridPiece, MESH_LEVELS, type MeshLevel } from "@japacity/models/props/motion/grids";
import { buildPlasticChair } from "@japacity/models/props/plastic-chair/build";
import { buildRoom } from "@japacity/models/buildings/room/build";
import { ROOMS, type RoomName } from "@japacity/models/buildings/room/rooms";
import * as furniture from "@japacity/models/props/furniture";
import * as basics from "@japacity/models/places/room-basics/build";
import * as street from "@japacity/models/props/street/build";
import { buildStall } from "@japacity/models/props/stall";
import { buildStreetBench } from "@japacity/models/props/street-bench/build";
import { buildSuyaGrill } from "@japacity/models/props/suya-grill/build";
import { buildJointSet } from "@japacity/models/props/joint-set/build";
import { buildTrolley } from "@japacity/models/props/trolley/build";
import { buildBarberKiosk } from "@japacity/models/shopfronts/barber-kiosk/build";
import { buildContainerPhones } from "@japacity/models/shopfronts/container-phones/build";
import { buildLottoKiosk } from "@japacity/models/shopfronts/lotto-kiosk/build";
import { buildProvisions } from "@japacity/models/shopfronts/provisions/build";
import { buildViewingCentre } from "@japacity/models/shopfronts/viewing-centre/build";
import { buildTaxi, DUBAI_TAXI } from "@japacity/models/vehicles/taxi/build";
import { buildHome } from "@japacity/models/buildings/home/build";
import { HOMES3 } from "@japacity/models/buildings/home/homes3";
import { buildCar } from "@japacity/models/vehicles/car/build";
import * as home from "@japacity/models/props/home/build";
import * as things from "@japacity/models/props/home/things";
import { buildAbra } from "@japacity/models/vehicles/abra/build";
import { buildLabourBus } from "@japacity/models/vehicles/labour-bus/build";
import { buildDanfo, buildKeke, buildOkada } from "@japacity/models/vehicles/vehicles";
import { buildLondonBus } from "@japacity/models/vehicles/london-bus/build";
import { buildTrainCarriage } from "@japacity/models/vehicles/train-carriage/build";
import { buildCornerPub } from "@japacity/models/buildings/corner-pub/build";
import * as london from "@japacity/models/props/london/build";
import * as castel from "@japacity/models/places/castel-volturno/build";
import * as farm from "@japacity/models/places/farm-italy/build";
import { buildPine } from "@japacity/models/places/via-domitiana/build";
import { buildItalyBus } from "@japacity/models/vehicles/italy-bus/build";
import { buildVan } from "@japacity/models/vehicles/van/build";
import { buildCalgaryBus } from "@japacity/models/vehicles/calgary-bus/build";
import { buildCtrainCar } from "@japacity/models/vehicles/ctrain-car/build";
import { buildDubaiMetro } from "@japacity/models/vehicles/dubai-metro/build";
import { buildStripMall, type StripMallSpec } from "@japacity/models/buildings/strip-mall/build";
import { buildMetroStation, buildMetroViaduct } from "@japacity/models/buildings/metro-station/build";
import { buildSiteFrame } from "@japacity/models/buildings/site-frame/build";
import * as north from "@japacity/models/props/north/build";
import { Group } from "three";

import { type BakedModel, bakeGroup, linearColour } from "./bake";
import { readJson, REPO_ROOT } from "../repo";

export const SOURCE = join(REPO_ROOT, "models");
export const PUBLIC = join(REPO_ROOT, "apps", "client", "public", "assets");

/** The folder under models/ that holds a kind's sources, by the kind's shipped prefix. */
const KIND_FOLDERS: Readonly<Record<string, string>> = { building: "buildings", landmark: "landmarks", vehicle: "vehicles", prop: "props", shopfront: "shopfronts", person: "people" };

/** The folder of a prefix's sources, `buildings` for `building`. */
export function kindFolder(prefix: string): string {
  const folder = KIND_FOLDERS[prefix];
  if (folder === undefined) throw new Error(`No model folder for the prefix ${prefix}`);
  return folder;
}

/** The way every dish in the hub faces, in the frame of its unturned buildings (assets:dishes-face-one-satellite). */
const HUB_DISH_YAW = DEFAULT_DISH_YAW;

export type ViewName = "front" | "back" | "left" | "right" | "threeQuarter" | "plan" | "phone" | "phoneFar" | "tile" | "poster" | "face" | "figure" | "cheer";

/** A look's portraits for the front door (prologue:front-door-builds-a-person, prologue:front-door-three-screens): the face for the look strip and the life cards, the whole figure with a hand on the hip, and the figure cheering on the page after Begin. */
export const PORTRAITS: readonly ViewName[] = ["face", "figure", "cheer"];
/**
 * The people the front door offers as a look: the city's passers-by, the client's `LOOKS` from its roster. Named here,
 * since the tools never import the client; the client's test of the door's pictures proves each look has its portraits.
 */
const DOOR_LOOKS: ReadonlySet<string> = new Set(["person_ada", "person_amaka", "person_bayo", "person_bisi", "person_dayo", "person_emeka", "person_femi", "person_kemi", "person_kunle", "person_ngozi", "person_sade", "person_segun", "person_tobi", "person_tolani", "person_tunde", "person_zainab"]);

/** Whether a model gets the portraits: a person the door offers as a look. */
export function isPortrayed(name: string): boolean {
  return DOOR_LOOKS.has(name);
}

/** The kinds of model a picture tile is cut from (docs/design/09-the-games-look.md, the pictures): never a person, whose tile is a name pill. */
const TILED_KINDS = /^(prop|shopfront|vehicle|landmark|building)_/;
/** Models no player is shown as a thing: the rooms' and the homes' shells, the moving sheets, the water, a pole, the drum's water surface and the plank walk. */
const UNTILED = /^(building_room_|building_home-|prop_sheet-|prop_water_|prop_pole$|prop_drum-water$|prop_plank-walkway$)/;

/**
 * The things the send-off draws far larger than a choice's tile (chapter:send-off-scene-in-beats): a street's buildings,
 * the taxi pulling in and the bus shelter, up to 260 of its 390 stage pixels across, about 290 CSS pixels on a large
 * phone. Each also gets the poster: the tile's framing at more pixels, so the scene's sticker is sharp at three to one
 * while every small tile stays small (prologue:front-door-three-screens).
 */
const POSTERED: ReadonlySet<string> = new Set(["building_rye-lane-terrace_a", "building_rye-lane-terrace_b", "building_deira-arcade_a", "building_deira-arcade_b", "building_deira-arcade_c", "building_shop-row", "vehicle_taxi-dubai", "prop_bus-shelter"]);

/** Whether a model gets the poster beside its tile: a thing the send-off draws larger than the tile is sharp at. */
export function isPostered(name: string): boolean {
  return POSTERED.has(name);
}

/** Whether a model gets the tile view: a thing a player could be shown on a choice. */
export function isTiled(name: string): boolean {
  return TILED_KINDS.test(name) && !UNTILED.test(name);
}

export interface CatalogEntry {
  /** The shipped name without extension: `building_plaza`. */
  name: string;
  /** The shipped path under public/assets. */
  file: string;
  place: string;
  /** The source folder under models: specs, outlines, renders, the review. */
  source: string;
  /** Who made it, for the register (assets:ai-media-recorded-and-credited). */
  author: string;
  build: () => BakedModel;
  views: ViewName[];
  /** A pose for a person in the shots. */
  pose?: "stand" | "tray";
  /** Is one of the six examples every other piece is judged against. */
  example?: boolean;
  /** The ground in the shots, when it is not sand. */
  ground?: "lagoon";
  /** Where the far phone shot stands, when the landmark is first seen from somewhere particular. */
  farView?: { position: [number, number, number]; target: [number, number, number] };
}

const EXAMPLE_MAKERS = "The makers, written as code; one of the examples (models/examples.json)";
const MAKERS = "The makers, written as code";
const STREET_DRESSING = "The makers, written as code from the kit (the streets' and offices' dressing)";
const ELEVATIONS: ViewName[] = ["front", "back", "left", "right", "threeQuarter"];
const KIT = "The makers, written as code from the kit";
/** Every dish in Peckham faces one way (assets:dishes-face-one-satellite); the terraces stand turned a quarter either way, so the yaw is given per side. */
const PECKHAM_DISH_YAW = 2.4;
/** Deira's blocks also stand turned a quarter either way; one yaw for the place's dishes. */
const DEIRA_DISH_YAW = 1.9;

function staticModel(name: string, group: Group, shipSigns = false): BakedModel {
  return bakeGroup(group, name, { shipSigns });
}

/** A person's arrays as a baked model: the flat colours on the vertices, the one pattern as the second material. */
function personModel(mesh: PersonMesh): BakedModel {
  const colours = mesh.colours.flatMap((name) => linearColour(name));
  const [flat, patterned] = mesh.groups;
  const shared = { positions: mesh.positions, normals: mesh.normals, colours, joints: mesh.joints, weights: mesh.weights };
  const primitives: BakedModel["parts"][number]["primitives"] = [{ material: "body", ...shared, indices: flat }];
  if (patterned.length > 0) primitives.push({ material: "pattern", ...shared, uvs: mesh.uvs, indices: patterned });
  // A person blocks no ground of the route map: the crowd moves, and keeps apart by its spots (city:players-shown-present-not-tracked).
  const model: BakedModel = { name: mesh.name, parts: [{ node: "body", primitives, extras: { smooth: mesh.smooth } }], extras: { footprint: "none" }, bones: mesh.bones };
  if (mesh.pattern !== null && patterned.length > 0) model.pattern = drawPattern(mesh.pattern);
  return model;
}

function buildingEntry(slug: string, place: string, author = EXAMPLE_MAKERS): CatalogEntry {
  const source = join("models", "buildings", slug);
  return {
    name: `building_${slug}`,
    file: `places/${place}/building_${slug}.glb`,
    place: `place.${place}`,
    source,
    author,
    example: author === EXAMPLE_MAKERS,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => {
      const { spec, options } = readJson<{ spec: BuildingSpec; options: BuildingOptions }>(join(REPO_ROOT, source, "spec.json"));
      return staticModel(`building_${slug}`, buildBuilding(spec, { ...options, dishYaw: HUB_DISH_YAW }));
    },
  };
}

const MAKOKO = "The makers, written as code from the kit";

/** A piece one of the staged places needed, built from the kit by the makers. */
function placePiece(name: string, place: string, build: () => Group, views: ViewName[] = [...ELEVATIONS, "phone"]): CatalogEntry {
  const [prefix = "", slug = ""] = name.split("_");
  return { name, file: `places/${place}/${name}.glb`, place: `place.${place}`, source: `models/${kindFolder(prefix)}/${slug}`, author: KIT, views, build: () => staticModel(name, build()) };
}

/** A building a staged place needed, as kit data in its spec.json (assets:variants-are-numbers-not-code). */
function placeBuilding(slug: string, place: string): CatalogEntry {
  const build = (): Group => {
    const { spec, options } = readJson<{ spec: BuildingSpec; options: BuildingOptions }>(join(SOURCE, "buildings", slug, "spec.json"));
    return buildBuilding(spec, { ...options, dishYaw: HUB_DISH_YAW });
  };
  return placePiece(`building_${slug}`, place, build, [...ELEVATIONS, "plan", "phone"]);
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

const TOOLS = "The makers, written as code";

/** A moving sheet or the water tile at one mesh level, its motion, pinned edge and level in its extras (assets:one-shared-motion-material, assets:sheets-ship-two-mesh-levels). */
function gridEntry(piece: GridPiece, level: MeshLevel): CatalogEntry {
  const name = `prop_${piece}_${level}`;
  const { motion, pinned } = GRIDS[piece];
  return {
    name,
    file: gridFile(piece, level),
    place: "shared",
    source: `models/props/motion/${piece}/${level}`,
    author: TOOLS,
    views: piece === "water" ? [...ELEVATIONS, "plan", "phone"] : [...ELEVATIONS, "phone"],
    build: () => {
      const model = staticModel(name, buildGrid(piece, level));
      model.extras = { ...model.extras, motion, level, ...(pinned === null ? {} : { pinned }), footprint: "none" };
      return model;
    },
  };
}

const ROOM_MAKERS = "The makers, written as code from the kit for the rooms";
/** The street's things of decision 0012. */
const STREET = "The makers, written as code from the kit";

/** Each interior's room, its folder under places/ by the room's name (world:place-is-one-screen). */
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
  bigshop: "big-shop-uk",
  care: "care-home-uk",
  ward: "ward-uk",
  office: "office-uk",
  warehouse: "warehouse-uk",
  church: "church-uk",
  library: "library-canada",
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
  bigshop: "place.big-shop-uk",
  care: "place.care-home-uk",
  ward: "place.ward-uk",
  office: "place.office-uk",
  warehouse: "place.warehouse-uk",
  church: "place.church-uk",
  library: "place.library-canada",
};

function roomEntry(room: RoomName): CatalogEntry {
  const spec = ROOMS[room];
  return {
    name: spec.name,
    file: `places/${ROOM_FOLDERS[room]}/${spec.name}.glb`,
    place: ROOM_PLACES[room],
    source: `models/buildings/room/${room}`,
    author: ROOM_MAKERS,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => staticModel(spec.name, buildRoom(spec)),
  };
}

/** A piece of furniture: shared when more than one room uses it, else in its room's folder. */
/** The room's basics (world:room-seen-down-its-length), written as code from the kit beside the rooms they furnish. */
function basicsPiece(name: string, folder: string, place: string, build: () => Group): CatalogEntry {
  // Each piece its own folder under places/room-basics, so each has renders of its own.
  return { ...furniturePiece(name, folder, place, build), source: `models/places/room-basics/${name.slice("prop_".length)}`, author: KIT };
}

function furniturePiece(name: string, folder: string, place: string, build: () => Group): CatalogEntry {
  const shared = folder === "shared";
  return {
    name,
    file: shared ? `shared/prop/${name}.glb` : `places/${folder}/${name}.glb`,
    place: shared ? "shared" : place,
    source: `models/props/${name.slice("prop_".length)}`,
    author: ROOM_MAKERS,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => staticModel(name, build()),
  };
}

const ENTRIES: CatalogEntry[] = [
  buildingEntry("shop-row", "ojuelegba"),
  buildingEntry("plaza", "ojuelegba"),
  {
    name: "building_flyover-span",
    file: "places/ojuelegba/building_flyover-span.glb",
    place: "place.ojuelegba",
    source: "models/buildings/flyover-span",
    author: "The makers, written as code from the kit; the plan from OpenStreetMap",
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => staticModel("building_flyover-span", buildFlyoverSpan()),
  },
  {
    name: "shopfront_provisions",
    file: "places/ojuelegba/shopfront_provisions.glb",
    place: "place.ojuelegba",
    source: "models/shopfronts/provisions",
    author: EXAMPLE_MAKERS,
    example: true,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () =>
      staticModel(
        "shopfront_provisions",
        buildProvisions({ board: "place.ojuelegba.sign.9", notice: "place.ojuelegba.sign.10" }, { board: SIGN.painted, notice: SIGN.notice }),
        true,
      ),
  },
  {
    name: "shopfront_container-phones",
    file: "places/ojuelegba/shopfront_container-phones.glb",
    place: "place.ojuelegba",
    source: "models/shopfronts/container-phones",
    author: EXAMPLE_MAKERS,
    example: true,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () =>
      staticModel(
        "shopfront_container-phones",
        buildContainerPhones({ board: "place.ojuelegba.sign.11", card: "place.ojuelegba.sign.12" }, { board: SIGN.printed, card: SIGN.cards }, HUB_DISH_YAW),
        true,
      ),
  },
  {
    name: "landmark_national-stadium",
    file: "places/national-stadium/landmark_national-stadium.glb",
    place: "place.national-stadium",
    source: "models/landmarks/national-stadium",
    author: EXAMPLE_MAKERS,
    example: true,
    views: [...ELEVATIONS, "plan", "phone", "phoneFar"],
    build: () => {
      const outline = readJson<OutlineFile>(join(SOURCE, "landmarks", "national-stadium", "outline.json"));
      const plan = outline.views.find((view) => view.view === "plan");
      if (plan === undefined) throw new Error("landmark_national-stadium: no plan outline");
      // The plan outline's picture coordinates are [x, -z].
      return staticModel("landmark_national-stadium", buildStadium(plan.polygon.map(([u, v]) => [u, -v] as const)));
    },
  },
  {
    name: "landmark_third-mainland-span",
    file: "places/third-mainland-bridge/landmark_third-mainland-span.glb",
    place: "place.third-mainland-bridge",
    source: "models/landmarks/third-mainland-span",
    author: EXAMPLE_MAKERS,
    example: true,
    views: [...ELEVATIONS, "plan", "phone", "phoneFar"],
    // On the lagoon, seen from a canoe as the photographs are, so the arches show.
    ground: "lagoon",
    farView: { position: [40, 2, 260], target: [-90, 6, 0] },
    build: () => staticModel("landmark_third-mainland-span", buildBridgeSpan()),
  },
  placeBuilding("market-block", "tejuosho-market"),
  placePiece("prop_market-stall", "tejuosho-market", buildMarketStall),
  placePiece("prop_bales", "tejuosho-market", buildBales),
  placePiece("prop_basins", "tejuosho-market", buildBasins),
  placeBuilding("phone-plaza", "computer-village"),
  placeBuilding("laptop-house", "computer-village"),
  placePiece("prop_repair-table", "computer-village", buildRepairTable),
  placePiece("building_terminal-front", "airport-lagos", () => buildTerminalFront({ fascia: "place.airport-lagos.sign.1", canopy: "place.airport-lagos.sign.2", left: "place.airport-lagos.sign.3", right: "place.airport-lagos.sign.4" }, { fascia: SIGN.terminal, canopy: SIGN.canopy, hanging: SIGN.hanging }), [...ELEVATIONS, "plan", "phone"]),
  placePiece("prop_trolley", "airport-lagos", buildTrolley),
  placePiece("prop_flagpole", "airport-lagos", buildFlagpole),
  placePiece("vehicle_taxi", "airport-lagos", buildTaxi),
  placePiece("building_stilt-house", "third-mainland-bridge", buildStiltHouse, [...ELEVATIONS, "plan", "phone"]),
  placePiece("prop_canoe", "third-mainland-bridge", buildCanoe),
  // Makoko on the lagoon (home:home-is-the-home-point): its houses, the classroom, the walk, the racks and the canoes that travel the channel.
  ...([
    ["building_makoko-house_a", "a", () => buildRoomHouse()],
    ["building_makoko-house_b", "b", () => buildTallHouse("place.makoko.sign.2", { board: "white", ink: "blue", painted: true })],
    ["building_makoko-school", "school", () => buildSchool("place.makoko.sign.1", { board: "blue", ink: "white", painted: true })],
  ] as const).map(([name, folder, build]): CatalogEntry => ({ ...placePiece(name, "makoko", build, [...ELEVATIONS, "plan", "phone"]), source: `models/buildings/makoko-house/${folder}`, author: MAKOKO, ground: "lagoon" })),
  { ...placePiece("prop_plank-walkway", "makoko", buildPlankWalkway), author: MAKOKO, ground: "lagoon" },
  { ...placePiece("prop_fish-racks", "makoko", () => buildFishRacks("place.makoko.sign.3", { board: "danfoYellow", ink: "red", painted: true })), author: MAKOKO, ground: "lagoon" },
  { ...placePiece("prop_canoe-goods", "makoko", buildCanoeGoods), source: "models/props/canoe-load/goods", author: MAKOKO, ground: "lagoon" },
  { ...placePiece("prop_canoe-school", "makoko", buildCanoeSchool), source: "models/props/canoe-load/school", author: MAKOKO, ground: "lagoon" },
  {
    name: "prop_pole",
    file: "shared/prop/prop_pole.glb",
    place: "shared",
    source: "models/props/pole",
    author: "The makers, from the kit's pole part",
    views: [...ELEVATIONS, "phone"],
    build: () => {
      const g = new Group();
      g.name = "prop_pole";
      pole(g, 0, 0, 0, 35);
      // The pole's foot; its wires pass overhead.
      return staticModel("prop_pole", setFootprint(g, [lowBox(g)]));
    },
  },
  // The street's and the office's dressing, shared by every place that stands them.
  ...([
    ["prop_poster-board", street.buildPosterBoard],
    ["prop_cooler-stand", street.buildCoolerStand],
    ["prop_mat", street.buildMat],
    ["prop_office-cabinet", street.buildOfficeCabinet],
  ] as const).map(([name, build]): CatalogEntry => ({
    name,
    file: `shared/prop/${name}.glb`,
    place: "shared",
    source: `models/props/street/${name.slice("prop_".length)}`,
    author: STREET_DRESSING,
    views: [...ELEVATIONS, "phone"],
    build: () => staticModel(name, build()),
  })),
  {
    name: "prop_stall",
    file: "shared/prop/prop_stall.glb",
    place: "shared",
    source: "models/props/stall",
    author: MAKERS,
    views: [...ELEVATIONS, "phone"],
    build: () => staticModel("prop_stall", buildStall()),
  },
  buildingEntry("bode-thomas-betting", "bode-thomas", KIT),
  { name: "shopfront_lotto-kiosk", file: "places/bode-thomas/shopfront_lotto-kiosk.glb", place: "place.bode-thomas", source: "models/shopfronts/lotto-kiosk", author: KIT, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("shopfront_lotto-kiosk", buildLottoKiosk({ board: "place.bode-thomas.sign.1", games: "place.bode-thomas.sign.5" }, { board: { board: "danfoYellow", ink: "green", painted: true }, games: { board: "black", ink: "white", painted: true } }), true) },
  { name: "building_family-house", file: "places/family-house/building_family-house.glb", place: "place.family-house", source: "models/buildings/family-house", author: KIT, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("building_family-house", buildFamilyHouse("place.family-house.sign.2", { board: "white", ink: "red", painted: true }, HUB_DISH_YAW)) },
  { name: "prop_party-set", file: "places/family-house/prop_party-set.glb", place: "place.family-house", source: "models/props/party-set", author: KIT, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("prop_party-set", buildPartySet("place.family-house.sign.1", { board: "cream", ink: "wine" })) },
  { name: "prop_parlour-set", file: "places/family-house/prop_parlour-set.glb", place: "place.family-house", source: "models/props/parlour-set", author: KIT, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("prop_parlour-set", buildParlourSet()) },
  { name: "prop_cooking-fire", file: "places/family-house/prop_cooking-fire.glb", place: "place.family-house", source: "models/props/cooking-fire", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_cooking-fire", buildCookingFire()) },
  { name: "prop_plastic-chair", file: "shared/prop/prop_plastic-chair.glb", place: "shared", source: "models/props/plastic-chair", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_plastic-chair", buildPlasticChair()) },
  ...(["a", "b"] as const).map(
    (variant): CatalogEntry => ({
      name: `building_rye-lane-terrace_${variant}`,
      file: `places/peckham/building_rye-lane-terrace_${variant}.glb`,
      place: "place.peckham",
      source: `models/buildings/rye-lane-terrace/${variant}`,
      author: KIT,
      views: [...ELEVATIONS, "plan", "phone"],
      build: () => {
        const spec = readJson<TerraceSpec>(join(SOURCE, "buildings", "rye-lane-terrace", variant, "spec.json"));
        return staticModel(spec.name, buildTerrace(spec, PECKHAM_DISH_YAW));
      },
    }),
  ),
  {
    name: "building_railway-bridge",
    file: "places/peckham/building_railway-bridge.glb",
    place: "place.peckham",
    source: "models/buildings/railway-bridge",
    author: KIT,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () =>
      staticModel(
        "building_railway-bridge",
        buildRailwayBridge(
          { mouth: "place.peckham.sign.30", girder: "place.peckham.sign.31", market: "place.peckham.sign.32", lockup: "place.peckham.sign.33", second: "place.peckham.sign.34" },
          { mouth: { board: "white", ink: "blue", border: "blue" }, girder: { board: "white", ink: "black" }, market: { board: "danfoYellow", ink: "black", painted: true } },
        ),
      ),
  },
  ...(["a", "b", "c"] as const).map(
    (variant): CatalogEntry => ({
      name: `building_deira-arcade_${variant}`,
      file: `places/deira/building_deira-arcade_${variant}.glb`,
      place: "place.deira",
      source: `models/buildings/deira-arcade/${variant}`,
      author: KIT,
      views: [...ELEVATIONS, "plan", "phone"],
      build: () => {
        const spec = readJson<ArcadeSpec>(join(SOURCE, "buildings", "deira-arcade", variant, "spec.json"));
        return staticModel(spec.name, buildArcade(spec, DEIRA_DISH_YAW));
      },
    }),
  ),
  { name: "vehicle_abra", file: "places/deira/vehicle_abra.glb", place: "place.deira", source: "models/vehicles/abra", author: KIT, views: [...ELEVATIONS, "phone"], ground: "lagoon", build: () => staticModel("vehicle_abra", buildAbra()) },
  { name: "vehicle_labour-bus", file: "places/deira/vehicle_labour-bus.glb", place: "place.deira", source: "models/vehicles/labour-bus", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("vehicle_labour-bus", buildLabourBus()) },
  // The pieces the places staged as frontages need (world:place-is-one-screen).
  { name: "vehicle_taxi-dubai", file: "places/deira/vehicle_taxi-dubai.glb", place: "place.deira", source: "models/vehicles/taxi/dubai", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("vehicle_taxi-dubai", buildTaxi(DUBAI_TAXI)) },
  placePiece("prop_street-bench", "peckham", buildStreetBench),
  { name: "prop_flag-mast", file: "shared/prop/prop_flag-mast.glb", place: "shared", source: "models/props/flag-mast", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_flag-mast", buildFlagMast()) },
  { name: "prop_bus-shelter", file: "shared/prop/prop_bus-shelter.glb", place: "shared", source: "models/props/bus-shelter", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_bus-shelter", buildBusShelter()) },
  ...([
    ["vehicle_danfo", buildDanfo],
    ["vehicle_keke", buildKeke],
    ["vehicle_okada", buildOkada],
  ] as const).map(
    ([name, build]): CatalogEntry => ({
      name,
      file: `shared/vehicle/${name}.glb`,
      place: "shared",
      source: `models/vehicles/${name.slice("vehicle_".length)}`,
      author: MAKERS,
      views: [...ELEVATIONS, "phone"],
      build: () => staticModel(name, build()),
    }),
  ),
  ...ALL_PEOPLE.map(
    (spec): CatalogEntry => ({
      name: spec.name,
      file: `shared/person/${spec.name}.glb`,
      place: "shared",
      source: `models/people/${spec.name.slice("person_".length)}`,
      author: MAKERS,
      views: isPortrayed(spec.name) ? [...ELEVATIONS, "phone", ...PORTRAITS] : [...ELEVATIONS, "phone"],
      pose: spec.carry === undefined ? "stand" : "tray",
      // JAPACITY_FACE names a face style to export for comparison; unset, the shipped style.
      build: () => personModel(buildPerson(spec, faceStyleFrom(process.env.JAPACITY_FACE))),
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
  // The street's things of decision 0012 (streets:lagos-street-spending): the suya spot staged on Ojuelegba, the joint's chairs, the barber's kiosk and the viewing centre on Bode Thomas.
  { name: "prop_suya-grill", file: "shared/prop/prop_suya-grill.glb", place: "shared", source: "models/props/suya-grill", author: STREET, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("prop_suya-grill", buildSuyaGrill()) },
  { name: "prop_joint-set", file: "shared/prop/prop_joint-set.glb", place: "shared", source: "models/props/joint-set", author: STREET, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("prop_joint-set", buildJointSet()) },
  { name: "shopfront_barber-kiosk", file: "places/bode-thomas/shopfront_barber-kiosk.glb", place: "place.bode-thomas", source: "models/shopfronts/barber-kiosk", author: STREET, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("shopfront_barber-kiosk", buildBarberKiosk("place.bode-thomas.sign.9", { board: "white", ink: "red", painted: true }), true) },
  { name: "shopfront_viewing-centre", file: "places/bode-thomas/shopfront_viewing-centre.glb", place: "place.bode-thomas", source: "models/shopfronts/viewing-centre", author: STREET, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("shopfront_viewing-centre", buildViewingCentre(HUB_DISH_YAW)) },
];

/** The homes as one wide floor each, the car, and the small things the kit lacked. */
const HOME_MAKERS = "The makers, written as code from the kit for the homes";
function homePiece(name: string, folder: string, build: () => Group): CatalogEntry {
  const [prefix = "", slug = ""] = name.split("_");
  const shared = folder === "shared";
  return {
    name,
    file: shared ? `shared/${prefix}/${name}.glb` : `places/${folder}/${name}.glb`,
    place: shared ? "shared" : `place.${folder}`,
    source: prefix === "prop" ? `models/props/home/${slug}` : `models/${kindFolder(prefix)}/${slug}`,
    author: HOME_MAKERS,
    // A building's plan as every building's (assets:contributor-renders-fixed-views).
    views: prefix === "building" ? [...ELEVATIONS, "plan", "phone"] : [...ELEVATIONS, "phone"],
    build: () => staticModel(name, build()),
  };
}
ENTRIES.push(
  homePiece("vehicle_car", "shared", () => buildCar()),
  homePiece("prop_bath-corner", "shared", home.buildBathCorner),
  homePiece("building_home-family-house", "home-family-house", () => buildHome(HOMES3.family)),
  homePiece("building_home-room-house", "home-room-house", () => buildHome(HOMES3.room)),
  homePiece("building_home-hostel-house", "home-hostel-house", () => buildHome(HOMES3.hostel)),
  homePiece("prop_carport", "shared", home.buildCarport),
  homePiece("prop_generator", "shared", home.buildGenerator),
  homePiece("prop_clothes-line", "shared", home.buildClothesLine),
  homePiece("prop_wardrobe", "shared", home.buildWardrobe),
  homePiece("prop_rug", "shared", home.buildRug),
  homePiece("prop_potted-plant", "shared", home.buildPottedPlant),
  homePiece("prop_slippers", "shared", home.buildSlippers),
  homePiece("prop_crates", "shared", home.buildCrates),
  homePiece("prop_fan", "shared", home.buildFan),
  homePiece("prop_kitchen-shelf", "shared", home.buildKitchenShelf),
  homePiece("prop_bucket", "shared", home.buildBucket),
  homePiece("prop_mattress", "shared", home.buildMattress),
  homePiece("prop_bunk-bed", "shared", home.buildBunkBed),
  homePiece("prop_small-shelf", "shared", home.buildSmallShelf),
  homePiece("prop_radio", "shared", things.buildRadio),
  homePiece("prop_big-pot", "shared", things.buildBigPot),
  homePiece("prop_router", "shared", things.buildRouter),
  homePiece("prop_decoder", "shared", things.buildDecoder),
  homePiece("prop_gas-cooker", "shared", things.buildGasCooker),
  homePiece("prop_fridge", "shared", things.buildFridge),
  homePiece("prop_mirror", "shared", things.buildMirror),
  homePiece("prop_speaker", "shared", things.buildSpeaker),
  homePiece("prop_inverter", "shared", things.buildInverter),
  homePiece("prop_solar", "shared", things.buildSolar),
  homePiece("prop_ac", "shared", things.buildAc),
  homePiece("prop_laptop-desk", "shared", things.buildLaptopDesk),
  homePiece("prop_phone", "shared", things.buildPhone),
  homePiece("prop_foam-mattress", "shared", things.buildFoamMattress),
  homePiece("prop_tv", "shared", things.buildTv),
);

/** London, built as Lagos is (docs/design/10-london.md): the bus and the train for the ride abroad, the frontages and the rooms of its places. */
const LONDON = "The makers, written as code from the kit";
ENTRIES.push(
  { name: "vehicle_london-bus", file: "shared/vehicle/vehicle_london-bus.glb", place: "shared", source: "models/vehicles/london-bus", author: LONDON, views: [...ELEVATIONS, "phone"], build: () => staticModel("vehicle_london-bus", buildLondonBus()) },
  { name: "vehicle_train-carriage", file: "shared/vehicle/vehicle_train-carriage.glb", place: "shared", source: "models/vehicles/train-carriage", author: LONDON, views: [...ELEVATIONS, "phone"], build: () => staticModel("vehicle_train-carriage", buildTrainCarriage()) },
  // Rye Lane (world:place-is-one-screen): two more terraces as data, the pub on the corner, the produce, the stalls and the kitchen's door.
  ...(["c", "d"] as const).map(
    (variant): CatalogEntry => ({
      name: `building_rye-lane-terrace_${variant}`,
      file: `places/rye-lane/building_rye-lane-terrace_${variant}.glb`,
      place: "place.rye-lane",
      source: `models/buildings/rye-lane-terrace/${variant}`,
      author: LONDON,
      views: [...ELEVATIONS, "plan", "phone"],
      build: () => {
        const spec = readJson<TerraceSpec>(join(SOURCE, "buildings", "rye-lane-terrace", variant, "spec.json"));
        return staticModel(spec.name, buildTerrace(spec, PECKHAM_DISH_YAW));
      },
    }),
  ),
  placePiece("building_corner-pub", "rye-lane", () => buildCornerPub(PECKHAM_DISH_YAW), [...ELEVATIONS, "plan", "phone"]),
  placePiece("prop_produce-stand", "rye-lane", london.buildProduceStand),
  placePiece("prop_gazebo-stall", "rye-lane", london.buildGazeboStall),
  placePiece("prop_side-door", "rye-lane", london.buildSideDoor),
  // Peckham Rye station: the machine for the pass, the gates under the arch, the courier's bike and the board by the stair.
  placePiece("prop_ticket-machine", "peckham-rye-station", london.buildTicketMachine),
  placePiece("prop_ticket-gates", "peckham-rye-station", london.buildTicketGates),
  placePiece("prop_courier-bike", "peckham-rye-station", london.buildCourierBike),
  placePiece("prop_platform-sign", "peckham-rye-station", () => london.buildPlatformSign("place.peckham.sign.31", { board: "white", ink: "blue", border: "blue" })),
  // The rooms' things: the big shop, the care home, the ward, the office, the warehouse and the church; the rota board and the tea point shared by the workplaces.
  placePiece("prop_shop-aisle", "big-shop-uk", london.buildShopAisle),
  placePiece("prop_trolley-bay", "big-shop-uk", london.buildTrolleyBay),
  placePiece("prop_tills", "big-shop-uk", london.buildTills),
  placePiece("prop_reception-desk", "care-home-uk", london.buildReceptionDesk),
  { ...furniturePiece("prop_rota-board", "shared", "shared", london.buildRotaBoard), author: LONDON },
  { ...furniturePiece("prop_tea-point", "shared", "shared", london.buildTeaPoint), author: LONDON },
  placePiece("prop_nurses-station", "ward-uk", london.buildNursesStation),
  placePiece("prop_hospital-bed", "ward-uk", london.buildHospitalBed),
  placePiece("prop_desk-pod", "office-uk", london.buildDeskPod),
  placePiece("prop_glass-office", "office-uk", london.buildGlassOffice),
  placePiece("prop_clock-in", "warehouse-uk", london.buildClockIn),
  placePiece("prop_racking", "warehouse-uk", london.buildRacking),
  placePiece("prop_cage-trolley", "warehouse-uk", london.buildCageTrolley),
  placePiece("prop_smoking-shelter", "warehouse-uk", london.buildSmokingShelter),
  placePiece("prop_pew", "church-uk", london.buildPew),
  placePiece("prop_altar", "church-uk", london.buildAltar),
);

/** Castel Volturno, built as Lagos is (docs/design/11-calgary-dubai-and-castel-volturno.md): the coast road's bus and the gangmaster's van for the ride, the roundabout, the Domitiana and the fields. */
const ITALY = "The makers, written as code from the kit";
/** Every dish at the roundabout and on the Domitiana faces one way (assets:dishes-face-one-satellite); their blocks all stand square to the road. */
const CASTEL_DISH_YAW = 2.1;

/** A piece of one of Castel Volturno's places, its renders beside its build code under the place's folder. */
function italyPiece(name: string, folder: string, source: string, build: () => Group, views: ViewName[] = [...ELEVATIONS, "phone"]): CatalogEntry {
  return { name, file: `places/${folder}/${name}.glb`, place: `place.${folder}`, source: `models/places/${folder}/${source}`, author: ITALY, views, build: () => staticModel(name, build()) };
}

/** A plaster row from its numbers in spec.json (assets:variants-are-numbers-not-code). */
function plasterRow(name: string, folder: string, source: string): CatalogEntry {
  const build = (): Group => castel.buildPlasterRow(readJson<castel.PlasterRowSpec>(join(SOURCE, "places", folder, source, "spec.json")), CASTEL_DISH_YAW);
  return italyPiece(name, folder, source, build, [...ELEVATIONS, "plan", "phone"]);
}

ENTRIES.push(
  { name: "vehicle_italy-bus", file: "shared/vehicle/vehicle_italy-bus.glb", place: "shared", source: "models/vehicles/italy-bus", author: ITALY, views: [...ELEVATIONS, "phone"], build: () => staticModel("vehicle_italy-bus", buildItalyBus()) },
  { name: "vehicle_van", file: "shared/vehicle/vehicle_van.glb", place: "shared", source: "models/vehicles/van", author: ITALY, views: [...ELEVATIONS, "phone"], build: () => staticModel("vehicle_van", buildVan()) },
  // The roundabout (world:place-is-one-screen): two plaster rows with the bar, the African shop and the call shop, the island and its sign, the bar's counter, the palms and the stop's pole.
  plasterRow("building_castel-row_a", "castel-volturno", "row-a"),
  plasterRow("building_castel-row_b", "castel-volturno", "row-b"),
  italyPiece("prop_roundabout", "castel-volturno", "roundabout", () => castel.buildRoundabout("place.castel-volturno.sign.roundabout", { board: "blue", ink: "white", border: "white" }), [...ELEVATIONS, "plan", "phone"]),
  italyPiece("prop_bar-counter", "castel-volturno", "bar-counter", castel.buildBarCounter),
  italyPiece("prop_palm", "castel-volturno", "palm", castel.buildPalm),
  italyPiece("prop_bus-pole", "castel-volturno", "bus-pole", () => castel.buildBusPole("place.castel-volturno.sign.stop", { board: "white", ink: "blue", border: "blue" })),
  // The Domitiana: the low block of the Nigerian shop and the barber, and the stone pines of the coast.
  plasterRow("building_domitiana-block", "via-domitiana", "block"),
  italyPiece("prop_pine", "via-domitiana", "pine", buildPine),
  // The fields: the rows, the gangmaster's table, the crates, the tap and the tree.
  italyPiece("prop_crop-row", "farm-italy", "crop-row", farm.buildCropRow, [...ELEVATIONS, "plan", "phone"]),
  italyPiece("prop_tarp-table", "farm-italy", "tarp-table", () => farm.buildTarpTable("place.farm-italy.sign.table", { board: "tan", ink: "black", painted: true })),
  italyPiece("prop_field-crates", "farm-italy", "field-crates", farm.buildFieldCrates),
  italyPiece("prop_water-tap", "farm-italy", "water-tap", farm.buildWaterTap),
  italyPiece("prop_shade-tree", "farm-italy", "shade-tree", farm.buildShadeTree),
);

/** Calgary and Dubai, built as Lagos is (docs/design/11-calgary-dubai-and-castel-volturno.md): the vehicles for their rides, the frontages and the library. */
const NORTH = "The makers, written as code from the kit";
ENTRIES.push(
  { name: "vehicle_calgary-bus", file: "shared/vehicle/vehicle_calgary-bus.glb", place: "shared", source: "models/vehicles/calgary-bus", author: NORTH, views: [...ELEVATIONS, "phone"], build: () => staticModel("vehicle_calgary-bus", buildCalgaryBus()) },
  { name: "vehicle_ctrain-car", file: "shared/vehicle/vehicle_ctrain-car.glb", place: "shared", source: "models/vehicles/ctrain-car", author: NORTH, views: [...ELEVATIONS, "phone"], build: () => staticModel("vehicle_ctrain-car", buildCtrainCar()) },
  { name: "vehicle_dubai-metro", file: "shared/vehicle/vehicle_dubai-metro.glb", place: "shared", source: "models/vehicles/dubai-metro", author: NORTH, views: [...ELEVATIONS, "phone"], build: () => staticModel("vehicle_dubai-metro", buildDubaiMetro()) },
  // The strip mall in north-east Calgary (world:place-is-one-screen), its row as data, and the bare trees of its winter.
  placePiece(
    "building_strip-mall",
    "calgary-north-east",
    () => buildStripMall(readJson<StripMallSpec>(join(SOURCE, "buildings", "strip-mall", "spec.json"))),
    [...ELEVATIONS, "plan", "phone"],
  ),
  placePiece("prop_bare-tree", "calgary-north-east", north.buildBareTree),
  // The CTrain station: the shelter on the platform; the machine, the gates' sign and the car are London's and the ride's.
  placePiece("prop_platform-shelter", "ctrain-station-canada", north.buildPlatformShelter),
  // The library's things.
  placePiece("prop_bookshelf", "library-canada", north.buildBookshelf),
  placePiece("prop_library-table", "library-canada", north.buildLibraryTable),
  placePiece("prop_course-desk", "library-canada", north.buildCourseDesk),
  // Union station: the hall under its shell, the viaduct with the car on it, the Nol machine and the escalator's foot.
  placePiece("building_metro-station", "metro-station-uae", () => buildMetroStation("place.metro-station-uae.sign.name", { board: "white", ink: "red", border: "red" }), [...ELEVATIONS, "plan", "phone"]),
  placePiece("building_metro-viaduct", "metro-station-uae", buildMetroViaduct, [...ELEVATIONS, "plan", "phone"]),
  placePiece("prop_nol-machine", "metro-station-uae", north.buildNolMachine),
  placePiece("prop_escalator", "metro-station-uae", north.buildEscalator),
  // The site: the towers' base over the hoarding, the crane's foot, the gate's post, the cleaner's trolley and the cooler.
  placePiece("building_site-frame", "site-uae", buildSiteFrame, [...ELEVATIONS, "plan", "phone"]),
  placePiece("prop_hoarding", "site-uae", north.buildHoarding),
  placePiece("prop_crane-foot", "site-uae", north.buildCraneFoot),
  placePiece("prop_guard-post", "site-uae", north.buildGuardPost),
  placePiece("prop_cleaner-trolley", "site-uae", north.buildCleanerTrolley),
  placePiece("prop_water-cooler", "site-uae", north.buildWaterCooler),
);

/** Every shipped asset, each model a player could be shown as a thing with the tile view beside its fixed views. */
export const CATALOG: CatalogEntry[] = ENTRIES.map((entry): CatalogEntry => {
  const tiled: ViewName[] = isTiled(entry.name) && !entry.views.includes("tile") ? ["tile"] : [];
  const postered: ViewName[] = isPostered(entry.name) && !entry.views.includes("poster") ? ["poster"] : [];
  return tiled.length + postered.length === 0 ? entry : { ...entry, views: [...entry.views, ...tiled, ...postered] };
});

export function findEntries(names: readonly string[]): CatalogEntry[] {
  if (names.length === 0 || names.includes("all")) return CATALOG;
  const found = new Set<CatalogEntry>();
  for (const name of names) {
    if (name === "examples") {
      for (const entry of CATALOG) if (entry.example === true) found.add(entry);
      continue;
    }
    if (name === "grids") {
      for (const entry of CATALOG) if (entry.source.startsWith("models/props/motion/")) found.add(entry);
      continue;
    }
    if (name === "people" || name === "vehicles") {
      for (const entry of CATALOG) if (entry.name.startsWith(name === "people" ? "person_" : "vehicle_")) found.add(entry);
      continue;
    }
    const entry = CATALOG.find((candidate) => candidate.name === name);
    if (entry === undefined) throw new Error(`No asset named ${name}. Known: ${CATALOG.map((e) => e.name).join(", ")}`);
    found.add(entry);
  }
  return [...found];
}
