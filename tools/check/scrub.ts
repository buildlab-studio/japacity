// pnpm check:scrub: the repository holds what the game declares to players and
// none of the legal or privacy planning behind it. Words that mark that
// planning fail the check in every file git would publish, except the two
// pages players read, the test that reads them, LICENSES.md and this list itself.
//
// A second list, for the public repository, holds the values that belong to
// one deployment and are never committed: an email address, a 32-hex id, a Turnstile key, a Google OAuth
// client, a Cloudflare account id, an admin account list. Each names the places it may stand in, and a
// placeholder (an example domain, a made-up run) never fails. docs/site/built/your-own-copy.md lists them.
//
// A third list holds the tags of how the game was planned and built: private notes files, review codes, wave
// and branch names, and the comment tags that marked a choice or a doubt. A comment says what holds and why
// instead.
//
// Usage: pnpm check:scrub
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isMain } from "../repo";

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
  "apps/client/src/features/legal/terms.html",
  "apps/client/src/features/legal/privacy.html",
  "apps/client/src/features/legal/legal.test.ts",
  "LICENSES.md",
  "tools/check/scrub.ts",
]);

export interface Hit {
  readonly file: string;
  readonly line: number;
  readonly label: string;
  readonly text: string;
  /** Which list caught it: the legal planning, a value of one deployment, or a tag of the build's process. */
  readonly kind: "planning" | "deployment" | "process";
}

export interface DeploymentValue {
  readonly label: string;
  /** Global, so every match on a line is weighed. */
  readonly pattern: RegExp;
  /** A line the check must catch, for the test. */
  readonly example: string;
  /** Paths, from the repository root, where this kind may stand, with why. */
  readonly allowedIn: ReadonlyMap<string, string>;
  /** A match that is a placeholder rather than a value. */
  readonly placeholder: (match: string) => boolean;
}

/** The game's own domain: its published addresses (the official accounts, the operator's) are the product's, not a person's. */
export const OWN_DOMAINS: readonly string[] = ["japacity.app"];

/** Domains kept for examples (RFC 2606 and RFC 6761), which can never be anyone's. */
const RESERVED_DOMAIN = /(^|\.)(example\.(com|org|net)|example|test|invalid|localhost)$/i;

function emailDomainIsPlaceholder(match: string): boolean {
  const domain = match.slice(match.lastIndexOf("@") + 1).toLowerCase();
  return RESERVED_DOMAIN.test(domain) || OWN_DOMAINS.some((own) => domain === own || domain.endsWith(`.${own}`));
}

/** A run anyone can see is made up: the hex digits in order, or one character repeated. */
const madeUpRun = (match: string): boolean => /^(0123456789abcdef)+$/i.test(match) || /^(.)\1*$/.test(match);

const never = (): boolean => false;

/**
 * The only files where a 32-hex run may stand: the staging Hyperdrive ids, which are not secret without the account's
 * token, and the hash of the configuration `wrangler types` writes at the top of each Worker's generated types.
 */
const GENERATED_TYPES = "the hash of the Worker's configuration that `wrangler types` records (pnpm check:types), not an id";
const WRANGLER_IDS = new Map([
  ["apps/server/wrangler.jsonc", "the staging Hyperdrive ids (research: not secret, listed on the your-own-copy page)"],
  ["apps/server/worker-configuration.d.ts", GENERATED_TYPES],
]);

// The examples are assembled from parts, so this file's own text carries none of them whole.
const hex32 = ["4c1d", "9e7a", "02b8", "f3a6"].join("").repeat(2);

export const DEPLOYMENT_VALUES: readonly DeploymentValue[] = [
  {
    label: "an email address",
    // After mailto: or at a word's start, never inside a URL's user part or a path (`https://user@host`, `formula/x@18.json`).
    pattern: /(?:(?<=mailto:)|(?<![\w.%+\-/:@]))[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g,
    example: ["Write to someone", "personal-mail.ng for help."].join("@"),
    allowedIn: new Map(),
    placeholder: emailDomainIsPlaceholder,
  },
  {
    label: "a 32-hex id",
    pattern: /\b[0-9a-f]{32}\b/g,
    example: `{ "binding": "GAME_DB", "id": "${hex32}" }`,
    allowedIn: WRANGLER_IDS,
    placeholder: madeUpRun,
  },
  {
    label: "a Turnstile key",
    pattern: /\b0x4AAAA[0-9A-Za-z_-]{6,}/g,
    example: `VITE_TURNSTILE_SITE_KEY=${["0x4", "AAAAAB", "planted", "Key"].join("")}`,
    allowedIn: new Map(),
    placeholder: never,
  },
  {
    label: "a Google OAuth client id",
    pattern: /\b\d{6,}-[0-9a-z]{16,}\.apps\.googleusercontent\.com\b/g,
    example: `GOOGLE_CLIENT_ID=${["123456789012", "-", "plantedclientid1".repeat(2), ".apps", ".googleusercontent", ".com"].join("")}`,
    allowedIn: new Map(),
    placeholder: never,
  },
  {
    label: "a Google OAuth client secret",
    pattern: /\bGOCSPX-[0-9A-Za-z_-]{16,}/g,
    example: `GOOGLE_CLIENT_SECRET=${["GOCSPX", "planted-secret-value"].join("-")}`,
    allowedIn: new Map(),
    placeholder: never,
  },
  {
    label: "a Cloudflare account id",
    pattern: /account[_-]?id["']?\s*[:=]\s*["']?[0-9a-f]{32}\b/gi,
    example: `"account_id": "${hex32}",`,
    allowedIn: new Map(),
    placeholder: never,
  },
  {
    label: "an admin account list",
    // A value given in a settings file or a config: `ADMIN_ACCOUNTS=<ids>` or `"ADMIN_ACCOUNTS": "<ids>"`; empty or a <placeholder> passes.
    pattern: /(?:^|[\s;])(?:export\s+)?ADMIN_ACCOUNTS=(?!<)\S+|"ADMIN_ACCOUNTS"\s*:\s*"(?!<)[^"]+"/g,
    example: ["ADMIN_ACCOUNTS", "planted-account-id"].join("="),
    allowedIn: new Map(),
    placeholder: never,
  },
];

/** Paths where no deployment value is looked for: this list itself, which holds the patterns. */
export const DEPLOYMENT_ALLOWED: ReadonlySet<string> = new Set(["tools/check/scrub.ts"]);

/** Every value of one deployment in one file's text, outside the places it may stand. A binary file is passed over. */
export function findDeploymentValues(file: string, text: string): Hit[] {
  if (DEPLOYMENT_ALLOWED.has(file) || text.includes("\u0000")) return [];
  const hits: Hit[] = [];
  text.split("\n").forEach((line, index) => {
    for (const value of DEPLOYMENT_VALUES) {
      if (value.allowedIn.has(file)) continue;
      const found = [...line.matchAll(value.pattern)].some((match) => !value.placeholder(match[0].trim()));
      if (found) hits.push({ file, line: index + 1, label: value.label, text: line.trim(), kind: "deployment" });
    }
  });
  return hits;
}

/** Every tell-tale in one file's text. A file holding a zero byte is binary and is passed over. */
export function findTellTales(file: string, text: string): Hit[] {
  if (ALLOWED.has(file) || text.includes("\u0000")) return [];
  const hits: Hit[] = [];
  text.split("\n").forEach((line, index) => {
    for (const tale of TELL_TALES) {
      if (tale.pattern.test(line)) hits.push({ file, line: index + 1, label: tale.label, text: line.trim(), kind: "planning" });
    }
  });
  return hits;
}

export interface ProcessTag extends TellTale {
  /** False: the pattern is tested, and the tree is not looked through for it. */
  readonly enforced: boolean;
}

const tag = (label: string, pattern: RegExp, example: string, enforced: boolean): ProcessTag => ({ label, pattern, example, enforced });

/**
 * Only tags that never mean anything in the game. A bare merge tag (`m60`) is left out, since an SVG path's
 * `m12 5` reads the same, and so are "the lead", "the brief" and "milestone", which are also the game's words. A
 * branch is matched by its numbered or `fun/wave-` prefix, since `land/` begins ordinary words too.
 */
export const PROCESS_TAGS: readonly ProcessTag[] = [
  tag("a handoff note", /\bHANDOFF-/, "Read HANDOFF-17-OCT first.", true),
  tag("the build notes", /\bjapacity-build-notes\b|(?<![\w-])docs\/build\b/, "See docs/build/STATE.md.", true),
  tag("the standing orders", /\bSTANDING-ORDERS\b/, "As STANDING-ORDERS says.", true),
  tag("the owner's notes", /\bFOR-THE-OWNER\b/, "Logged in FOR-THE-OWNER.", true),
  tag("a review code", /\bREVIEW-\d/, "For REVIEW-9-OCT item 24.", true),
  tag("the logic review", /\bLOGIC-REVIEW\b/, "Found by the LOGIC-REVIEW.", true),
  tag("the whole-life review", /\bwhole-life review\b/i, "Raised by the whole-life review.", true),
  tag("a reading taken", /\bReading taken\b/, "the bank pocket.", true),
  tag("a wave's name", /\bwave [A-Z]{1,4}\d?[a-z]?\b/, "Built in wave AB2a.", true),
  tag("a builder's branch", /(?<![\w./-])(?:m\d{2,3}\/[a-z0-9]|fun\/wave-)/, "On the branch m37/logic-review.", true),
  tag("a comment tag", /(?:\/\/|\/\*|^\s*\*\s|^\s*#\s|<!--).*\b(?:QUESTION|Decided):/, "const rate = 20; // QUESTION: no page gives the rate.", true),
  tag("a plan file", /\b[A-Z]+-PLAN\b/, "The family house (HOME-the design).", true),
  tag(
    "a numbered review",
    /\bthe (?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth) review(?:'s note|, [A-Z]\d)/i,
    "The desk is still there to ask.",
    true,
  ),
  tag("an audit's finding", /\b(?:audit|review)(?:'s)? finding\b/i, "A secret, never a variable.", true),
  tag("a launch lesson", /\blaunch lesson \d/i, "Every other account plays on. Launch lesson 5.", true),
  tag("a catalog run", /\bcatalog [0-9a-f]{7,}\b/, "Never cut with an ellipsis.", true),
  tag("a dated call", /\(the (?:lead|owner|maintainer)(?:'s call)?,? (?:of )?\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/, "Nobody is met here.", true),
  tag("a milestone's name", /\bM[0-7] (?:pages?|tables?|stage|milestone|examples)\b/, "The tables (advert.md, guide.md, analytics.md).", true),
];

/** Paths where no process tag is looked for: this list itself, which holds the patterns. */
export const PROCESS_ALLOWED: ReadonlySet<string> = new Set(["tools/check/scrub.ts"]);

/** The tags the tree is looked through for: a new tag may be held off until the tree passes it. */
export function enforcedTags(tags: readonly ProcessTag[]): ProcessTag[] {
  return tags.filter((each) => each.enforced);
}

/** Every tag of the build's process in one file's text, by the tags given. A binary file is passed over. */
export function findProcessTags(file: string, text: string, tags: readonly ProcessTag[] = enforcedTags(PROCESS_TAGS)): Hit[] {
  if (PROCESS_ALLOWED.has(file) || text.includes("\u0000")) return [];
  const hits: Hit[] = [];
  text.split("\n").forEach((line, index) => {
    for (const each of tags) {
      if (each.pattern.test(line)) hits.push({ file, line: index + 1, label: each.label, text: line.trim(), kind: "process" });
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
    hits.push(...findTellTales(file, text), ...findDeploymentValues(file, text), ...findProcessTags(file, text));
  }
  return hits;
}

if (isMain(import.meta.url)) {
  const hits = scrubTree(process.cwd());
  for (const hit of hits) console.log(`${hit.file}:${String(hit.line)}: "${hit.label}": ${hit.text.slice(0, 160)}`);
  const planning = hits.filter((hit) => hit.kind === "planning").length;
  const processTags = hits.filter((hit) => hit.kind === "process").length;
  const deployment = hits.length - planning - processTags;
  if (planning > 0) console.log(`\n${String(planning)} line(s) carry legal or privacy planning. Keep that planning outside the repository.`);
  if (deployment > 0) console.log(`\n${String(deployment)} line(s) carry a value of one deployment. Keep it in .env.local, .dev.vars or the platform's secrets, and write a placeholder here.`);
  if (processTags > 0) console.log(`\n${String(processTags)} line(s) carry a tag of how the game was planned or built. Say what holds and why, without the tag.`);
  if (hits.length > 0) process.exit(1);
  console.log("No legal or privacy planning, no deployment value and no process tag found.");
}
