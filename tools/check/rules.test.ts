import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fc, test } from "@fast-check/vitest";
import { afterEach, describe, expect } from "vitest";
import { evaluate, findCitations, findCitationsInSource, findDefinitions, pageOf, run } from "./rules";
import { readJson } from "../repo";

const fixtures = fileURLToPath(new URL("../__fixtures__/rules/", import.meta.url));
const names = (citations: ReadonlyArray<{ name: string }>) => citations.map((citation) => citation.name);

describe("rule definitions", () => {
  test("plain, quoted and list definitions are found and underscore files are ignored", () => {
    const definitions = findDefinitions(join(fixtures, "passing", "docs", "rules"));
    expect([...definitions.names.keys()].sort()).toEqual([
      "status:listed-rule",
      "status:numbered-rule",
      "status:plain-paragraph-rule",
      "status:quoted-rule",
    ]);
    expect(definitions.names.get("status:quoted-rule")).toEqual([{ file: "status.md", line: 5 }]);
    expect(definitions.malformed).toEqual([]);
  });

  test("a bold that opens a line like a definition but is no rule name is kept as malformed", () => {
    const root = join(fixtures, "failing");
    expect(findDefinitions(join(root, "docs", "rules"), root).malformed).toEqual([
      { text: "A:Shouting-Name", file: "docs/rules/a.md", line: 7 },
      { text: "R-OLD-001.", file: "docs/rules/a.md", line: 9 },
    ]);
  });

  test("a missing rules folder has no definitions", () => {
    expect(findDefinitions(join(fixtures, "does-not-exist")).names.size).toBe(0);
  });

  test("a name's page is the part before the colon", () => {
    expect(pageOf("abroad-money:salary-abroad-taxed-locally")).toBe("abroad-money");
  });
});

describe("test citations", () => {
  test("only test and it titles count, including property tests, and comments never count", () => {
    const citations = findCitations(join(fixtures, "passing"));
    expect(names(citations).sort()).toEqual(["status:listed-rule", "status:plain-paragraph-rule", "status:quoted-rule"]);
  });

  test("one title may cite several names", () => {
    const source = `test("[a:first-rule] and [b:second-rule] together", () => {});`;
    expect(names(findCitationsInSource("x.test.ts", source))).toEqual(["a:first-rule", "b:second-rule"]);
  });

  test("a bracket that holds no well-formed name is not a citation", () => {
    const source = `test("[A:Upper] [a:] [:slug] [a b:c] [R-A-001] [a:slug-] [route-gates:sponsor-needed] given", () => {});`;
    expect(names(findCitationsInSource("x.test.ts", source))).toEqual(["route-gates:sponsor-needed"]);
  });

  test("skipped, todo and interpolated titles do not count", () => {
    const source = [
      `test.skip("[a:first-rule] skipped", () => {});`,
      `it.todo("[a:second-rule] todo");`,
      "test(`[a:third-rule] ${name}`, () => {});",
      `test.skipIf(true)("[a:fourth-rule] conditional", () => {});`,
    ].join("\n");
    expect(findCitationsInSource("x.test.ts", source)).toEqual([]);
  });

  test("each, concurrent and curried forms count once with their line", () => {
    const source = [
      `test.each([1, 2])("[a:first-rule] each %i", () => {});`,
      `it.concurrent("[a:second-rule] concurrent", async () => {});`,
      `test.prop([arb])("[a:third-rule] property", () => true);`,
    ].join("\n");
    expect(findCitationsInSource("x.test.ts", source)).toEqual([
      { name: "a:first-rule", file: "x.test.ts", line: 1 },
      { name: "a:second-rule", file: "x.test.ts", line: 2 },
      { name: "a:third-rule", file: "x.test.ts", line: 3 },
    ]);
  });
});

describe("rule name property", () => {
  const word = fc.stringMatching(/^[a-z0-9]{1,8}$/);
  const ruleName = fc
    .tuple(fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/), fc.array(word, { maxLength: 1 }), fc.array(word, { minLength: 1, maxLength: 5 }))
    .map(([head, rest, slug]) => `${[head, ...rest].join("-")}:${slug.join("-")}`);

  test.prop([ruleName, fc.string(), fc.string()])("any well-formed name in brackets in a title is cited", (name, before, after) => {
    const title = JSON.stringify(`${before.replaceAll("[", "")} [${name}] ${after.replaceAll("[", "")}`);
    expect(names(findCitationsInSource("x.test.ts", `test(${title}, () => {});`))).toEqual([name]);
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
      "a:pending-now-tested",
      "a:gone-from-pages",
    ]);
    expect(report.problems).toEqual([
      "docs/rules/a.md:7 opens with **A:Shouting-Name**, which is not a rule name of the form page:slug",
      "docs/rules/a.md:9 opens with **R-OLD-001.**, which is not a rule name of the form page:slug",
      "a:defined-twice is defined more than once: docs/rules/a.md:1, docs/rules/b.md:1",
      "a:defined-twice is defined in docs/rules/b.md:1, but its name says a.md",
      "src/a.test.ts:7 cites a:never-defined, which is not defined in docs/rules",
      "a:pending-now-tested now has a test. Remove it from tools/rules-pending.json",
      "a:gone-from-pages is in tools/rules-pending.json but is not defined. Remove it from the list",
      "a:untested-rule (docs/rules/a.md:3) has no test citing [a:untested-rule]",
    ]);
    expect(run(root, { writePending: false }).code).toBe(1);
  });

  test("a name listed twice as pending is reported", () => {
    const root = join(fixtures, "passing");
    const report = evaluate(findDefinitions(join(root, "docs", "rules"), root), findCitations(root), [
      "status:numbered-rule",
      "status:numbered-rule",
    ]);
    expect(report.problems).toEqual(["status:numbered-rule is listed twice in tools/rules-pending.json"]);
  });
});

describe("write pending", () => {
  let scratch: string | undefined;
  afterEach(() => {
    if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
  });

  test("the pending list is rewritten to exactly the untested names, sorted", () => {
    scratch = mkdtempSync(join(tmpdir(), "check-rules-"));
    cpSync(join(fixtures, "failing"), scratch, { recursive: true });
    const result = run(scratch, { writePending: true });
    expect(readJson(join(scratch, "tools", "rules-pending.json"))).toEqual(["a:untested-rule"]);
    // The duplicate and the undefined citation are still errors after a rewrite.
    expect(result.code).toBe(1);
  });
});
