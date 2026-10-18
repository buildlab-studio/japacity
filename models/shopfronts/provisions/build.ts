// A hand-painted provisions store: one lock-up bay under a shallow zinc lean-to, the goods brought
// out to a table in front of the door, sacks and crates, a painted board over the shutter and a
// painted notice by the door, clear of the louvre; the tin drawn as a tin and the goods in front of
// the walls.
import { setFootprint, type SignStyle } from "@japacity/model-kit";
import {
  box,
  clutter,
  drain,
  extrude,
  KIT_SIZES,
  louvreWindow,
  onWall,
  posters,
  quad,
  seeded,
  shopOpening,
  signboard,
  stain,
} from "@japacity/model-kit/kit";
import { Group } from "three";

export const PROVISIONS = { width: 4.0, depth: 3.5, plinth: 0.15, wall: 3.375 } as const;

export function buildProvisions(signs: { board: string; notice: string }, styles: { board: SignStyle; notice: SignStyle }): Group {
  const g = new Group();
  g.name = "shopfront_provisions";
  const random = seeded(24);
  const { width: w, depth: d, plinth, wall } = PROVISIONS;
  box(g, w + 0.4, plinth, d + 1.1, 0, 0, 0.35, "concrete");
  box(g, w, wall, d, 0, plinth, 0, "wallCream");
  const face = onWall(g, 0, 0, d / 2);
  shopOpening(face, -0.6, plinth, 2.2, true, random);
  // The painted board over the shutter, the full width of the shop.
  signboard(g, face, signs.board, styles.board, 0, plinth + KIT_SIZES.bay.opening + KIT_SIZES.bay.shutterBox + 0.05, w - 0.2, 0.62);
  // The painted notice by the door, under a louvre window that clears it.
  signboard(g, face, signs.notice, styles.notice, 1.25, plinth + 0.95, 1.2, 0.42);
  louvreWindow(face, 1.25, plinth + 0.55);
  // The goods on a table in front of the door: tins and packets, a basin of tomatoes, sacks and crates beside it.
  box(g, 1.8, 0.06, 0.6, -0.6, 0.85, d / 2 + 0.45, "wood");
  for (const sx of [-1.4, 0.2]) box(g, 0.06, 0.7, 0.5, sx, plinth, d / 2 + 0.45, "darkWood");
  const goods = ["red", "danfoYellow", "white", "green", "blue", "orange"] as const;
  for (let i = 0; i < 5; i++) box(g, 0.22, 0.18 + random() * 0.12, 0.2, -1.3 + i * 0.32, 0.91, d / 2 + 0.4, goods[i % goods.length] ?? "red");
  clutter(g, "sacks", 1.0, plinth, d / 2 + 0.55);
  clutter(g, "crates", -1.85, plinth, d / 2 + 0.75);
  // A shallow zinc lean-to rising toward the street, with a little overhang over the board.
  extrude(g, [[-d / 2 - 0.1, plinth + wall + 0.05], [d / 2 + 0.45, plinth + wall + 0.4], [d / 2 + 0.45, plinth + wall + 0.46], [-d / 2 - 0.1, plinth + wall + 0.11]], w + 0.3, "zinc", 0, 0, 0, -Math.PI / 2);
  for (const rx of [-1.1, 0.9]) quad(onWall(g, rx, plinth + wall + 0.47 - 0.25, 0.4), 0.85, 0.02, 0, 0, 0, "zincRust");
  // Wear: the worn band, a damp patch under the roof edge, posters on the side wall.
  stain(face, 0, plinth, w, 0.6, "wallCreamWorn");
  stain(face, -1.5, plinth + 2.2, 0.4, 0.5, "wallCreamWorn");
  const side = onWall(g, w / 2, 0, 0, Math.PI / 2);
  stain(side, 0, plinth, d, 0.6, "wallCreamWorn");
  posters(side, -0.9, plinth + 1.2, random, 3);
  drain(g, -w / 2 - 0.2, w / 2 + 0.2, d / 2 + 1.25, plinth, [-0.6]);
  // The shop, the goods' table, the sacks and the crates; the lean-to passes overhead.
  return setFootprint(g, [
    { x: 0, z: 0, width: w, depth: d },
    { x: -0.6, z: d / 2 + 0.45, width: 1.8, depth: 0.6 },
    { x: 1.25, z: d / 2 + 0.6, width: 1.02, depth: 0.56 },
    { x: -1.81, z: d / 2 + 0.75, width: 0.58, depth: 0.36 },
  ]);
}
