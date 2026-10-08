// One span of the Ojuelegba flyover (city.md place.ojuelegba, R-CITY-013): a piece of one
// carriageway, pier to pier, instanced along its length and in two rows for the twin carriageways.
// The plan comes from OpenStreetMap (R-ASSET-024, outline.json): two one-way carriageways of two
// lanes each, their centrelines 13 to 15 m apart over the junction. The street sees it from below,
// so the underside carries the detail: four girders, a hammerhead cap on one square column, the
// bearings, the cross diaphragms, posters pasted on the column, a painted plinth, a drain pipe and the drip stains.
import { box, extrude, floorQuad, posters, quad, seeded } from "@japacity/assets/kit";
import { Group } from "three";

export const FLYOVER = {
  /** Pier to pier, metres: the piece repeats at this pitch. */
  span: 20,
  /** One carriageway: two 3.65 m lanes, hard strips and the parapets. */
  deckWidth: 9,
  /** The road surface, and the girders' soffit: about 5 m clear under the bridge. */
  top: 6.3,
  soffit: 5.0,
  /** The centrelines of the two carriageways, as the map data measures them over the junction. */
  rowGap: 13.8,
  lanes: 2,
} as const;

const SLAB = 0.3;
const PARAPET = { height: 0.9, thick: 0.35 } as const;
const GIRDERS = [-3.3, -1.1, 1.1, 3.3] as const;
const COLUMN = 1.5;
const LAMP = 5.4;

export function buildFlyoverSpan(): Group {
  const g = new Group();
  g.name = "bld_flyover-span";
  const random = seeded(1976);
  const { span, deckWidth, top, soffit } = FLYOVER;
  const half = deckWidth / 2;
  const capTop = soffit - 0.2;
  const capDepth = 1.3;

  // The deck: the slab, its asphalt, the lane line and edge lines seen from above.
  box(g, span, SLAB, deckWidth, 0, top - SLAB, 0, "concrete");
  floorQuad(g, span, deckWidth - 2 * PARAPET.thick, 0, top + 0.004, 0, "asphalt");
  for (const z of [-half + 0.75, half - 0.75]) floorQuad(g, span, 0.15, 0, top + 0.008, z, "marking");
  for (const x of [-span / 4, span / 4]) floorQuad(g, 3, 0.15, x, top + 0.008, 0, "marking");

  // The parapets, the drip band under the slab edge, and rain streaks down the fascia.
  for (const side of [-1, 1]) {
    const z = side * (half - PARAPET.thick / 2);
    box(g, span, PARAPET.height, PARAPET.thick, 0, top, z, "concrete");
    const face = side * (half + 0.004);
    quad(g, span, 0.18, 0, top - SLAB - 0.02, face, "concreteWorn", side > 0 ? 0 : Math.PI);
    for (let k = 0; k < 3; k++) {
      const x = -span / 2 + 2 + random() * (span - 4);
      quad(g, 0.35 + random() * 0.4, 0.9 + random() * 0.4, x, top - SLAB - 0.9, face, "concreteWorn", side > 0 ? 0 : Math.PI);
    }
  }

  // Four girders under the slab, the outer pair weathered darker.
  GIRDERS.forEach((z, index) => {
    box(g, span, top - SLAB - soffit, 0.6, 0, soffit, z, index === 0 || index === GIRDERS.length - 1 ? "concreteWorn" : "concrete");
  });

  // Cross diaphragms tie the girders over the pier and at the span's end, seen as ribs from below.
  for (const x of [-span / 2 + 0.15, 0]) box(g, 0.3, top - SLAB - soffit - 0.15, GIRDERS[3] - GIRDERS[0], x, soffit + 0.15, 0, "concreteWorn");

  // The hammerhead: wide under the girders, narrowing to the column, with a bearing under each girder.
  const capHalf = half - 0.6;
  extrude(
    g,
    [
      [-capHalf, capTop],
      [-COLUMN / 2 - 0.2, capTop - capDepth],
      [COLUMN / 2 + 0.2, capTop - capDepth],
      [capHalf, capTop],
      [capHalf, capTop + 0.01],
      [-capHalf, capTop + 0.01],
    ],
    1.6,
    "concrete",
    0,
    0,
    0,
    Math.PI / 2,
  );
  for (const z of GIRDERS) box(g, 0.5, soffit - capTop, 0.5, 0, capTop, z, "black");

  // The column, square, with a plinth painted in black and white blocks as the kerbs are.
  const columnTop = capTop - capDepth + 0.02;
  box(g, COLUMN, columnTop, COLUMN, 0, 0, 0, "concrete");
  const plinth = COLUMN + 0.5;
  box(g, plinth, 0.35, plinth, 0, 0, 0, "white");
  for (const turn of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const face = new Group();
    face.rotation.y = turn;
    face.position.set(Math.sin(turn) * (plinth / 2 + 0.004), 0, Math.cos(turn) * (plinth / 2 + 0.004));
    g.add(face);
    for (const x of [-plinth / 4, plinth / 4]) quad(face, plinth / 4, 0.35, x, 0, 0, "black");
  }

  // Posters pasted on every face of the column at head height, and the damp at its foot.
  for (const turn of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const face = new Group();
    face.rotation.y = turn;
    face.position.set(Math.sin(turn) * (COLUMN / 2), 0, Math.cos(turn) * (COLUMN / 2));
    g.add(face);
    posters(face, -0.48, 1.35 + random() * 0.3, random, 3);
    quad(face, COLUMN, 0.5, 0, 0.35, 0.004, "concreteWorn");
  }

  // The deck drain carried down the column's side in a black pipe.
  box(g, 0.14, columnTop - 0.35, 0.14, COLUMN / 2 + 0.1, 0.35, -COLUMN / 4, "black");

  // A lamp post on the outer parapet over the pier, its arm out over the carriageway.
  const lampBase = top + PARAPET.height;
  const lampZ = half - PARAPET.thick / 2;
  box(g, 0.18, LAMP, 0.18, 0, lampBase, lampZ, "hub");
  box(g, 0.14, 0.14, 2.2, 0, lampBase + LAMP - 0.14, lampZ - 1.1, "hub");
  box(g, 0.5, 0.16, 0.28, 0, lampBase + LAMP - 0.3, lampZ - 2.1, "hub");
  return g;
}
