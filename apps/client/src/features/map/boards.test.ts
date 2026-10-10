// The map's boards never cover one another (docs/rules/world.md R-WORLD-015).
import { describe, expect, test } from "vitest";

import { type BoardBox, boardsShown } from "./boards";

const box = (left: number, top: number, extra: Partial<BoardBox> = {}): BoardBox => ({ left, top, right: left + 110, bottom: top + 26, state: "can", home: false, picked: false, ...extra });

describe("the boards on the map", () => {
  test("[R-WORLD-015] given three boards over each other and one apart, when the map lays them out, then no two shown cover each other and the one apart shows", () => {
    const boxes = [box(0, 290), box(70, 312), box(45, 330), box(280, 340)];
    const shown = boardsShown(boxes);
    const kept = boxes.filter((_, index) => shown[index]);
    for (const [i, a] of kept.entries()) for (const b of kept.slice(i + 1)) expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).toBe(false);
    expect(shown[3]).toBe(true);
  });

  test("[R-WORLD-015] given a board where the player stands, home, the stop picked and a stop been to all over one another, when the map lays them out, then where the player stands always shows and home shows when clear of it; the stop picked comes before one only been to", () => {
    expect(boardsShown([box(0, 300, { state: "been" }), box(10, 305, { state: "here" })])).toEqual([false, true]);
    expect(boardsShown([box(0, 300, { state: "been" }), box(10, 305, { picked: true })])).toEqual([false, true]);
    expect(boardsShown([box(0, 300, { state: "can" }), box(10, 305, { state: "home", home: true }), box(300, 300, { state: "here" })])).toEqual([false, true, true]);
  });

  test("[R-WORLD-015] given boards apart, when the map lays them out, then all show", () => {
    expect(boardsShown([box(0, 0), box(0, 40), box(200, 0)])).toEqual([true, true, true]);
  });
});
