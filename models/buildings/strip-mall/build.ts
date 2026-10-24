// The strip mall in north-east Calgary (docs/design/11-calgary-dubai-and-castel-volturno.md sections 2 and 3: the hub, the jobs notice, the coffee shop, the
// African store, the barber): one flat-roofed row of shop units behind a parking lot, as the newcomers' suburbs have
// them. Each unit has its plate glass and glass door under a deep canopy on slim posts, a fascia sign over the canopy
// with a text key (assets:sign-text-drawn-in-code), and posters in the window; the roof carries its grey heating units behind a parapet.
// Stains where the meltwater runs and a pasted notice on a pier (assets:buildings-carry-wear-and-clutter). No real business's name, colours or
// mark (assets:no-real-brands-on-assets): the signs say what the place file's keys say. The data below makes the row.
import { type PaletteName, setFootprint, type SignStyle } from "@japacity/model-kit";
import { box, meterAndCable, onWall, posters, quad, seeded, signboard, stain } from "@japacity/model-kit/kit";
import { Group } from "three";

export interface StripMallSpec {
  name: string;
  units: number;
  /** One shop's frontage in metres. */
  unit: number;
  wall: PaletteName;
  worn: PaletteName;
  /** The fascia band and the canopy's edge. */
  trim: PaletteName;
  /** One colour a shopfront's frame, in unit order. */
  fronts: PaletteName[];
  signs: string[];
  styles: SignStyle[];
  seed: number;
}

export const STRIP_MALL = { depth: 9.5, height: 4.8, canopy: 1.8, canopyY: 3.1, fascia: [3.3, 5.3] } as const;

export function buildStripMall(spec: StripMallSpec): Group {
  const g = new Group();
  g.name = spec.name;
  const random = seeded(spec.seed);
  const { depth, height, canopy, canopyY, fascia } = STRIP_MALL;
  const w = spec.units * spec.unit;
  const front = depth / 2;
  box(g, w, height, depth, 0, 0, 0, spec.wall);
  const face = onWall(g, 0, 0, front + 0.005);
  // The fascia band standing proud of the front and above the roof, its coping, and the canopy on its posts.
  box(g, w + 0.2, fascia[1] - fascia[0], 0.4, 0, fascia[0], front + 0.2, spec.trim);
  box(g, w + 0.3, 0.1, 0.5, 0, fascia[1], front + 0.2, "concreteWorn");
  box(g, w + 0.2, 0.16, canopy, 0, canopyY, front + canopy / 2, spec.trim);
  for (let index = 0; index <= spec.units; index += 1) box(g, 0.14, canopyY, 0.14, -w / 2 + 0.1 + index * ((w - 0.2) / spec.units), 0, front + canopy - 0.12, "charcoal");
  // A low concrete base along the front.
  quad(face, w, 0.5, 0, 0, 0.002, "concrete");

  const sign = onWall(g, 0, 0, front + 0.405);
  for (let index = 0; index < spec.units; index += 1) {
    const x = -w / 2 + spec.unit * (index + 0.5);
    const frame = spec.fronts[index % spec.fronts.length] ?? "charcoal";
    // The shopfront: its frame, the plate glass with a mullion, the glass door at one side with its handle.
    quad(face, spec.unit - 0.5, 2.8, x, 0.3, 0.004, frame);
    quad(face, spec.unit - 1.9, 2.35, x - 0.45, 0.55, 0.008, "glass");
    quad(face, 0.06, 2.35, x - 0.45, 0.55, 0.012, frame);
    quad(face, 1.0, 2.5, x + spec.unit / 2 - 0.85, 0.3, 0.008, "glass");
    quad(face, 0.04, 0.32, x + spec.unit / 2 - 0.5, 1.2, 0.012, "hub");
    // Posters and goods behind the glass: blocks of colour, never words.
    for (let k = 0; k < 2; k += 1) {
      const colour = (["red", "danfoYellow", "white", "green", "orange", "blue", "cream"] as const)[Math.floor(random() * 7)] ?? "white";
      quad(face, 0.5, 0.7, x - 1.1 + k * 0.75, 1.3 + random() * 0.3, 0.01, colour);
    }
    // The pier between units, a shade darker, with meltwater stains at its foot.
    if (index > 0) {
      quad(face, 0.3, canopyY, -w / 2 + spec.unit * index, 0, 0.006, spec.worn);
      stain(face, -w / 2 + spec.unit * index, 0.5, 0.5, 0.4, "concreteWorn");
    }
    signboard(g, sign, spec.signs[index] ?? "", spec.styles[index % spec.styles.length] ?? { board: "white", ink: "black" }, x, fascia[0] + 0.45, spec.unit - 0.8, 0.95);
  }
  // A notice pasted on the end pier, the meter and its cable at the far end, a stain along the fascia's foot.
  posters(face, -w / 2 + 0.05, 1.4, random, 1);
  meterAndCable(face, w / 2 - 0.5, 0, height);
  stain(face, 0, fascia[0] - 0.3, w, 0.25, spec.worn);
  // The ends: plain walls with a stain each, and the back with its doors.
  for (const s of [-1, 1]) stain(onWall(g, s * (w / 2 + 0.005), 0, 0, s * (Math.PI / 2)), 0, 0.3, depth - 1, 0.6, spec.worn);
  const back = onWall(g, 0, 0, -front - 0.005, Math.PI);
  for (let index = 0; index < spec.units; index += 1) quad(back, 0.95, 2.1, -w / 2 + spec.unit * (index + 0.5), 0, 0.004, "zinc");
  // The roof's grey heating units behind the parapet, and a coping round the roof's edge.
  for (const [x, z] of [[-w / 4, -1.5], [w / 8, -3.0], [w / 3, -1.0]] as const) box(g, 1.6, 0.9, 1.2, x, height, z, "hub");
  box(g, w + 0.06, 0.1, depth + 0.06, 0, height - 0.06, 0, "concreteWorn");
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth }]);
}
