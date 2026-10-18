// A family's own saloon, parked at its spot in the yard: made to read from the raised camera
// of a home, where the car is seen from above and close. The body is a slab with its top edges chamfered and its bonnet
// falling to the nose; the cabin sits narrower on it (the glasshouse leans in), so from above the roof stands apart from
// the bonnet and the boot; the windscreen and the rear glass lie on their slopes in dark glass, so the roof reads between
// two dark bands; the wheels stand a little proud of the body so their tyres show at the four corners; headlamps, grille,
// bumpers, mirrors, plates and tail lamps finish it. No maker's mark or badge (assets:no-real-brands-on-assets). Built along +x like the design's
// vehicles, then turned to face +z. The wheels are round, so they are their own part, shaded smooth (assets:flat-and-smooth-shading).
import { lowBox, type PaletteName, setFootprint } from "@japacity/assets";
import { paletteMaterial, part } from "@japacity/assets/kit";
import { Group, Mesh, type Object3D, Vector3 } from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

import { cbox, facePlusZ, wheel } from "../lab";

type P = readonly [number, number, number];

export interface CarSpec {
  name: string;
  body: PaletteName;
  /** The bumpers' and the trim's colour. */
  trim: PaletteName;
}

export const FAMILY_CAR: CarSpec = { name: "veh_car", body: "blue", trim: "charcoal" };

/** A convex solid through the points given, in one colour. */
function hull(g: Object3D, points: readonly P[], colour: PaletteName): void {
  const geometry = new ConvexGeometry(points.map(([x, y, z]) => new Vector3(x, y, z)));
  g.add(new Mesh(geometry, paletteMaterial(colour)));
}

/**
 * A pane laid on a face of the cabin: the face's four corners drawn in toward their middle by `inset` and the pane
 * standing a few millimetres proud of the face, away from `inside`.
 */
function pane(g: Object3D, corners: readonly [P, P, P, P], inside: P, colour: PaletteName, inset = 0.1): void {
  const c = corners.map(([x, y, z]) => new Vector3(x, y, z));
  const middle = c.reduce((sum, v) => sum.add(v), new Vector3()).multiplyScalar(0.25);
  const [a, b, , d] = c as [Vector3, Vector3, Vector3, Vector3];
  const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(d, a)).normalize();
  if (normal.dot(new Vector3().subVectors(middle, new Vector3(...inside))) < 0) normal.negate();
  const points: P[] = [];
  for (const v of c) {
    const drawn = v.clone().lerp(middle, inset);
    for (const lift of [0.004, 0.014]) {
      const p = drawn.clone().addScaledVector(normal, lift);
      points.push([p.x, p.y, p.z]);
    }
  }
  hull(g, points, colour);
}

export function buildCar(spec: CarSpec = FAMILY_CAR): Group {
  const g = new Group();
  const L = 2.2;
  const W = 0.86;
  // The body: the sill at 0.22, the belt at 0.8 at the boot and 0.74 at the nose, its top edges chamfered.
  hull(
    g,
    [
      [-L, 0.22, -W], [-L, 0.22, W], [L, 0.22, -W], [L, 0.22, W],
      [-L, 0.7, -W], [-L, 0.7, W], [L, 0.62, -W], [L, 0.62, W],
      [-L + 0.06, 0.82, -W + 0.08], [-L + 0.06, 0.82, W - 0.08], [L - 0.08, 0.72, -W + 0.08], [L - 0.08, 0.72, W - 0.08],
      [-0.4, 0.84, -W + 0.05], [-0.4, 0.84, W - 0.05],
    ],
    spec.body,
  );
  // The cabin: narrower at the roof than at the belt, the windscreen raked further than the rear glass.
  const cw = W - 0.08;
  const rw = W - 0.2;
  const base = { front: 0.85, back: -1.3, y: 0.83 };
  const roof = { front: 0.18, back: -0.95, y: 1.42 };
  const cabin: P[] = [
    [base.back, base.y, -cw], [base.back, base.y, cw], [base.front, base.y - 0.04, -cw], [base.front, base.y - 0.04, cw],
    [roof.back, roof.y, -rw], [roof.back, roof.y, rw], [roof.front, roof.y, -rw], [roof.front, roof.y, rw],
  ];
  hull(g, cabin, spec.body);
  const inside: P = [-0.4, 1.0, 0];
  const [b0, b1, b2, b3, t0, t1, t2, t3] = cabin as [P, P, P, P, P, P, P, P];
  // The windscreen and the rear glass on their slopes; each side's two windows parted by the pillar.
  pane(g, [b2, b3, t3, t2], inside, "glass", 0.08);
  pane(g, [b0, b1, t1, t0], inside, "glass", 0.12);
  for (const s of [-1, 1]) {
    const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const lowBack = s < 0 ? b0 : b1;
    const lowFront = s < 0 ? b2 : b3;
    const highBack = s < 0 ? t0 : t1;
    const highFront = s < 0 ? t2 : t3;
    const lowMid = lerp(lowBack, lowFront, 0.5);
    const highMid = lerp(highBack, highFront, 0.45);
    const lift = (p: P): P => [p[0], p[1] + 0.07, p[2]];
    pane(g, [lift(lowMid), lift(lowFront), highFront, highMid], inside, "glass", 0.14);
    pane(g, [lift(lowBack), lift(lowMid), highMid, highBack], inside, "glass", 0.14);
  }
  // The nose: grille, headlamps, the bumper and its plate; the tail: lamps, bumper, plate.
  cbox(g, 0.04, 0.16, 0.9, L + 0.01, 0.6, 0, "black");
  for (const s of [-1, 1]) {
    cbox(g, 0.06, 0.12, 0.34, L, 0.62, s * 0.6, "cream");
    cbox(g, 0.05, 0.12, 0.3, -L - 0.005, 0.7, s * 0.6, "red");
  }
  cbox(g, 0.14, 0.18, 2 * W + 0.04, L + 0.04, 0.42, 0, spec.trim);
  cbox(g, 0.14, 0.18, 2 * W + 0.04, -L - 0.04, 0.44, 0, spec.trim);
  cbox(g, 0.02, 0.12, 0.42, L + 0.115, 0.4, 0, "white");
  cbox(g, 0.02, 0.12, 0.42, -L - 0.115, 0.42, 0, "white");
  // A line down the bonnet, the boot's lid seam, the doors' seams and handles, the mirrors.
  cbox(g, 1.2, 0.012, 0.03, 1.55, 0.74, 0, "black", -0.07);
  cbox(g, 0.03, 0.012, 1.4, -1.55, 0.835, 0, "black");
  for (const s of [-1, 1]) {
    for (const x of [0.75, -0.25, -1.25]) cbox(g, 0.02, 0.44, 0.02, x, 0.74, s * (W + 0.005), "black");
    for (const x of [0.4, -0.6]) cbox(g, 0.14, 0.03, 0.03, x, 0.7, s * (W + 0.01), "black");
    cbox(g, 0.12, 0.1, 0.14, 0.78, 0.98, s * (W + 0.05), spec.trim);
    // The sills and the wheel arches in the dark trim, so the wheels sit in shadow.
    cbox(g, 2 * L - 0.4, 0.08, 0.02, 0, 0.3, s * (W + 0.006), spec.trim);
    for (const x of [1.38, -1.38]) cbox(g, 0.86, 0.12, 0.02, x, 0.76, s * (W + 0.007), spec.trim);
  }
  // The wheels, their tyres a little proud of the body so they show from above at the four corners.
  const wheels = part(g, "wheels");
  wheels.userData.smooth = true;
  for (const x of [1.38, -1.38]) for (const s of [1, -1]) wheel(wheels, 0.33, 0.24, x, 0.33, s * (W - 0.04));
  const root = facePlusZ(g, spec.name);
  return setFootprint(root, [lowBox(root)]);
}
