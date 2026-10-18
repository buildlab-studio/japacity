import { ESLint } from "eslint";
import { beforeAll, describe, expect, test } from "vitest";

import { REPO_ROOT } from "../tools/repo";

// Proves the purity rules in eslint.config.js actually fire. Each fixture in
// __fixtures__/lint/sim is linted as if it lived in packages/sim/src.

const expectations: ReadonlyArray<readonly [fixture: string, rule: string | null]> = [
  ["date-now.ts", "no-restricted-globals"],
  ["new-date.ts", "no-restricted-globals"],
  ["global-this.ts", "no-restricted-globals"],
  ["set-timeout.ts", "no-restricted-globals"],
  ["fetch.ts", "no-restricted-globals"],
  ["console.ts", "no-restricted-globals"],
  ["math-random.ts", "no-restricted-properties"],
  ["math-sin.ts", "no-restricted-properties"],
  ["divide.ts", "no-restricted-syntax"],
  ["divide-assign.ts", "no-restricted-syntax"],
  ["power.ts", "no-restricted-syntax"],
  ["decimal.ts", "no-restricted-syntax"],
  ["exponent.ts", "no-restricted-syntax"],
  ["node-import.ts", "no-restricted-imports"],
  ["package-import.ts", "no-restricted-imports"],
  ["focused.test.ts", "vitest/no-focused-tests"],
  ["skipped.test.ts", "vitest/no-disabled-tests"],
  ["todo.test.ts", "vitest/warn-todo"],
  ["clean.ts", null],
  ["clean.test.ts", null],
  ["engine/int.ts", null],
];

const rulesByFixture = new Map<string, string[]>();

beforeAll(async () => {
  // ignore: false lets ESLint see the fixtures, which `pnpm lint` skips.
  const eslint = new ESLint({ cwd: REPO_ROOT, ignore: false });
  const files = expectations.map(([fixture]) => `tools/__fixtures__/lint/sim/${fixture}`);
  const results = await eslint.lintFiles(files);
  for (const result of results) {
    const fixture = result.filePath.split("__fixtures__/lint/sim/")[1] ?? result.filePath;
    const rules = result.messages.map((message) => message.ruleId ?? `fatal: ${message.message}`);
    rulesByFixture.set(fixture, [...new Set(rules)]);
  }
}, 120_000);

describe("simulation lint rules", () => {
  const cases = expectations.map(([fixture, rule]) => ({ fixture, rule, expected: rule ?? "nothing" }));
  test.each(cases)("$fixture is reported by $expected", ({ fixture, rule }) => {
    expect(rulesByFixture.get(fixture)).toEqual(rule === null ? [] : [rule]);
  });
});
