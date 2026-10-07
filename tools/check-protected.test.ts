import { describe, expect, test } from "vitest";
import {
  addedPendingIds,
  findProtectedChanges,
  parseNameStatus,
  protectedReason,
  type Change,
} from "./check-protected";

const noPending = () => null;
const paths = (changes: ReturnType<typeof findProtectedChanges>) => changes.map(({ change }) => change.path);

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

describe("protected paths", () => {
  test.each([
    ["packages/sim/src/money/money.test.ts", "test file"],
    ["apps/client/src/App.test.tsx", "test file"],
    ["goldens/nurse.json", "golden file"],
    ["packages/sim/src/scenarios/goldens/nurse.json", "golden file"],
    ["packages/sim/src/route/route.schema.ts", "schema"],
    ["eslint.config.js", "lint config"],
    ["tools/rules-pending.json", "pending rules list"],
  ])("%s is protected as a %s", (path, reason) => {
    expect(protectedReason(path)).toBe(reason);
  });

  test.each([
    "packages/sim/src/route/route.logic.ts",
    "packages/sim/src/testing.ts",
    "packages/sim/src/goldens.ts",
    "apps/eslint.config.js",
    "docs/rules/status.md",
  ])("%s is not protected", (path) => {
    expect(protectedReason(path)).toBeNull();
  });
});

describe("which changes need approval", () => {
  test("modified, deleted, renamed and type-changed protected files need approval, added ones do not", () => {
    const changes: Change[] = [
      { status: "M", from: "a.test.ts", path: "a.test.ts" },
      { status: "D", from: "b.test.ts", path: "b.test.ts" },
      { status: "R", from: "c.test.ts", path: "c-renamed.test.ts" },
      { status: "T", from: "goldens/d.json", path: "goldens/d.json" },
      { status: "A", from: "e.test.ts", path: "e.test.ts" },
      { status: "C", from: "a.test.ts", path: "f.test.ts" },
      { status: "M", from: "logic.ts", path: "logic.ts" },
    ];
    expect(paths(findProtectedChanges(changes, noPending))).toEqual([
      "a.test.ts",
      "b.test.ts",
      "c-renamed.test.ts",
      "goldens/d.json",
    ]);
  });

  test("renaming a file into a protected name needs approval", () => {
    const changes: Change[] = [{ status: "R", from: "helper.ts", path: "helper.test.ts" }];
    expect(paths(findProtectedChanges(changes, noPending))).toEqual(["helper.test.ts"]);
  });

  test("the pending list may shrink freely but may not grow", () => {
    const change: Change = { status: "M", from: "tools/rules-pending.json", path: "tools/rules-pending.json" };
    const shrink = (side: "base" | "head") => (side === "base" ? `["R-A-001","R-A-002"]` : `["R-A-001"]`);
    const grow = (side: "base" | "head") => (side === "base" ? `["R-A-001"]` : `["R-A-001","R-B-001"]`);
    expect(findProtectedChanges([change], shrink)).toEqual([]);
    expect(findProtectedChanges([change], grow)).toEqual([
      { change, reason: "pending rules list gained R-B-001" },
    ]);
    expect(findProtectedChanges([{ ...change, status: "D" }], noPending)).toEqual([]);
  });

  test("added pending ids are found whichever side is missing", () => {
    expect(addedPendingIds(null, `["R-A-001"]`)).toEqual(["R-A-001"]);
    expect(addedPendingIds(`["R-A-001"]`, null)).toEqual([]);
    expect(addedPendingIds(`[]`, `[]`)).toEqual([]);
  });
});
