// A terrace on Rye Lane, Peckham (city.md place.peckham): Victorian brick over shopfronts, one
// unit to each 5 m of frontage. Each shop has a glazed front over a low stall riser, its door to
// one side, a fascia board over the glass with a text key (assets:sign-text-drawn-in-code) and a roller shutter box;
// above it the brick rises two or three storeys with sash windows under stone lintels to a cornice
// and parapet, the slate roof behind it, chimney stacks on the party walls, a soil pipe, a dish on
// the back (assets:dishes-face-one-satellite) and soot where the rain runs. The data below makes the two variants.
import { type PaletteName, setFootprint, type SignStyle } from "@japacity/model-kit";
import { box, dish, extrude, onWall, quad, seeded, signboard, stain } from "@japacity/model-kit/kit";
import { Group } from "three";

export interface TerraceSpec {
  name: string;
  units: number;
  storeys: 2 | 3;
  /** The frontage of one shop in metres, when it is not the street's usual five: Rye Lane's narrower units. */
  unit?: number;
  brick: PaletteName;
  soot: PaletteName;
  /** One colour a shopfront's frame, in unit order. */
  fronts: PaletteName[];
  signs: string[];
  styles: SignStyle[];
  seed: number;
}

export const TERRACE = { unit: 5.0, depth: 9.0, shop: 3.8, storey: 3.0, parapet: 0.9 } as const;

export function buildTerrace(spec: TerraceSpec, dishYaw: number): Group {
  const g = new Group();
  g.name = spec.name;
  const random = seeded(spec.seed);
  const { depth, shop, storey, parapet } = TERRACE;
  const unit = spec.unit ?? TERRACE.unit;
  const w = spec.units * unit;
  const top = shop + (spec.storeys - 1) * storey;
  const front = depth / 2;
  box(g, w, top + parapet, depth, 0, 0, 0, spec.brick);
  const face = onWall(g, 0, 0, front + 0.005);

  for (let index = 0; index < spec.units; index += 1) {
    const x = -w / 2 + unit * (index + 0.5);
    const frame = spec.fronts[index % spec.fronts.length] ?? "black";
    // The shopfront: frame, stall riser, plate glass with a mullion, the door at one side.
    quad(face, unit - 0.5, shop - 0.25, x, 0, 0.002, frame);
    quad(face, unit - 1.9, 0.5, x - 0.45, 0.05, 0.006, frame === "black" ? "charcoal" : "black");
    quad(face, unit - 1.9, 2.15, x - 0.45, 0.6, 0.006, "glass");
    quad(face, 0.06, 2.15, x - 0.45, 0.6, 0.01, frame);
    quad(face, 1.0, 2.5, x + unit / 2 - 0.85, 0.05, 0.006, "glass");
    quad(face, 0.04, 0.3, x + unit / 2 - 0.5, 1.15, 0.012, "hub");
    // Goods in the window: shelves of colour behind the glass.
    for (let shelf = 0; shelf < 3; shelf += 1) {
      const colour = (["red", "danfoYellow", "white", "green", "orange", "blue"] as const)[Math.floor(random() * 6)] ?? "red";
      quad(face, unit - 2.3, 0.18, x - 0.45, 0.85 + shelf * 0.55, 0.008, colour);
    }
    // The shutter box and the fascia with its words; a pilaster between units.
    box(face, unit - 0.4, 0.28, 0.25, x, shop - 0.25 - 0.28 - 0.62, 0.12, "charcoal");
    signboard(g, face, spec.signs[index] ?? "", spec.styles[index % spec.styles.length] ?? { board: "black", ink: "white" }, x, shop - 0.25 - 0.62, unit - 0.5, 0.62);
    if (index > 0) quad(face, 0.32, shop, -w / 2 + unit * index, 0, 0.004, spec.soot);
    // Upper floors: two sash windows a unit, each under a lintel over a sill.
    for (let floor = 1; floor < spec.storeys; floor += 1) {
      const y = shop + (floor - 1) * storey + 0.75;
      for (const dx of [-1.2, 1.2]) {
        quad(face, 1.1, 1.75, x + dx, y, 0.004, "white");
        quad(face, 0.95, 0.78, x + dx, y + 0.08, 0.008, "glass");
        quad(face, 0.95, 0.78, x + dx, y + 0.9, 0.008, "glass");
        quad(face, 1.3, 0.16, x + dx, y + 1.75, 0.006, "concrete");
        quad(face, 1.25, 0.08, x + dx, y - 0.08, 0.012, "concrete");
        if (random() < 0.4) quad(face, 0.95, 0.5, x + dx, y + 1.2, 0.01, (["cream", "wine", "white"] as const)[Math.floor(random() * 3)] ?? "cream");
      }
      // Soot streaks down from the sills.
      if (random() < 0.6) stain(face, x + (random() - 0.5) * 3, y - 1.2, 0.25, 1.1, spec.soot);
    }
  }

  // The cornice band, the parapet's coping, and the slate roof showing behind it.
  box(g, w + 0.1, 0.25, 0.25, 0, top - 0.05, front, "concrete");
  box(g, w + 0.06, 0.08, depth + 0.06, 0, top + parapet - 0.08, 0, "concrete");
  extrude(g, [[-front + 0.4, top + parapet - 0.6], [0, top + parapet + 1.6], [front - 0.4, top + parapet - 0.6]], w - 0.2, "charcoal", 0, 0, 0, Math.PI / 2);
  // Chimney stacks on the party walls, with pots.
  for (let index = 0; index <= spec.units; index += 2) {
    const x = Math.min(w / 2 - 0.5, Math.max(-w / 2 + 0.5, -w / 2 + unit * index));
    box(g, 0.9, 1.4, 0.6, x, top + parapet - 0.2, -0.4, spec.brick);
    box(g, 1.0, 0.1, 0.7, x, top + parapet + 1.2, -0.4, "concrete");
    for (const dx of [-0.22, 0.22]) box(g, 0.14, 0.3, 0.14, x + dx, top + parapet + 1.3, -0.4, "laterite");
  }
  // Soot along the top and a worn band at the foot of the brick piers; a soil pipe at one end.
  stain(face, 0, top - 0.6, w, 0.5, spec.soot);
  quad(face, 0.1, top - shop, w / 2 - 0.35, shop, 0.03, "black");
  // The back: windows and the dish facing the satellite, as every dish in the place does.
  const back = onWall(g, 0, 0, -front - 0.005, Math.PI);
  for (let index = 0; index < spec.units; index += 1) {
    const x = -w / 2 + unit * (index + 0.5);
    for (let floor = 0; floor < spec.storeys; floor += 1) quad(back, 1.0, 1.3, x, 1.0 + floor * storey, 0.002, "glass");
  }
  dish(g, back, -w / 2 + 2.5, top - 1.2, 0.3, dishYaw - Math.PI);
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth }]);
}
