import { describe, expect, test } from "vitest";

import hubFile from "../../../../public/assets/places/ojuelegba/place.json";
import { AHEAD, BEHIND, cameraAim, EYE, FOV, LOOK_Y, planHeight, SIDE_TALL, SIDE_WIDE, sideOffset } from "./camera";

const PHONE = 360 / 640;
const DESKTOP = 1600 / 1000;

/** Where a point falls across the screen from the camera's aim: -1 the left edge, 0 the middle, 1 the right edge. */
function across(aim: ReturnType<typeof cameraAim>, point: [number, number], aspect: number): number {
  const [px, , pz] = aim.position;
  const [tx, , tz] = aim.target;
  const forward = [tx - px, tz - pz];
  const length = Math.hypot(forward[0] ?? 0, forward[1] ?? 0);
  const [fx, fz] = [(forward[0] ?? 0) / length, (forward[1] ?? 0) / length];
  const [dx, dz] = [point[0] - px, point[1] - pz];
  const depth = dx * fx + dz * fz;
  const right = dx * -fz + dz * fx;
  return right / (depth * Math.tan(((FOV / 2) * Math.PI) / 180) * aspect);
}

describe("the street camera", () => {
  test("given a start facing each way, when the camera is aimed, then it stands behind the character along that facing and looks the same way", () => {
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7]) {
      const aim = cameraAim({ x: 3, z: -4 }, heading, 0, DESKTOP);
      const back = [Math.sin(heading) * -BEHIND, Math.cos(heading) * -BEHIND];
      const right = [-Math.cos(heading) * SIDE_WIDE, Math.sin(heading) * SIDE_WIDE];
      expect(aim.position[0]).toBeCloseTo(3 + (back[0] ?? 0) + (right[0] ?? 0), 6);
      expect(aim.position[2]).toBeCloseTo(-4 + (back[1] ?? 0) + (right[1] ?? 0), 6);
      const look = [aim.target[0] - aim.position[0], aim.target[2] - aim.position[2]];
      expect(Math.atan2(look[0] ?? 0, look[1] ?? 0)).toBeCloseTo(Math.atan2(Math.sin(heading), Math.cos(heading)), 6);
    }
  });

  test("given the hub's start, when the camera is aimed, then it looks the way the start faces, north under the bridge", () => {
    const [x, z, facing] = hubFile.stage.start as [number, number, number];
    const aim = cameraAim({ x, z }, facing, 0, PHONE);
    expect(aim.target[2]).toBeLessThan(aim.position[2] - BEHIND);
  });

  test("given the street view, when its height is read, then the camera is at a person's eyes and looks a little lower, ahead of the character", () => {
    const aim = cameraAim({ x: 0, z: 0 }, Math.PI, 0, PHONE);
    expect(aim.position[1]).toBe(EYE);
    expect(aim.target[1]).toBe(LOOK_Y);
    expect(LOOK_Y).toBeLessThan(1.3);
    expect(aim.target[2]).toBeCloseTo(-AHEAD, 6);
  });

  test("given a phone held upright, when the character is framed, then it stands a quarter of the way in from the left edge, not in the middle; on a desktop it stays near the middle", () => {
    const phone = cameraAim({ x: 0, z: 0 }, Math.PI, 0, PHONE);
    expect(across(phone, [0, 0], PHONE)).toBeCloseTo(-SIDE_TALL, 6);
    expect(sideOffset(PHONE)).toBeGreaterThan(0);
    const desktop = cameraAim({ x: 0, z: 0 }, Math.PI, 0, DESKTOP);
    expect(Math.abs(across(desktop, [0, 0], DESKTOP))).toBeLessThan(0.25);
  });

  test("given the screen held, when the view has risen all the way, then the camera is over the character at the plan height, behind it along the facing", () => {
    const aim = cameraAim({ x: 2, z: 2 }, 0, 1, PHONE);
    expect(aim.position[1]).toBeCloseTo(planHeight(PHONE), 6);
    expect(aim.position[0]).toBeCloseTo(2, 6);
    expect(aim.position[2]).toBeLessThan(2);
    expect(aim.target[1]).toBe(0);
  });
});
