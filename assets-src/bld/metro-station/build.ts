// Union station in Deira (design page 15 section 3: the Nol machine, the platform): the metro's way in at street level,
// a glass hall under a sweeping silver shell with the station's name board under its lip (R-ASSET-012), and the
// viaduct the line runs on, its piers and deck over the street with a metro car standing on it as decor, since a
// place's models stand on the ground and the car must be up on its deck. A public station's plain description, no
// operator's mark or line colours (R-ASSET-010). Each is one building of the kit's shapes, inside a building's budget.
import { setFootprint, type SignStyle } from "@japacity/assets";
import { box, extrude, onWall, quad, signboard, solid, stain } from "@japacity/assets/kit";
import { Group } from "three";

export const STATION = { width: 14.0, depth: 6.0, hall: 4.6 } as const;
export const VIADUCT = { length: 28.0, deck: 7.2, width: 7.0, span: 8.0 } as const;

/** The hall at street level: glass on three sides under the shell, the doors in its front, the name board under the lip. */
export function buildMetroStation(key: string, style: SignStyle): Group {
  const g = new Group();
  g.name = "bld_metro-station";
  const { width: w, depth: d, hall } = STATION;
  const front = d / 2;
  box(g, w + 0.4, 0.15, d + 0.6, 0, 0, 0.2, "concrete");
  // The back: a solid wall where the escalators go down, faced in stone.
  box(g, w, hall, 0.4, 0, 0.15, -front + 0.2, "wallCream");
  stain(onWall(g, 0, 0, -front + 0.405), 0, 0.15, w - 1, 0.5, "wallCreamWorn");
  // The glass: the front in tall panes between slim mullions, the doors in the middle, the ends glazed too.
  const face = onWall(g, 0, 0, front);
  quad(face, w, hall, 0, 0.15, 0, "glass");
  for (let x = -w / 2; x <= w / 2 + 1e-6; x += 1.75) box(face, 0.1, hall, 0.1, x, 0.15, 0, "zinc");
  for (const x of [-1.2, 1.2]) {
    quad(face, 2.0, 2.4, x, 0.15, 0.06, "charcoal");
    quad(face, 1.8, 2.25, x, 0.2, 0.065, "glass");
  }
  for (const s of [-1, 1]) {
    const end = onWall(g, s * (w / 2), 0, 0, s * (Math.PI / 2));
    quad(end, d - 0.4, hall, 0.2, 0.15, 0, "glass");
  }
  box(g, w + 0.1, 0.25, d, 0, hall + 0.15, 0, "white");
  // The shell: a crescent of silver swept over the hall, its lip high over the front, falling to the back.
  extrude(g, [[-front - 1.6, 5.2], [-front - 1.6, 5.5], [-0.4, 6.9], [front + 0.4, 5.6], [front + 0.4, 5.2], [-0.4, 6.4]], w + 2.0, "zinc", 0, 0, 0, Math.PI / 2);
  // Under the lip, the white soffit between the shell and the hall's roof.
  solid(g, [[-w / 2 - 1, 4.99, front + 1.6], [w / 2 + 1, 4.99, front + 1.6], [w / 2 + 1, 4.99, -front], [-w / 2 - 1, 4.99, -front]], [[0, 3, 2, 1]], "white");
  // The name board on two hangers under the lip, over the doors.
  // It hangs just past the lip's edge, so the street sees it from the raised view as well as from under the shell.
  for (const x of [-2.2, 2.2]) box(g, 0.06, 0.6, 0.06, x, 4.65, front + 1.75, "charcoal");
  signboard(g, onWall(g, 0, 0, front + 1.75), key, style, 0, 3.9, 5.0, 0.75);
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

/** The viaduct over the street: hammerhead piers every span, the deck with its parapets, and a metro car on it. */
export function buildMetroViaduct(): Group {
  const g = new Group();
  g.name = "bld_metro-viaduct";
  const { length: L, deck, width: d, span } = VIADUCT;
  const piers = [-1.5, -0.5, 0.5, 1.5].map((k) => k * span);
  for (const x of piers) {
    box(g, 1.4, deck - 1.8, 1.8, x, 0, 0, "concrete");
    box(g, 1.6, 0.8, d - 0.6, x, deck - 1.8, 0, "concrete");
    stain(onWall(g, x, 0, 0.905), 0, 0, 1.4, 0.8, "concreteWorn");
  }
  // The deck: a box girder with its parapets, the stains where the rain runs off its edge.
  box(g, L, 1.0, d, 0, deck - 1.0, 0, "concrete");
  for (const s of [-1, 1]) box(g, L, 0.9, 0.25, 0, deck, s * (d / 2 - 0.125), "concrete");
  stain(onWall(g, 0, 0, d / 2 + 0.005), 0, deck - 1.0, L, 0.3, "concreteWorn");
  // The car on the deck, as the street sees it: a silver body over the parapet, its band of glass and its red line,
  // the raked nose at +x, the roof. Seen from below only its upper half shows.
  const z = 1.6;
  const base = deck + 0.3;
  const top = base + 3.1;
  const x0 = -9.5;
  const x1 = 6.0;
  box(g, x1 - x0, top - base, 2.9, (x0 + x1) / 2, base, z, "zinc");
  const side = onWall(g, 0, 0, z + 1.455);
  quad(side, x1 - x0 - 0.6, 1.2, (x0 + x1) / 2, base + 1.15, 0, "glass");
  quad(side, x1 - x0, 0.14, (x0 + x1) / 2, base + 0.85, 0.002, "red");
  for (const x of [-6.0, -1.5, 3.0]) quad(side, 1.4, 2.2, x, base + 0.2, 0.004, "hub");
  solid(g, [[x1, base, z - 1.45], [x1, base, z + 1.45], [x1 + 1.6, base, z + 1.2], [x1 + 1.6, base, z - 1.2], [x1, top, z - 1.45], [x1, top, z + 1.45], [x1 + 1.6, base + 1.2, z + 1.2], [x1 + 1.6, base + 1.2, z - 1.2]], [[0, 3, 2, 1], [1, 2, 6, 5], [0, 4, 7, 3], [3, 7, 6, 2]], "zinc");
  solid(g, [[x1 + 1.6, base + 1.2, z - 1.2], [x1 + 1.6, base + 1.2, z + 1.2], [x1, top, z + 1.45], [x1, top, z - 1.45]], [[0, 3, 2, 1]], "glass");
  return setFootprint(g, piers.map((x) => ({ x, z: 0, width: 1.4, depth: 1.8 })));
}
