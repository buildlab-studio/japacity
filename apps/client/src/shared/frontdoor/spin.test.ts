// The figure on the plinth (prologue.md R-PROLOGUE-009): it turns slowly by itself, a finger drags it round, and let
// go it settles back into the slow turn.
import { describe, expect, test } from "vitest";

import { SLOW_TURN, type Spin, turnFrame } from "./spin";

const still = (): Spin => ({ dragging: false, pending: 0, last: 0 });

describe("the figure on the plinth", () => {
  test("[R-PROLOGUE-009] given no finger, then the figure turns slowly by itself", () => {
    const turned = turnFrame(still(), 0, SLOW_TURN, 1);
    expect(turned.angle).toBeCloseTo(SLOW_TURN);
    expect(turned.speed).toBe(SLOW_TURN);
  });

  test("[R-PROLOGUE-009] given a finger dragging, then the figure turns by the drag and nothing else, and the drag is used once", () => {
    const spin: Spin = { dragging: true, pending: 1.2, last: 0 };
    const turned = turnFrame(spin, 0.5, SLOW_TURN, 1 / 60);
    expect(turned.angle).toBeCloseTo(1.7);
    expect(spin.pending).toBe(0);
    expect(turnFrame(spin, turned.angle, turned.speed, 1 / 60).angle).toBeCloseTo(1.7);
  });

  test("[R-PROLOGUE-009] given a fast flick let go, then the figure coasts and settles back into the slow turn", () => {
    let state = { angle: 0, speed: 20 };
    for (let frame = 0; frame < 300; frame += 1) state = turnFrame(still(), state.angle, state.speed, 1 / 60);
    expect(state.speed).toBeCloseTo(SLOW_TURN, 2);
  });
});
