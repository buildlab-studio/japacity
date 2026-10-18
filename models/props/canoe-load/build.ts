// The canoe of Makoko (city.md place.makoko) with what it carries along the channel: the same hull
// as the moored canoe, paddled by someone sitting low in it. One carries goods to sell (basins of
// fish and pepper, a sack, a jerrycan of kerosene); one carries children in their school shirts,
// bags on their backs, to the classroom on stilts. Everyone in it sits below the gunwale to the
// waist, so only a body, a head and the paddle show over the side. Built in the hull's frame, the
// bow toward +z; the stage sends these along their lanes on the shared clock (city:no-script-loop-per-sheet).
import { type PaletteName, setFootprint } from "@japacity/assets";
import { beam, box, cylinder, type Vec3 } from "@japacity/assets/kit";
import { Group } from "three";

import { facePlusZ, lump } from "../../vehicles/centred";
import { CANOE, canoeHull } from "../canoe/build";

/** How tall a seated body is from the seat to the shoulders, and its head's radius, for a grown person and a child. */
const BODY = {
  adult: { width: 0.38, chest: 0.5, deep: 0.22, head: 0.11 },
  child: { width: 0.26, chest: 0.34, deep: 0.16, head: 0.085 },
} as const;

/** Where people sit in the hull: low, on the floor or a block, so the gunwale comes to the waist. */
const SEAT_Y = 0.28;

interface Sitter {
  size: keyof typeof BODY;
  z: number;
  shirt: PaletteName;
  skin: PaletteName;
  /** A child's school bag on the back. */
  bag?: PaletteName;
  /** The side the paddle goes into the water, for whoever paddles. */
  paddle?: 1 | -1;
}

/** One person sitting in the canoe, facing the bow, with the paddle in both hands if they paddle. */
function sitter(g: Group, person: Sitter): void {
  const body = BODY[person.size];
  const top = SEAT_Y + body.chest;
  box(g, body.width, body.chest, body.deep, 0, SEAT_Y, person.z, person.shirt);
  box(g, body.width * 0.3, 0.06, body.deep * 0.6, 0, top, person.z, person.skin);
  lump(g, body.head, 0, top + 0.06 + body.head * 0.8, person.z, person.skin, [0.9, 1.05, 0.95]);
  lump(g, body.head * 0.95, 0, top + 0.06 + body.head * 1.25, person.z - 0.01, "hair", [0.95, 0.5, 0.95]);
  if (person.bag !== undefined) box(g, body.width * 0.8, body.chest * 0.6, 0.1, 0, SEAT_Y + body.chest * 0.3, person.z - body.deep / 2 - 0.05, person.bag);
  const side = person.paddle;
  if (side === undefined) {
    // Hands in the lap: the forearms forward over the knees.
    for (const s of [-1, 1]) beam(g, [s * body.width * 0.5, top - 0.06, person.z], [s * 0.08, SEAT_Y + 0.12, person.z + 0.22], 0.06, person.shirt);
    return;
  }
  // The paddle held across the body, its blade in the water on one side, both arms to its shaft.
  const grip: Vec3 = [-side * 0.12, top + 0.12, person.z + 0.12];
  // The blade dips to the water's level, never below the hull's floor at y = 0.
  const blade: Vec3 = [side * 0.62, 0.3, person.z - 0.3];
  beam(g, grip, blade, 0.04, "darkWood");
  box(g, 0.14, 0.32, 0.03, blade[0], 0, blade[2], "darkWood");
  beam(g, [-side * body.width * 0.5, top - 0.05, person.z], grip, 0.06, person.shirt);
  beam(g, [side * body.width * 0.5, top - 0.05, person.z], [side * 0.28, top - 0.2, person.z + 0.05], 0.06, person.shirt);
}

function finish(g: Group, name: string): Group {
  const root = facePlusZ(g, name, false);
  // The whole hull blocks the water it floats on: people sit in it from bow to stern.
  return setFootprint(root, [{ x: 0, z: 0, width: CANOE.beam, depth: CANOE.length }]);
}

/** Goods along the channel to sell from the canoe: basins of smoked fish and pepper, a sack, kerosene. */
export function buildCanoeGoods(): Group {
  const g = new Group();
  canoeHull(g);
  sitter(g, { size: "adult", z: -1.9, shirt: "wine", skin: "skin3", paddle: 1 });
  cylinder(g, 0.3, 0.16, 0, 0.1, 0.0, "basin", 10, 0.36);
  for (let i = 0; i < 5; i++) lump(g, 0.07, -0.12 + i * 0.06, 0.26, -0.06 + (i % 2) * 0.1, "darkWood", [1.6, 0.6, 0.8]);
  cylinder(g, 0.26, 0.14, 0.05, 0.1, 0.8, "red", 10, 0.3);
  for (let i = 0; i < 4; i++) lump(g, 0.06, -0.1 + i * 0.07, 0.24, 0.8 + (i % 2) * 0.06, i % 2 === 0 ? "tomato" : "pepper");
  lump(g, 0.22, 0.02, 0.24, 1.55, "khaki", [1.3, 0.9, 1.6]);
  box(g, 0.2, 0.34, 0.28, -0.12, 0.08, -1.25, "danfoYellow");
  return finish(g, "prop_canoe-goods");
}

const UNIFORM: PaletteName = "white";
const BAGS: PaletteName[] = ["red", "blue", "indigo", "wine"];

/** Children in their school shirts, bags on their backs, going to the classroom on stilts; a grown-up paddles at the stern. */
export function buildCanoeSchool(): Group {
  const g = new Group();
  canoeHull(g);
  sitter(g, { size: "adult", z: -2.0, shirt: "indigo", skin: "skin5", paddle: -1 });
  const children: [number, PaletteName][] = [[-0.95, "skin2"], [-0.2, "skin6"], [0.55, "skin4"], [1.3, "skin7"]];
  children.forEach(([z, skin], index) => sitter(g, { size: "child", z, shirt: UNIFORM, skin, bag: BAGS[index % BAGS.length] ?? "red" }));
  return finish(g, "prop_canoe-school");
}
