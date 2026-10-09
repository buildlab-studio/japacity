// The family house (city.md place.family-house, R-CITY-037): a bungalow on its own plot behind a
// fence wall, the kind the starting lives grew up in. The front of the house is a deep veranda under
// the roof, open to the yard between its pillars, where visitors sit and a send-off party dances;
// the rooms are behind its back wall. The yard holds the gate and its notice, the small generator
// under a zinc shade, a tank on its stand, the posts of the washing line and the water drums.
import { setFootprint, type SignStyle } from "@japacity/assets";
import {
  barredWindow,
  box,
  clutter,
  dish,
  door,
  fenceWall,
  floorQuad,
  gate,
  generator,
  hipRoof,
  KIT_SIZES,
  onWall,
  posters,
  quad,
  seeded,
  signboard,
  stain,
  tank,
} from "@japacity/assets/kit";
import { Group } from "three";

/** The plot and the house in metres, in the model's frame: the plot is centred on the origin, the gate at +Z. */
export const FAMILY_HOUSE = {
  plot: [15, 31] as const,
  house: { width: 10.4, back: -14.5, front: -1.5, walls: 3.0 },
  veranda: { back: -7.5, pillars: [-5.05, -2.6, 2.6, 5.05] as const },
  gateX: 3.4,
} as const;

export function buildFamilyHouse(notice: string, style: SignStyle, dishYaw: number): Group {
  const g = new Group();
  g.name = "bld_family-house";
  const random = seeded(1962);
  const [plotW, plotD] = FAMILY_HOUSE.plot;
  const { width: w, back, front, walls } = FAMILY_HOUSE.house;
  const veranda = FAMILY_HOUSE.veranda.back;
  const half = w / 2;
  const rooms = veranda - back;

  // The rooms behind the veranda, their windows barred, a worn band where the rain splashes.
  box(g, w, walls, rooms, 0, 0, (back + veranda) / 2, "wallPeach");
  const face = onWall(g, 0, 0, veranda);
  door(face, -1.6, 0, true, "darkWood");
  barredWindow(face, 1.4, 0);
  barredWindow(face, 3.7, 0);
  barredWindow(face, -3.9, 0);
  quad(face, 0.34, 0.34, 0.1, 2.25, 0.012, "white");
  quad(face, 0.04, 0.12, 0.1, 2.38, 0.016, "black");
  stain(face, 0, 0, w, 0.5, "wallPeachWorn");
  for (const [x, ry] of [[-half, -Math.PI / 2], [half, Math.PI / 2]] as const) {
    const side = onWall(g, x, 0, (back + veranda) / 2, ry);
    barredWindow(side, -1.8, 0);
    barredWindow(side, 1.8, 0);
    stain(side, 0, 0, rooms, 0.6, "wallPeachWorn");
  }
  const rear = onWall(g, 0, 0, back, Math.PI);
  for (const x of [-3, 0.4, 3]) barredWindow(rear, x, 0);
  stain(rear, 0, 0, w, 0.6, "wallPeachWorn");

  // The veranda: a tiled floor, its two end walls, the ceiling and the lintel on four pillars. The grout
  // lines stand a clear centimetre over the tiles so the two never fight (docs/rules/world.md R-WORLD-012).
  const deep = front - veranda;
  floorQuad(g, w, deep, 0, 0.012, (front + veranda) / 2, "wallCream");
  for (let x = -half + 0.6; x < half; x += 0.6) floorQuad(g, 0.025, deep, x, 0.024, (front + veranda) / 2, "wallCreamWorn");
  for (let z = veranda + 0.6; z < front; z += 0.6) floorQuad(g, w, 0.025, 0, 0.024, z, "wallCreamWorn");
  for (const x of [-half + 0.1, half - 0.1]) {
    box(g, 0.2, walls, deep - 1.2, x, 0, veranda + (deep - 1.2) / 2, "wallPeach");
  }
  box(g, w, 0.12, deep + 0.3, 0, walls, (front + veranda) / 2 + 0.15, "cream");
  box(g, w + 0.1, 0.35, 0.3, 0, walls - 0.3, front, "wallPeach");
  for (const x of FAMILY_HOUSE.veranda.pillars) {
    box(g, 0.3, walls - 0.3, 0.3, x, 0, front, "white");
    box(g, 0.4, 0.15, 0.4, x, 0, front, "wallCreamWorn");
  }
  stain(onWall(g, 0, 0, front + 0.151), 0, walls - 0.3, w + 0.1, 0.12, "wallPeachWorn");

  // The roof over rooms and veranda, a fascia board, and the dish on the ridge side facing the satellite.
  const roofTop = hipRoof(g, w, front - back, 0, walls + 0.12, (front + back) / 2, "roofBlue", 24);
  box(g, w + 1.3, 0.22, 0.05, 0, walls - 0.12, front + 0.62, "white");
  dish(g, onWall(g, -half, 0, back + 2.4, -Math.PI / 2), 0, walls - 0.95, 0.3, dishYaw + Math.PI / 2);

  // The fence wall round the plot, the gate and its pedestrian door at the front, the notice on its face.
  const plotHalfW = plotW / 2;
  const plotHalfD = plotD / 2;
  fenceWall(onWall(g, 0, 0, -plotHalfD), -plotHalfW, plotHalfW, 0, "wallCream");
  for (const [x, ry] of [[-plotHalfW, -Math.PI / 2], [plotHalfW, Math.PI / 2]] as const) fenceWall(onWall(g, x, 0, 0, ry), -plotHalfD, plotHalfD, 0, "wallCream");
  const gateW = KIT_SIZES.gate.widthMin + 0.4;
  const gateX = FAMILY_HOUSE.gateX;
  const street = onWall(g, 0, 0, plotHalfD);
  fenceWall(street, -plotHalfW, gateX - gateW / 2 - 0.3, 0, "wallCream");
  fenceWall(street, gateX + gateW / 2 + 0.3, plotHalfW, 0, "wallCream");
  gate(street, gateX, 0, gateW, KIT_SIZES.gate.heightMin + 0.2, "green");
  const outside = onWall(g, 0, 0, plotHalfD + 0.09);
  signboard(g, outside, notice, style, -3.4, 1.0, 2.6, 0.72);
  stain(outside, -1.5, 0, plotW * 0.75, 0.55, "wallCreamWorn");
  stain(onWall(g, 0, 0, plotHalfD - 0.09, Math.PI), 0, 0, plotW, 0.5, "wallCreamWorn");
  posters(onWall(g, plotHalfW + 0.09, 0, plotHalfD - 3, Math.PI / 2), -0.5, 1.1, random, 2);

  // The small generator by the gate under a lean-to of zinc on four posts, its cable to the house.
  const genX = plotHalfW - 1.4;
  const genZ = plotHalfD - 3.4;
  generator(g, genX, 0, genZ, false, -Math.PI / 2, "red");
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]] as const) box(g, 0.06, 1.5 - (dx > 0 ? 0.25 : 0), 0.06, genX + dx, 0, genZ + dz, "black");
  const shade = new Group();
  shade.position.set(genX, 1.38, genZ);
  shade.rotation.z = -0.2;
  g.add(shade);
  box(shade, 1.6, 0.04, 1.6, 0, 0, 0, "zinc");
  box(g, 0.05, 0.05, Math.abs(genZ - front), genX - 0.3, 0.02, (genZ + front) / 2, "black");

  // The tank on its stand at the back corner, the water drums and jerrycans by the side wall.
  tank(g, half + 0.9, 0, back + 0.9, true, 3.4, "black");
  clutter(g, "drum", -half - 0.6, 0, veranda + 1.2);
  clutter(g, "drum", -half - 0.6, 0, veranda + 1.9);
  clutter(g, "jerrycans", -half - 0.9, 0, veranda - 1.0);

  // The washing line's two posts down the left of the yard.
  for (const z of [1.0, 9.0]) box(g, 0.08, 2.1, 0.08, -plotHalfW + 0.9, 0, z, "darkWood");

  g.userData.top = roofTop;
  g.userData.clutter = ["tank", "dish", "generator", "bars", "stains", "notice", "wires"];
  // The rooms, the veranda's end walls and pillars, the fence wall and its gate, the generator's
  // shade, the tank, the drums and jerrycans and the washing posts; the yard and the veranda's floor are open.
  const fence = 0.3;
  const leftRun = gateX - gateW / 2 - 0.3 + plotHalfW;
  const rightRun = plotHalfW - (gateX + gateW / 2 + 0.3);
  return setFootprint(g, [
    { x: 0, z: (back + veranda) / 2, width: w, depth: rooms },
    ...[-half + 0.1, half - 0.1].map((x) => ({ x, z: veranda + (deep - 1.2) / 2, width: 0.2, depth: deep - 1.2 })),
    ...FAMILY_HOUSE.veranda.pillars.map((x) => ({ x, z: front, width: 0.4, depth: 0.4 })),
    { x: 0, z: -plotHalfD, width: plotW, depth: fence },
    ...[-plotHalfW, plotHalfW].map((x) => ({ x, z: 0, width: fence, depth: plotD })),
    { x: -plotHalfW + leftRun / 2, z: plotHalfD, width: leftRun, depth: fence },
    { x: plotHalfW - rightRun / 2, z: plotHalfD, width: rightRun, depth: fence },
    { x: gateX, z: plotHalfD, width: gateW + 0.6, depth: fence },
    { x: genX, z: genZ, width: 1.3, depth: 1.3 },
    { x: half + 0.9, z: back + 0.9, width: 1.5, depth: 1.5 },
    { x: -half - 0.6, z: veranda + 1.55, width: 0.6, depth: 1.3 },
    { x: -half - 0.68, z: veranda - 1.0, width: 0.62, depth: 0.3 },
    ...[1.0, 9.0].map((z) => ({ x: -plotHalfW + 0.9, z, width: 0.1, depth: 0.1 })),
  ]);
}
