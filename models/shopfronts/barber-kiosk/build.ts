// A barber's container kiosk on the pavement (streets:lagos-street-spending): a short steel container on
// sleepers with its door swung open, the mirror and the shelf of clippers inside, a striped pole by
// the door, the swivel chair out front under a zinc awning, a small painted board on the roof and the
// generator that keeps the clippers going when the light goes. The board's words are an anchor with a
// text key, drawn at run time (assets:sign-text-drawn-in-code).
import { setFootprint, type SignStyle } from "@japacity/model-kit";
import { awning, box, container, cylinder, generator, onWall, posters, quad, seeded, signboard, stain } from "@japacity/model-kit/kit";
import { Group } from "three";

export const BARBER_KIOSK = { width: 2.4, height: 2.45, depth: 2.0, raised: 0.15 } as const;

export function buildBarberKiosk(sign: string, style: SignStyle): Group {
  const g = new Group();
  g.name = "shopfront_barber-kiosk";
  const random = seeded(73);
  const { width: w, height: h, depth: d, raised: y } = BARBER_KIOSK;
  container(g, w, h, d, 0, y, 0, "roofBlue", -0.95, 1.2);
  const face = onWall(g, 0, 0, d / 2 + 0.012);
  // The doorway, dark inside, with the mirror on the back wall framed in white and the shelf of clippers under it.
  const door = { x: -0.05, width: 0.95 };
  quad(face, door.width, 2.05, door.x, y + 0.05, 0.002, "canvas");
  quad(face, 0.74, 0.72, door.x, y + 1.05, 0.004, "white");
  quad(face, 0.64, 0.62, door.x, y + 1.1, 0.006, "glass");
  box(g, 0.8, 0.04, 0.16, door.x, y + 0.92, d / 2 - 0.06, "wood");
  for (let i = 0; i < 3; i++) box(g, 0.07, 0.1 + random() * 0.08, 0.06, door.x - 0.25 + i * 0.25, y + 0.96, d / 2 - 0.06, i % 2 === 0 ? "black" : "danfoYellow");
  // The door swung right open against the front, its padlock hasp showing.
  const leaf = new Group();
  leaf.position.set(door.x + door.width / 2 + 0.02, y + 0.05, d / 2 + 0.04);
  leaf.rotation.y = 1.4;
  g.add(leaf);
  box(leaf, 0.04, 2.0, 0.9, 0, 0, 0.45, "roofBlue");
  quad(onWall(leaf, -0.025, 0, 0.45, -Math.PI / 2), 0.7, 1.7, 0, 0.15, 0, "blue");
  quad(onWall(leaf, -0.025, 0, 0.8, -Math.PI / 2), 0.06, 0.12, 0, 1.0, 0.003, "hub");
  // The striped pole by the door: red, white and blue bands on a white post, a cap on top.
  const poleX = -0.75;
  const poleZ = d / 2 + 0.12;
  for (let i = 0; i < 6; i++) cylinder(g, 0.07, 0.18, poleX, y + 1.0 + i * 0.18, poleZ, (["red", "white", "blue"] as const)[i % 3] ?? "red", 6, 0.07, true);
  cylinder(g, 0.09, 0.08, poleX, y + 2.08, poleZ, "hub", 6);
  cylinder(g, 0.05, 0.05, poleX, y + 0.95, poleZ, "hub", 6);
  // The zinc awning out over the chair, on two posts at its front edge.
  awning(face, 0.15, y + h - 0.05, 2.6, 1.4, 8, "zinc");
  for (const sx of [-1.05, 1.35]) box(g, 0.06, y + h - 0.25, 0.06, sx, 0, d / 2 + 1.36, "hub");
  // The swivel chair out front, turned to the mirror: its foot, its post, the black seat and back, the footrest.
  const cz = d / 2 + 0.85;
  cylinder(g, 0.26, 0.05, 0.15, 0, cz, "hub", 8);
  cylinder(g, 0.05, 0.38, 0.15, 0.05, cz, "hub", 6);
  box(g, 0.52, 0.12, 0.5, 0.15, 0.43, cz, "black");
  box(g, 0.5, 0.6, 0.08, 0.15, 0.55, cz + 0.24, "black");
  for (const sx of [-0.12, 0.42]) box(g, 0.06, 0.04, 0.42, sx, 0.66, cz, "hub");
  box(g, 0.36, 0.04, 0.16, 0.15, 0.12, cz - 0.38, "hub");
  // The small painted board on two posts above the roof.
  for (const sx of [-0.7, 0.7]) box(g, 0.06, 0.55, 0.06, sx, y + h, 0.3, "black");
  signboard(g, onWall(g, 0, 0, 0.34), sign, style, 0, y + h + 0.12, 1.9, 0.5);
  // The small generator on the left of the box, rust at the foot, posters on the right side.
  generator(g, -w / 2 - 0.35, 0, 0.3, false, Math.PI / 2, "red");
  for (let i = 0; i < 3; i++) stain(face, -1.1 + random() * 2.0, y + 0.02, 0.2 + random() * 0.3, 0.18, "zincRust");
  posters(onWall(g, w / 2 + 0.012, 0, 0, Math.PI / 2), -0.7, y + 0.9, random, 2);
  // The container with its open door, the generator and the awning's posts; the chair is a seat and the awning passes overhead.
  return setFootprint(g, [
    { x: 0, z: 0, width: w, depth: d + 0.2 },
    { x: 0.88, z: d / 2 + 0.2, width: 0.95, depth: 0.2 },
    { x: -w / 2 - 0.35, z: 0.3, width: 0.5, depth: 0.65 },
    { x: -1.05, z: d / 2 + 1.36, width: 0.1, depth: 0.1 },
    { x: 1.35, z: d / 2 + 1.36, width: 0.1, depth: 0.1 },
  ]);
}
