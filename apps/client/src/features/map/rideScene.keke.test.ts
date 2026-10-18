// The keke's window (world:ride-cuts-between-angles): the camera sits on the bench, clear of everyone the ride seats, so
// no head comes through it and the canopy's underside never fills the cut. It looks out of
// the keke's open side on the road's side, between its pillars and under its canopy, as the danfo's window looks out
// from the aisle. Positions are the ride scene's own: its seats and the keke's frame as the model builds it.
import { Group, Vector3 } from "three";
import { describe, expect, test } from "vitest";

import { anglesOf, buildRide, RIDE_MS } from "./rideScene";

/** The keke's open sides as its model has them (models/vehicles/vehicles.ts, turned to face +z): the side at x 0.61 between the pillars at z -1.3 and 0.08, over the sill at 0.77 and under the canopy at 1.705. */
const SIDE_X = 0.61;
const PILLARS_Z = [-1.3, 0.08] as const;
const SILL_Y = 0.77;
const CANOPY_Y = 1.705;
/** A seated person, from the seat up: the head about 1.2 m over where the figure stands, and a body this wide each side. */
const HEAD_OVER_SEAT = 1.2;
const BODY_REACH = 0.25;
/** The phone's frame, wide over high. */
const PHONE = 390 / 844;

function cameraIn(scene: ReturnType<typeof buildRide>): { at: Vector3; facing: Vector3 } {
  scene.vehicle.updateMatrixWorld(true);
  const at = scene.vehicle.worldToLocal(scene.camera.position.clone());
  const facing = scene.camera.getWorldDirection(new Vector3());
  // The vehicle's body is turned half a circle inside it, so its own frame is the vehicle's turned.
  return { at: new Vector3(-at.x, at.y, -at.z), facing: new Vector3(-facing.x, facing.y, -facing.z) };
}

describe("the keke's window", () => {
  test("[world:ride-cuts-between-angles] given a keke's scene, when its last angle is framed, then the camera sits under the canopy clear of every seated person, looks out of the open side on the road's side between the pillars, and no one stands in front of it", () => {
    const scene = buildRide("keke");
    scene.setPerson("own", new Group());
    scene.setPerson("driver", new Group());
    const last = anglesOf("keke").at(-1);
    if (last === undefined) throw new Error("The keke has no angles.");
    scene.frame((last.from + RIDE_MS) / 2, PHONE);
    const { at, facing } = cameraIn(scene);

    // Inside the cab: over the bench, under the canopy, inside the sides.
    expect(Math.abs(at.x)).toBeLessThan(SIDE_X);
    expect(at.y).toBeLessThan(CANOPY_Y);
    expect(at.z).toBeGreaterThan(PILLARS_Z[0]);
    expect(at.z).toBeLessThan(PILLARS_Z[1]);

    // Nothing through it: every seated person, from the seat to the head, is clear of the camera by more than a body.
    for (const seat of scene.seats) {
      const spot = seat.group.position;
      const across = Math.hypot(at.x - spot.x, at.z - spot.z);
      const within = at.y >= spot.y && at.y <= spot.y + HEAD_OVER_SEAT + BODY_REACH;
      expect({ role: seat.role, clear: !within || across > BODY_REACH + 0.1 }).toEqual({ role: seat.role, clear: true });
      // And no one's head is in the frame in front of it.
      const head = seat.group.getWorldPosition(new Vector3()).add(new Vector3(0, HEAD_OVER_SEAT, 0)).project(scene.camera);
      const seen = head.z < 1 && Math.abs(head.x) < 1 && Math.abs(head.y) < 1;
      expect({ role: seat.role, seen }).toEqual({ role: seat.role, seen: false });
    }

    // Out of the open side on the road's side (the kerb is on -x): the line of sight leaves the cab through the
    // opening, between the pillars, over the sill and under the canopy.
    expect(facing.x).toBeGreaterThan(0.5);
    const out = at.clone().addScaledVector(facing, (SIDE_X - at.x) / facing.x);
    expect(out.z).toBeGreaterThan(PILLARS_Z[0]);
    expect(out.z).toBeLessThan(PILLARS_Z[1]);
    expect(out.y).toBeGreaterThan(SILL_Y);
    expect(out.y).toBeLessThan(CANOPY_Y);
    scene.dispose();
  });
});
