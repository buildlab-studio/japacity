// pnpm check:version and pnpm content:seal (docs/rules/server.md R-SERVER-048): the content version moves whenever
// what a replay depends on moves. The seal beside the version (packages/content/src/seal.json) holds the version and a
// fingerprint of the content's data and the simulation's code. The check fails when the fingerprint moved and the
// version did not; the seal command writes the seal, and refuses to reseal a changed fingerprint under the same version.
// A change to how the fingerprint is made is the one case sealed again under the same version: the seal file is
// deleted first, and the content and the simulation are left as they were.
//
// Usage: pnpm check:version, pnpm content:seal
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

import { content } from "../../packages/content/src/index";
import { isMain, readJson, REPO_ROOT, toPosix } from "../repo";

export const SEAL_FILE = "packages/content/src/seal.json";
export const SIM_SOURCE = "packages/sim/src";
/** Folders of the simulation's source that only tests and tools read. */
const NOT_PLAYED = new Set(["sweep", "testing", "goldens"]);
/** A content version is a whole number from 1, written as a string. */
const VERSION = /^[1-9]\d*$/;

const ABOUT =
  "R-SERVER-048: the content version and the fingerprint of what a replay depends on (the content's data and the simulation's code, comments and layout aside). Written by pnpm content:seal; read by pnpm check:version.";

export interface Seal {
  about: string;
  version: string;
  fingerprint: string;
}

/** What is sealed: the version and the fingerprint now. */
export interface Sealed {
  version: string;
  fingerprint: string;
}

export interface SourceFile {
  /** The path from the simulation's source folder, with forward slashes. */
  path: string;
  text: string;
}

/** `value` as JSON with every object's keys in order, so the same data always gives the same text. */
export function stableJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`The content holds a number JSON cannot keep: ${String(value)}.`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((each) => stableJson(each)).join(",")}]`;
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, each]) => each !== undefined);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, each]) => `${JSON.stringify(key)}:${stableJson(each)}`).join(",")}}`;
  }
  throw new Error(`The content holds a value that is not plain data: ${typeof value}.`);
}

/** Whether a file under the simulation's source is part of what a replay runs: no test, no test helper, no tool's folder. */
export function played(path: string): boolean {
  const parts = path.split("/");
  const name = parts.at(-1) ?? "";
  if (!name.endsWith(".ts") || name.endsWith(".d.ts")) return false;
  if (name.endsWith(".test.ts") || name.endsWith(".fixtures.ts")) return false;
  return !parts.slice(0, -1).some((part) => NOT_PLAYED.has(part));
}

/** Every file the simulation plays, read from `dir`, in path order. */
export function simSources(dir: string = join(REPO_ROOT, SIM_SOURCE)): SourceFile[] {
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map(toPosix)
    .filter(played)
    .sort();
  return files.map((path) => ({ path, text: readFileSync(join(dir, path), "utf8") }));
}

const printer = ts.createPrinter({ removeComments: true });
const CLOSERS = new Set(["]", "}", ")", ">"]);

/**
 * The file's tokens, one space apart, as the TypeScript printer leaves them with comments removed: the same for any
 * change of comments or layout alone. The printer keeps a block or a literal on one line when the source did, and a
 * trailing comma where the source had one, so the printed file is read back and only its tokens are kept.
 */
export function printed(file: SourceFile): string {
  const bare = printer.printFile(ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS));
  const reread = ts.createSourceFile(file.path, bare, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const tokens: string[] = [];
  const walk = (node: ts.Node): void => {
    const children = node.getChildren(reread);
    if (children.length === 0) tokens.push(node.getText(reread));
    else for (const child of children) walk(child);
  };
  walk(reread);
  const kept = tokens.filter((token) => token !== "");
  // A trailing comma is layout: the formatter adds one when a list breaks over lines.
  return kept.filter((token, at) => token !== "," || !CLOSERS.has(kept[at + 1] ?? "")).join(" ");
}

/** The fingerprint of the content's data (its version aside) and the simulation's printed source. */
export function fingerprint(data: object, sources: readonly SourceFile[]): string {
  const hash = createHash("sha256");
  const rest = Object.fromEntries(Object.entries(data).filter(([key]) => key !== "version"));
  hash.update(`content\n${stableJson(rest)}\n`);
  for (const file of sources) hash.update(`file ${file.path}\n${printed(file)}\n`);
  return hash.digest("hex");
}

const bumpWords = (version: string): string =>
  `The content or the simulation changed and the content version did not: it is still "${version}". Raise \`version\` in packages/content/src/index.ts by one; if lives exist under "${version}", add that content, as it shipped, to \`olderContents\` beside it (docs/rules/server.md R-SERVER-023). Then run pnpm content:seal.`;

/** R-SERVER-048: what is wrong with the seal against the version and fingerprint now; empty when it holds. */
export function checkSeal(now: Sealed, seal: Sealed): string[] {
  if (!VERSION.test(now.version)) return [`The content version "${now.version}" is not a whole number from 1.`];
  if (now.version === seal.version) return now.fingerprint === seal.fingerprint ? [] : [bumpWords(now.version)];
  if (Number(now.version) <= Number(seal.version)) return [`The content version "${now.version}" is not above the sealed "${seal.version}".`];
  return [`The content version is "${now.version}" and the seal names "${seal.version}". Run pnpm content:seal to seal "${now.version}".`];
}

/** R-SERVER-048: the seal to write now, or why it is refused: a changed fingerprint is never sealed under the same version. */
export function resealed(now: Sealed, seal: Sealed | null): { ok: true; seal: Seal } | { ok: false; problem: string } {
  if (!VERSION.test(now.version)) return { ok: false, problem: `The content version "${now.version}" is not a whole number from 1.` };
  if (seal !== null && now.version === seal.version && now.fingerprint !== seal.fingerprint) return { ok: false, problem: bumpWords(now.version) };
  if (seal !== null && Number(now.version) < Number(seal.version)) return { ok: false, problem: `The content version "${now.version}" is below the sealed "${seal.version}".` };
  return { ok: true, seal: { about: ABOUT, version: now.version, fingerprint: now.fingerprint } };
}

function readSeal(): Seal | null {
  try {
    return readJson<Seal>(join(REPO_ROOT, SEAL_FILE));
  } catch {
    return null;
  }
}

function main(): void {
  const mode = process.argv[2];
  const now: Sealed = { version: content.version, fingerprint: fingerprint(content, simSources()) };
  const seal = readSeal();
  if (mode === "seal") {
    const result = resealed(now, seal);
    if (!result.ok) {
      console.log(result.problem);
      process.exit(1);
    }
    writeFileSync(join(REPO_ROOT, SEAL_FILE), `${JSON.stringify(result.seal, null, 2)}\n`);
    console.log(`Sealed content version "${now.version}": ${now.fingerprint}.`);
    return;
  }
  if (mode !== "check") {
    console.log("Usage: tsx tools/check/version.ts check|seal");
    process.exit(2);
  }
  if (seal === null) {
    console.log(`${SEAL_FILE} is missing. Run pnpm content:seal.`);
    process.exit(1);
  }
  const problems = checkSeal(now, seal);
  if (problems.length > 0) {
    for (const problem of problems) console.log(problem);
    process.exit(1);
  }
  console.log(`Content version "${now.version}" is sealed: the content and the simulation are as sealed.`);
}

if (isMain(import.meta.url)) main();
