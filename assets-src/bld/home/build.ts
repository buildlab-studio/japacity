// The shell of a home seen as one view (the home redesign): the walls of the house or the room and of the yard
// beyond it, cut open toward the camera as the rooms are (docs/rules/world.md R-WORLD-011). The walls the camera looks
// past are cut low, so the yard and its life show over them; the far side walls stand full height and carry the
// home's wall things: the calendar, the family photo, the clock, the switch and its wire run on the surface, posters, a
// shelf. Openings are real: a door frame with its leaf swung open, an arch, a window with louvres, a gateway with its
// gate. Every home is a set of numbers in HOMES given to this one builder (R-ASSET-014). One material, one draw call.
import { type FootprintBox, type PaletteName, setFootprint } from "@japacity/assets";
import { beam, box, cylinder, extrude, quad } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

/** A hole in a wall, `at` metres along it from its middle. */
export interface Opening {
  kind: "door" | "arch" | "window" | "gap" | "gate";
  at: number;
  width: number;
  /** The opening's top; a window's sill stands at `sill`. */
  height: number;
  sill?: number;
  /** A door's leaf, swung this many degrees open into the wall's inner side (negative: out); none when absent. */
  swing?: number;
  /** The door leaf's or the gate's colour. */
  colour?: PaletteName;
}

/** Something fixed flat on a wall's inner face, `at` metres along it from its middle, `y` its bottom. */
export interface Fitting {
  kind: "calendar" | "photo" | "clock" | "switch" | "posters" | "shelf" | "mirror" | "notice" | "louvre" | "number";
  at: number;
  y?: number;
  colour?: PaletteName;
}

/**
 * A wall from `from` to `to` on the floor (x, z), its inner face on the right of the walk from `from` to `to` as seen from
 * above with -z up the page; `height` its top, cut low where the camera looks over it.
 */
export interface WallSpec {
  from: readonly [number, number];
  to: readonly [number, number];
  height: number;
  upper: PaletteName;
  lower: PaletteName;
  dado: number;
  /** The colour of the wall's outer face's lower band, the wear where rain splashes; none when absent. */
  outer?: PaletteName;
  openings?: readonly Opening[];
  fittings?: readonly Fitting[];
}

/** A post or a pillar: x, z, width, depth, height, colour. */
export type Post = readonly [number, number, number, number, number, PaletteName];

export interface HomeSpec {
  name: string;
  walls: readonly WallSpec[];
  posts?: readonly Post[];
  /** Wires on the surface and across the yard: from, to and sag. */
  wires?: readonly (readonly [readonly [number, number, number], readonly [number, number, number], number])[];
  /** A curtain on its rod across a corner: from and to on the floor, its drop, its colour, the share of the rod it covers. */
  curtain?: { from: readonly [number, number]; to: readonly [number, number]; top: number; colour: PaletteName; drawn: number };
  /** The wall cap's colour, a shade darker, so the cut tops read as walls from above. */
  cap: PaletteName;
}

const T = 0.15;

/** A wall's own frame: along x from its middle, the inner face toward +z. */
function wallFrame(g: Object3D, spec: WallSpec): { frame: Group; length: number } {
  const [x0, z0] = spec.from;
  const [x1, z1] = spec.to;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const frame = new Group();
  frame.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  frame.rotation.y = Math.atan2(-dz, dx);
  g.add(frame);
  return { frame, length: Math.hypot(dx, dz) };
}

/** The spans of the wall between its openings, as [from, to] along it. */
function solidSpans(length: number, openings: readonly Opening[]): [number, number][] {
  const sorted = [...openings].sort((a, b) => a.at - b.at);
  const spans: [number, number][] = [];
  let start = -length / 2;
  for (const opening of sorted) {
    const left = opening.at - opening.width / 2;
    if (left > start + 0.01) spans.push([start, left]);
    start = opening.at + opening.width / 2;
  }
  if (length / 2 > start + 0.01) spans.push([start, length / 2]);
  return spans;
}

/** The trim round a door or a window, a little proud of both faces. */
function trim(w: Object3D, x: number, width: number, bottom: number, top: number, colour: PaletteName): void {
  for (const s of [-1, 1]) box(w, 0.07, top - bottom, T + 0.04, x + s * (width / 2 + 0.035), bottom, 0, colour);
  box(w, width + 0.14, 0.07, T + 0.04, x, top, 0, colour);
}

function opening(w: Object3D, spec: WallSpec, hole: Opening): void {
  const { at: x, width, height } = hole;
  const lintel = spec.height - height;
  switch (hole.kind) {
    case "door": {
      if (lintel > 0.02) box(w, width, lintel, T, x, height, 0, spec.upper);
      // The frame always stands full height, so a door in a wall cut low still reads as a door.
      trim(w, x, width, 0, Math.max(height, 2.1), "white");
      if (hole.swing !== undefined) {
        const hinge = new Group();
        hinge.position.set(x - width / 2 + 0.03, 0, hole.swing > 0 ? T / 2 : -T / 2);
        hinge.rotation.y = (hole.swing * Math.PI) / 180;
        w.add(hinge);
        box(hinge, width - 0.04, 2.06, 0.045, (width - 0.04) / 2, 0.02, hole.swing > 0 ? 0.03 : -0.03, hole.colour ?? "darkWood");
        quad(hinge, width * 0.62, 0.8, width / 2, 1.1, hole.swing > 0 ? 0.054 : -0.054, "wood", hole.swing > 0 ? 0 : Math.PI);
        box(hinge, 0.12, 0.04, 0.1, width - 0.16, 1.0, 0, "hub");
      }
      return;
    }
    case "arch": {
      // The wall over the arch, its underside a round head: a profile pushed through the wall.
      const spring = height - width / 2;
      const top = spec.height;
      const points: [number, number][] = [[-width / 2, top], [-width / 2, spring]];
      const steps = 8;
      for (let i = 1; i < steps; i++) {
        const a = Math.PI - (i * Math.PI) / steps;
        points.push([Math.cos(a) * (width / 2), spring + Math.sin(a) * (width / 2)]);
      }
      points.push([width / 2, spring], [width / 2, top]);
      extrude(w, points.map(([a, b]): [number, number] => [a, b]), T, spec.upper, x, 0, 0);
      for (const s of [-1, 1]) box(w, 0.06, spring, T + 0.04, x + s * (width / 2 - 0.03), 0, 0, "white");
      return;
    }
    case "window": {
      const sill = hole.sill ?? 0.9;
      box(w, width, sill, T, x, 0, 0, spec.upper);
      if (lintel > 0.02) box(w, width, lintel, T, x, height, 0, spec.upper);
      trim(w, x, width, sill, height, "white");
      box(w, width + 0.2, 0.05, T + 0.12, x, sill - 0.05, 0, "concrete");
      // The louvres: glass blades tilted open, a slim mullion down the middle.
      const blades = Math.max(3, Math.round((height - sill) / 0.22));
      for (let i = 0; i < blades; i++) {
        const blade = new Group();
        blade.position.set(x, sill + 0.12 + (i * (height - sill - 0.18)) / Math.max(1, blades - 1), 0);
        blade.rotation.x = -0.6;
        w.add(blade);
        box(blade, width - 0.04, 0.012, 0.11, 0, 0, 0, "wallSky");
      }
      box(w, 0.04, height - sill, 0.05, x, sill, 0, "white");
      return;
    }
    case "gap":
      if (lintel > 0.02) box(w, width, lintel, T, x, height, 0, spec.upper);
      return;
    case "gate": {
      for (const s of [-1, 1]) box(w, 0.32, height + 0.25, 0.32, x + s * (width / 2 + 0.16), 0, 0, "concrete");
      // Two sheet-steel leaves, the left shut, the right swung half open into the yard, a black band across each.
      const leaf = width / 2;
      box(w, leaf, height - 0.06, 0.05, x - leaf / 2, 0.05, 0, hole.colour ?? "charcoal");
      quad(w, leaf - 0.1, 0.06, x - leaf / 2, height - 0.5, 0.03, "black");
      quad(w, 0.06, height - 0.4, x - leaf + 0.2, 0.2, 0.03, "black");
      const swung = new Group();
      swung.position.set(x + leaf, 0, 0);
      swung.rotation.y = -0.45;
      w.add(swung);
      box(swung, leaf, height - 0.06, 0.05, -leaf / 2, 0.05, 0, hole.colour ?? "charcoal");
      quad(swung, leaf - 0.1, 0.06, -leaf / 2, height - 0.5, 0.03, "black");
      return;
    }
    default: {
      const never: never = hole.kind;
      throw new Error(`No opening ${String(never)}`);
    }
  }
}

/** A frame on the wall's inner face with its edge and its picture. */
function framed(w: Object3D, x: number, y: number, width: number, height: number, edge: PaletteName, inner: PaletteName): void {
  quad(w, width + 0.08, height + 0.08, x, y - 0.04, T / 2 + 0.012, edge);
  quad(w, width, height, x, y, T / 2 + 0.02, inner);
}

function fitting(w: Object3D, f: Fitting): void {
  const x = f.at;
  const face = T / 2;
  switch (f.kind) {
    case "calendar": {
      // A bank-less, church-less wall calendar: a picture above, the month's grid below, hung from a nail.
      const y = f.y ?? 1.3;
      quad(w, 0.46, 0.78, x, y, face + 0.01, "white");
      quad(w, 0.4, 0.3, x, y + 0.42, face + 0.016, f.colour ?? "green");
      quad(w, 0.16, 0.1, x - 0.08, y + 0.5, face + 0.02, "danfoYellow");
      for (let row = 0; row < 4; row++) quad(w, 0.38, 0.02, x, y + 0.06 + row * 0.08, face + 0.016, "concrete");
      quad(w, 0.08, 0.06, x + 0.08, y + 0.14, face + 0.02, "red");
      return;
    }
    case "photo": {
      // The family's portrait: a gold frame, a blue studio backdrop and three heads in a row.
      const y = f.y ?? 1.65;
      framed(w, x, y, 0.7, 0.5, "gold", "wallSky");
      for (const [dx, skin, cloth, h] of [[-0.18, "skin3", "wine", 0.26], [0, "skin4", "indigo", 0.32], [0.18, "skin5", "gold", 0.24]] as const) {
        quad(w, 0.14, h, x + dx, y, face + 0.026, cloth);
        quad(w, 0.08, 0.09, x + dx, y + h, face + 0.026, skin);
      }
      return;
    }
    case "clock": {
      const y = f.y ?? 2.3;
      const dial = new Group();
      dial.position.set(x, y, face + 0.01);
      dial.rotation.x = Math.PI / 2;
      w.add(dial);
      cylinder(dial, 0.2, 0.03, 0, 0, 0, "white", 12);
      cylinder(dial, 0.22, 0.02, 0, -0.005, 0, f.colour ?? "red", 12);
      quad(w, 0.025, 0.14, x, y, face + 0.045, "black");
      quad(w, 0.1, 0.025, x + 0.05, y, face + 0.046, "black");
      return;
    }
    case "switch": {
      // The switch and the socket, their wire run up the wall in its white channel to the ceiling line.
      const y = f.y ?? 1.25;
      quad(w, 0.12, 0.12, x, y, face + 0.01, "white");
      quad(w, 0.04, 0.05, x, y + 0.035, face + 0.014, "concrete");
      quad(w, 0.12, 0.12, x + 0.2, 0.35, face + 0.01, "white");
      quad(w, 0.03, 2.9 - y - 0.12, x, y + 0.12, face + 0.008, "white");
      quad(w, 0.03, y - 0.47, x + 0.2, 0.47, face + 0.008, "white");
      return;
    }
    case "posters": {
      const colours: PaletteName[] = ["danfoYellow", "white", "red"];
      colours.forEach((colour, i) => quad(w, 0.42, 0.58, x + i * 0.5, (f.y ?? 1.35) + (i % 2) * 0.08, face + 0.01 + i * 0.002, colour));
      quad(w, 0.3, 0.12, x, (f.y ?? 1.35) + 0.38, face + 0.016, "black");
      quad(w, 0.3, 0.3, x + 0.5, (f.y ?? 1.35) + 0.2, face + 0.016, "blue");
      return;
    }
    case "shelf": {
      const y = f.y ?? 1.6;
      box(w, 1.0, 0.03, 0.24, x, y, face + 0.12, "wood");
      for (const [dx, colour, h] of [[-0.38, "white", 0.14], [-0.24, "gold", 0.2], [-0.1, "green", 0.12], [0.1, "red", 0.16], [0.3, "blue", 0.22]] as const) box(w, 0.1, h, 0.1, x + dx, y + 0.03, face + 0.12, colour);
      return;
    }
    case "mirror": {
      const y = f.y ?? 1.2;
      framed(w, x, y, 0.36, 0.6, "white", "wallSky");
      quad(w, 0.3, 0.54, x, y + 0.03, face + 0.026, "glass");
      return;
    }
    case "notice": {
      // A hand-painted notice on the hostel wall: a white board, its black lines of paint.
      const y = f.y ?? 1.5;
      quad(w, 0.9, 0.5, x, y, face + 0.01, "white");
      for (let row = 0; row < 3; row++) quad(w, 0.7 - row * 0.15, 0.05, x - row * 0.05, y + 0.35 - row * 0.13, face + 0.014, row === 0 ? "red" : "black");
      return;
    }
    case "louvre": {
      // A painted-on louvre window where the wall stands whole: glass behind silver blades.
      const y = f.y ?? 0.9;
      quad(w, 1.0, 1.0, x, y, face + 0.006, "white");
      quad(w, 0.86, 0.86, x, y + 0.07, face + 0.01, "glass");
      for (let i = 0; i < 4; i++) quad(w, 0.84, 0.035, x, y + 0.2 + i * 0.2, face + 0.014, "hub");
      return;
    }
    case "number": {
      // A room's number painted over its door.
      const y = f.y ?? 2.25;
      quad(w, 0.3, 0.18, x, y, face + 0.01, "white");
      quad(w, 0.06, 0.12, x - 0.05, y + 0.03, face + 0.014, f.colour ?? "black");
      quad(w, 0.06, 0.12, x + 0.05, y + 0.03, face + 0.014, f.colour ?? "black");
      return;
    }
    default: {
      const never: never = f.kind;
      throw new Error(`No fitting ${String(never)}`);
    }
  }
}

function wall(g: Object3D, spec: WallSpec, cap: PaletteName): FootprintBox[] {
  const { frame, length } = wallFrame(g, spec);
  const openings = spec.openings ?? [];
  const spans = solidSpans(length, openings);
  for (const [a, b] of spans) {
    const width = b - a;
    const mid = (a + b) / 2;
    box(frame, width, spec.height, T, mid, 0, 0, spec.upper);
    // The cap, a shade darker, a touch wider than the wall so its top reads.
    box(frame, width + 0.02, 0.05, T + 0.04, mid, spec.height, 0, cap);
    // The inner face's dado and skirting; the outer face's worn band.
    if (spec.height > spec.dado + 0.05) quad(frame, width, spec.dado, mid, 0, T / 2 + 0.004, spec.lower);
    else quad(frame, width, spec.height - 0.02, mid, 0, T / 2 + 0.004, spec.lower);
    quad(frame, width, 0.1, mid, 0, T / 2 + 0.007, "darkWood");
    if (spec.outer !== undefined) quad(frame, width, Math.min(0.6, spec.height - 0.02), mid, 0, -T / 2 - 0.004, spec.outer, Math.PI);
  }
  for (const hole of openings) opening(frame, spec, hole);
  for (const f of spec.fittings ?? []) fitting(frame, f);
  // The wall blocks the ground under its solid spans.
  const [x0, z0] = spec.from;
  const [x1, z1] = spec.to;
  return spans.map(([a, b]) => {
    const mid = (a + b) / 2 / length + 0.5;
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    return { x: x0 + (x1 - x0) * mid, z: z0 + (z1 - z0) * mid, width: along ? b - a : T, depth: along ? T : b - a };
  });
}

export function buildHome(spec: HomeSpec): Group {
  const g = new Group();
  g.name = spec.name;
  const footprint: FootprintBox[] = [];
  for (const w of spec.walls) footprint.push(...wall(g, w, spec.cap));
  for (const [x, z, width, depth, height, colour] of spec.posts ?? []) {
    box(g, width, height, depth, x, 0, z, colour);
    box(g, width + 0.06, 0.06, depth + 0.06, x, height, z, spec.cap);
    footprint.push({ x, z, width, depth });
  }
  for (const [a, b, sag] of spec.wires ?? []) {
    let prev: [number, number, number] = [a[0], a[1], a[2]];
    const pieces = 5;
    for (let i = 1; i <= pieces; i++) {
      const t = i / pieces;
      const p: [number, number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
      beam(g, prev, p, 0.02, "black");
      prev = p;
    }
  }
  if (spec.curtain !== undefined) {
    const { from, to, top, colour, drawn } = spec.curtain;
    beam(g, [from[0], top + 0.05, from[1]], [to[0], top + 0.05, to[1]], 0.03, "hub");
    const cx = from[0] + (to[0] - from[0]) * (drawn / 2);
    const cz = from[1] + (to[1] - from[1]) * (drawn / 2);
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]) * drawn;
    const turn = Math.atan2(-(to[1] - from[1]), to[0] - from[0]);
    // The curtain gathered in three folds.
    for (let i = 0; i < 3; i++) {
      const share = (i - 1) / 3;
      box(g, length / 3 + 0.02, top - 0.12, 0.05, cx + Math.cos(turn) * share * length, 0.1, cz - Math.sin(turn) * share * length + (i % 2) * 0.04, i === 1 ? colour : colour, turn);
    }
  }
  return setFootprint(g, footprint);
}
