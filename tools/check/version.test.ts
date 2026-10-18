import { join } from "node:path";

import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { readJson, REPO_ROOT } from "../repo";
import { checkSeal, fingerprint, played, printed, resealed, SEAL_FILE, type Seal, simSources, type SourceFile, stableJson } from "./version";

const STEP: SourceFile = {
  path: "engine/step.ts",
  text: ["// Steps one command.", "export function step(state: number, by: number): number {", "  return state + by;", "}", ""].join("\n"),
};
const KIND: SourceFile = { path: "turn/turn.logic.ts", text: "export const CAP = 3;\n" };
const DATA = { version: "1", tuning: { turn: { cap: 3, refill: 2 } }, route: { "route.a": { fee: 100 } } };

/** The version and fingerprint of `data` and `sources`, as the check reads them. */
function now(data: { version: string }, sources: readonly SourceFile[]): { version: string; fingerprint: string } {
  return { version: data.version, fingerprint: fingerprint(data, sources) };
}

const sealed = now(DATA, [STEP, KIND]);

describe("the content version's seal", () => {
  test("[R-SERVER-048] given the committed seal, when it is read, then it names the content's version and a sha-256 fingerprint", () => {
    const seal = readJson<Seal>(join(REPO_ROOT, SEAL_FILE));
    expect(seal.version).toBe(content.version);
    expect(seal.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  test("[R-SERVER-048] given a comment added, reworded or removed in the simulation, and the layout changed, when fingerprinted, then the check passes", () => {
    const commented: SourceFile = {
      ...STEP,
      text: ["// Steps one command, and only one.", "/** The sum. */", "export function step(state: number, by: number): number {", "", "    return state + by; // added", "}", ""].join("\n"),
    };
    const bare: SourceFile = { ...STEP, text: "export function step(state: number, by: number): number { return state + by; }" };
    expect(printed(commented)).toBe(printed(STEP));
    expect(checkSeal(now(DATA, [commented, KIND]), sealed)).toEqual([]);
    expect(checkSeal(now(DATA, [bare, KIND]), sealed)).toEqual([]);
    const oneLine: SourceFile = { path: "turn/turn.data.ts", text: "export const TABLE = { a: 1, b: [2, 3] };\nswitch (TABLE.a) { case 1: break; }\n" };
    const spread: SourceFile = { path: "turn/turn.data.ts", text: "export const TABLE = {\n  // The first.\n  a: 1,\n  b: [\n    2,\n    3,\n  ],\n};\nswitch (TABLE.a) {\n  case 1:\n    break;\n}\n" };
    expect(printed(spread)).toBe(printed(oneLine));
  });

  test("[R-SERVER-048] given a test, a test helper or a tool's folder in the simulation's source, when the played files are listed, then none of them is read, and every kind's logic is", () => {
    expect(["engine/step.test.ts", "japacity/japacity.fixtures.ts", "sweep/players.ts", "testing/play.ts", "goldens/index.ts", "goldens/ada-careful.json", "engine/types.d.ts"].filter(played)).toEqual([]);
    expect(["engine/step.ts", "turn/turn.logic.ts", "world/standIn.ts", "index.ts"].every(played)).toBe(true);
    const paths = simSources().map((file) => file.path);
    expect(paths).toContain("engine/step.ts");
    expect(paths).toContain("turn/turn.logic.ts");
    expect(paths.filter((path) => !played(path))).toEqual([]);
    expect(paths).toEqual([...paths].sort());
  });

  test("[R-SERVER-048] given the same content with its keys in another order, or with only its version changed, when fingerprinted, then the fingerprint is the same", () => {
    const reordered = { route: { "route.a": { fee: 100 } }, tuning: { turn: { refill: 2, cap: 3 } }, version: "1" };
    expect(stableJson(reordered)).toBe(stableJson(DATA));
    expect(fingerprint(reordered, [STEP, KIND])).toBe(sealed.fingerprint);
    expect(fingerprint({ ...DATA, version: "2" }, [STEP, KIND])).toBe(sealed.fingerprint);
  });

  test("[R-SERVER-048] given a tuning number changed in the content and the version not, when checked, then it fails and says to raise the version, add the old content to the older bundles if lives exist under it, and seal", () => {
    const tuned = { ...DATA, tuning: { turn: { cap: 4, refill: 2 } } };
    const problems = checkSeal(now(tuned, [STEP, KIND]), sealed);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('the content version did not: it is still "1"');
    expect(problems[0]).toContain("Raise `version` in packages/content/src/index.ts by one");
    expect(problems[0]).toContain("`olderContents`");
    expect(problems[0]).toContain("pnpm content:seal");
  });

  test("[R-SERVER-048] given the simulation's logic or a number in its code changed and the version not, when checked, then it fails", () => {
    const logic: SourceFile = { ...STEP, text: STEP.text.replace("state + by", "state - by") };
    const number: SourceFile = { ...KIND, text: "export const CAP = 4;\n" };
    const added: SourceFile = { path: "turn/turn.extra.ts", text: "export const EXTRA = 1;\n" };
    expect(checkSeal(now(DATA, [logic, KIND]), sealed)).toHaveLength(1);
    expect(checkSeal(now(DATA, [STEP, number]), sealed)).toHaveLength(1);
    expect(checkSeal(now(DATA, [STEP, KIND, added]), sealed)).toHaveLength(1);
    expect(checkSeal(now(DATA, [STEP]), sealed)).toHaveLength(1);
  });

  test("[R-SERVER-048] given a changed content and the same version, when sealed, then the seal is refused; after the version is raised by one and sealed, then the check passes", () => {
    const tuned = { ...DATA, version: "1", tuning: { turn: { cap: 4, refill: 2 } } };
    const refused = resealed(now(tuned, [STEP, KIND]), { ...sealed });
    expect(refused).toMatchObject({ ok: false });
    const bumped = now({ ...tuned, version: "2" }, [STEP, KIND]);
    expect(checkSeal(bumped, sealed)).toEqual(['The content version is "2" and the seal names "1". Run pnpm content:seal to seal "2".']);
    const result = resealed(bumped, sealed);
    if (!result.ok) throw new Error(result.problem);
    expect(result.seal).toMatchObject({ version: "2", fingerprint: bumped.fingerprint });
    expect(checkSeal(bumped, result.seal)).toEqual([]);
  });

  test("[R-SERVER-048] given an unchanged content and simulation, when sealed again under the same version, then the seal is the same; a version that is not a whole number from 1, or below the seal's, is refused", () => {
    const again = resealed(sealed, sealed);
    if (!again.ok) throw new Error(again.problem);
    expect(again.seal).toMatchObject(sealed);
    expect(resealed({ ...sealed, version: "m1" }, sealed)).toMatchObject({ ok: false });
    expect(resealed({ ...sealed, version: "0" }, sealed)).toMatchObject({ ok: false });
    expect(checkSeal({ ...sealed, version: "1.1" }, sealed)).toHaveLength(1);
    const two = { ...sealed, version: "2" };
    expect(resealed(sealed, two)).toMatchObject({ ok: false });
    expect(checkSeal(sealed, two)).toEqual(['The content version "1" is not above the sealed "2".']);
  });

  test("[R-SERVER-048] given a value that is not plain data in the content, when serialized, then it throws", () => {
    expect(() => stableJson({ a: () => 1 })).toThrow(/not plain data/);
    expect(() => stableJson({ a: new Map() })).toThrow(/not plain data/);
    expect(() => stableJson({ a: Number.NaN })).toThrow(/JSON cannot keep/);
  });
});
