// pnpm check:scrub: the repository holds what the game declares to players and
// none of the legal or privacy planning behind it. Words that mark that
// planning fail the check in every file git would publish, except the two
// pages players read, LICENSES.md and this list itself.
//
// Usage: pnpm check:scrub
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export interface TellTale {
  readonly label: string;
  readonly pattern: RegExp;
  /** A line the check must catch, for the test. */
  readonly example: string;
}

const phrase = (words: string): TellTale => ({
  label: words,
  pattern: new RegExp(String.raw`\b${words.replace(/ /g, String.raw`\s+`)}`, "i"),
  example: `A line that says ${words} somewhere.`,
});

// Acronyms match their capitals only, so a file name such as an .ico never trips them.
const acronym = (letters: string): TellTale => ({
  label: letters,
  pattern: new RegExp(String.raw`\b${letters}\b`),
  example: `A line that names ${letters} once.`,
});

export const TELL_TALES: readonly TellTale[] = [
  phrase("legal advice"),
  phrase("lawyer"),
  phrase("solicitor"),
  phrase("legal representative"),
  phrase("lawful basis"),
  phrase("legal bases"),
  phrase("legitimate interests"),
  phrase("data protection act"),
  phrase("data protection commission"),
  phrase("data protection regulation"),
  phrase("information commissioner"),
  phrase("online safety act"),
  phrase("ofcom"),
  phrase("gambling commission"),
  phrase("gambling act"),
  phrase("lagos state lotteries"),
  phrase("national lottery act"),
  phrase("digital services act"),
  phrase("consumer rights act"),
  phrase("privacy and electronic communications"),
  acronym("GDPR"),
  acronym("ICO"),
  acronym("NDPC"),
  acronym("NDPA"),
  acronym("NITDA"),
  acronym("PECR"),
  acronym("COPPA"),
  acronym("CCPA"),
  acronym("PEGI"),
  acronym("ESRB"),
  acronym("IARC"),
];

/** Paths, from the repository root, that may carry the words. */
export const ALLOWED: ReadonlySet<string> = new Set([
  "apps/client/public/legal/terms.html",
  "apps/client/public/legal/privacy.html",
  "LICENSES.md",
  "tools/scrub-check.ts",
]);

export interface Hit {
  readonly file: string;
  readonly line: number;
  readonly label: string;
  readonly text: string;
}

/** Every tell-tale in one file's text. A file holding a zero byte is binary and is passed over. */
export function findTellTales(file: string, text: string): Hit[] {
  if (ALLOWED.has(file) || text.includes("\u0000")) return [];
  const hits: Hit[] = [];
  text.split("\n").forEach((line, index) => {
    for (const tale of TELL_TALES) {
      if (tale.pattern.test(line)) hits.push({ file, line: index + 1, label: tale.label, text: line.trim() });
    }
  });
  return hits;
}

/** The files git would publish from `root`: tracked ones, and new ones that are not ignored. */
export function publishedFiles(root: string): string[] {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return [...new Set(output.split("\u0000").filter((path) => path !== ""))].sort();
}

export function scrubTree(root: string): Hit[] {
  const hits: Hit[] = [];
  for (const file of publishedFiles(root)) {
    let text: string;
    try {
      text = readFileSync(join(root, file), "utf8");
    } catch {
      // Listed by git but gone from the disk: a deletion not yet committed.
      continue;
    }
    hits.push(...findTellTales(file, text));
  }
  return hits;
}

function isMain(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  const hits = scrubTree(process.cwd());
  for (const hit of hits) console.log(`${hit.file}:${String(hit.line)}: "${hit.label}": ${hit.text.slice(0, 160)}`);
  if (hits.length > 0) {
    console.log(`\n${String(hits.length)} line(s) carry legal or privacy planning. Keep that planning outside the repository.`);
    process.exit(1);
  }
  console.log("No legal or privacy planning found.");
}
