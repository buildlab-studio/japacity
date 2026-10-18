import { Bone, Group } from "three";
import { describe, expect, test } from "vitest";

import { DANCE_SECONDS, danceFigure, danceShare } from "./dance";
import type { Figure } from "./people";

const BONES = ["hips", "spine", "chest", "neck", "head", "upperArmL", "forearmL", "handL", "upperArmR", "forearmR", "handR", "upperLegL", "lowerLegL", "footL", "upperLegR", "lowerLegR", "footR"];

function figure(phase = 0): Figure {
  const bones = new Map(BONES.map((name): [string, Bone] => [name, Object.assign(new Bone(), { name })]));
  bones.get("hips")?.position.set(0, 0.95, 0);
  return { root: new Group(), bones, hipsY: 0.95, rest: new Map(BONES.map((name): [string, [number, number, number]] => [name, [0, 0, 0]])), phase, pose: "stand" };
}

const turnsOf = (body: Figure): number[] => [...body.bones.values()].flatMap((bone) => [bone.rotation.x, bone.rotation.y, bone.rotation.z, bone.position.x, bone.position.y]);

describe("the party's dance loops", () => {
  test("[city:party-room-sets-the-bar] given a dancer on either loop, when the shared clock runs through the loop, then it starts at zero, wraps at the loop's length and never runs backward past zero", () => {
    for (const dance of ["twoStep", "shuffle"] as const) {
      const seconds = DANCE_SECONDS[dance];
      expect(danceShare(dance, 0, 0)).toBe(0);
      expect(danceShare(dance, seconds, 0)).toBeCloseTo(0, 9);
      expect(danceShare(dance, seconds / 2, 0)).toBeCloseTo(0.5, 9);
      expect(danceShare(dance, -seconds / 4, 0)).toBeCloseTo(0.75, 9);
      expect(danceShare(dance, 0, seconds * 2.25)).toBeCloseTo(0.25, 9);
    }
  });

  test("[city:party-room-sets-the-bar] given a body posed on a loop, when the clock moves a quarter of the loop, then the legs, arms and hips have moved, the hips stay within a hand of standing height, and a full loop later it is posed the same", () => {
    for (const dance of ["twoStep", "shuffle"] as const) {
      const body = figure(0.3);
      danceFigure(body, 0, dance);
      const start = turnsOf(body);
      const hipsY = body.bones.get("hips")?.position.y ?? 0;
      expect(Math.abs(hipsY - body.hipsY)).toBeLessThan(0.1);
      danceFigure(body, DANCE_SECONDS[dance] / 4, dance);
      expect(turnsOf(body)).not.toEqual(start);
      danceFigure(body, DANCE_SECONDS[dance], dance);
      turnsOf(body).forEach((value, index) => expect(value).toBeCloseTo(start[index] ?? 0, 6));
    }
  });

  test("[city:party-room-sets-the-bar] given two dancers on the same loop with different phases, when they are posed at the same moment, then they are not in step", () => {
    const one = figure(0);
    const two = figure(0.5);
    danceFigure(one, 1, "twoStep");
    danceFigure(two, 1, "twoStep");
    expect(turnsOf(one)).not.toEqual(turnsOf(two));
  });
});
