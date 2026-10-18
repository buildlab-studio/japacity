// Calgary's and Dubai's models (docs/design/15-the-three-countries-on-the-mold.md sections 3 and 6): the things of their
// places, the strip mall, Union station, the site's frame, and the vehicles of their rides, each standing on y = 0 with
// its footprint and only palette colours, and each ride's vehicle built to be sat in, its seat inside the body on the
// kerb side, the right of the facing, as Canada and the UAE drive (world:ride-abroad-and-workplace).
import { footprintOf, isPaletteName } from "@japacity/assets";
import { Box3, type Group, type Mesh, Vector3 } from "three";
import { describe, expect, test } from "vitest";

import { buildMetroStation, buildMetroViaduct } from "../../bld/metro-station/build";
import { buildRoom } from "../../bld/room/build";
import { ROOMS } from "../../bld/room/rooms";
import { buildSiteFrame } from "../../bld/site-frame/build";
import { buildStripMall, type StripMallSpec } from "../../bld/strip-mall/build";
import spec from "../../bld/strip-mall/spec.json";
import { buildCalgaryBus, CALGARY_BUS_SEAT, CALGARY_BUS_SEAT_BUILT } from "../../veh/calgary-bus/build";
import { buildCtrainCar, CTRAIN_SEAT, CTRAIN_SEAT_BUILT } from "../../veh/ctrain-car/build";
import { buildDubaiMetro, METRO_SEAT, METRO_SEAT_BUILT } from "../../veh/dubai-metro/build";
import { buildLabourBus, LABOUR_BUS_SEAT, LABOUR_BUS_SEAT_BUILT } from "../../veh/labour-bus/build";
import { type RideSeat, turnedSeat } from "../../veh/ride";
import { buildTaxi, DUBAI_TAXI, TAXI_SEAT, TAXI_SEAT_BUILT } from "../../veh/taxi/build";
import * as north from "./build";

const MODELS: [string, () => Group][] = [
  ["prop_bare-tree", north.buildBareTree],
  ["prop_platform-shelter", north.buildPlatformShelter],
  ["prop_bookshelf", north.buildBookshelf],
  ["prop_library-table", north.buildLibraryTable],
  ["prop_course-desk", north.buildCourseDesk],
  ["prop_nol-machine", north.buildNolMachine],
  ["prop_escalator", north.buildEscalator],
  ["prop_hoarding", north.buildHoarding],
  ["prop_crane-foot", north.buildCraneFoot],
  ["prop_guard-post", north.buildGuardPost],
  ["prop_cleaner-trolley", north.buildCleanerTrolley],
  ["prop_water-cooler", north.buildWaterCooler],
  ["bld_strip-mall", () => buildStripMall(spec as StripMallSpec)],
  ["bld_metro-station", () => buildMetroStation("place.metro-station-uae.sign.name", { board: "white", ink: "red" })],
  ["bld_metro-viaduct", buildMetroViaduct],
  ["bld_site-frame", buildSiteFrame],
  ["bld_room_library", () => buildRoom(ROOMS.library)],
  ["veh_calgary-bus", buildCalgaryBus],
  ["veh_ctrain-car", buildCtrainCar],
  ["veh_dubai-metro", buildDubaiMetro],
  ["veh_labour-bus", buildLabourBus],
  ["veh_taxi-dubai", () => buildTaxi(DUBAI_TAXI)],
];

/** Each ride's vehicle, its seat in the frame it is built in, and the seat it exports in the turned frame. */
const RIDES: [string, () => Group, RideSeat, RideSeat][] = [
  ["Calgary's bus", buildCalgaryBus, CALGARY_BUS_SEAT_BUILT, CALGARY_BUS_SEAT],
  ["the CTrain car", buildCtrainCar, CTRAIN_SEAT_BUILT, CTRAIN_SEAT],
  ["the Dubai metro car", buildDubaiMetro, METRO_SEAT_BUILT, METRO_SEAT],
  ["the labour bus", buildLabourBus, LABOUR_BUS_SEAT_BUILT, LABOUR_BUS_SEAT],
  ["the Dubai taxi", () => buildTaxi(DUBAI_TAXI), TAXI_SEAT_BUILT, TAXI_SEAT],
];

function bounds(model: Group): Box3 {
  model.updateMatrixWorld(true);
  return new Box3().setFromObject(model);
}

describe("Calgary's and Dubai's models", () => {
  test.each(MODELS)("[assets:metre-units-and-origin] [assets:models-record-their-footprint] given %s, when it is built, then it stands on y = 0 and records the ground it blocks", (name, build) => {
    const model = build();
    expect(model.name).toBe(name);
    expect(Math.abs(bounds(model).min.y)).toBeLessThanOrEqual(0.01);
    const footprint = footprintOf(model);
    expect(Array.isArray(footprint) && footprint.length > 0).toBe(true);
  });

  test.each(MODELS)("[assets:colours-from-named-palette] given %s, when it is built, then every part names a palette colour", (_, build) => {
    build().traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const colour = (mesh.material as { userData: { palette?: string } }).userData.palette ?? "";
      expect(isPaletteName(colour)).toBe(true);
    });
  });

  test.each(RIDES)("[assets:metre-units-and-origin] given %s, when it is built, then it faces +Z, its length along z and its footprint centred", (_, build) => {
    const box = bounds(build());
    const size = box.getSize(new Vector3());
    expect(size.z).toBeGreaterThan(size.x * 2);
    expect(Math.abs(box.min.x + box.max.x)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(box.min.z + box.max.z)).toBeLessThanOrEqual(0.05);
  });

  test.each(RIDES)("[world:ride-abroad-and-workplace] given %s, when the ride's seat is read, then the seat it exports is its built seat turned, and the eye stands inside the body on the kerb side, the right of the facing", (_, build, built, seat) => {
    const model = build();
    expect(turnedSeat(model, built)).toEqual(seat);
    const [x, y, z] = seat.eye;
    expect(bounds(model).containsPoint(new Vector3(x, y, z))).toBe(true);
    // Facing +z, the right hand is -x: the kerb side where Canada and the UAE drive, and the window the ride looks out of.
    expect(x).toBeLessThan(0);
    expect(seat.window[0]).toBeLessThan(x);
  });
});
