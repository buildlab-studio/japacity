// A Lagos tailor's corner, the backdrop of the front door's first screen (prologue.md R-PROLOGUE-016): a nook of 6 by
// 4 metres seen from the front, its back wall along -Z and one side wall, built by the room's builder (R-ASSET-014),
// with a shelf of three bolts of cloth, a clothes rail with two hangers and a long mirror against the back wall. The
// numbers live here so the builder, the door and the tests read the same ones.
import type { PaletteName } from "@japacity/assets";

import type { RoomSpec } from "../room/build";

/** The three prints the door's sheet offers, by the names the sheet gives them. */
export type BoltFabric = "ankara" | "adire" | "aso-oke";

export interface Bolt {
  fabric: BoltFabric;
  /** The print's ground: the bolt's body is painted in it, so it reads as that cloth before its print is on. */
  ground: PaletteName;
}

export interface TailorSpec {
  name: string;
  room: RoomSpec;
  /** The shelf against the back wall: its middle along x, its width, depth and height, and the boards' heights. */
  shelf: { x: number; width: number; depth: number; high: number; boards: readonly number[]; colour: PaletteName };
  /** One bolt a board from the second board up, lying flat with its folded edge to the front. */
  bolts: readonly Bolt[];
  bolt: { width: number; high: number; deep: number };
  /** The rail on two stands, its middle along x, its width, the bar's height and how far it stands off the wall. */
  rail: { x: number; width: number; high: number; off: number; colour: PaletteName };
  /** Two hangers on the rail, each with a garment of one colour. */
  hangers: readonly { at: number; colour: PaletteName }[];
  /** A long mirror on the back wall: a light rectangle in a dark frame, no reflection. */
  mirror: { x: number; bottom: number; width: number; high: number; glass: PaletteName; frame: PaletteName };
}

export const TAILOR = {
  name: "bld_tailor-corner",
  room: {
    name: "bld_tailor-corner",
    size: [6, 4],
    height: 3.0,
    side: "left",
    upper: "wallPeach",
    lower: "wallPeachWorn",
    dado: 1.0,
    skirting: "darkWood",
    fittings: [],
    seed: 1616,
  },
  shelf: { x: -1.5, width: 0.86, depth: 0.42, high: 2.05, boards: [0.08, 0.6, 1.1, 1.6], colour: "wood" },
  bolts: [
    { fabric: "ankara", ground: "indigo" },
    { fabric: "adire", ground: "indigo" },
    { fabric: "aso-oke", ground: "wine" },
  ],
  bolt: { width: 0.72, high: 0.26, deep: 0.34 },
  rail: { x: 1.3, width: 1.2, high: 1.75, off: 0.45, colour: "zinc" },
  hangers: [
    { at: -0.28, colour: "teal" },
    { at: 0.3, colour: "gold" },
  ],
  mirror: { x: -0.62, bottom: 0.3, width: 0.42, high: 1.7, glass: "white", frame: "darkWood" },
} as const satisfies TailorSpec;

/** One face of a bolt that shows its print, as a rectangle in the corner's frame facing +Z (front) or +Y (top). */
export interface BoltFace {
  fabric: BoltFabric;
  /** The rectangle's middle. */
  centre: [number, number, number];
  width: number;
  /** Its height for a front face, its depth for a top face. */
  high: number;
  facing: "front" | "top";
}

/** How far a print sits off the bolt's own face, so the two never fight for the same pixels. */
export const PRINT_OFF = 0.004;

/** Where each bolt lies: on the boards from the second up, centred on the shelf, its back to the wall. */
export function boltsOf(spec: TailorSpec = TAILOR): { fabric: BoltFabric; ground: PaletteName; x: number; y: number; z: number }[] {
  const back = -spec.room.size[1] / 2;
  return spec.bolts.map((bolt, i) => ({
    fabric: bolt.fabric,
    ground: bolt.ground,
    x: spec.shelf.x,
    y: (spec.shelf.boards[i + 1] ?? 0) + 0.03,
    z: back + spec.shelf.depth - spec.bolt.deep / 2 - 0.02,
  }));
}

/** The faces of the bolts the door prints at load: each bolt's folded front edge and its top. */
export function boltFaces(spec: TailorSpec = TAILOR): BoltFace[] {
  const { width, high, deep } = spec.bolt;
  return boltsOf(spec).flatMap((bolt): BoltFace[] => [
    { fabric: bolt.fabric, centre: [bolt.x, bolt.y + high / 2, bolt.z + deep / 2 + PRINT_OFF], width, high, facing: "front" },
    { fabric: bolt.fabric, centre: [bolt.x, bolt.y + high + PRINT_OFF, bolt.z], width, high: deep, facing: "top" },
  ]);
}
