import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fc, test } from "@fast-check/vitest";
import { afterEach, describe, expect } from "vitest";
import { evaluate, findCitations, findCitationsInSource, findDefinitions, run } from "./rules";

const fixtures = fileURLToPath(new URL("../__fixtures__/rules/", import.meta.url));
const ids = (citations: ReadonlyArray<{ id: string }>) => citations.map((citation) => citation.id);

describe("rule definitions", () => {
  test("plain, quoted and list definitions are found and underscore files are ignored", () => {
    const definitions = findDefinitions(join(fixtures, "passing", "docs", "rules"));
    expect([...definitions.keys()].sort()).toEqual(["R-MONEY-001", "R-MONEY-002", "R-STATUS-001", "R-STATUS-002"]);
    expect(definitions.get("R-STATUS-002")).toEqual([{ file: "status.md", line: 5 }]);
  });

  test("a missing rules folder has no definitions", () => {
    expect(findDefinitions(join(fixtures, "does-not-exist")).size).toBe(0);
  });
});

describe("test citations", () => {
  test("only test and it titles count, including property tests, and comments never count", () => {
    const citations = findCitations(join(fixtures, "passing"));
    expect(ids(citations).sort()).toEqual(["R-MONEY-001", "R-STATUS-001", "R-STATUS-002"]);
  });

  test("one title may cite several ids", () => {
    const source = `test("[R-A-001] and [R-B-002] together", () => {});`;
    expect(ids(findCitationsInSource("x.test.ts", source))).toEqual(["R-A-001", "R-B-002"]);
  });

  test("skipped, todo and interpolated titles do not count", () => {
    const source = [
      `test.skip("[R-A-001] skipped", () => {});`,
      `it.todo("[R-A-002] todo");`,
      "test(`[R-A-003] ${name}`, () => {});",
      `test.skipIf(true)("[R-A-004] conditional", () => {});`,
    ].join("\n");
    expect(findCitationsInSource("x.test.ts", source)).toEqual([]);
  });

  test("each, concurrent and curried forms count once with their line", () => {
    const source = [
      `test.each([1, 2])("[R-A-001] each %i", () => {});`,
      `it.concurrent("[R-A-002] concurrent", async () => {});`,
      `test.prop([arb])("[R-A-003] property", () => true);`,
    ].join("\n");
    expect(findCitationsInSource("x.test.ts", source)).toEqual([
      { id: "R-A-001", file: "x.test.ts", line: 1 },
      { id: "R-A-002", file: "x.test.ts", line: 2 },
      { id: "R-A-003", file: "x.test.ts", line: 3 },
    ]);
  });
});

describe("rule id property", () => {
  const ruleId = fc
    .tuple(fc.stringMatching(/^[A-Z][A-Z0-9]{0,8}$/), fc.integer({ min: 0, max: 999 }))
    .map(([kind, number]) => `R-${kind}-${String(number).padStart(3, "0")}`);

  test.prop([ruleId, fc.string(), fc.string()])("any well-formed id in brackets in a title is cited", (id, before, after) => {
    const title = JSON.stringify(`${before.replaceAll("[", "")} [${id}] ${after.replaceAll("[", "")}`);
    expect(ids(findCitationsInSource("x.test.ts", `test(${title}, () => {});`))).toEqual([id]);
  });
});

describe("evaluation", () => {
  test("a fully traced fixture passes with a one-line summary", () => {
    expect(run(join(fixtures, "passing"), { writePending: false })).toEqual({
      code: 0,
      output: ["rules: 4 defined, 3 tested, 1 pending"],
    });
  });

  test("no rules at all passes with zeros", () => {
    expect(run(join(fixtures, "empty"), { writePending: false }).output).toEqual([
      "rules: 0 defined, 0 tested, 0 pending",
    ]);
    expect(run(join(fixtures, "does-not-exist"), { writePending: false }).code).toBe(0);
  });

  test("every kind of problem is reported", () => {
    const root = join(fixtures, "failing");
    const report = evaluate(findDefinitions(join(root, "docs", "rules"), root), findCitations(root), [
      "R-DONE-001",
      "R-GONE-001",
    ]);
    expect(report.problems).toEqual([
      "R-DUP-001 is defined more than once: docs/rules/a.md:1, docs/rules/b.md:1",
      "src/a.test.ts:7 cites R-MISSING-001, which is not defined in docs/rules",
      "R-DONE-001 now has a test. Remove it from tools/rules-pending.json",
      "R-GONE-001 is in tools/rules-pending.json but is not defined. Remove it from the list",
      "R-UNTESTED-001 (docs/rules/a.md:3) has no test citing [R-UNTESTED-001]",
    ]);
    expect(run(root, { writePending: false }).code).toBe(1);
  });
});

describe("write pending", () => {
  let scratch: string | undefined;
  afterEach(() => {
    if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
  });

  test("the pending list is rewritten to exactly the untested ids, sorted", () => {
    scratch = mkdtempSync(join(tmpdir(), "check-rules-"));
    cpSync(join(fixtures, "failing"), scratch, { recursive: true });
    const result = run(scratch, { writePending: true });
    expect(JSON.parse(readFileSync(join(scratch, "tools", "rules-pending.json"), "utf8"))).toEqual(["R-UNTESTED-001"]);
    // The duplicate and the undefined citation are still errors after a rewrite.
    expect(result.code).toBe(1);
  });
});
