// The National Stadium, Surulere (city.md place.national-stadium), built only to its outline and
// the review sheet (city:landmarks-built-to-outline): the footprint is the OpenStreetMap way, the heights are
// the review's measurements. An oval bowl of two continuous raked tiers in maroon seats,
// one long side's upper tier blue, an open concrete frame on columns, the main stand's light
// roof on the west long side, four floodlight masts outside the bowl, eight radial ramps down
// to round landings. In 2026 the bowl is decayed and unused (city.md), so seats are missing in
// patches, roof sheets are gone and the concrete is stained.
import { type FootprintBox, HEAD_HEIGHT, type PaletteName, setFootprint } from "@japacity/model-kit";
import { beam, box, cylinder, floorQuad, paletteMaterial, part, seeded, solid, type Vec3 } from "@japacity/model-kit/kit";
import { Group, Mesh, type Object3D, Shape, ShapeGeometry, Vector2 } from "three";

/** Heights in metres, from the examples' review (estimates from photographs, the 400 m track as ruler). */
export const STADIUM = {
  segments: 64,
  lowerTier: { from: 0.62, to: 0.74, low: 1.0, high: 9.5 },
  upperTier: { from: 0.755, to: 0.975, low: 10.5, high: 22.0 },
  rim: 23.0,
  concourse: 9.5,
  columns: 48,
  masts: { x: 67, z: 108, height: 44.5, head: [7, 9] as const },
  ramps: { count: 8, length: 35, landing: 6, width: 5 },
  roof: { halfLength: 70, inner: 0.68, height: 23.0 },
} as const;

/** The footprint's radius from the centre at angle a in the model's x-z plane, read off the outline polygon. */
function radiusAt(footprint: readonly (readonly [number, number])[], a: number): number {
  const dx = Math.cos(a);
  const dz = Math.sin(a);
  let best = 0;
  for (let i = 0; i < footprint.length; i++) {
    const p = footprint[i] ?? [0, 0];
    const q = footprint[(i + 1) % footprint.length] ?? [0, 0];
    const ex = q[0] - p[0];
    const ez = q[1] - p[1];
    const det = dx * -ez - dz * -ex;
    if (Math.abs(det) < 1e-9) continue;
    const t = (p[0] * -ez - p[1] * -ex) / det;
    const u = (dx * p[1] - dz * p[0]) / det;
    if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t);
  }
  return best;
}

export type Facing = "up" | "down" | "outward" | "inward";

/**
 * Quads between two closed rings of points, one solid per colour so every face keeps one palette
 * colour, each wound to face the way it is seen from (a raked tier faces up, the frame outward).
 */
function ringStrip(g: Object3D, inner: readonly Vec3[], outer: readonly Vec3[], facing: Facing, colourOf: (i: number) => PaletteName): void {
  const byColour = new Map<PaletteName, { corners: Vec3[]; faces: number[][] }>();
  const n = inner.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const colour = colourOf(i);
    let entry = byColour.get(colour);
    if (entry === undefined) {
      entry = { corners: [], faces: [] };
      byColour.set(colour, entry);
    }
    const a = inner[i] ?? [0, 0, 0];
    const b = inner[j] ?? [0, 0, 0];
    const c = outer[j] ?? [0, 0, 0];
    const d = outer[i] ?? [0, 0, 0];
    // The face's normal from its corners, against the way it should face.
    const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const v = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
    const normal = [(u[1] ?? 0) * (v[2] ?? 0) - (u[2] ?? 0) * (v[1] ?? 0), (u[2] ?? 0) * (v[0] ?? 0) - (u[0] ?? 0) * (v[2] ?? 0), (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0)];
    const mx = (a[0] + b[0] + c[0] + d[0]) / 4;
    const mz = (a[2] + b[2] + c[2] + d[2]) / 4;
    const want = facing === "up" ? [0, 1, 0] : facing === "down" ? [0, -1, 0] : facing === "outward" ? [mx, 0, mz] : [-mx, 0, -mz];
    const dot = (normal[0] ?? 0) * (want[0] ?? 0) + (normal[1] ?? 0) * (want[1] ?? 0) + (normal[2] ?? 0) * (want[2] ?? 0);
    const base = entry.corners.length;
    entry.corners.push(a, b, c, d);
    entry.faces.push(dot >= 0 ? [base, base + 1, base + 2, base + 3] : [base, base + 3, base + 2, base + 1]);
  }
  for (const [colour, { corners, faces }] of byColour) solid(g, corners, faces, colour);
}

/** A flat polygon at height y, face up. */
function flat(g: Object3D, points: readonly (readonly [number, number])[], y: number, colour: PaletteName): void {
  const shape = new Shape(points.map(([x, z]) => new Vector2(x, -z)));
  const geometry = new ShapeGeometry(shape, 1);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, paletteMaterial(colour));
  mesh.position.y = y;
  g.add(mesh);
}

/**
 * Builds the stadium from its footprint: points [x, z] in metres in the model's frame, the long
 * axis along z with north toward -z, the main stand on the west (negative x) long side.
 */
export function buildStadium(footprint: readonly (readonly [number, number])[]): Group {
  const g = new Group();
  g.name = "landmark_national-stadium";
  const random = seeded(1973);
  const n = STADIUM.segments;
  const angles = Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2);
  const radius = angles.map((a) => radiusAt(footprint, a));
  const at = (i: number, s: number, y: number): Vec3 => {
    const a = angles[i] ?? 0;
    const r = (radius[i] ?? 0) * s;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  const ring = (s: number, y: number): Vec3[] => angles.map((_, i) => at(i, s, y));
  const east = (i: number): boolean => Math.cos(angles[i] ?? 0) > 0.55;
  // Missing seats and stained concrete: the decay a 2026 viewer knows the bowl by.
  const decayed = angles.map(() => random() < 0.22);

  // The ground of the bowl and the concourse round it.
  const { lowerTier: lower, upperTier: upper } = STADIUM;
  ringStrip(g, ring(lower.from, 0.6), ring(1.02, 0.02), "up", () => "concrete");
  flat(g, angles.map((_, i) => { const p = at(i, lower.from, 0); return [p[0], p[2]] as const; }), 0.6, "concreteWorn");
  // The 400 m track with its straights and the pitch inside it.
  const track: [number, number][] = [];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI + (k / 16) * Math.PI;
    track.push([Math.cos(a) * 46, -44.5 + Math.sin(a) * 46]);
  }
  for (let k = 0; k <= 16; k++) {
    const a = (k / 16) * Math.PI;
    track.push([Math.cos(a) * 46, 44.5 + Math.sin(a) * 46]);
  }
  flat(g, track, 0.64, "laterite");
  floorQuad(g, 68, 105, 0, 0.68, 0, "green");
  for (let k = 0; k < 5; k++) floorQuad(g, 6 + random() * 10, 6 + random() * 12, (random() - 0.5) * 50, 0.7, (random() - 0.5) * 80, "pepper");

  // The ground the bowl blocks (assets:models-record-their-footprint): its closed wall and open frame as a ring of turned boxes, then the ramps and masts below.
  const blocks: FootprintBox[] = angles.map((_, i) => {
    const [ax, , az] = at(i, 0.982, 0);
    const [bx, , bz] = at((i + 1) % n, 0.982, 0);
    return { x: (ax + bx) / 2, z: (az + bz) / 2, width: Math.hypot(bx - ax, bz - az) + 1.0, depth: (radius[i] ?? 0) * 0.035 + 1.3, turn: Math.atan2(-(bz - az), bx - ax) };
  });

  // Two continuous raked tiers with a concrete balcony fascia between them.
  ringStrip(g, ring(lower.from, lower.low), ring(lower.to, lower.high), "up", (i) => (decayed[i] === true ? "concreteWorn" : "seat"));
  ringStrip(g, ring(lower.to, lower.high), ring(lower.to, upper.low), "inward", () => "concrete");
  ringStrip(g, ring(lower.to, upper.low), ring(upper.from, upper.low), "up", () => "concrete");
  ringStrip(g, ring(upper.from, upper.low), ring(upper.to, upper.high), "up", (i) => (decayed[(i + 7) % n] === true ? "concreteWorn" : east(i) ? "blue" : "seat"));
  // The rooms under the stands: a closed wall from the ground to the concourse behind the frame, with dark doorways.
  ringStrip(g, ring(0.965, 0), ring(0.965, STADIUM.concourse), "outward", (i) => (i % 4 === 1 ? "canvas" : "concreteWorn"));
  // The upper tier's underside, seen between the columns: the open frame.
  ringStrip(g, ring(upper.to, upper.high), ring(0.8, STADIUM.concourse), "down", () => "concreteWorn");
  // The rim beam and the concourse beam on the outer frame.
  ringStrip(g, ring(upper.to, upper.high), ring(1.0, STADIUM.rim), "up", () => "concrete");
  ringStrip(g, ring(1.0, STADIUM.rim), ring(1.0, STADIUM.rim - 1.6), "outward", (i) => (i % 9 === 3 ? "concreteWorn" : "concrete"));
  ringStrip(g, ring(1.0, STADIUM.concourse + 0.8), ring(1.0, STADIUM.concourse - 0.4), "outward", () => "concrete");

  // Columns of the open frame, stained at the foot.
  for (let k = 0; k < STADIUM.columns; k++) {
    const i = Math.round((k / STADIUM.columns) * n) % n;
    const [x, , z] = at(i, 0.992, 0);
    box(g, 1.3, STADIUM.rim - 1.6, 1.3, x, 0, z, k % 5 === 2 ? "concreteWorn" : "concrete", -(angles[i] ?? 0));
  }

  // The main stand's roof on the west long side: a light frame of trusses, tilted up toward the pitch, sheets missing.
  const roof = new Group();
  g.add(roof);
  const xOuter = -radiusAt(footprint, Math.PI) * 0.99;
  const xInner = xOuter * STADIUM.roof.inner;
  const { halfLength, height } = STADIUM.roof;
  for (let z = -halfLength; z <= halfLength; z += 14) beam(roof, [xOuter, STADIUM.rim, z], [xInner, height + 2.2, z], 0.8, "concrete");
  beam(roof, [xInner, height + 2.2, -halfLength], [xInner, height + 2.2, halfLength], 1.0, "concrete");
  const pitch = Math.atan2(height + 2.2 - STADIUM.rim, xInner - xOuter);
  for (let z = -halfLength; z < halfLength; z += 10) {
    if (random() < 0.25) continue;
    const sheet = new Group();
    sheet.position.set(xOuter, STADIUM.rim + 0.5, z + 5);
    sheet.rotation.z = pitch;
    roof.add(sheet);
    box(sheet, Math.hypot(xInner - xOuter, height + 2.2 - STADIUM.rim), 0.2, 9.6, Math.hypot(xInner - xOuter, height + 2.2 - STADIUM.rim) / 2, 0, 0, random() < 0.3 ? "zincRust" : "zinc");
  }

  // Four floodlight masts outside the bowl, upright, with portrait lamp heads turned to the pitch.
  const [headW, headH] = STADIUM.masts.head;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x = sx * STADIUM.masts.x;
    const z = sz * STADIUM.masts.z;
    cylinder(g, 1.2, STADIUM.masts.height, x, 0, z, "concreteWorn", 8, 0.6);
    const head = new Group();
    head.position.set(x, STADIUM.masts.height - 1, z);
    head.rotation.y = Math.atan2(-x, -z);
    head.rotation.x = -0.25;
    g.add(head);
    box(head, headW, headH, 1.0, 0, -headH / 2, 0, "concrete");
    box(head, headW - 0.8, headH - 0.8, 0.1, 0, -headH / 2 + 0.4, 0.5, "white");
  }

  // The scoreboard at the north end, inside the bowl.
  box(g, 16, 7, 1.5, 0, 14, -(radiusAt(footprint, -Math.PI / 2) * 0.86), "black");

  // Eight straight ramps running out from the frame to round landings, a separate node so the
  // outline views can leave them out: the footprint way does not include them.
  const ramps = part(g, "ramps");
  const { count, length, landing, width } = STADIUM.ramps;
  for (let k = 0; k < count; k++) {
    const a = Math.PI / 8 + (k * Math.PI * 2) / count;
    const r0 = radiusAt(footprint, a);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const top: Vec3 = [c * r0, STADIUM.concourse, s * r0];
    const foot: Vec3 = [c * (r0 + length), 0.6, s * (r0 + length)];
    const slab = new Group();
    slab.position.set((top[0] + foot[0]) / 2, (top[1] + foot[1]) / 2, (top[2] + foot[2]) / 2);
    slab.rotation.y = -a;
    slab.rotation.z = -Math.atan2(top[1] - foot[1], length);
    ramps.add(slab);
    box(slab, Math.hypot(length, top[1] - foot[1]) + 1, 0.7, width, 0, -0.35, 0, "concrete");
    for (const t of [0.3, 0.65]) {
      const y = top[1] + (foot[1] - top[1]) * t;
      box(ramps, 0.9, y - 0.7, 0.9, c * (r0 + length * t), 0, s * (r0 + length * t), "concreteWorn");
    }
    cylinder(ramps, landing, 0.6, c * (r0 + length + landing - 1), 0, s * (r0 + length + landing - 1), "concrete", 12);
    // The ramp's foot, from where its underside comes down below head height, its two piers and its landing.
    const low = 1 - (HEAD_HEIGHT + 0.7 - 0.6) / (STADIUM.concourse - 0.6);
    const from = r0 + length * low;
    const to = r0 + length;
    blocks.push({ x: c * ((from + to) / 2), z: s * ((from + to) / 2), width: to - from + 0.5, depth: width, turn: -a });
    for (const t of [0.3, 0.65]) blocks.push({ x: c * (r0 + length * t), z: s * (r0 + length * t), width: 0.9, depth: 0.9 });
    blocks.push({ x: c * (r0 + length + landing - 1), z: s * (r0 + length + landing - 1), width: landing * 2, depth: landing * 2, turn: -a });
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) blocks.push({ x: sx * STADIUM.masts.x, z: sz * STADIUM.masts.z, width: 2.4, depth: 2.4 });
  return setFootprint(g, blocks);
}
