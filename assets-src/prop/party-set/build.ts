// The family house dressed for a send-off (offer.send-off-party, R-CITY-037): the banner on its
// frame of two poles with balloons tied on, the DJ's table with its cloth and laptop between two
// speakers on stands, the small chops table under a cream cloth with its trays, a cooler of cold
// drinks and crates of empties. The banner's words are an anchor with a text key (R-ASSET-012).
import { type PaletteName, setFootprint, type SignStyle } from "@japacity/assets";
import { box, clutter, cylinder, onWall, paletteMaterial, quad, signboard } from "@japacity/assets/kit";
import { Group, IcosahedronGeometry, Mesh, type Object3D } from "three";

/** Where the banner and the floor are, in the set's own frame: the banner at the back (-Z). */
export const PARTY_SET = { banner: { z: -2.5, width: 3.6, height: 0.8, bottom: 2.0 } } as const;

function balloon(g: Object3D, x: number, y: number, z: number, colour: PaletteName): void {
  const mesh = new Mesh(new IcosahedronGeometry(0.16, 0), paletteMaterial(colour));
  mesh.scale.set(1, 1.18, 1);
  mesh.position.set(x, y, z);
  g.add(mesh);
}

function speaker(g: Object3D, x: number, z: number): void {
  for (const [dx, dz] of [[-0.25, -0.2], [0.25, -0.2], [0, 0.28]] as const) {
    const leg = new Group();
    leg.position.set(x + dx * 0.1, 0, z + dz * 0.1);
    g.add(leg);
    box(leg, 0.03, 1.0, 0.03, dx, 0, dz, "black");
  }
  box(g, 0.48, 0.72, 0.4, x, 1.0, z, "black");
  const front = onWall(g, x, 1.0, z + 0.201);
  quad(front, 0.34, 0.34, 0, 0.08, 0.002, "charcoal");
  quad(front, 0.16, 0.12, 0, 0.5, 0.002, "charcoal");
  quad(front, 0.1, 0.1, 0, 0.2, 0.004, "hub");
}

export function buildPartySet(banner: string, style: SignStyle): Group {
  const g = new Group();
  g.name = "prop_party-set";
  const { z: bz, width, height, bottom } = PARTY_SET.banner;
  // The banner frame: two poles in the floor, the board between them, balloons tied at the tops.
  for (const side of [-1, 1]) {
    const x = side * (width / 2 + 0.08);
    cylinder(g, 0.035, bottom + height + 0.15, x, 0, bz, "white", 6);
    cylinder(g, 0.2, 0.06, x, 0, bz, "charcoal", 8);
    balloon(g, x - side * 0.05, bottom + height + 0.3, bz + 0.05, "gold");
    balloon(g, x + side * 0.16, bottom + height + 0.18, bz + 0.1, "white");
    balloon(g, x + side * 0.02, bottom + height + 0.05, bz + 0.2, "green");
  }
  box(g, width + 0.1, height + 0.1, 0.03, 0, bottom - 0.05, bz - 0.02, "wine");
  signboard(g, onWall(g, 0, 0, bz), banner, style, 0, bottom, width, height);
  // The DJ's corner: a table under a black cloth, a laptop and a mixer, a speaker either side.
  const dj = { x: 2.7, z: -1.9 };
  box(g, 1.5, 0.78, 0.65, dj.x, 0, dj.z, "canvas");
  quad(onWall(g, dj.x, 0, dj.z + 0.326), 1.3, 0.6, 0, 0.05, 0, "gold");
  box(g, 0.36, 0.02, 0.26, dj.x - 0.3, 0.78, dj.z, "hub");
  const lid = new Group();
  lid.position.set(dj.x - 0.3, 0.8, dj.z - 0.12);
  lid.rotation.x = -0.35;
  g.add(lid);
  box(lid, 0.36, 0.24, 0.015, 0, 0, 0, "hub");
  box(g, 0.4, 0.06, 0.3, dj.x + 0.3, 0.78, dj.z, "black");
  speaker(g, dj.x - 1.15, dj.z - 0.1);
  speaker(g, dj.x + 1.15, dj.z - 0.1);
  // The small chops table: a cream cloth to the floor and the trays on it.
  const chops = { x: -2.8, z: -1.9 };
  box(g, 1.6, 0.76, 0.7, chops.x, 0, chops.z, "cream");
  box(g, 1.64, 0.02, 0.74, chops.x, 0.76, chops.z, "white");
  for (const [dx, colour] of [[-0.5, "tomato"], [0, "gold"], [0.5, "pepper"]] as const) {
    box(g, 0.42, 0.04, 0.3, chops.x + dx, 0.78, chops.z, "hub");
    box(g, 0.32, 0.06, 0.22, chops.x + dx, 0.82, chops.z, colour);
  }
  box(g, 0.14, 0.26, 0.14, chops.x + 0.7, 0.78, chops.z + 0.15, "danfoYellow");
  // The cooler and the crates, by the steps.
  box(g, 0.8, 0.5, 0.5, 3.6, 0, 1.2, "basin");
  box(g, 0.84, 0.07, 0.54, 3.6, 0.5, 1.2, "white");
  clutter(g, "crates", 3.6, 0, 0.5);
  // The banner's poles, the DJ's table between its speakers, the chops table, the cooler and the crates; people pass under the banner.
  return setFootprint(g, [
    ...[-1, 1].map((side) => ({ x: side * (width / 2 + 0.08), z: bz, width: 0.4, depth: 0.4 })),
    { x: dj.x, z: dj.z - 0.05, width: 2.8, depth: 0.75 },
    { x: chops.x, z: chops.z, width: 1.64, depth: 0.74 },
    { x: 3.6, z: 1.2, width: 0.84, depth: 0.54 },
    { x: 3.64, z: 0.5, width: 0.58, depth: 0.36 },
  ]);
}
