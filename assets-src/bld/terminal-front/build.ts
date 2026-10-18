// The departures front of the international terminal (city.md place.airport-lagos), from the kit's
// shapes: a long glass wall in white mullions under a deep concrete fascia, three sets of sliding
// doors, and the canopy over the kerb on round columns, where cars stop and families say goodbye.
// Not a landmark (city:landmarks-built-to-outline): an ordinary building in the terminal's role, built from the
// kit and the airport's plain description, never from a drawing or a photograph.
import { type FootprintBox, setFootprint, type SignStyle } from "@japacity/assets";
import { acUnit, box, cylinder, floorQuad, onWall, parapet, quad, seeded, signboard, stain } from "@japacity/assets/kit";
import { Group } from "three";

export const TERMINAL = {
  width: 36,
  /** The façade's glass line; the body runs back from it and the canopy forward over the kerb. */
  face: 1.5,
  back: -10.5,
  canopyEdge: 10.5,
  glassTop: 7.0,
  top: 9.6,
  canopy: { underside: 5.4, depth: 0.5 },
  columns: [-13.5, -4.5, 4.5, 13.5],
  doors: [-9, 0, 9],
} as const;

export function buildTerminalFront(signs: { fascia: string; canopy: string; left: string; right: string }, styles: { fascia: SignStyle; canopy: SignStyle; hanging: SignStyle }): Group {
  const root = new Group();
  root.name = "bld_terminal-front";
  const random = seeded(1979);
  const { width: w, face, back, canopyEdge, glassTop, top, canopy } = TERMINAL;
  const half = w / 2;
  const depth = face - back;

  // The body, its roof parapet and a plant room on the roof with condensers on its face.
  box(root, w, top, depth, 0, 0, (face + back) / 2, "concrete");
  parapet(root, w, depth, 0, top, (face + back) / 2, "concrete");
  box(root, 8, 2.2, 5, -8, top, back + 4, "concreteWorn");
  const plant = onWall(root, -8, top, back + 6.5);
  for (const x of [-2.5, 0, 2.5]) acUnit(plant, x, 0.2);

  // The glass wall in its white grid: mullions every three metres, two transoms, a sill.
  const front = onWall(root, 0, 0, face);
  quad(front, w - 0.4, glassTop - 0.15, 0, 0.15, 0.01, "glass");
  for (let x = -half + 0.2; x <= half - 0.19; x += 3) box(front, 0.14, glassTop - 0.15, 0.16, x, 0.15, 0.08, "white");
  for (const y of [3.2, 6.0]) box(front, w - 0.4, 0.12, 0.14, 0, y, 0.07, "white");
  box(front, w - 0.4, 0.15, 0.2, 0, 0, 0.1, "concreteWorn");

  // Sliding doors: a white frame, two dark leaves meeting in the middle, a canopy number plate above.
  for (const x of TERMINAL.doors) {
    quad(front, 3.2, 2.7, x, 0.15, 0.02, "white");
    for (const s of [-1, 1]) quad(front, 1.45, 2.5, x + s * 0.76, 0.2, 0.03, "black");
    quad(front, 0.04, 2.5, x, 0.2, 0.035, "hub");
  }

  // The fascia over the glass: a deep band with a dark joint, and rain streaks down from its edge.
  box(front, w, top - glassTop, 0.3, 0, glassTop, 0.15, "concrete");
  quad(front, w, 0.08, 0, glassTop + 0.35, 0.31, "concreteWorn");
  for (let i = 0; i < 6; i++) stain(onWall(root, -half + 3 + random() * (w - 6), 0, face + 0.31), 0, glassTop + 0.45, 0.4 + random() * 0.5, 0.8 + random() * 0.9, "concreteWorn");
  signboard(root, onWall(root, 0, 0, face + 0.3), signs.fascia, styles.fascia, 0, glassTop + 0.35, 9.6, 1.6);

  // The canopy: a slab over the kerb from the fascia to the columns, its edge banded, its underside lit.
  const span = canopyEdge - face;
  box(root, w + 2, canopy.depth, span, 0, canopy.underside, face + span / 2, "white");
  box(root, w + 2.1, 0.28, 0.3, 0, canopy.underside + 0.15, canopyEdge - 0.1, "gold");
  for (let x = -half + 2; x < half; x += 4) floorQuad(root, 1.6, 0.25, x, canopy.underside - 0.005, face + span / 2, "cream");
  // The drop-off sign standing on the canopy's edge, off the centre so it never hides the name above the glass.
  for (const s of [-1, 1]) box(root, 0.1, 0.12, 0.1, 4.5 + s * 2.6, canopy.underside + canopy.depth, canopyEdge - 0.25, "hub");
  box(root, 6.2, 1.1, 0.14, 4.5, canopy.underside + canopy.depth + 0.1, canopyEdge - 0.25, styles.canopy.board);
  signboard(root, onWall(root, 4.5, 0, canopyEdge - 0.19), signs.canopy, styles.canopy, 0, canopy.underside + canopy.depth + 0.15, 6.0, 1.0);
  for (const x of TERMINAL.columns) {
    cylinder(root, 0.38, canopy.underside, x, 0, canopyEdge - 0.7, "white", 10);
    box(root, 0.95, 0.5, 0.95, x, 0, canopyEdge - 0.7, "concreteWorn");
  }

  // Two signs hung from the canopy over the doors at the ends, on rods.
  for (const [x, key] of [[TERMINAL.doors[0], signs.left], [TERMINAL.doors[2], signs.right]] as const) {
    for (const s of [-1, 1]) box(root, 0.05, 0.6, 0.05, x + s * 1.1, canopy.underside - 0.6, face + 3.0, "hub");
    box(root, 2.6, 0.7, 0.12, x, canopy.underside - 1.3, face + 3.0, styles.hanging.board);
    signboard(root, onWall(root, x, 0, face + 3.01), key, styles.hanging, 0, canopy.underside - 1.26, 2.5, 0.62);
  }

  // Steel bollards along the pavement's edge between the people and the cars; the pavement is the place's ground.
  for (let x = -half + 1; x <= half - 1; x += 2.5) box(root, 0.2, 0.95, 0.2, x, 0, canopyEdge - 0.25, "hub");

  // The plain back and ends, stained at the foot, with service doors and the wires to the plant room.
  const rear = onWall(root, 0, 0, back, Math.PI);
  stain(rear, 0, 0, w, 1.1, "concreteWorn");
  for (const x of [-10, 6]) quad(rear, 1.8, 2.4, x, 0, 0.01, "darkWood");
  for (const [x, ry] of [[-half, -Math.PI / 2], [half, Math.PI / 2]] as const) {
    const end = onWall(root, x, 0, (face + back) / 2, ry);
    stain(end, 0, 0, depth, 1.1, "concreteWorn");
    quad(end, 0.04, top - 1.8, -depth / 2 + 1.2, 1.8, 0.01, "black");
  }
  // The building, the canopy's columns and the bollards; the doors are shut glass and the canopy passes overhead.
  const bollards: FootprintBox[] = [];
  for (let x = -half + 1; x <= half - 1; x += 2.5) bollards.push({ x, z: canopyEdge - 0.25, width: 0.2, depth: 0.2 });
  return setFootprint(root, [
    { x: 0, z: (face + back) / 2, width: w, depth: depth + 0.4 },
    ...TERMINAL.columns.map((x) => ({ x, z: canopyEdge - 0.7, width: 0.95, depth: 0.95 })),
    ...bollards,
  ]);
}
