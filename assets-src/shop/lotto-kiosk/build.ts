// A lotto kiosk on a Surulere pavement: a painted steel box on a step with a wide hatch, its flap
// propped up as a sun shade, a counter where the slips are filled, a painted board on posts above
// the roof, a chalked board of today's games by the hatch, a bench and a stool for the regulars,
// posters and rust. The words are anchors with text keys, drawn at run time (R-ASSET-012).
import { type SignStyle } from "@japacity/assets";
import { box, clutter, onWall, posters, quad, seeded, signboard, stain } from "@japacity/assets/kit";
import { Group } from "three";

export const KIOSK = { width: 2.4, depth: 1.7, height: 2.35, step: 0.15 } as const;

export function buildLottoKiosk(signs: { board: string; games: string }, styles: { board: SignStyle; games: SignStyle }): Group {
  const g = new Group();
  g.name = "shop_lotto-kiosk";
  const random = seeded(55);
  const { width: w, depth: d, height: h, step } = KIOSK;
  box(g, w + 0.5, step, d + 0.9, 0, 0, 0.25, "concrete");
  // The box, with a darker band where feet and rain have worn the paint.
  box(g, w, h, d, 0, step, 0, "green");
  box(g, w + 0.12, 0.08, d + 0.12, 0, step + h, 0, "white");
  const face = onWall(g, 0, 0, d / 2 + 0.005);
  stain(face, 0, step, w, 0.45, "roofGreen");
  // The hatch: a dark opening over the counter, the flap propped up over it.
  quad(face, 1.7, 0.95, -0.2, step + 1.05, 0.002, "canvas");
  box(g, 1.9, 0.05, 0.35, -0.2, step + 1.0, d / 2 + 0.15, "white");
  box(g, 1.8, 0.04, 0.03, -0.2, step + 1.02, d / 2 + 0.33, "black");
  const flap = new Group();
  flap.position.set(-0.2, step + 2.02, d / 2);
  flap.rotation.x = -1.05;
  g.add(flap);
  box(flap, 1.8, 0.95, 0.04, 0, -0.95, 0.02, "green");
  for (const sx of [-0.95, 0.55]) box(g, 0.03, 0.67, 0.03, sx, step + 1.05, d / 2 + 0.45, "black");
  // Slips and a biro on the counter, a calendar inside the hatch.
  for (let i = 0; i < 4; i++) box(g, 0.12, 0.005, 0.08, -0.8 + i * 0.25, step + 1.05, d / 2 + 0.2, "white");
  quad(face, 0.35, 0.45, 0.35, step + 1.35, 0.004, "white");
  // The side door, at the right end, with its padlock hasp.
  const side = onWall(g, w / 2 + 0.005, 0, 0, Math.PI / 2);
  quad(side, 0.75, 2.0, 0.1, step + 0.05, 0.002, "roofGreen");
  quad(side, 0.08, 0.12, -0.18, step + 1.05, 0.004, "black");
  // The painted board above the roof on two posts, and the chalked board of today's games by the hatch.
  for (const sx of [-w / 2 + 0.25, w / 2 - 0.25]) box(g, 0.08, 0.95, 0.08, sx, step + h, 0.1, "black");
  signboard(g, onWall(g, 0, 0, 0.16), signs.board, styles.board, 0, step + h + 0.28, w + 0.2, 0.62);
  signboard(g, face, signs.games, styles.games, 0.9, step + 0.55, 0.62, 0.9);
  // Posters on the far side, rust where the box meets the step.
  posters(onWall(g, -w / 2 - 0.005, 0, 0, -Math.PI / 2), -0.6, step + 1.0, random, 2);
  for (let i = 0; i < 3; i++) stain(face, -1.0 + random() * 2.0, step + 0.02, 0.25 + random() * 0.3, 0.2, "zincRust");
  // A bench and a plastic stool for the regulars, a crate of empties.
  clutter(g, "bench", -0.4, step, d / 2 + 0.95);
  box(g, 0.32, 0.42, 0.32, 1.25, step, d / 2 + 0.6, "red");
  clutter(g, "crates", -1.55, step, d / 2 + 0.45);
  return g;
}
