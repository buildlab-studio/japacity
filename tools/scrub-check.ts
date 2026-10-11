// pnpm check:scrub: the repository holds what the game declares to players and
// none of the legal or privacy planning behind it. Words that mark that
// planning fail the check in every file git would publish, except the two
// pages players read, the test that reads them, LICENSES.md and this list itself.
//
// A second list holds the values that belong to
// one deployment and are never committed: an email address, a 32-hex id, a Turnstile key, a Google OAuth
// client, a Cloudflare account id, an admin account list. Each names the places it may stand in, and a
// placeholder (an example domain, a made-up run) never fails. docs/site/built/your-own-copy.md lists them.
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
  "apps/client/src/features/legal/terms.html",
  "apps/client/src/features/legal/privacy.html",
  "apps/client/src/features/legal/legal.test.ts",
  "LICENSES.md",
  "tools/scrub-check.ts",
]);

export interface Hit {
  readonly file: string;
  readonly line: number;
  readonly label: string;
  readonly text: string;
  /** Which list caught it: the legal planning, or a value of one deployment. */
  readonly kind: "planning" | "deployment";
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

/** The only file where a 32-hex id may stand: the staging Hyperdrive ids, which are not secret without the account's token. */
const WRANGLER_IDS = new Map([["apps/server/wrangler.jsonc", "the staging Hyperdrive ids (research: not secret, listed on the your-own-copy page)"]]);

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
export const DEPLOYMENT_ALLOWED: ReadonlySet<string> = new Set(["tools/scrub-check.ts"]);

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
    hits.push(...findTellTales(file, text), ...findDeploymentValues(file, text));
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
  const planning = hits.filter((hit) => hit.kind === "planning").length;
  const deployment = hits.length - planning;
  if (planning > 0) console.log(`\n${String(planning)} line(s) carry legal or privacy planning. Keep that planning outside the repository.`);
  if (deployment > 0) console.log(`\n${String(deployment)} line(s) carry a value of one deployment. Keep it in .env.local, .dev.vars or the platform's secrets, and write a placeholder here.`);
  if (hits.length > 0) process.exit(1);
  console.log("No legal or privacy planning and no deployment value found.");
}
