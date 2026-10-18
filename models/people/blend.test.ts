import { describe, expect, test } from "vitest";

import { field, project, type Shape, signedVolume, surface, type Surface } from "./blend";
import { thin } from "./thin";

// Nine balls, blended as the afro is.
const BALLS = [[0, 0.004, 0, 0.124], [-0.028, 0.012, 0, 0.084], [0.028, 0.012, 0, 0.084], [0, 0.036, -0.004, 0.092], [-0.016, 0.026, -0.024, 0.068], [0.016, 0.026, -0.024, 0.068], [0, 0.016, 0.026, 0.08], [-0.02, -0.008, 0.012, 0.06], [0.02, -0.008, 0.012, 0.06]];
const shapes: Shape[] = BALLS.map(([x = 0, y = 0, z = 0, r = 0]) => ({ kind: "ball", c: [x, y, z], r }));

/** Every edge shared by exactly two triangles, and a sphere's Euler number: a closed surface with no holes or handles. */
function closed(s: Surface): boolean {
  const edges = new Map<string, number>();
  for (const [a, b, c] of s.triangles) {
    for (const [x, y] of [[a, b], [b, c], [c, a]] as const) {
      const key = `${String(Math.min(x, y))},${String(Math.max(x, y))}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  return [...edges.values()].every((count) => count === 2) && s.positions.length - edges.size + s.triangles.length === 2;
}

describe("soft shapes", () => {
  test("[assets:flat-and-smooth-shading] given nine blended balls, when turned into triangles, then the surface is closed, faces outward, lies within a cell of the blend and projects onto it", () => {
    const blend = { shapes, k: 0.02 };
    const raw = surface(blend, 0.004);
    expect(closed(raw)).toBe(true);
    expect(signedVolume(raw)).toBeGreaterThan(0);
    expect(Math.max(...raw.positions.map((p) => Math.abs(field(blend, p))))).toBeLessThanOrEqual(0.004);
    expect(Math.max(...project(blend, raw, 0.004).positions.map((p) => Math.abs(field(blend, p))))).toBeLessThanOrEqual(0.0005);
  });

  test("[assets:flat-and-smooth-shading] given the blended balls, when thinned to 600 triangles, then at most 600 remain, the surface stays closed and keeps its volume within 3%", () => {
    const raw = surface({ shapes, k: 0.02 }, 0.004);
    expect(raw.triangles.length).toBeGreaterThan(600);
    const thinned = thin(raw, 600);
    expect(thinned.triangles.length).toBeLessThanOrEqual(600);
    expect(thinned.triangles.length).toBeGreaterThan(580);
    expect(closed(thinned)).toBe(true);
    expect(Math.abs(signedVolume(thinned) / signedVolume(raw) - 1)).toBeLessThanOrEqual(0.03);
  });

  test("[assets:flat-and-smooth-shading] given the same blend twice, when built and thinned, then the triangles are the same", () => {
    const once = thin(surface({ shapes, k: 0.02 }, 0.005), 400);
    const again = thin(surface({ shapes, k: 0.02 }, 0.005), 400);
    expect(again).toEqual(once);
  });

  test("[assets:flat-and-smooth-shading] given a blend with a ball cut from it and the edge melted, when turned into triangles, then no vertex lies inside the cut", () => {
    const cut: Shape = { kind: "ball", c: [0, 0, 0.13], r: 0.05 };
    const blend = { shapes, k: 0.02, cut: [cut], cutK: 0.01 };
    const raw = surface(blend, 0.004);
    expect(closed(raw)).toBe(true);
    expect(project(blend, raw, 0.004).positions.every((p) => Math.hypot(p[0], p[1], p[2] - 0.13) >= 0.05 - 0.0005)).toBe(true);
  });
});
