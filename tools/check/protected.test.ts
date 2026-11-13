import { describe, expect, test } from "vitest";
import {
  addedPendingNames,
  countChecks,
  findProtectedChanges,
  isGolden,
  isTestFile,
  parseNameStatus,
  type Change,
  type ReadFile,
} from "./protected";

const nothing: ReadFile = () => null;
const paths = (changes: ReturnType<typeof findProtectedChanges>) => changes.map(({ change }) => change.path);
/** A reader with the given files at the base and at the head. */
const files =
  (base: Record<string, string>, head: Record<string, string>): ReadFile =>
  (side, path) =>
    (side === "base" ? base : head)[path] ?? null;

const TWO_TESTS = `
describe("money", () => {
  test("a", () => {
    expect(1).toBe(1);
    expect(2).toBe(2);
  });
  it("b", () => {
    expect.soft(3).toBe(3);
  });
});
`;

describe("name-status parsing", () => {
  test("plain, renamed and copied lines are parsed", () => {
    const output = ["M\tpackages/sim/src/a.ts", "R087\told.test.ts\tnew.test.ts", "C100\ta.ts\tb.ts", ""].join("\n");
    expect(parseNameStatus(output)).toEqual([
      { status: "M", from: "packages/sim/src/a.ts", path: "packages/sim/src/a.ts" },
      { status: "R", from: "old.test.ts", path: "new.test.ts" },
      { status: "C", from: "a.ts", path: "b.ts" },
    ]);
  });
});

describe("which files are tests and goldens", () => {
  test.each(["packages/sim/src/money/money.test.ts", "apps/client/src/app/App.test.tsx"])("%s is a test file", (path) => {
    expect(isTestFile(path)).toBe(true);
  });

  test.each(["packages/sim/src/testing.ts", "apps/client/e2e/map.spec.ts", "tools/check/protected.ts"])("%s is not a test file", (path) => {
    expect(isTestFile(path)).toBe(false);
  });

  test.each(["goldens/nurse.json", "packages/sim/src/scenarios/goldens/nurse.json"])("%s is a golden", (path) => {
    expect(isGolden(path)).toBe(true);
  });

  test.each(["tools/goldens/bless.ts", "packages/sim/src/goldens.ts"])("%s is not a golden", (path) => {
    expect(isGolden(path)).toBe(false);
  });
});

describe("counting a test file's checks", () => {
  test("each test and it call, and each expect call with or without a modifier, is counted", () => {
    expect(countChecks(TWO_TESTS)).toEqual({ tests: 2, assertions: 3 });
  });

  test("a table counts once, and describe, split and a method named expect are not counted", () => {
    const source = `
describe("x", () => {
  test.each([1, 2, 3])("row %s", (n) => { expect(n).toBeGreaterThan(0); });
  const parts = "a b".split(" ");
  harness.expect(parts);
});
`;
    expect(countChecks(source)).toEqual({ tests: 1, assertions: 1 });
  });

  test("commented-out tests and assertions are not counted", () => {
    const source = `
test("kept", () => {
  expect(1).toBe(1);
  // expect(2).toBe(2);
  /* expect(3).toBe(3); */
});
// test("gone", () => {});
`;
    expect(countChecks(source)).toEqual({ tests: 1, assertions: 1 });
  });
});

describe("which changes need approval", () => {
  test("an edit to a test that keeps its tests and assertions needs no approval", () => {
    const edited = TWO_TESTS.replace("toBe(1)", "toBe(400)");
    const change: Change = { status: "M", from: "a.test.ts", path: "a.test.ts" };
    expect(findProtectedChanges([change], files({ "a.test.ts": TWO_TESTS }, { "a.test.ts": edited }))).toEqual([]);
  });

  test("an edit that adds tests or assertions needs no approval", () => {
    const more = TWO_TESTS.replace(`expect(2).toBe(2);`, `expect(2).toBe(2);\n    expect(4).toBe(4);`);
    const change: Change = { status: "M", from: "a.test.ts", path: "a.test.ts" };
    expect(findProtectedChanges([change], files({ "a.test.ts": TWO_TESTS }, { "a.test.ts": more }))).toEqual([]);
  });

  test("an edit that removes an assertion needs approval, and says how many went", () => {
    const fewer = TWO_TESTS.replace(`    expect(2).toBe(2);\n`, "");
    const change: Change = { status: "M", from: "a.test.ts", path: "a.test.ts" };
    expect(findProtectedChanges([change], files({ "a.test.ts": TWO_TESTS }, { "a.test.ts": fewer }))).toEqual([
      { change, reason: "fewer assertions 3 to 2" },
    ]);
  });

  test("an edit that removes a test needs approval, and names both counts that fell", () => {
    const fewer = TWO_TESTS.replace(/ {2}it\("b"[\s\S]*?\}\);\n/, "");
    const change: Change = { status: "M", from: "a.test.ts", path: "a.test.ts" };
    expect(findProtectedChanges([change], files({ "a.test.ts": TWO_TESTS }, { "a.test.ts": fewer }))).toEqual([
      { change, reason: "fewer tests 2 to 1, assertions 3 to 2" },
    ]);
  });

  test("a deleted test file, or one renamed to a name that is not a test, needs approval", () => {
    const changes: Change[] = [
      { status: "D", from: "b.test.ts", path: "b.test.ts" },
      { status: "R", from: "c.test.ts", path: "c.ts" },
    ];
    expect(findProtectedChanges(changes, nothing)).toEqual([
      { change: changes[0], reason: "test file deleted" },
      { change: changes[1], reason: "test file deleted" },
    ]);
  });

  test("a test file renamed with its checks needs no approval; renamed with fewer, it does", () => {
    const change: Change = { status: "R", from: "c.test.ts", path: "c-renamed.test.ts" };
    const fewer = TWO_TESTS.replace(`    expect(2).toBe(2);\n`, "");
    expect(findProtectedChanges([change], files({ "c.test.ts": TWO_TESTS }, { "c-renamed.test.ts": TWO_TESTS }))).toEqual([]);
    expect(paths(findProtectedChanges([change], files({ "c.test.ts": TWO_TESTS }, { "c-renamed.test.ts": fewer })))).toEqual([
      "c-renamed.test.ts",
    ]);
  });

  test("any change to a golden needs approval; added and copied files, and code, need none", () => {
    const changes: Change[] = [
      { status: "M", from: "goldens/d.json", path: "goldens/d.json" },
      { status: "T", from: "goldens/e.json", path: "goldens/e.json" },
      { status: "A", from: "f.test.ts", path: "f.test.ts" },
      { status: "A", from: "goldens/g.json", path: "goldens/g.json" },
      { status: "C", from: "a.test.ts", path: "h.test.ts" },
      { status: "M", from: "logic.ts", path: "logic.ts" },
      { status: "M", from: "eslint.config.js", path: "eslint.config.js" },
    ];
    expect(paths(findProtectedChanges(changes, nothing))).toEqual(["goldens/d.json", "goldens/e.json"]);
  });

  test("the pending list may shrink freely but may not grow", () => {
    const change: Change = { status: "M", from: "tools/rules-pending.json", path: "tools/rules-pending.json" };
    const shrink = files({ "tools/rules-pending.json": `["a:first-rule","a:second-rule"]` }, { "tools/rules-pending.json": `["a:first-rule"]` });
    const grow = files({ "tools/rules-pending.json": `["a:first-rule"]` }, { "tools/rules-pending.json": `["a:first-rule","b:first-rule"]` });
    expect(findProtectedChanges([change], shrink)).toEqual([]);
    expect(findProtectedChanges([change], grow)).toEqual([{ change, reason: "pending rules list gained b:first-rule" }]);
    expect(findProtectedChanges([{ ...change, status: "D" }], nothing)).toEqual([]);
  });

  test("added pending names are found whichever side is missing", () => {
    expect(addedPendingNames(null, `["a:first-rule"]`)).toEqual(["a:first-rule"]);
    expect(addedPendingNames(`["a:first-rule"]`, null)).toEqual([]);
    expect(addedPendingNames(`[]`, `[]`)).toEqual([]);
  });
});
