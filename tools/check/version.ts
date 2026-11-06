// pnpm check:version and pnpm content:seal (server:content-version-sealed): the content version moves whenever
// what a replay depends on moves. The seal beside the version (packages/content/src/seal.json) holds the version and a
// fingerprint of the content's data and the simulation's code. The check fails when the fingerprint moved and the
// version did not; the seal command writes the seal, and refuses to reseal a changed fingerprint under the same version.
// A change to how the fingerprint is made is the one case sealed again under the same version: the seal file is
// deleted first, and the content and the simulation are left as they were.
//
// pnpm content:freeze (server:older-content-frozen) keeps the sealed version's content before the version is raised:
// packages/content/src/older/<version>/content.json, the content as the server bundles it, with seal.json beside it
// holding the fingerprint of that content alone, and a line in `olderContents`. The check then also fails when a
// version below the current one is not frozen and listed, when a frozen one was edited, and when a frozen one is not
// below the current.
//
// Usage: pnpm check:version, pnpm content:seal, pnpm content:freeze
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Content } from "@japacity/sim";
import ts from "typescript";

import { content, olderContents } from "../../packages/content/src/index";
import { filesUnder, isMain, readJson, REPO_ROOT } from "../repo";

export const SEAL_FILE = "packages/content/src/seal.json";
export const SIM_SOURCE = "packages/sim/src";
/** Folders of the simulation's source that only tests and tools read. */
const NOT_PLAYED = new Set(["simulated-play", "testing", "goldens"]);
/** A content version is a whole number from 1, written as a string. */
const VERSION = /^[1-9]\d*$/;

const ABOUT =
  "server:content-version-sealed: the content version and the fingerprint of what a replay depends on (the content's data and the simulation's code, comments and layout aside). Written by pnpm content:seal; read by pnpm check:version.";

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

/**
 * `value` as JSON with every object's keys in the order the content has them: the simulation meets a table's entries
 * in that order, so a reorder alone can move a replay and must move the fingerprint.
 */
export function orderedJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`The content holds a number JSON cannot keep: ${String(value)}.`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((each) => orderedJson(each)).join(",")}]`;
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, each]) => each !== undefined);
    return `{${entries.map(([key, each]) => `${JSON.stringify(key)}:${orderedJson(each)}`).join(",")}}`;
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
  const files = filesUnder(dir).filter(played);
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

/** The content's part of what the seal hashes: its data, its version aside, with every object's keys in the content's order. */
function contentPart(data: object): string {
  const rest = Object.fromEntries(Object.entries(data).filter(([key]) => key !== "version"));
  return `content\n${orderedJson(rest)}\n`;
}

/** The fingerprint of the content's data (its version aside) and the simulation's printed source. */
export function fingerprint(data: object, sources: readonly SourceFile[]): string {
  const hash = createHash("sha256");
  hash.update(contentPart(data));
  for (const file of sources) hash.update(`file ${file.path}\n${printed(file)}\n`);
  return hash.digest("hex");
}

/** server:older-content-frozen: the fingerprint of the content alone, the content part of the seal's hash. */
export function contentFingerprint(data: object): string {
  return createHash("sha256").update(contentPart(data)).digest("hex");
}

const bumpWords = (version: string): string =>
  `The content or the simulation changed and the content version did not: it is still "${version}". Keep "${version}" as it shipped first: set the change aside (git stash), run pnpm content:freeze, which writes it to packages/content/src/older/${version} and lists it in \`olderContents\` (server:older-content-frozen), and bring the change back (git stash pop). Raise \`version\` in packages/content/src/index.ts by one, then run pnpm content:seal.`;

/** server:content-version-sealed: what is wrong with the seal against the version and fingerprint now; empty when it holds. */
export function checkSeal(now: Sealed, seal: Sealed): string[] {
  if (!VERSION.test(now.version)) return [`The content version "${now.version}" is not a whole number from 1.`];
  if (now.version === seal.version) return now.fingerprint === seal.fingerprint ? [] : [bumpWords(now.version)];
  if (Number(now.version) <= Number(seal.version)) return [`The content version "${now.version}" is not above the sealed "${seal.version}".`];
  return [`The content version is "${now.version}" and the seal names "${seal.version}". Run pnpm content:seal to seal "${now.version}".`];
}

/** server:content-version-sealed: the seal to write now, or why it is refused: a changed fingerprint is never sealed under the same version. */
export function resealed(now: Sealed, seal: Sealed | null): { ok: true; seal: Seal } | { ok: false; problem: string } {
  if (!VERSION.test(now.version)) return { ok: false, problem: `The content version "${now.version}" is not a whole number from 1.` };
  if (seal !== null && now.version === seal.version && now.fingerprint !== seal.fingerprint) return { ok: false, problem: bumpWords(now.version) };
  if (seal !== null && Number(now.version) < Number(seal.version)) return { ok: false, problem: `The content version "${now.version}" is below the sealed "${seal.version}".` };
  return { ok: true, seal: { about: ABOUT, version: now.version, fingerprint: now.fingerprint } };
}

/** The content's source folder, where the frozen versions live under `older`. */
export const CONTENT_SOURCE = "packages/content/src";
export const OLDER_DIR = "older";
const FROZEN_CONTENT = "content.json";
const FROZEN_SEAL = "seal.json";
/** The list as the freeze writes it, one line in the content's index.ts. */
const LISTED = /^export const olderContents: readonly Content\[\] = \[(.*)\];$/m;
const LOADER_IMPORT = 'import { frozenContent } from "./older/frozen";';

const FROZEN_ABOUT =
  "server:older-content-frozen: the fingerprint of this content version as it shipped (the content part of the seal's hash) and the SHA-256 of content.json as written. Written by pnpm content:freeze; read by pnpm check:version. Never edited.";

/** Beside a frozen version's content: its version, its content's fingerprint and the hash of the file as written. */
export interface FrozenSeal {
  about: string;
  version: string;
  fingerprint: string;
  /** SHA-256 of content.json: the seal's fingerprint sorts keys, and the order of a table's entries is part of what a replay walks. */
  file: string;
}

/** One folder under `older`, as read: a missing or unreadable file is null. */
export interface Frozen {
  version: string;
  seal: FrozenSeal | null;
  text: string | null;
}

/** One entry of `olderContents`, by its version and its content's fingerprint. */
export interface Listed {
  version: string;
  fingerprint: string;
}

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** The frozen file's text: the content as JSON, its keys in the order the content has them. */
export function frozenText(data: object): string {
  return `${JSON.stringify(data)}\n`;
}

/** Every folder under `<dir>/older`, in version order. */
export function readFrozen(dir: string): Frozen[] {
  const older = join(dir, OLDER_DIR);
  if (!existsSync(older)) return [];
  const readOrNull = (path: string): string | null => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  };
  const sealOf = (text: string | null): FrozenSeal | null => {
    if (text === null) return null;
    try {
      return JSON.parse(text) as FrozenSeal;
    } catch {
      return null;
    }
  };
  const folders = readdirSync(older, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const frozen = folders.map(
    (entry): Frozen => ({ version: entry.name, seal: sealOf(readOrNull(join(older, entry.name, FROZEN_SEAL))), text: readOrNull(join(older, entry.name, FROZEN_CONTENT)) }),
  );
  return frozen.sort((a, b) => Number(a.version) - Number(b.version) || (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
}

/** The versions and fingerprints of the contents listed in `olderContents`. */
export function listedOf(contents: readonly Content[]): Listed[] {
  return contents.map((each) => ({ version: each.version, fingerprint: contentFingerprint(each) }));
}

/** Whether a frozen version's files are as the freeze wrote them. */
function frozenHolds(each: Frozen): boolean {
  if (each.seal === null || each.text === null) return false;
  let data: unknown;
  try {
    data = JSON.parse(each.text);
  } catch {
    return false;
  }
  if (typeof data !== "object" || data === null || (data as { version?: unknown }).version !== each.version) return false;
  return each.seal.version === each.version && each.seal.file === sha256(each.text) && each.seal.fingerprint === contentFingerprint(data);
}

/** server:older-content-frozen: what is wrong with the frozen versions against the current version and `olderContents`; empty when it holds. */
export function checkFrozen(current: string, frozen: readonly Frozen[], listed: readonly Listed[]): string[] {
  if (!VERSION.test(current)) return [];
  const problems: string[] = [];
  const where = (version: string): string => `${CONTENT_SOURCE}/${OLDER_DIR}/${version}`;
  const byVersion = new Map(frozen.map((each) => [each.version, each]));
  for (const each of frozen) {
    if (!VERSION.test(each.version)) {
      problems.push(`${where(each.version)} is not named for a content version (a whole number from 1). Remove it.`);
      continue;
    }
    if (!frozenHolds(each)) {
      problems.push(
        `The frozen content "${each.version}" in ${where(each.version)} no longer matches its fingerprint. A frozen version is never edited: restore it from git (git checkout -- ${where(each.version)}).`,
      );
    }
    if (Number(each.version) >= Number(current)) {
      problems.push(
        `The frozen content "${each.version}" is not below the current version "${current}". Raise \`version\` in packages/content/src/index.ts by one, make the change, then run pnpm content:seal.`,
      );
    }
    if (!listed.some((entry) => entry.version === each.version)) {
      problems.push(
        `The frozen content "${each.version}" is not listed in \`olderContents\` in packages/content/src/index.ts. List it as pnpm content:freeze does: import ${where(each.version)}/${FROZEN_CONTENT} and add it through \`frozenContent\`.`,
      );
    }
  }
  for (let below = 1; below < Number(current); below += 1) {
    const version = String(below);
    if (!byVersion.has(version)) {
      problems.push(
        `Content version "${version}" is below the current "${current}" and is not frozen. A version is frozen before it is raised: check out the commit that sealed "${version}" (git log -- ${SEAL_FILE}), run pnpm content:freeze there, and bring ${where(version)} and its line in \`olderContents\` here.`,
      );
    }
  }
  const counted = new Set<string>();
  for (const entry of listed) {
    if (counted.has(entry.version)) {
      problems.push(`\`olderContents\` lists the content "${entry.version}" more than once. List each frozen version once.`);
      continue;
    }
    counted.add(entry.version);
    const each = byVersion.get(entry.version);
    if (each === undefined) {
      const reported = VERSION.test(entry.version) && Number(entry.version) < Number(current);
      if (!reported) problems.push(`\`olderContents\` lists a content "${entry.version}" that is not frozen in ${where(entry.version)}. Only a frozen version is listed: remove it, or freeze it with pnpm content:freeze.`);
    } else if (frozenHolds(each) && each.seal?.fingerprint !== entry.fingerprint) {
      problems.push(`\`olderContents\` lists a content "${entry.version}" other than the frozen one in ${where(entry.version)}. List the frozen file itself, through \`frozenContent\`, as pnpm content:freeze does.`);
    }
  }
  return problems;
}

/** The content's index.ts with `version` listed in `olderContents`, or null when the list is not in the form the freeze writes. */
function listedIndex(index: string, version: string): string | null {
  const list = LISTED.exec(index);
  if (list === null) return null;
  const entries = (list[1] ?? "").trim() === "" ? [] : (list[1] ?? "").split(",").map((entry) => entry.trim());
  const named = `content${version}`;
  const withList = index.replace(LISTED, `export const olderContents: readonly Content[] = [${[...entries, `frozenContent(${named})`].join(", ")}];`);
  const lines = withList.split("\n");
  const firstCode = lines.findIndex((line) => line !== "" && !line.startsWith("//") && !line.startsWith("import "));
  let lastImport = -1;
  for (let at = 0; at < (firstCode === -1 ? lines.length : firstCode); at += 1) if (lines[at]?.startsWith("import ") === true) lastImport = at;
  if (lastImport === -1) return null;
  // The import attribute lets Node's own loader (the browser tests' runner) read the JSON as the bundlers do.
  const added = [`import ${named} from "./${OLDER_DIR}/${version}/${FROZEN_CONTENT}" with { type: "json" };`];
  if (!lines.includes(LOADER_IMPORT)) added.unshift(LOADER_IMPORT);
  lines.splice(lastImport + 1, 0, ...added);
  return lines.join("\n");
}

/**
 * server:older-content-frozen: freezes the sealed version's content into `<dir>/older/<version>` and lists it in
 * `<dir>/index.ts`. Refused while the content or the simulation differs from the seal (only what shipped is frozen),
 * when the version is already frozen, and when the list is not in the form the freeze writes. Writes nothing when refused.
 */
export function freeze(dir: string, data: { version: string }, now: Sealed, seal: Sealed | null): { ok: true; files: string[] } | { ok: false; problem: string } {
  if (seal === null) return { ok: false, problem: `${SEAL_FILE} is missing. Only a sealed version is frozen: run pnpm content:seal first.` };
  if (now.version !== seal.version || now.fingerprint !== seal.fingerprint || data.version !== seal.version) {
    return {
      ok: false,
      problem: `The content or the simulation is not as sealed under "${seal.version}" (the content version is "${now.version}"). Only what shipped is frozen: run pnpm content:freeze before changing anything, on the commit that sealed "${seal.version}".`,
    };
  }
  const folder = join(dir, OLDER_DIR, seal.version);
  if (existsSync(folder)) return { ok: false, problem: `Content version "${seal.version}" is already frozen in ${folder}. A frozen version is never written again.` };
  const indexFile = join(dir, "index.ts");
  const index = listedIndex(readFileSync(indexFile, "utf8"), seal.version);
  if (index === null) return { ok: false, problem: `${indexFile} has no \`olderContents\` line in the form the freeze writes ("export const olderContents: readonly Content[] = [...];") after its imports.` };
  const text = frozenText(data);
  const frozenSeal: FrozenSeal = { about: FROZEN_ABOUT, version: seal.version, fingerprint: contentFingerprint(data), file: sha256(text) };
  mkdirSync(folder, { recursive: true });
  const files = [join(folder, FROZEN_CONTENT), join(folder, FROZEN_SEAL), indexFile];
  writeFileSync(files[0] ?? "", text);
  writeFileSync(files[1] ?? "", `${JSON.stringify(frozenSeal, null, 2)}\n`);
  writeFileSync(indexFile, index);
  return { ok: true, files };
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
  if (mode === "freeze") {
    const result = freeze(join(REPO_ROOT, CONTENT_SOURCE), content, now, seal);
    if (!result.ok) {
      console.log(result.problem);
      process.exit(1);
    }
    console.log(`Froze content version "${now.version}": ${result.files.map((file) => file.slice(REPO_ROOT.length + 1)).join(", ")}. Now raise \`version\` by one, make the change, and run pnpm content:seal.`);
    return;
  }
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
    console.log("Usage: tsx tools/check/version.ts check|seal|freeze");
    process.exit(2);
  }
  if (seal === null) {
    console.log(`${SEAL_FILE} is missing. Run pnpm content:seal.`);
    process.exit(1);
  }
  const problems = [...checkSeal(now, seal), ...checkFrozen(now.version, readFrozen(join(REPO_ROOT, CONTENT_SOURCE)), listedOf(olderContents))];
  if (problems.length > 0) {
    for (const problem of problems) console.log(problem);
    process.exit(1);
  }
  const frozen = olderContents.map((each) => `"${each.version}"`);
  console.log(`Content version "${now.version}" is sealed: the content and the simulation are as sealed. Frozen and listed below it: ${frozen.length === 0 ? "none" : frozen.join(", ")}.`);
}

if (isMain(import.meta.url)) main();
