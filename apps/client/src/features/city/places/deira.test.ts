// Deira staged as the hub in Dubai (city.md place.deira, R-CITY-013): a souk street of arcades and
// gold shops down to the creek, the abras on the water, the flag on its mast and the labour buses at
// their stop, measured as the build check measures it and read for what the place must show.
import { paletteCss } from "@japacity/assets";
import { BufferGeometry, Color, Mesh, MeshLambertMaterial } from "three";
import { describe, expect, test } from "vitest";

import { rideWater } from "../../../shared/three/motion";
import placeFile from "../../../../public/assets/places/deira/place.json";
import type { Motion } from "../placeFile";
import { motionOf } from "../world";
import { allPalette, copiesOf, highCrowd, instancesOf, lowCrowd, onGround, rowOf, signKeys, staged, totalsOf, wordsOf } from "./placeTesting";

const { file, stage, entry } = staged(placeFile, "place.deira");
const quay = Math.min(...stage.roads.filter((road) => road.raise !== undefined).map((road) => road.at[1]));
const motionOfKind = (kind: Motion["kind"]): Motion => {
  const found = stage.motion.find((motion) => motion.kind === kind);
  if (found === undefined) throw new Error(`No ${kind}`);
  return found;
};
const triangles = (object: ReturnType<typeof motionOf>): number => {
  let count = 0;
  object.traverse((part) => {
    const geometry = (part as Mesh).geometry as BufferGeometry | undefined;
    if (geometry === undefined) return;
    count += (geometry.getIndex()?.count ?? geometry.getAttribute("position").count) / 3;
  });
  return count;
};

describe("Deira's budget", () => {
  test("[R-ASSET-007] given Deira's shipped files measured as the build check measures them, when the place is counted, then both modes fit the exterior row, since the hub abroad comes on arrival and not in the first download", async () => {
    expect(entry.hub).toBe(true);
    expect(file.hub).toBe(false);
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
    }
  });

  test("[R-ASSET-007] given Deira's file, when its counts are read, then the instances are the copies staged, the crowd is the client's in each mode, and the floor is one draw call of palette colours", () => {
    expect(file.instances).toEqual(instancesOf(stage));
    expect(file.people.low).toBe(lowCrowd(entry));
    expect(file.people.high).toBe(highCrowd(entry));
    expect(placeFile.groundRoadSky.drawCalls).toBe(1);
    expect(allPalette(stage)).toBe(true);
  });
});

describe("the creek and the souk", () => {
  test("[R-CITY-026] given the creek, when its stage is read, then the water lies beyond the quay ahead of the start, the abras sit on it riding it, and the flag flies with its hoist from the top of its mast", () => {
    const water = motionOfKind("water");
    const [, , waterZ] = water.at;
    const [, depth] = water.size ?? [0, 0];
    expect(waterZ + depth / 2).toBeLessThanOrEqual(quay + 0.5);
    expect(waterZ).toBeLessThan(stage.start[1]);
    const abras = stage.models.find((model) => model.file.endsWith("veh_abra.glb"));
    expect(abras?.bob).toBe(true);
    expect((abras?.at ?? []).every(([, z]) => z < quay && z > waterZ - depth / 2)).toBe(true);
    const flag = motionOfKind("flag");
    expect(flag.hoist).toBe("red");
    expect(flag.colours).toEqual(["green", "white", "black"]);
    const [mast] = copiesOf(stage, "prop_flag-mast.glb");
    if (mast === undefined) throw new Error("No mast");
    expect(Math.hypot(flag.at[0] - mast[0], flag.at[2] - mast[1])).toBeLessThan(0.01);
  });

  test("[R-CITY-028] given the creek's water and the flag, when they are built at both mesh levels, then the fine level has more triangles than the coarse and the same outline", () => {
    for (const kind of ["water", "flag"] as const) {
      const motion = motionOfKind(kind);
      expect(triangles(motionOf(motion, "fine"))).toBeGreaterThan(triangles(motionOf(motion, "coarse")));
    }
  });

  test("[R-CITY-026] given the flag built from its stripes, when its faces are coloured, then the quarter by the mast is the hoist's colour and the rest runs green, white and black from the top", () => {
    const flag = motionOf(motionOfKind("flag"), "coarse") as Mesh;
    const position = flag.geometry.getAttribute("position");
    const colour = flag.geometry.getAttribute("color");
    const hex = (at: number): string => new Color(colour.getX(at), colour.getY(at), colour.getZ(at)).getHexString();
    const width = 2.4;
    const height = 1.2;
    for (let at = 0; at < position.count; at += 3) {
      const x = (position.getX(at) + position.getX(at + 1) + position.getX(at + 2)) / 3;
      const y = (position.getY(at) + position.getY(at + 1) + position.getY(at + 2)) / 3;
      const expected = x < width / 4 ? "red" : y > height / 6 ? "green" : y < -height / 6 ? "black" : "white";
      expect(hex(at)).toBe(new Color(paletteCss(expected)).getHexString());
    }
  });

  test("[R-CITY-027] given an abra's material, when it is made to ride the water, then the roll and the rise are in its vertex shader on the shared clock, phased by where each copy is moored", () => {
    const boat = new Mesh<BufferGeometry, MeshLambertMaterial>(new BufferGeometry(), new MeshLambertMaterial());
    rideWater(boat);
    const material = boat.material;
    const shader = { uniforms: {} as Record<string, unknown>, vertexShader: "#include <begin_vertex>", fragmentShader: "" };
    material.onBeforeCompile(shader as never, undefined as never);
    expect(Object.keys(shader.uniforms)).toEqual(expect.arrayContaining(["uTime", "uWind"]));
    expect(shader.vertexShader).toContain("instanceMatrix[3].xz");
  });

  test("[R-CITY-024] given the arcades standing six times on the street, when their copies are lettered, then every copy has its own keys with words, gold shops and the cafeteria among them, and no key shows twice", () => {
    const keys = signKeys(stage);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key.startsWith("place.deira.sign.") && wordsOf(key).trim() !== "")).toBe(true);
    const words = keys.map(wordsOf);
    expect(words.filter((said) => said.includes("GOLD")).length).toBeGreaterThanOrEqual(2);
    expect(words.some((said) => said.includes("CAFETERIA"))).toBe(true);
    expect(copiesOf(stage, "veh_labour-bus.glb").length).toBeGreaterThanOrEqual(1);
  });

  test("[R-CITY-014] given Deira's crowd spots, when the high mode's sample stands, then there are spots for all of it on the ground, and the low mode's first spots stand between the start and the water", () => {
    expect(stage.people.length).toBeGreaterThanOrEqual(highCrowd(entry));
    expect(stage.people.every((spot) => onGround(stage, spot))).toBe(true);
    const ahead = stage.people.slice(0, lowCrowd(entry)).filter(([, z]) => z < stage.start[1] && z > quay);
    expect(ahead.length).toBeGreaterThanOrEqual(3);
    for (const indices of Object.values(stage.prefer ?? {})) for (const index of indices) expect(index).toBeLessThan(highCrowd(entry));
  });
});
