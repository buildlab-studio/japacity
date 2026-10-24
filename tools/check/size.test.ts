import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { readJson, REPO_ROOT } from "../repo";
import { adminInFirstVisit, BUDGET_FILE, budgetFileProblems, budgetFor, type BudgetFile, buildEnv, firstVisit, measure, overBudget, partOf, PARTS, type ReportChunk } from "./size";

const ROOT = "/repo";
const module = (path: string): string => `${ROOT}/${path}`;

/** A build shaped as the client's is: the entry, its static imports, and a chunk loaded later. */
const BUILD: ReportChunk[] = [
  { file: "assets/index.js", isEntry: true, imports: ["assets/runtime.js", "assets/three.js", "assets/sim.js", "assets/load.js"], modules: [module("apps/client/src/main.tsx"), module("apps/client/src/features/admin/adminPath.ts")] },
  { file: "assets/runtime.js", isEntry: false, imports: [], modules: ["\0rolldown/runtime.js"] },
  { file: "assets/three.js", isEntry: false, imports: ["assets/runtime.js"], modules: [module("node_modules/.pnpm/three@0.186.1/node_modules/three/build/three.core.js")] },
  { file: "assets/sim.js", isEntry: false, imports: [], modules: [module("packages/content/src/index.ts"), module("packages/sim/src/index.ts")] },
  { file: "assets/load.js", isEntry: false, imports: ["assets/three.js"], modules: [module("node_modules/.pnpm/three@0.186.1/node_modules/three/examples/jsm/loaders/GLTFLoader.js"), module("packages/model-kit/src/load.ts")] },
  { file: "assets/AdminRoute.js", isEntry: false, imports: ["assets/index.js"], modules: [module("apps/client/src/features/admin/AdminPage.tsx")] },
];

const SIZES: Record<string, number> = { "assets/index.js": 300, "assets/runtime.js": 4, "assets/three.js": 200, "assets/sim.js": 250, "assets/load.js": 25, "assets/AdminRoute.js": 14 };

function budgets(budget: number): BudgetFile {
  return {
    about: "",
    parts: Object.fromEntries(PARTS.map((part) => [part, { budget, measured: budget }])) as BudgetFile["parts"],
    changes: ["total set for the test."],
  };
}

describe("the size check", () => {
  test("[engine:first-download-has-budget] given a build, when its first visit is taken, then it is the entry and everything the entry imports, never a chunk loaded later", () => {
    const first = firstVisit(BUILD).map((chunk) => chunk.file);
    expect(first).toEqual(["assets/index.js", "assets/load.js", "assets/runtime.js", "assets/sim.js", "assets/three.js"]);
    expect(first).not.toContain("assets/AdminRoute.js");
  });

  test("[engine:first-download-has-budget] given the first visit's chunks, then each is named by what it holds and the total is their sum", () => {
    const first = firstVisit(BUILD);
    expect(Object.fromEntries(first.map((chunk) => [chunk.file, partOf(chunk)]))).toEqual({
      "assets/index.js": "main",
      "assets/runtime.js": "shared",
      "assets/three.js": "three",
      "assets/sim.js": "content-sim",
      "assets/load.js": "loader",
    });
    expect(measure(first, (file) => SIZES[file] ?? 0)).toEqual({ main: 300, three: 200, "content-sim": 250, loader: 25, shared: 4, total: 779 });
  });

  test("[engine:first-download-has-budget] given a part one byte over its budget, then the check names it with both numbers; at its budget it passes", () => {
    const sizes = measure(firstVisit(BUILD), (file) => SIZES[file] ?? 0);
    const file = budgets(1000);
    file.parts.main = { budget: 299, measured: 285 };
    expect(overBudget(sizes, file)).toEqual(["main: 300 bytes gzipped, over its budget of 299 (measured 285 when it was set)."]);
    file.parts.main = { budget: 300, measured: 286 };
    expect(overBudget(sizes, file)).toEqual([]);
  });

  test("[engine:first-download-has-budget] given a budget set above the measured size plus five percent, a fraction, a change line with no part or no reason, a dated one, or none, then the budget file is refused", () => {
    expect(budgetFor(1000)).toBe(1050);
    expect(budgetFor(999)).toBe(1048);
    const file = budgets(1000);
    expect(budgetFileProblems(file)).toEqual([]);
    file.parts.three = { budget: 1051, measured: 1000 };
    file.parts.loader = { budget: 10.5, measured: 10 };
    file.changes = ["Raised because it grew.", "main raised to 1050.", "11 Oct 2026: main raised to 1050 for the test."];
    expect(budgetFileProblems(file)).toEqual([
      "three: the budget 1051 is more than the measured 1000 plus 5 percent.",
      "loader: the budget and the measured size are whole numbers of bytes.",
      'A change line names the part that moved and says what for ("main raised to 1050 for ..."), with no date: Raised because it grew.',
      'A change line names the part that moved and says what for ("main raised to 1050 for ..."), with no date: main raised to 1050.',
      'A change line names the part that moved and says what for ("main raised to 1050 for ..."), with no date: 11 Oct 2026: main raised to 1050 for the test.',
    ]);
    expect(budgetFileProblems({ ...budgets(1000), changes: [] })).toEqual(["The budget file has no line for its changes."]);
  });

  test("[engine:first-download-has-budget] given the committed budget file, then every budget is a whole number at most its measured size plus five percent, and every change names its part and what it was for", () => {
    const file = readJson<BudgetFile>(join(REPO_ROOT, BUDGET_FILE));
    expect(budgetFileProblems(file)).toEqual([]);
    expect(Object.keys(file.parts).sort()).toEqual([...PARTS].sort());
  });

  test("[engine:first-download-has-budget] given a local settings file, then the measured build takes placeholders in a deploy's shape, never a value of its own", () => {
    const env = buildEnv("/tmp/report.json");
    expect(env.VITE_SERVER_URL).toBe("https://example.com");
    expect(env.VITE_ALLOW_LOCAL_AUTHORITY).toBe("");
    expect(env.VITE_ANALYTICS_TOKEN).toBe("");
    expect(env.JAPACITY_SIZE_REPORT).toBe("/tmp/report.json");
  });

  test("[moderation:admin-view-for-admin-list] given the admin page in a first-visit chunk, then the size check names it; its address alone may stay", () => {
    expect(adminInFirstVisit(firstVisit(BUILD))).toEqual([]);
    const leaked = BUILD.map((chunk) => (chunk.isEntry ? { ...chunk, modules: [...chunk.modules, module("apps/client/src/features/admin/AdminPage.tsx")] } : chunk));
    expect(adminInFirstVisit(firstVisit(leaked))).toEqual(["assets/index.js holds apps/client/src/features/admin/AdminPage.tsx: the admin page loads only at /admin."]);
  });
});
