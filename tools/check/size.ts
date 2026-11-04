// pnpm check:size (engine:first-download-has-budget): what a first visit downloads stays inside its budget.
// Builds the client in production mode into a folder of its own, with placeholder settings in the shape of a
// deploy's, takes the chunks the page loads before anything else (the entry and everything it imports
// statically, which the page's modulepreload links name), and compares each one's gzipped size with
// tools/check/size-budget.json. A chunk over its budget fails with its name and both numbers. Also fails when any of
// the admin page's code (moderation:admin-view-for-admin-list) or of the life's screens (app/Life.tsx and the features it draws) is in
// those chunks, which are the start screen's. Prints, without a budget, the life's screens fetched after it and the whole game. Runs locally and in the check
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
export const PARTS = ["main", "three", "content-sim", "loader", "react", "shared", "total"] as const;
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
  /** One line for every change to a budget: the part that moved and what for, "main raised to 1050 for ...". Git keeps the date. */
  changes: string[];
}

/** A budget is set at the measured size plus this share, in percent. */
export const HEADROOM_PERCENT = 5;

const THREE = /\/node_modules\/three\/build\//;
const SIM = /\/packages\/sim\/src\//;
const LOADER = /\/packages\/model-kit\/src\/load\.ts$|\/apps\/client\/src\/shared\/three\/load\.ts$/;
/** React DOM, which the build gives a chunk of its own with React and the sign-in libraries (apps/client/vite/shipping.plugin.ts). */
const REACT = /\/node_modules\/react-dom\//;
/** The admin page's modules. Only its address may be in the game's own chunks. */
const ADMIN = /\/apps\/client\/src\/features\/admin\//;
const ADMIN_ADDRESS = /\/apps\/client\/src\/features\/admin\/adminPath\.ts$/;
/**
 * The life's screens: the part the shell fetches apart (app/Life.tsx) and every feature's screens but the start screen's, the door's and
 * sign in's (account, front-door) and the admin page's, which has its own check. None is in a first visit.
 */
const LIFE = /\/apps\/client\/src\/(?:app\/Life\.tsx$|features\/(?!account\/|front-door\/|admin\/))/;
const LIFE_SHELL = /\/apps\/client\/src\/app\/Life\.tsx$/;
/** A change line opens on the part that moved and says what for. A date in front is refused: git keeps when. */
const REASON = /^(?:main|three|content-sim|loader|react|shared|total)\b.*\bfor\b\s+\S/;

/**
 * Which part a first-visit chunk is: the entry is the main chunk; then by what it holds: the simulation (with
 * the content beside it), three.js's core, the model loader, React's chunk with React DOM. Any other chunk the entry imports (the
 * bundler's runtime, a library both the game and a later chunk share) is counted under `shared`.
 */
export function partOf(chunk: ReportChunk): Exclude<Part, "total"> {
  if (chunk.isEntry) return "main";
  if (chunk.modules.some((id) => SIM.test(id))) return "content-sim";
  if (chunk.modules.some((id) => THREE.test(id))) return "three";
  if (chunk.modules.some((id) => LOADER.test(id))) return "loader";
  if (chunk.modules.some((id) => REACT.test(id))) return "react";
  return "shared";
}

/** The files of the chunks given and of every chunk they need through their static imports. */
function withImports(start: readonly ReportChunk[], chunks: readonly ReportChunk[]): Set<string> {
  const byFile = new Map(chunks.map((chunk) => [chunk.file, chunk]));
  const seen = new Set<string>();
  const queue = start.map((chunk) => chunk.file);
  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    queue.push(...(byFile.get(file)?.imports ?? []));
  }
  return seen;
}

/** The chunks a first visit downloads: every entry and, through static imports, everything it needs. */
export function firstVisit(chunks: readonly ReportChunk[]): ReportChunk[] {
  const seen = withImports(chunks.filter((chunk) => chunk.isEntry), chunks);
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

/** engine:first-download-has-budget: a line for every module of the life's screens in a first-visit chunk. */
export function lifeInFirstVisit(chunks: readonly ReportChunk[]): string[] {
  return chunks.flatMap((chunk) =>
    chunk.modules.filter((id) => LIFE.test(id)).map((id) => `${chunk.file} holds ${id.slice(id.indexOf("apps/client/"))}: the life's screens load apart from the start screen (app/Life.tsx).`),
  );
}

/**
 * Two figures beside the budgets, measured and not budgeted: the life's screens (the shell's chunk and what it imports that a first visit
 * did not bring), and the whole game (every script chunk the build makes but the admin page's: the first visit and every part fetched later).
 */
export function laterFigures(chunks: readonly ReportChunk[], gzipped: (file: string) => number): { life: number; game: number } {
  const first = new Set(firstVisit(chunks).map((chunk) => chunk.file));
  const life = [...withImports(chunks.filter((chunk) => chunk.modules.some((id) => LIFE_SHELL.test(id))), chunks)].filter((file) => !first.has(file));
  const game = chunks.filter((chunk) => !chunk.modules.some((id) => ADMIN.test(id) && !ADMIN_ADDRESS.test(id)));
  const sum = (files: readonly string[]) => files.reduce((total, file) => total + gzipped(file), 0);
  return { life: sum(life), game: sum(game.map((chunk) => chunk.file)) };
}

/** A line for every part over its budget, with both numbers. */
export function overBudget(sizes: Record<Part, number>, budgets: BudgetFile): string[] {
  return PARTS.filter((part) => sizes[part] > budgets.parts[part].budget).map(
    (part) => `${part}: ${String(sizes[part])} bytes gzipped, over its budget of ${String(budgets.parts[part].budget)} (measured ${String(budgets.parts[part].measured)} when it was set).`,
  );
}

/** What the budget file itself must hold: whole numbers, every budget at most its measured size plus the headroom, and a line for each change naming the part and what for. */
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
  if (budgets.changes.length === 0) problems.push("The budget file has no line for its changes.");
  for (const line of budgets.changes) if (!REASON.test(line)) problems.push(`A change line names the part that moved and says what for ("main raised to 1050 for ..."), with no date: ${line}`);
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
    const later = laterFigures(chunks, (file) => gzipSync(readFileSync(join(outDir, file))).length);
    console.log(`The life's screens, fetched after the start screen: ${String(later.life)} bytes gzipped. The whole game, every script but the admin page's: ${String(later.game)} bytes gzipped. Neither has a budget.`);
    problems.push(...overBudget(sizes, budgets), ...adminInFirstVisit(first), ...lifeInFirstVisit(first));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  if (problems.length > 0) {
    for (const problem of problems) console.log(`  ${problem}`);
    console.log(`\nThe size check failed. A budget is lowered on purpose and never raised quietly: ${BUDGET_FILE} says why, with a line naming the part that moved and what for.`);
    process.exit(1);
  }
  console.log("Every part of a first visit is inside its budget.");
}

if (isMain(import.meta.url)) main();
