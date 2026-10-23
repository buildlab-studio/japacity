// The figure on the plinth (prologue:front-door-builds-a-person): it turns slowly by itself, a finger drags it round, and let
// go it settles back into the slow turn.
import { describe, expect, test } from "vitest";

import { SLOW_TURN, type Spin, turnFrame } from "./spin";

const still = (): Spin => ({ dragging: false, pending: 0, last: 0 });

describe("the figure on the plinth", () => {
  test("[prologue:front-door-builds-a-person] given no finger, then the figure turns slowly by itself", () => {
    const turned = turnFrame(still(), 0, SLOW_TURN, 1);
    expect(turned.angle).toBeCloseTo(SLOW_TURN);
    expect(turned.speed).toBe(SLOW_TURN);
  });

  test("[prologue:front-door-builds-a-person] given a finger dragging, then the figure turns by the drag and nothing else, and the drag is used once", () => {
    const spin: Spin = { dragging: true, pending: 1.2, last: 0 };
    const turned = turnFrame(spin, 0.5, SLOW_TURN, 1 / 60);
    expect(turned.angle).toBeCloseTo(1.7);
    expect(spin.pending).toBe(0);
    expect(turnFrame(spin, turned.angle, turned.speed, 1 / 60).angle).toBeCloseTo(1.7);
  });

  test("[prologue:front-door-builds-a-person] given a fast flick let go, then the figure coasts and settles back into the slow turn", () => {
    let state = { angle: 0, speed: 20 };
    for (let frame = 0; frame < 300; frame += 1) state = turnFrame(still(), state.angle, state.speed, 1 / 60);
    expect(state.speed).toBeCloseTo(SLOW_TURN, 2);
  });
});

describe("the figure under Reduce Motion (world:reach-and-read)", () => {
  test("[world:reach-and-read] given Reduce Motion and no finger, then the figure stands still: nothing turns on its own", () => {
    expect(turnFrame(still(), 0.3, SLOW_TURN, 1, true)).toEqual({ angle: 0.3, speed: 0 });
  });

  test("[world:reach-and-read] given Reduce Motion and a flick let go, then the figure stops where it was let go rather than coasting", () => {
    expect(turnFrame(still(), 1.1, 20, 1 / 60, true)).toEqual({ angle: 1.1, speed: 0 });
  });

  test("[world:reach-and-read] given Reduce Motion and a finger dragging, then the figure still turns by the drag", () => {
    const spin: Spin = { dragging: true, pending: 0.4, last: 0 };
    expect(turnFrame(spin, 0.5, 0, 1 / 60, true).angle).toBeCloseTo(0.9);
  });
});

