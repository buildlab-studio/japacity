// The room of an interior place (docs/rules/world.md R-WORLD-011): its two far walls and no roof, so
// the raised camera looks into it from the open sides. The floor is the place's own ground; the room
// is the back wall along -Z and one side wall, painted in two tones with a dark skirting, with the
// windows, the clock, the notices and the air conditioner a Lagos office or home has on its walls.
// Every room is a set of numbers in ROOMS given to this one builder (R-ASSET-014). The things the
// player taps (the door, the window of the room abroad) are props of their own placed against a wall.
import { type PaletteName, setFootprint } from "@japacity/assets";
import { acUnit, box, cylinder, louvreWindow, onWall, posters, quad, seeded } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

/** Where a fitting hangs: on the back wall (x along it) or the side wall (z along it). */
export interface Fitting {
  kind: "window" | "clock" | "notices" | "ac" | "board" | "picture" | "glass";
  wall: "back" | "side";
  /** Metres along the wall from its middle. */
  at: number;
}

export interface RoomSpec {
  name: string;
  /** Inside width along x and depth along z, in metres. */
  size: readonly [number, number];
  height: number;
  /** The side wall stands at -x (left, as the camera sees it) or +x. */
  side: "left" | "right";
  upper: PaletteName;
  lower: PaletteName;
  /** Height of the lower tone, the dado. */
  dado: number;
  skirting: PaletteName;
  fittings: readonly Fitting[];
  seed: number;
}

const WALL = 0.2;

/** A picture or a notice frame flat on a wall. */
function frame(w: Object3D, x: number, y: number, width: number, height: number, inner: PaletteName, edge: PaletteName = "darkWood"): void {
  quad(w, width + 0.08, height + 0.08, x, y - 0.04, 0.012, edge);
  quad(w, width, height, x, y, 0.02, inner);
}

function fit(w: Object3D, fitting: Fitting, room: RoomSpec, random: () => number): void {
  const x = fitting.at;
  switch (fitting.kind) {
    case "window":
      louvreWindow(w, x, 0);
      return;
    case "clock":
      // A round clock high on the wall, turned to face out of it.
      {
        const face = new Group();
        face.position.set(x, 2.35, 0.02);
        face.rotation.x = Math.PI / 2;
        w.add(face);
        cylinder(face, 0.2, 0.04, 0, 0, 0, "white", 12);
        cylinder(face, 0.225, 0.02, 0, -0.005, 0, "black", 12);
        quad(w, 0.03, 0.15, x, 2.35, 0.065, "black");
      }
      return;
    case "notices":
      posters(w, x - 0.48, 1.45, random, 3);
      return;
    case "ac":
      acUnit(w, x, room.height - 0.75);
      return;
    case "board":
      // A notice board with papers pinned to it.
      frame(w, x, 1.2, 1.4, 0.9, "tan", "wood");
      for (let i = 0; i < 4; i++) quad(w, 0.28, 0.36, x - 0.5 + i * 0.33, 1.35 + (i % 2) * 0.12, 0.03, i % 2 === 0 ? "white" : "cream");
      return;
    case "picture":
      frame(w, x, 1.55, 0.7, 0.5, random() < 0.5 ? "teal" : "gold");
      return;
    case "glass":
      // A wide pane of dark glass with its mullions: the arrivals hall's wall to the kerb.
      quad(w, 3.2, 2.4, x, 0.6, 0.012, "concrete");
      quad(w, 3.0, 2.2, x, 0.7, 0.02, "glass");
      for (const along of [-1, 0, 1]) quad(w, 0.06, 2.2, x + along * 1.0, 0.7, 0.026, "hub");
      return;
    default: {
      const never: never = fitting.kind;
      throw new Error(`No fitting ${String(never)}`);
    }
  }
}

/** Paints a wall's inner face: the dado, the band over it and the skirting. */
function paint(w: Object3D, length: number, room: RoomSpec): void {
  quad(w, length, room.dado, 0, 0, 0.004, room.lower);
  quad(w, length, 0.06, 0, room.dado, 0.006, room.skirting);
  quad(w, length, 0.12, 0, 0, 0.008, room.skirting);
}

export function buildRoom(spec: RoomSpec): Group {
  const g = new Group();
  g.name = spec.name;
  const random = seeded(spec.seed);
  const [width, depth] = spec.size;
  const sx = spec.side === "left" ? -1 : 1;
  const sideX = sx * (width / 2 + WALL / 2);
  // The back wall runs over the side wall's end, so the two never share a top face.
  box(g, width + WALL, spec.height, WALL, (sx * WALL) / 2, 0, -depth / 2 - WALL / 2, spec.upper);
  box(g, WALL, spec.height - 0.02, depth, sideX, 0, 0, spec.upper);
  // The wall heads, a shade darker, so the cut tops read as walls from above.
  box(g, width + WALL + 0.06, 0.08, WALL + 0.06, (sx * WALL) / 2, spec.height, -depth / 2 - WALL / 2, spec.skirting);
  box(g, WALL + 0.06, 0.08, depth, sideX, spec.height - 0.05, 0, spec.skirting);
  const back = onWall(g, 0, 0, -depth / 2);
  const side = onWall(g, sx * (width / 2), 0, 0, -sx * (Math.PI / 2));
  paint(back, width, spec);
  paint(side, depth, spec);
  for (const fitting of spec.fittings) fit(fitting.wall === "back" ? back : side, fitting, spec, random);
  // The walls block the ground behind and beside the room.
  return setFootprint(g, [
    { x: (sx * WALL) / 2, z: -depth / 2 - WALL / 2, width: width + WALL, depth: WALL },
    { x: sideX, z: 0, width: WALL, depth },
  ]);
}
