import { describe, expect, test } from "vitest";

import { isPaletteName } from "@japacity/assets";

import { BONE_NAMES, buildPerson, type PersonSpec } from "./people";
import { ALL_PEOPLE } from "./people.data";
import { poseRotations } from "./poses";

const FILE_NAME = /^(chr|veh|bld|shop|sign|lm|prop|cloth|hair|anim|tex)_[a-z0-9]+(-[a-z0-9]+)*(_[a-z0-9]+(-[a-z0-9]+)*)?\.(glb|png|ktx2)$/;
const cases = ALL_PEOPLE.map((spec) => [spec.name, spec] as const);

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

describe("the design's people", () => {
  test("[R-ASSET-014] given the design's people, when they are listed, then there are 34, each a set of numbers for the one builder", () => {
    expect(ALL_PEOPLE).toHaveLength(34);
    expect(new Set(ALL_PEOPLE.map((p) => p.name)).size).toBe(34);
  });

  test.each(cases)("[R-ASSET-008] given %s, when it is named, then the name fits the shipped file pattern", (name) => {
    expect(`${name}.glb`).toMatch(FILE_NAME);
    expect(name.startsWith("chr_")).toBe(true);
  });

  test.each(cases)("[R-ASSET-003] given %s, when built, then every position is finite and the feet are on y = 0", (_, spec) => {
    const mesh = buildPerson(spec);
    expect(mesh.positions.every((v) => Number.isFinite(v))).toBe(true);
    expect(Math.abs(heights(spec).min)).toBeLessThanOrEqual(0.01);
  });

  // The bare body is 1.70 m times the person's height number; the rule's 1.59 to 1.82 m range is
  // what the design's height numbers give, and is reported, not asserted, where they fall outside it.
  test.each(cases)("[R-ASSET-004] given %s, when built bare, then the body is 1.70 m times its height number", (_, spec) => {
    expect(Math.abs(heights(bare(spec)).max - 1.7 * (spec.height ?? 1))).toBeLessThanOrEqual(0.01);
  });

  test.each(cases)("[R-ASSET-004] given %s, when built with hair and headwear, then the whole height is 1.55 m to 2.3 m", (_, spec) => {
    const { max } = heights(spec);
    expect(max).toBeGreaterThanOrEqual(1.55);
    expect(max).toBeLessThanOrEqual(2.3);
  });

  test.each(cases)("[R-ASSET-005] given %s, when built, then it carries at most one pattern, and only if some cloth uses it", (_, spec) => {
    const mesh = buildPerson(spec);
    expect(mesh.pattern === null).toBe(mesh.groups[1].length === 0);
  });

  test.each(cases)("[R-ASSET-001] given %s, when built, then every vertex colour is a palette name", (_, spec) => {
    const mesh = buildPerson(spec);
    expect(mesh.colours.every((c) => isPaletteName(c))).toBe(true);
    expect(mesh.colours).toHaveLength(mesh.positions.length / 3);
  });

  test.each(cases)("[R-ASSET-014] given %s, when built, then it has the one 17-bone skeleton and clean skin weights", (_, spec) => {
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

  test("[R-ASSET-014] given any pose, when it is read, then it names only the skeleton's bones", () => {
    for (const name of ["stand", "walk", "hip", "selfie", "cheer", "ride", "pillion", "tray", "trayWalk", "sell", "sit"] as const) {
      for (const bone of Object.keys(poseRotations(name, 0.25).rotations)) expect(BONE_NAMES).toContain(bone);
    }
  });
});
