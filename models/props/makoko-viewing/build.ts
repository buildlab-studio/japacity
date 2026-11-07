// What the viewing centre of Makoko holds (city.md place.makoko): two flat screens on plank brackets on the back wall, each showing
// the same match, a green pitch with its white lines and no mark of any club, league or broadcaster; the stereo on its shelf between
// them with its two speakers; and the plank benches in rows facing the screens. Each faces +z with its lowest point at y = 0.
import { setFootprint } from "@japacity/model-kit";
import { beam, box, cylinder, quad } from "@japacity/model-kit/kit";
import { Group } from "three";

/** The screens: how far apart their middles stand along x, their width and height, and the height of their bottom edge. */
export const SCREENS = { apart: 2.6, width: 1.0, height: 0.6, bottom: 1.45 } as const;

/** One screen's match: the green pitch, its halfway line and centre, the boxes at either end, and the players as dots. */
function pitch(g: Group, x: number, y: number, z: number): void {
  const { width, height } = SCREENS;
  quad(g, width - 0.08, height - 0.08, x, y + 0.04, z, "green");
  quad(g, width - 0.16, height - 0.16, x, y + 0.08, z + 0.002, "pepper");
  quad(g, 0.012, height - 0.16, x, y + 0.08, z + 0.004, "white");
  for (const [dx, dy, w, h] of [
    [0, 0.27, 0.12, 0.012],
    [0, 0.33, 0.12, 0.012],
    [-0.06, 0.27, 0.012, 0.072],
    [0.06, 0.27, 0.012, 0.072],
  ] as const) quad(g, w, h, x + dx, y + dy - 0.03, z + 0.004, "white");
  for (const s of [-1, 1]) {
    quad(g, 0.012, 0.22, x + s * 0.34, y + 0.19, z + 0.004, "white");
    quad(g, 0.1, 0.012, x + s * 0.39, y + 0.19, z + 0.004, "white");
    quad(g, 0.1, 0.012, x + s * 0.39, y + 0.4, z + 0.004, "white");
  }
  const dots: [number, number, "red" | "white"][] = [[-0.2, 0.3, "red"], [0.12, 0.22, "white"], [0.25, 0.38, "red"], [-0.05, 0.42, "white"], [0.3, 0.16, "white"]];
  for (const [dx, dy, colour] of dots) quad(g, 0.025, 0.03, x + dx, y + dy, z + 0.006, colour);
}

/** Two screens on plank brackets, set against a wall behind them, and the stereo on its shelf between them. */
export function buildMatchTvs(): Group {
  const g = new Group();
  g.name = "prop_match-tvs";
  const { apart, width, height, bottom } = SCREENS;
  for (const s of [-1, 1]) {
    const x = (s * apart) / 2;
    // The plank bracket: a shelf on two diagonal braces, nailed to two uprights that stand on the floor against the wall.
    box(g, width + 0.1, 0.04, 0.32, x, bottom - 0.06, 0.16, "wood");
    for (const dx of [-0.35, 0.35]) {
      box(g, 0.07, bottom - 0.06, 0.05, x + dx, 0, 0.03, "darkWood");
      beam(g, [x + dx, bottom - 0.5, 0.04], [x + dx, bottom - 0.06, 0.3], 0.05, "darkWood");
    }
    // The screen standing on its foot, its pitch facing the room.
    box(g, 0.2, 0.06, 0.12, x, bottom - 0.02, 0.15, "black");
    box(g, width, height, 0.05, x, bottom + 0.02, 0.12, "black");
    pitch(g, x, bottom + 0.02, 0.146);
  }
  // The stereo on a lower shelf between them: the player and two speakers with their cones.
  box(g, 1.3, 0.04, 0.32, 0, 0.98, 0.16, "wood");
  for (const dx of [-0.5, 0.5]) box(g, 0.06, 0.98, 0.05, dx, 0, 0.05, "darkWood");
  box(g, 0.42, 0.14, 0.26, 0, 1.02, 0.14, "charcoal");
  quad(g, 0.3, 0.04, 0, 1.08, 0.271, "danfoYellow");
  for (const dx of [-0.45, 0.45]) {
    box(g, 0.26, 0.36, 0.24, dx, 1.02, 0.14, "black");
    const cone = cylinder(g, 0.08, 0.01, dx, 1.16, 0.262, "charcoal", 8);
    cone.rotation.x = Math.PI / 2;
  }
  return setFootprint(g, "none");
}

/** The benches' count, their length, the gap between their rows, and their seat's height. */
export const BENCHES = { rows: 3, length: 2.4, apart: 1.0, top: 0.42 } as const;

/** Plank benches in rows, two to a row, each a plank on three short legs, a cup or a phone left on one. */
export function buildViewingBenches(): Group {
  const g = new Group();
  g.name = "prop_viewing-benches";
  const { rows, length, apart, top } = BENCHES;
  for (let r = 0; r < rows; r++) {
    const z = r * apart;
    for (const s of [-1, 1]) {
      const x = s * (length / 2 + 0.25);
      box(g, length, 0.05, 0.3, x, top - 0.05, z, r % 2 === 0 ? "wood" : "tan");
      for (const dx of [-length / 2 + 0.15, 0, length / 2 - 0.15]) box(g, 0.06, top - 0.05, 0.24, x + dx, 0, z, "darkWood");
    }
  }
  box(g, 0.07, 0.1, 0.07, -1.9, top, apart, "white");
  box(g, 0.08, 0.015, 0.15, 1.2, top, 0, "black");
  // Nobody is kept off the benches: the young men sit on them.
  return setFootprint(g, "none");
}
