// Every shipped asset, where its source is and how it is built (decision 0009 section 4).
// The export, the shooter, the outline scorer and the check all start here.
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
import { buildPerson, faceStyleFrom } from "@japacity/assets-src/people/people";
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
import * as street from "@japacity/assets-src/prop/street/build";
import { buildStall } from "@japacity/assets-src/prop/stall";
import { buildStreetBench } from "@japacity/assets-src/prop/street-bench/build";
import { buildSuyaGrill } from "@japacity/assets-src/prop/suya-grill/build";
import { buildJointSet } from "@japacity/assets-src/prop/joint-set/build";
import { buildTrolley } from "@japacity/assets-src/prop/trolley/build";
import { buildBarberKiosk } from "@japacity/assets-src/shop/barber-kiosk/build";
import { buildContainerPhones } from "@japacity/assets-src/shop/container-phones/build";
import { buildLottoKiosk } from "@japacity/assets-src/shop/lotto-kiosk/build";
import { buildProvisions } from "@japacity/assets-src/shop/provisions/build";
import { buildViewingCentre } from "@japacity/assets-src/shop/viewing-centre/build";
import { buildTaxi, DUBAI_TAXI } from "@japacity/assets-src/veh/taxi/build";
import { buildHome } from "@japacity/assets-src/bld/home/build";
import { HOMES3 } from "@japacity/assets-src/bld/home/homes3";
import { buildCar } from "@japacity/assets-src/veh/car/build";
import * as home from "@japacity/assets-src/prop/home/build";
import * as things from "@japacity/assets-src/prop/home/things";
import { buildAbra } from "@japacity/assets-src/veh/abra/build";
import { buildLabourBus } from "@japacity/assets-src/veh/labour-bus/build";
import { buildDanfo, buildKeke, buildOkada } from "@japacity/assets-src/veh/vehicles";
import { buildLondonBus } from "@japacity/assets-src/veh/london-bus/build";
import { buildTrainCarriage } from "@japacity/assets-src/veh/train-carriage/build";
import { buildCornerPub } from "@japacity/assets-src/bld/corner-pub/build";
import * as london from "@japacity/assets-src/prop/london/build";
import * as castel from "@japacity/assets-src/places/castel-volturno/build";
import * as farm from "@japacity/assets-src/places/farm-it/build";
import { buildPine } from "@japacity/assets-src/places/via-domitiana/build";
import { buildItalyBus } from "@japacity/assets-src/veh/italy-bus/build";
import { buildVan } from "@japacity/assets-src/veh/van/build";
import { buildCalgaryBus } from "@japacity/assets-src/veh/calgary-bus/build";
import { buildCtrainCar } from "@japacity/assets-src/veh/ctrain-car/build";
import { buildDubaiMetro } from "@japacity/assets-src/veh/dubai-metro/build";
import { buildStripMall, type StripMallSpec } from "@japacity/assets-src/bld/strip-mall/build";
import { buildMetroStation, buildMetroViaduct } from "@japacity/assets-src/bld/metro-station/build";
import { buildSiteFrame } from "@japacity/assets-src/bld/site-frame/build";
import * as north from "@japacity/assets-src/prop/north/build";
import { Group } from "three";

import { type BakedModel, bakeGroup, linearColour } from "./bake";
import { readJson, REPO_ROOT } from "../repo";

export const SOURCE = join(REPO_ROOT, "assets-src");
export const PUBLIC = join(REPO_ROOT, "apps", "client", "public", "assets");

/** The way every dish in the hub faces, in the frame of its unturned buildings (assets:dishes-face-one-satellite). */
const HUB_DISH_YAW = DEFAULT_DISH_YAW;

export type ViewName = "front" | "back" | "left" | "right" | "threeQuarter" | "plan" | "phone" | "phoneFar" | "tile" | "face" | "figure" | "cheer";

/** A look's portraits for the front door (prologue:front-door-builds-a-person, prologue:front-door-three-screens): the face for the look strip and the life cards, the whole figure with a hand on the hip, and the figure cheering on the page after Begin. */
export const PORTRAITS: readonly ViewName[] = ["face", "figure", "cheer"];
/**
 * The people the front door offers as a look: the city's passers-by, the client's `LOOKS` from its roster. Named here,
 * since the tools never import the client; the client's test of the door's pictures proves each look has its portraits.
 */
const DOOR_LOOKS: ReadonlySet<string> = new Set(["chr_ada", "chr_amaka", "chr_bayo", "chr_bisi", "chr_dayo", "chr_emeka", "chr_femi", "chr_kemi", "chr_kunle", "chr_ngozi", "chr_sade", "chr_segun", "chr_tobi", "chr_tolani", "chr_tunde", "chr_zainab"]);

/** Whether a model gets the portraits: a person the door offers as a look. */
export function isPortrayed(name: string): boolean {
  return DOOR_LOOKS.has(name);
}

/** The kinds of model a picture tile is cut from (design page 13, the pictures): never a person, whose tile is a name pill. */
const TILED_KINDS = /^(prop|shop|veh|lm|bld)_/;
/** Models no player is shown as a thing: the rooms' and the homes' shells, the moving sheets, the water, a pole, the drum's water surface and the plank walk. */
const UNTILED = /^(bld_room_|bld_home-|prop_sheet-|prop_water_|prop_pole$|prop_drum-water$|prop_plank-walkway$)/;

/** Whether a model gets the tile view: a thing a player could be shown on a choice. */
export function isTiled(name: string): boolean {
  return TILED_KINDS.test(name) && !UNTILED.test(name);
}

export interface CatalogEntry {
  /** The shipped name without extension: `bld_plaza`. */
  name: string;
  /** The shipped path under public/assets. */
  file: string;
  place: string;
  /** The source folder under assets-src: specs, outlines, renders, the review. */
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

const EXAMPLE_MAKERS = "The makers, written as code; one of the examples (assets-src/examples.json)";
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
  const source = join("assets-src", "bld", slug);
  return {
    name: `bld_${slug}`,
    file: `places/${place}/bld_${slug}.glb`,
    place: `place.${place}`,
    source,
    author,
    example: author === EXAMPLE_MAKERS,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => {
      const { spec, options } = readJson<{ spec: BuildingSpec; options: BuildingOptions }>(join(REPO_ROOT, source, "spec.json"));
      return staticModel(`bld_${slug}`, buildBuilding(spec, { ...options, dishYaw: HUB_DISH_YAW }));
    },
  };
}

const MAKOKO = "The makers, written as code from the kit";

/** A piece one of the staged places needed, built from the kit by the makers. */
function placePiece(name: string, place: string, build: () => Group, views: ViewName[] = [...ELEVATIONS, "phone"]): CatalogEntry {
  const [prefix = "", slug = ""] = name.split("_");
  return { name, file: `places/${place}/${name}.glb`, place: `place.${place}`, source: `assets-src/${prefix}/${slug}`, author: KIT, views, build: () => staticModel(name, build()) };
}

/** A building a staged place needed, as kit data in its spec.json (assets:variants-are-numbers-not-code). */
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

const TOOLS = "The makers, written as code";

/** A moving sheet or the water tile at one mesh level, its motion, pinned edge and level in its extras (assets:one-shared-motion-material, assets:sheets-ship-two-mesh-levels). */
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
  library: "library-ca",
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
  library: "place.library-ca",
};

function roomEntry(room: RoomName): CatalogEntry {
  const spec = ROOMS[room];
  return {
    name: spec.name,
    file: `places/${ROOM_FOLDERS[room]}/${spec.name}.glb`,
    place: ROOM_PLACES[room],
    source: `assets-src/bld/room/${room}`,
    author: ROOM_MAKERS,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => staticModel(spec.name, buildRoom(spec)),
  };
}

/** A piece of furniture: shared when more than one room uses it, else in its room's folder. */
/** The room's basics (world:room-seen-down-its-length), written as code from the kit beside the rooms they furnish. */
function basicsPiece(name: string, folder: string, place: string, build: () => Group): CatalogEntry {
  // Each piece its own folder under places/room-basics, so each has renders of its own.
  return { ...furniturePiece(name, folder, place, build), source: `assets-src/places/room-basics/${name.slice("prop_".length)}`, author: KIT };
}

function furniturePiece(name: string, folder: string, place: string, build: () => Group): CatalogEntry {
  const shared = folder === "shared";
  return {
    name,
    file: shared ? `shared/prop/${name}.glb` : `places/${folder}/${name}.glb`,
    place: shared ? "shared" : place,
    source: `assets-src/prop/${name.slice("prop_".length)}`,
    author: ROOM_MAKERS,
    views: [...ELEVATIONS, "plan", "phone"],
    build: () => staticModel(name, build()),
  };
}

const ENTRIES: CatalogEntry[] = [
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
    author: EXAMPLE_MAKERS,
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
    author: EXAMPLE_MAKERS,
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
    author: EXAMPLE_MAKERS,
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
    author: EXAMPLE_MAKERS,
    example: true,
    views: [...ELEVATIONS, "plan", "phone", "phoneFar"],
    // On the lagoon, seen from a canoe as the photographs are, so the arches show.
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
  // Makoko on the lagoon (home:home-is-the-home-point): its houses, the classroom, the walk, the racks and the canoes that travel the channel.
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
    source: `assets-src/prop/street/${name.slice("prop_".length)}`,
    author: STREET_DRESSING,
    views: [...ELEVATIONS, "phone"],
    build: () => staticModel(name, build()),
  })),
  {
    name: "prop_stall",
    file: "shared/prop/prop_stall.glb",
    place: "shared",
    source: "assets-src/prop/stall",
    author: MAKERS,
    views: [...ELEVATIONS, "phone"],
    build: () => staticModel("prop_stall", buildStall()),
  },
  buildingEntry("bode-thomas-betting", "bode-thomas", KIT),
  { name: "shop_lotto-kiosk", file: "places/bode-thomas/shop_lotto-kiosk.glb", place: "place.bode-thomas", source: "assets-src/shop/lotto-kiosk", author: KIT, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("shop_lotto-kiosk", buildLottoKiosk({ board: "place.bode-thomas.sign.1", games: "place.bode-thomas.sign.5" }, { board: { board: "danfoYellow", ink: "green", painted: true }, games: { board: "black", ink: "white", painted: true } }), true) },
  { name: "bld_family-house", file: "places/family-house/bld_family-house.glb", place: "place.family-house", source: "assets-src/bld/family-house", author: KIT, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("bld_family-house", buildFamilyHouse("place.family-house.sign.2", { board: "white", ink: "red", painted: true }, HUB_DISH_YAW)) },
  { name: "prop_party-set", file: "places/family-house/prop_party-set.glb", place: "place.family-house", source: "assets-src/prop/party-set", author: KIT, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("prop_party-set", buildPartySet("place.family-house.sign.1", { board: "cream", ink: "wine" })) },
  { name: "prop_parlour-set", file: "places/family-house/prop_parlour-set.glb", place: "place.family-house", source: "assets-src/prop/parlour-set", author: KIT, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("prop_parlour-set", buildParlourSet()) },
  { name: "prop_cooking-fire", file: "places/family-house/prop_cooking-fire.glb", place: "place.family-house", source: "assets-src/prop/cooking-fire", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_cooking-fire", buildCookingFire()) },
  { name: "prop_plastic-chair", file: "shared/prop/prop_plastic-chair.glb", place: "shared", source: "assets-src/prop/plastic-chair", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_plastic-chair", buildPlasticChair()) },
  ...(["a", "b"] as const).map(
    (variant): CatalogEntry => ({
      name: `bld_rye-lane-terrace_${variant}`,
      file: `places/peckham/bld_rye-lane-terrace_${variant}.glb`,
      place: "place.peckham",
      source: `assets-src/bld/rye-lane-terrace/${variant}`,
      author: KIT,
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
    author: KIT,
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
      author: KIT,
      views: [...ELEVATIONS, "plan", "phone"],
      build: () => {
        const spec = readJson<ArcadeSpec>(join(SOURCE, "bld", "deira-arcade", variant, "spec.json"));
        return staticModel(spec.name, buildArcade(spec, DEIRA_DISH_YAW));
      },
    }),
  ),
  { name: "veh_abra", file: "places/deira/veh_abra.glb", place: "place.deira", source: "assets-src/veh/abra", author: KIT, views: [...ELEVATIONS, "phone"], ground: "lagoon", build: () => staticModel("veh_abra", buildAbra()) },
  { name: "veh_labour-bus", file: "places/deira/veh_labour-bus.glb", place: "place.deira", source: "assets-src/veh/labour-bus", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("veh_labour-bus", buildLabourBus()) },
  // The pieces the places staged as frontages need (world:place-is-one-screen).
  { name: "veh_taxi-dubai", file: "places/deira/veh_taxi-dubai.glb", place: "place.deira", source: "assets-src/veh/taxi/dubai", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("veh_taxi-dubai", buildTaxi(DUBAI_TAXI)) },
  placePiece("prop_street-bench", "peckham", buildStreetBench),
  { name: "prop_flag-mast", file: "shared/prop/prop_flag-mast.glb", place: "shared", source: "assets-src/prop/flag-mast", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_flag-mast", buildFlagMast()) },
  { name: "prop_bus-shelter", file: "shared/prop/prop_bus-shelter.glb", place: "shared", source: "assets-src/prop/bus-shelter", author: KIT, views: [...ELEVATIONS, "phone"], build: () => staticModel("prop_bus-shelter", buildBusShelter()) },
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
      author: MAKERS,
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
  { name: "prop_suya-grill", file: "shared/prop/prop_suya-grill.glb", place: "shared", source: "assets-src/prop/suya-grill", author: STREET, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("prop_suya-grill", buildSuyaGrill()) },
  { name: "prop_joint-set", file: "shared/prop/prop_joint-set.glb", place: "shared", source: "assets-src/prop/joint-set", author: STREET, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("prop_joint-set", buildJointSet()) },
  { name: "shop_barber-kiosk", file: "places/bode-thomas/shop_barber-kiosk.glb", place: "place.bode-thomas", source: "assets-src/shop/barber-kiosk", author: STREET, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("shop_barber-kiosk", buildBarberKiosk("place.bode-thomas.sign.9", { board: "white", ink: "red", painted: true }), true) },
  { name: "shop_viewing-centre", file: "places/bode-thomas/shop_viewing-centre.glb", place: "place.bode-thomas", source: "assets-src/shop/viewing-centre", author: STREET, views: [...ELEVATIONS, "plan", "phone"], build: () => staticModel("shop_viewing-centre", buildViewingCentre(HUB_DISH_YAW)) },
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
    source: prefix === "prop" ? `assets-src/prop/home/${slug}` : `assets-src/${prefix}/${slug}`,
    author: HOME_MAKERS,
    // A building's plan as every building's (assets:contributor-renders-fixed-views).
    views: prefix === "bld" ? [...ELEVATIONS, "plan", "phone"] : [...ELEVATIONS, "phone"],
    build: () => staticModel(name, build()),
  };
}
ENTRIES.push(
  homePiece("veh_car", "shared", () => buildCar()),
  homePiece("prop_bath-corner", "shared", home.buildBathCorner),
  homePiece("bld_home-family-house", "home-family-house", () => buildHome(HOMES3.family)),
  homePiece("bld_home-room-house", "home-room-house", () => buildHome(HOMES3.room)),
  homePiece("bld_home-hostel-house", "home-hostel-house", () => buildHome(HOMES3.hostel)),
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

/** London on the Lagos mold (design page 14): the bus and the train for the ride abroad, the frontages and the rooms of its places. */
const LONDON = "The makers, written as code from the kit";
ENTRIES.push(
  { name: "veh_london-bus", file: "shared/veh/veh_london-bus.glb", place: "shared", source: "assets-src/veh/london-bus", author: LONDON, views: [...ELEVATIONS, "phone"], build: () => staticModel("veh_london-bus", buildLondonBus()) },
  { name: "veh_train-carriage", file: "shared/veh/veh_train-carriage.glb", place: "shared", source: "assets-src/veh/train-carriage", author: LONDON, views: [...ELEVATIONS, "phone"], build: () => staticModel("veh_train-carriage", buildTrainCarriage()) },
  // Rye Lane (world:place-is-one-screen): two more terraces as data, the pub on the corner, the produce, the stalls and the kitchen's door.
  ...(["c", "d"] as const).map(
    (variant): CatalogEntry => ({
      name: `bld_rye-lane-terrace_${variant}`,
      file: `places/rye-lane/bld_rye-lane-terrace_${variant}.glb`,
      place: "place.rye-lane",
      source: `assets-src/bld/rye-lane-terrace/${variant}`,
      author: LONDON,
      views: [...ELEVATIONS, "plan", "phone"],
      build: () => {
        const spec = readJson<TerraceSpec>(join(SOURCE, "bld", "rye-lane-terrace", variant, "spec.json"));
        return staticModel(spec.name, buildTerrace(spec, PECKHAM_DISH_YAW));
      },
    }),
  ),
  placePiece("bld_corner-pub", "rye-lane", () => buildCornerPub(PECKHAM_DISH_YAW), [...ELEVATIONS, "plan", "phone"]),
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

/** Castel Volturno on the mold (design page 15): the coast road's bus and the gangmaster's van for the ride, the roundabout, the Domitiana and the fields. */
const ITALY = "The makers, written as code from the kit";
/** Every dish at the roundabout and on the Domitiana faces one way (assets:dishes-face-one-satellite); their blocks all stand square to the road. */
const CASTEL_DISH_YAW = 2.1;

/** A piece of one of Castel Volturno's places, its renders beside its build code under the place's folder. */
function italyPiece(name: string, folder: string, source: string, build: () => Group, views: ViewName[] = [...ELEVATIONS, "phone"]): CatalogEntry {
  return { name, file: `places/${folder}/${name}.glb`, place: `place.${folder}`, source: `assets-src/places/${folder}/${source}`, author: ITALY, views, build: () => staticModel(name, build()) };
}

/** A plaster row from its numbers in spec.json (assets:variants-are-numbers-not-code). */
function plasterRow(name: string, folder: string, source: string): CatalogEntry {
  const build = (): Group => castel.buildPlasterRow(readJson<castel.PlasterRowSpec>(join(SOURCE, "places", folder, source, "spec.json")), CASTEL_DISH_YAW);
  return italyPiece(name, folder, source, build, [...ELEVATIONS, "plan", "phone"]);
}

ENTRIES.push(
  { name: "veh_italy-bus", file: "shared/veh/veh_italy-bus.glb", place: "shared", source: "assets-src/veh/italy-bus", author: ITALY, views: [...ELEVATIONS, "phone"], build: () => staticModel("veh_italy-bus", buildItalyBus()) },
  { name: "veh_van", file: "shared/veh/veh_van.glb", place: "shared", source: "assets-src/veh/van", author: ITALY, views: [...ELEVATIONS, "phone"], build: () => staticModel("veh_van", buildVan()) },
  // The roundabout (world:place-is-one-screen): two plaster rows with the bar, the African shop and the call shop, the island and its sign, the bar's counter, the palms and the stop's pole.
  plasterRow("bld_castel-row_a", "castel-volturno", "row-a"),
  plasterRow("bld_castel-row_b", "castel-volturno", "row-b"),
  italyPiece("prop_roundabout", "castel-volturno", "roundabout", () => castel.buildRoundabout("place.castel-volturno.sign.roundabout", { board: "blue", ink: "white", border: "white" }), [...ELEVATIONS, "plan", "phone"]),
  italyPiece("prop_bar-counter", "castel-volturno", "bar-counter", castel.buildBarCounter),
  italyPiece("prop_palm", "castel-volturno", "palm", castel.buildPalm),
  italyPiece("prop_bus-pole", "castel-volturno", "bus-pole", () => castel.buildBusPole("place.castel-volturno.sign.stop", { board: "white", ink: "blue", border: "blue" })),
  // The Domitiana: the low block of the Nigerian shop and the barber, and the stone pines of the coast.
  plasterRow("bld_domitiana-block", "via-domitiana", "block"),
  italyPiece("prop_pine", "via-domitiana", "pine", buildPine),
  // The fields: the rows, the gangmaster's table, the crates, the tap and the tree.
  italyPiece("prop_crop-row", "farm-it", "crop-row", farm.buildCropRow, [...ELEVATIONS, "plan", "phone"]),
  italyPiece("prop_tarp-table", "farm-it", "tarp-table", () => farm.buildTarpTable("place.farm-it.sign.table", { board: "tan", ink: "black", painted: true })),
  italyPiece("prop_field-crates", "farm-it", "field-crates", farm.buildFieldCrates),
  italyPiece("prop_water-tap", "farm-it", "water-tap", farm.buildWaterTap),
  italyPiece("prop_shade-tree", "farm-it", "shade-tree", farm.buildShadeTree),
);

/** Calgary and Dubai on the mold (design page 15): the vehicles for their rides, the frontages and the library. */
const NORTH = "The makers, written as code from the kit";
ENTRIES.push(
  { name: "veh_calgary-bus", file: "shared/veh/veh_calgary-bus.glb", place: "shared", source: "assets-src/veh/calgary-bus", author: NORTH, views: [...ELEVATIONS, "phone"], build: () => staticModel("veh_calgary-bus", buildCalgaryBus()) },
  { name: "veh_ctrain-car", file: "shared/veh/veh_ctrain-car.glb", place: "shared", source: "assets-src/veh/ctrain-car", author: NORTH, views: [...ELEVATIONS, "phone"], build: () => staticModel("veh_ctrain-car", buildCtrainCar()) },
  { name: "veh_dubai-metro", file: "shared/veh/veh_dubai-metro.glb", place: "shared", source: "assets-src/veh/dubai-metro", author: NORTH, views: [...ELEVATIONS, "phone"], build: () => staticModel("veh_dubai-metro", buildDubaiMetro()) },
  // The strip mall in north-east Calgary (world:place-is-one-screen), its row as data, and the bare trees of its winter.
  placePiece(
    "bld_strip-mall",
    "calgary-north-east",
    () => buildStripMall(readJson<StripMallSpec>(join(SOURCE, "bld", "strip-mall", "spec.json"))),
    [...ELEVATIONS, "plan", "phone"],
  ),
  placePiece("prop_bare-tree", "calgary-north-east", north.buildBareTree),
  // The CTrain station: the shelter on the platform; the machine, the gates' sign and the car are London's and the ride's.
  placePiece("prop_platform-shelter", "ctrain-station-ca", north.buildPlatformShelter),
  // The library's things.
  placePiece("prop_bookshelf", "library-ca", north.buildBookshelf),
  placePiece("prop_library-table", "library-ca", north.buildLibraryTable),
  placePiece("prop_course-desk", "library-ca", north.buildCourseDesk),
  // Union station: the hall under its shell, the viaduct with the car on it, the Nol machine and the escalator's foot.
  placePiece("bld_metro-station", "metro-station-uae", () => buildMetroStation("place.metro-station-uae.sign.name", { board: "white", ink: "red", border: "red" }), [...ELEVATIONS, "plan", "phone"]),
  placePiece("bld_metro-viaduct", "metro-station-uae", buildMetroViaduct, [...ELEVATIONS, "plan", "phone"]),
  placePiece("prop_nol-machine", "metro-station-uae", north.buildNolMachine),
  placePiece("prop_escalator", "metro-station-uae", north.buildEscalator),
  // The site: the towers' base over the hoarding, the crane's foot, the gate's post, the cleaner's trolley and the cooler.
  placePiece("bld_site-frame", "site-uae", buildSiteFrame, [...ELEVATIONS, "plan", "phone"]),
  placePiece("prop_hoarding", "site-uae", north.buildHoarding),
  placePiece("prop_crane-foot", "site-uae", north.buildCraneFoot),
  placePiece("prop_guard-post", "site-uae", north.buildGuardPost),
  placePiece("prop_cleaner-trolley", "site-uae", north.buildCleanerTrolley),
  placePiece("prop_water-cooler", "site-uae", north.buildWaterCooler),
);

/** Every shipped asset, each model a player could be shown as a thing with the tile view beside its fixed views. */
export const CATALOG: CatalogEntry[] = ENTRIES.map((entry) => (isTiled(entry.name) && !entry.views.includes("tile") ? { ...entry, views: [...entry.views, "tile"] } : entry));

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
