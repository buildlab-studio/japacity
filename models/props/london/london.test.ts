// London's models (docs/design/10-london-on-the-lagos-mold.md section 4): the things of its places, the pub, the bus
// and the train, each standing on y = 0 with its footprint and only palette colours, and the two vehicles built to be
// sat in, with the ride's seat inside the body (world:ride-abroad-and-workplace).
import { footprintOf, isPaletteName } from "@japacity/model-kit";
import { Box3, type Group, type Mesh, Vector3 } from "three";
import { describe, expect, test } from "vitest";

import { buildCornerPub } from "../../buildings/corner-pub/build";
import { BUS, BUS_TOP_SEAT, buildLondonBus } from "../../vehicles/london-bus/build";
import { buildTrainCarriage, CARRIAGE, CARRIAGE_SEAT } from "../../vehicles/train-carriage/build";
import * as london from "./build";

const MODELS: [string, () => Group][] = [
  ["prop_produce-stand", london.buildProduceStand],
  ["prop_gazebo-stall", london.buildGazeboStall],
  ["prop_side-door", london.buildSideDoor],
  ["prop_ticket-machine", london.buildTicketMachine],
  ["prop_ticket-gates", london.buildTicketGates],
  ["prop_courier-bike", london.buildCourierBike],
  ["prop_platform-sign", () => london.buildPlatformSign("place.peckham.sign.31", { board: "white", ink: "blue" })],
  ["prop_shop-aisle", london.buildShopAisle],
  ["prop_trolley-bay", london.buildTrolleyBay],
  ["prop_tills", london.buildTills],
  ["prop_reception-desk", london.buildReceptionDesk],
  ["prop_rota-board", london.buildRotaBoard],
  ["prop_tea-point", london.buildTeaPoint],
  ["prop_nurses-station", london.buildNursesStation],
  ["prop_hospital-bed", london.buildHospitalBed],
  ["prop_desk-pod", london.buildDeskPod],
  ["prop_glass-office", london.buildGlassOffice],
  ["prop_clock-in", london.buildClockIn],
  ["prop_racking", london.buildRacking],
  ["prop_cage-trolley", london.buildCageTrolley],
  ["prop_smoking-shelter", london.buildSmokingShelter],
  ["prop_pew", london.buildPew],
  ["prop_altar", london.buildAltar],
  ["building_corner-pub", () => buildCornerPub(2.4)],
  ["vehicle_london-bus", buildLondonBus],
  ["vehicle_train-carriage", buildTrainCarriage],
];

function bounds(model: Group): Box3 {
  model.updateMatrixWorld(true);
  return new Box3().setFromObject(model);
}

describe("London's models", () => {
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

  test("[assets:metre-units-and-origin] given the bus and the carriage, when they are built, then each faces +Z, its length along z and its footprint centred", () => {
    for (const build of [buildLondonBus, buildTrainCarriage]) {
      const box = bounds(build());
      const size = box.getSize(new Vector3());
      expect(size.z).toBeGreaterThan(size.x * 3);
      expect(Math.abs(box.min.x + box.max.x)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(box.min.z + box.max.z)).toBeLessThanOrEqual(0.05);
    }
  });

  test("[world:ride-abroad-and-workplace] given the bus's top deck and the carriage's window seat, when the ride's seat is read, then the eye stands inside the body, over the floor and under the roof, so the camera rides inside", () => {
    const bus = bounds(buildLondonBus());
    const [bx, by, bz] = BUS_TOP_SEAT.eye;
    expect(bus.containsPoint(new Vector3(bx, by, bz))).toBe(true);
    expect(by).toBeGreaterThan(BUS.deck + 0.9);
    expect(by).toBeLessThan(BUS.roof);
    // The kerb side is on the left of the facing, +x, where the UK's doors open.
    expect(bx).toBeGreaterThan(0);
    const train = bounds(buildTrainCarriage());
    const [tx, ty, tz] = CARRIAGE_SEAT.eye;
    expect(train.containsPoint(new Vector3(tx, ty, tz))).toBe(true);
    expect(ty).toBeGreaterThan(CARRIAGE.sill);
    expect(ty).toBeLessThan(CARRIAGE.head);
  });
});
