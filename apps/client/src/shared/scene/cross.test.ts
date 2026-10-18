import { describe, expect, test } from "vitest";

import { CROSS_WAIT, crossAt } from "./cross";
import { WALK_SPEED } from "./walk";

/** Seven metres at walking pace: five seconds each way, so a whole round is two legs and two waits. */
const FROM: [number, number] = [0, 0];
const TO: [number, number] = [0, 7];
const LEG = 7 / WALK_SPEED;
const ROUND = 2 * (LEG + CROSS_WAIT);

describe("someone crossing at the stop", () => {
  test("[city:one-clock-one-wind] given the clock at zero, when a crosser is read, then they stand at their spot about to walk out, facing the far side", () => {
    const pace = crossAt(FROM, TO, 0, WALK_SPEED);
    expect(pace).toMatchObject({ x: 0, z: 0, walking: true, stride: 0 });
    expect(pace.facing).toBeCloseTo(0, 6);
  });

  test("[city:one-clock-one-wind] given the clock halfway along the first leg, when a crosser is read, then they are halfway across at walking pace, mid stride", () => {
    const pace = crossAt(FROM, TO, LEG / 2, WALK_SPEED);
    expect(pace.z).toBeCloseTo(3.5, 6);
    expect(pace.walking).toBe(true);
    expect(pace.stride).toBeGreaterThanOrEqual(0);
    expect(pace.stride).toBeLessThan(1);
  });

  test("[city:one-clock-one-wind] given the clock at the end of the first leg and through the wait, when a crosser is read, then they stand still on the far side facing back", () => {
    for (const time of [LEG, LEG + CROSS_WAIT / 2, LEG + CROSS_WAIT - 0.01]) {
      const pace = crossAt(FROM, TO, time, WALK_SPEED);
      expect(pace).toMatchObject({ x: 0, z: 7, walking: false, stride: 0 });
      expect(Math.abs(pace.facing)).toBeCloseTo(Math.PI, 6);
    }
    expect(crossAt(FROM, TO, LEG - 0.01, WALK_SPEED).walking).toBe(true);
  });

  test("[city:one-clock-one-wind] given the clock on the way back, when a crosser is read, then they walk home facing their spot, and wait there at the end of the round", () => {
    const back = crossAt(FROM, TO, LEG + CROSS_WAIT + LEG / 2, WALK_SPEED);
    expect(back.z).toBeCloseTo(3.5, 6);
    expect(back.walking).toBe(true);
    expect(Math.abs(back.facing)).toBeCloseTo(Math.PI, 6);
    const home = crossAt(FROM, TO, 2 * LEG + CROSS_WAIT + CROSS_WAIT / 2, WALK_SPEED);
    expect(home).toMatchObject({ x: 0, z: 0, walking: false });
    expect(home.facing).toBeCloseTo(0, 6);
  });

  test("[city:no-script-loop-per-sheet] given a phase, when two crossers on one path are read at one clock, then each is the other shifted along the round, so no two cross together", () => {
    const late = crossAt(FROM, TO, 1, WALK_SPEED, 2);
    const early = crossAt(FROM, TO, 3, WALK_SPEED);
    expect(late).toEqual(early);
    expect(crossAt(FROM, TO, 1, WALK_SPEED, 2)).not.toEqual(crossAt(FROM, TO, 1, WALK_SPEED));
  });

  test("[city:no-script-loop-per-sheet] given clocks across many rounds and phases, when a crosser is read, then they are always on the line between the two sides, and the same a whole round later", () => {
    for (let step = -400; step <= 400; step += 1) {
      const time = step * 0.37;
      const phase = (step * 7) % 23;
      const pace = crossAt(FROM, TO, time, WALK_SPEED, phase);
      expect(pace.x).toBeCloseTo(0, 6);
      expect(pace.z).toBeGreaterThanOrEqual(-1e-9);
      expect(pace.z).toBeLessThanOrEqual(7 + 1e-9);
      expect(crossAt(FROM, TO, time + ROUND, WALK_SPEED, phase).z).toBeCloseTo(pace.z, 3);
    }
  });
});
