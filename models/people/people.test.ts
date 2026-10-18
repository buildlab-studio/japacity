import { beforeAll, describe, expect, test } from "vitest";

import { isPaletteName } from "@japacity/model-kit";

import { BONE_NAMES, buildPerson as build, type PersonSpec } from "./people";
import { ALL_PEOPLE } from "./people.data";
import { poseRotations } from "./poses";

const FILE_NAME = /^(chr|veh|bld|shop|sign|lm|prop|cloth|hair|anim|tex)_[a-z0-9]+(-[a-z0-9]+)*(_[a-z0-9]+(-[a-z0-9]+)*)?\.(glb|png|ktx2)$/;
const cases = ALL_PEOPLE.map((spec) => [spec.name, spec] as const);

// Blending soft shapes takes a moment, so each person is built once, dressed and bare.
const built = new Map<string, ReturnType<typeof build>>();
function buildPerson(spec: PersonSpec): ReturnType<typeof build> {
  const key = JSON.stringify(spec);
  let mesh = built.get(key);
  if (mesh === undefined) {
    mesh = build(spec);
    built.set(key, mesh);
  }
  return mesh;
}

function heights(spec: PersonSpec): { min: number; max: number } {
  const ys = buildPerson(spec).positions.filter((_, i) => i % 3 === 1);
  return { min: Math.min(...ys), max: Math.max(...ys) };
}

/** The same person with nothing on the head: no hair, no headwear, no load. */
function bare(spec: PersonSpec): PersonSpec {
  const rest = { ...spec };
  delete rest.hair;
  delete rest.head;
  delete rest.carry;
  return rest;
}

describe("the people", () => {
  beforeAll(() => {
    for (const spec of ALL_PEOPLE) {
      buildPerson(spec);
      buildPerson(bare(spec));
    }
  }, 120_000);

  test("[assets:variants-are-numbers-not-code] given the people, when they are listed, then there are 34, each a set of numbers for the one builder", () => {
    expect(ALL_PEOPLE).toHaveLength(34);
    expect(new Set(ALL_PEOPLE.map((p) => p.name)).size).toBe(34);
  });

  test.each(cases)("[assets:shipped-file-naming] given %s, when it is named, then the name fits the shipped file pattern", (name) => {
    expect(`${name}.glb`).toMatch(FILE_NAME);
    expect(name.startsWith("chr_")).toBe(true);
  });

  test.each(cases)("[assets:metre-units-and-origin] given %s, when built, then every position is finite and the feet are on y = 0", (_, spec) => {
    const mesh = buildPerson(spec);
    expect(mesh.positions.every((v) => Number.isFinite(v))).toBe(true);
    expect(Math.abs(heights(spec).min)).toBeLessThanOrEqual(0.01);
  });

  test.each(cases)("[assets:people-and-door-sizes] given %s, when built bare, then the body is 1.70 m times its height number", (_, spec) => {
    expect(Math.abs(heights(bare(spec)).max - 1.7 * (spec.height ?? 1))).toBeLessThanOrEqual(0.01);
  });

  test.each(cases)("[assets:people-and-door-sizes] given %s, when built bare, then the body stands 1.59 m to 1.82 m", (_, spec) => {
    const { max } = heights(bare(spec));
    expect(max).toBeGreaterThanOrEqual(1.59);
    expect(max).toBeLessThanOrEqual(1.82);
  });

  test.each(cases)("[assets:flat-and-smooth-shading] given %s, when built, then the head, hair, headwear and hands are smooth and every other triangle flat", (_, spec) => {
    const mesh = buildPerson(spec);
    const n = (i: number): [number, number, number] => [mesh.normals[i * 3] ?? 0, mesh.normals[i * 3 + 1] ?? 0, mesh.normals[i * 3 + 2] ?? 0];
    expect(mesh.normals).toHaveLength(mesh.positions.length);
    for (let i = 0; i < mesh.normals.length / 3; i++) expect(Math.abs(Math.hypot(...n(i)) - 1)).toBeLessThanOrEqual(1e-6);
    const expected = ["hands", "head", ...(spec.hair !== undefined || spec.beard === true ? ["hair"] : []), ...(spec.head !== undefined ? ["headwear"] : [])];
    expect(mesh.smooth.filter((part) => part !== "load" && part !== "robe")).toEqual(expected.sort());
    // A flat triangle owns its three vertices, each carrying its face's normal; a smooth one shares them.
    const uses = new Map<number, number>();
    for (const group of mesh.groups) for (const v of group) uses.set(v, (uses.get(v) ?? 0) + 1);
    let flat = 0;
    for (const group of mesh.groups) {
      for (let t = 0; t < group.length; t += 3) {
        const tri = [group[t] ?? 0, group[t + 1] ?? 0, group[t + 2] ?? 0];
        if (!tri.every((v) => uses.get(v) === 1)) continue;
        flat += 1;
        const [a, b, c] = tri.map(n);
        expect(a).toEqual(b);
        expect(b).toEqual(c);
      }
    }
    expect(flat).toBeGreaterThan(100);
  });

  test.each(cases)("[assets:assets-and-places-within-budget] given %s, when built, then it stays at or under 80% of a person's 3,000 triangles", (_, spec) => {
    const mesh = buildPerson(spec);
    expect((mesh.groups[0].length + mesh.groups[1].length) / 3).toBeLessThanOrEqual(2400);
  });

  test.each(cases)("[assets:people-and-door-sizes] given %s, when built with hair and headwear, then the whole height is 1.55 m to 2.3 m", (_, spec) => {
    const { max } = heights(spec);
    expect(max).toBeGreaterThanOrEqual(1.55);
    expect(max).toBeLessThanOrEqual(2.3);
  });

  test.each(cases)("[assets:flat-and-smooth-shading] given %s, when built, then it carries at most one pattern, and only if some cloth uses it", (_, spec) => {
    const mesh = buildPerson(spec);
    expect(mesh.pattern === null).toBe(mesh.groups[1].length === 0);
  });

  test.each(cases)("[assets:colours-from-named-palette] given %s, when built, then every vertex colour is a palette name", (_, spec) => {
    const mesh = buildPerson(spec);
    expect(mesh.colours.every((c) => isPaletteName(c))).toBe(true);
    expect(mesh.colours).toHaveLength(mesh.positions.length / 3);
  });

  test.each(cases)("[assets:variants-are-numbers-not-code] given %s, when built, then it has the one 17-bone skeleton and clean skin weights", (_, spec) => {
    const mesh = buildPerson(spec);
    expect(mesh.bones.map((b) => b.name)).toEqual([...BONE_NAMES]);
    for (let i = 0; i < mesh.weights.length; i += 4) {
      const w = mesh.weights.slice(i, i + 4);
      expect(Math.abs(w.reduce((a, c) => a + c, 0) - 1)).toBeLessThanOrEqual(1e-5);
      expect(mesh.joints.slice(i, i + 4).every((j) => j >= 0 && j < 17)).toBe(true);
    }
    const count = mesh.positions.length / 3;
    for (const group of mesh.groups) expect(group.every((i) => i >= 0 && i < count)).toBe(true);
  });

  test("[assets:variants-are-numbers-not-code] given any pose, when it is read, then it names only the skeleton's bones", () => {
    for (const name of ["stand", "walk", "hip", "selfie", "cheer", "ride", "pillion", "tray", "trayWalk", "sell", "sit"] as const) {
      for (const bone of Object.keys(poseRotations(name, 0.25).rotations)) expect(BONE_NAMES).toContain(bone);
    }
  });
});
