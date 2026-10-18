// A phone shop in a 20-foot container on sleepers: a glazed front with a door cut in it, a
// display case brought out to the pavement, a printed board on the roof edge and a recharge
// card sign on its own post. A printed shopfront, no ribs on the back nobody sees, rust and
// stickers on the box, and the sign inside the plot.
import { setFootprint, type SignStyle } from "@japacity/assets";
import { acUnit, awning, box, clutter, container, dish, onWall, posters, quad, seeded, signboard, stain } from "@japacity/assets/kit";
import { Group } from "three";

export const CONTAINER_SHOP = { width: 6.0, height: 2.6, depth: 2.4, raised: 0.3 } as const;

export function buildContainerPhones(signs: { board: string; card: string }, styles: { board: SignStyle; card: SignStyle }, dishYaw: number): Group {
  const g = new Group();
  g.name = "shop_container-phones";
  const random = seeded(31);
  const { width: w, height: h, depth: d, raised: y } = CONTAINER_SHOP;
  container(g, w, h, d, 0, y, 0, "blue", -2.7, 2.7);
  const face = onWall(g, 0, 0, d / 2 + 0.012);
  // The glass front in a white frame, with a door at the left.
  quad(face, 4.6, 2.0, 0.45, y + 0.15, 0.002, "white");
  quad(face, 0.9, 1.95, -1.4, y + 0.15, 0.006, "glass");
  quad(face, 3.4, 1.4, 1.1, y + 0.55, 0.006, "glass");
  quad(face, 0.06, 0.12, -1.05, y + 1.0, 0.01, "black");
  for (const sx of [-0.6, 1.1, 2.75]) quad(face, 0.06, 1.4, sx, y + 0.55, 0.008, "white");
  // The display case on the pavement, with phones on show.
  box(g, 2.6, 0.9, 0.5, 1.1, 0, d / 2 + 0.55, "white");
  quad(onWall(g, 1.1, 0, d / 2 + 0.801), 2.4, 0.3, 0, 0.55, 0, "glass");
  for (let i = 0; i < 6; i++) box(g, 0.1, 0.18, 0.02, 0.1 + i * 0.4, 0.9, d / 2 + 0.55, "black");
  // The printed board on the roof edge and the recharge sign on its post by the kerb.
  signboard(g, onWall(g, 0, 0, d / 2 + 0.05), signs.board, styles.board, 0, y + h + 0.02, w - 0.4, 0.72);
  box(g, 0.08, 2.4, 0.08, w / 2 - 0.4, 0, d / 2 + 1.0, "black");
  signboard(g, onWall(g, w / 2 - 0.4, 0, d / 2 + 1.05), signs.card, styles.card, 0, 2.4, 1.2, 0.8);
  awning(face, 0.45, y + 2.25, 4.8, 1.0, 7, "blue");
  // Rust, stickers and a sun-faded patch on the box; the AC unit and the dish at the back, off the glass.
  for (let i = 0; i < 4; i++) stain(onWall(g, 0, 0, d / 2 + 0.03), -2.8 + random() * 5.6, y + 0.05, 0.3 + random() * 0.5, 0.25 + random() * 0.4, "zincRust");
  posters(onWall(g, -w / 2 - 0.012, 0, 0, -Math.PI / 2), -0.8, y + 0.9, random, 3);
  stain(onWall(g, w / 2 + 0.012, 0, 0, Math.PI / 2), 0, y + 0.2, 1.4, 0.5, "zincRust");
  acUnit(onWall(g, 0, 0, -d / 2 - 0.012, Math.PI), -1.5, y + 1.4);
  // The dish on a bracket on the side wall nearest the satellite, below the roof so the shop stays under 4 m.
  dish(g, onWall(g, w / 2 + 0.012, 0, 0, Math.PI / 2), 0.4, y + 1.5, 0.3, dishYaw - Math.PI / 2);
  clutter(g, "bench", -2.0, 0, d / 2 + 0.9);
  clutter(g, "drum", -3.3, 0, d / 2 + 0.3);
  // The container on its sleepers, the display case, the sign's post and the drum; the bench is a seat and the awning passes overhead.
  return setFootprint(g, [
    { x: 0, z: 0, width: w, depth: d + 0.2 },
    { x: 1.1, z: d / 2 + 0.55, width: 2.6, depth: 0.5 },
    { x: w / 2 - 0.4, z: d / 2 + 1.0, width: 0.12, depth: 0.12 },
    { x: -3.3, z: d / 2 + 0.3, width: 0.58, depth: 0.58 },
  ]);
}
