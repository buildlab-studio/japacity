// pnpm check:size (engine:first-download-has-budget): what a first visit downloads stays inside its budget.
// Builds the client in production mode into a folder of its own, with placeholder settings in the shape of a
// deploy's, takes the chunks the page loads before anything else (the entry and everything it imports
// statically, which the page's modulepreload links name), and compares each one's gzipped size with
// tools/check/size-budget.json. A chunk over its budget fails with its name and both numbers. Also fails when any of
// the admin page's code is in those chunks (moderation:admin-view-for-admin-list). Runs locally and in the check
// workflow; it reads and writes only local files and sends nothing anywhere.
//
// Usage: pnpm check:size
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { isMain, readJson, REPO_ROOT } from "../repo";

export const BUDGET_FILE = "tools/check/size-budget.json";

/** The parts a first visit downloads, each with its own budget, and their sum. */
export const PARTS = ["main", "three", "content-sim", "loader", "shared", "total"] as const;
export type Part = (typeof PARTS)[number];

/** One chunk as the client build's size report gives it (apps/client/vite/size.plugin.ts). */
export interface ReportChunk {
  file: string;
  isEntry: boolean;
  imports: string[];
  modules: string[];
}

export interface Budget {
  /** The largest gzipped size allowed, in bytes. */
  budget: number;
  /** The gzipped size measured when the budget was last set, in bytes. */
  measured: number;
}

export interface BudgetFile {
  about: string;
  parts: Record<Part, Budget>;
  /** One dated line for every change to a budget: "11 Oct 2026: ...". */
  changes: string[];
}

/** A budget is set at the measured size plus this share, in percent. */
export const HEADROOM_PERCENT = 5;

const THREE = /\/node_modules\/three\/build\//;
const SIM = /\/packages\/sim\/src\//;
const LOADER = /\/packages\/model-kit\/src\/load\.ts$|\/apps\/client\/src\/shared\/three\/load\.ts$/;
/** The admin page's modules. Only its address may be in the game's own chunks. */
const ADMIN = /\/apps\/client\/src\/features\/admin\//;
const ADMIN_ADDRESS = /\/apps\/client\/src\/features\/admin\/adminPath\.ts$/;
const DATED = /^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}: \S/;

/**
 * Which part a first-visit chunk is: the entry is the main chunk; then by what it holds: the simulation (with
 * the content beside it), three.js's core, the model loader. Any other chunk the entry imports (the bundler's
 * runtime, a library both the game and a later chunk share) is counted under `shared`.
 */
export function partOf(chunk: ReportChunk): Exclude<Part, "total"> {
  if (chunk.isEntry) return "main";
  if (chunk.modules.some((id) => SIM.test(id))) return "content-sim";
  if (chunk.modules.some((id) => THREE.test(id))) return "three";
  if (chunk.modules.some((id) => LOADER.test(id))) return "loader";
  return "shared";
}

/** The chunks a first visit downloads: every entry and, through static imports, everything it needs. */
export function firstVisit(chunks: readonly ReportChunk[]): ReportChunk[] {
  const byFile = new Map(chunks.map((chunk) => [chunk.file, chunk]));
  const seen = new Set<string>();
  const queue = chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.file);
  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    queue.push(...(byFile.get(file)?.imports ?? []));
  }
  return chunks.filter((chunk) => seen.has(chunk.file)).sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/** Each part's gzipped bytes, and the total, given each chunk's gzipped size. */
export function measure(chunks: readonly ReportChunk[], gzipped: (file: string) => number): Record<Part, number> {
  const sizes = Object.fromEntries(PARTS.map((part) => [part, 0])) as Record<Part, number>;
  for (const chunk of chunks) {
    const bytes = gzipped(chunk.file);
    sizes[partOf(chunk)] += bytes;
    sizes.total += bytes;
  }
  return sizes;
}

/** moderation:admin-view-for-admin-list: a line for every admin module in a first-visit chunk. */
export function adminInFirstVisit(chunks: readonly ReportChunk[]): string[] {
  return chunks.flatMap((chunk) =>
    chunk.modules.filter((id) => ADMIN.test(id) && !ADMIN_ADDRESS.test(id)).map((id) => `${chunk.file} holds ${id.slice(id.indexOf("apps/client/"))}: the admin page loads only at /admin.`),
  );
}

/** A line for every part over its budget, with both numbers. */
export function overBudget(sizes: Record<Part, number>, budgets: BudgetFile): string[] {
  return PARTS.filter((part) => sizes[part] > budgets.parts[part].budget).map(
    (part) => `${part}: ${String(sizes[part])} bytes gzipped, over its budget of ${String(budgets.parts[part].budget)} (measured ${String(budgets.parts[part].measured)} when it was set).`,
  );
}

/** What the budget file itself must hold: whole numbers, every budget at most its measured size plus the headroom, and a dated line for each change. */
export function budgetFileProblems(budgets: BudgetFile): string[] {
  const problems: string[] = [];
  for (const part of PARTS) {
    const entry = budgets.parts[part] as Budget | undefined;
    if (entry === undefined) {
      problems.push(`${part}: no budget.`);
      continue;
    }
    if (!Number.isSafeInteger(entry.budget) || !Number.isSafeInteger(entry.measured) || entry.budget < 0 || entry.measured < 0) problems.push(`${part}: the budget and the measured size are whole numbers of bytes.`);
    else if (entry.budget * 100 > entry.measured * (100 + HEADROOM_PERCENT)) problems.push(`${part}: the budget ${String(entry.budget)} is more than the measured ${String(entry.measured)} plus ${String(HEADROOM_PERCENT)} percent.`);
  }
  if (budgets.changes.length === 0) problems.push("The budget file has no dated line for its changes.");
  for (const line of budgets.changes) if (!DATED.test(line)) problems.push(`A change line starts with its date ("11 Oct 2026: ..."): ${line}`);
  return problems;
}

/** The size a budget is set at: the measured size plus the headroom, in whole bytes. */
export function budgetFor(measured: number): number {
  return Math.floor((measured * (100 + HEADROOM_PERCENT)) / 100);
}

/**
 * The build the check measures: production mode, into `outDir`, with placeholders in the shape of a deploy's
 * settings (a server address, Turnstile's published test key, no analytics tag), so a local settings file
 * never changes what is measured. Vite keeps a variable already set over one in a file.
 */
export function buildEnv(report: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "production",
    JAPACITY_SIZE_REPORT: report,
    JAPACITY_BUILD: "size-check",
    VITE_SERVER_URL: "https://example.com",
    VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    VITE_ANALYTICS_TOKEN: "",
    VITE_ALLOW_LOCAL_AUTHORITY: "",
    VITE_BUILD: "size-check",
  };
}

function main(): void {
  const budgets = readJson<BudgetFile>(join(REPO_ROOT, BUDGET_FILE));
  const problems = budgetFileProblems(budgets);
  const work = mkdtempSync(join(tmpdir(), "japacity-size-"));
  try {
    const outDir = join(work, "dist");
    const report = join(work, "chunks.json");
    const started = Date.now();
    const built = spawnSync("pnpm", ["--filter", "@japacity/client", "exec", "vite", "build", "--mode", "production", "--outDir", outDir, "--emptyOutDir", "--logLevel", "warn"], {
      cwd: REPO_ROOT,
      env: buildEnv(report),
      stdio: "inherit",
    });
    if (built.status !== 0) {
      console.log("The client did not build.");
      process.exit(built.status ?? 1);
    }
    const seconds = Math.round((Date.now() - started) / 1000);
    const { chunks } = readJson<{ chunks: ReportChunk[] }>(report);
    const first = firstVisit(chunks);
    const sizes = measure(first, (file) => gzipSync(readFileSync(join(outDir, file))).length);
    console.log(`Built in ${String(seconds)} s. A first visit downloads ${String(first.length)} script files:`);
    for (const chunk of first) console.log(`  ${partOf(chunk).padEnd(12)} ${chunk.file}`);
    for (const part of PARTS) {
      const { budget, measured } = budgets.parts[part];
      console.log(`${part.padEnd(12)} ${String(sizes[part]).padStart(8)} bytes gzipped   budget ${String(budget).padStart(8)}   measured when set ${String(measured).padStart(8)}`);
    }
    problems.push(...overBudget(sizes, budgets), ...adminInFirstVisit(first));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  if (problems.length > 0) {
    for (const problem of problems) console.log(`  ${problem}`);
    console.log(`\nThe size check failed. A budget is lowered on purpose and never raised quietly: ${BUDGET_FILE} says why, with a dated line.`);
    process.exit(1);
  }
  console.log("Every part of a first visit is inside its budget.");
}

if (isMain(import.meta.url)) main();
