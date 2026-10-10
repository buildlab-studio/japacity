// The play driver's command line and its picture names, kept apart from the browser so a test can
// check them without one. `pnpm play --help` prints USAGE.
import { isAbsolute, relative, resolve } from "node:path";

export const USAGE = `pnpm play --out <folder> [--life <name>] [--ready] [--months <n>] [--url <address> | --port <n>] [--skip-walkthrough] [--headed]

  --out <folder>       Where the pictures and play.log go. Required. Must be outside the repository.
  --life <name>        The life to play, by its short name: developer, nurse, trader and so on (default developer).
  --ready              Start from the ready life of that kind instead of the archetype's tile.
  --months <n>         Months to end after reaching the world, 1 to 60 (default 3).
  --url <address>      Use a dev server that is already running at this address.
  --port <n>           The port for the dev server this tool starts, or reuses if one answers there (default 5190).
  --skip-walkthrough   Mark the first-play walkthrough as seen, so it never shows.
  --headed             Show the browser window.
  --help               Print this and stop.`;

export interface PlayOptions {
  readonly life: string;
  readonly ready: boolean;
  readonly months: number;
  readonly out: string;
  readonly url: string | null;
  readonly port: number;
  readonly skipWalkthrough: boolean;
  readonly headed: boolean;
}

export type Parsed = { readonly ok: true; readonly options: PlayOptions } | { readonly ok: false; readonly help: boolean; readonly problem: string };

export const DEFAULT_PORT = 5190;
export const MAX_MONTHS = 60;

const FLAGS = new Set(["--ready", "--skip-walkthrough", "--headed", "--help"]);
const VALUED = new Set(["--life", "--months", "--out", "--url", "--port"]);

function whole(value: string, name: string, low: number, high: number): number | string {
  if (!/^\d+$/.test(value)) return `${name} takes a whole number, got "${value}".`;
  const n = Number(value);
  if (n < low || n > high) return `${name} must be from ${String(low)} to ${String(high)}, got ${value}.`;
  return n;
}

/**
 * Reads the arguments after the script name. `cwd` resolves a relative --out, and `repoRoot` is the
 * folder the pictures must stay out of, so a play never leaves files for git to pick up.
 */
export function parseOptions(argv: readonly string[], cwd: string, repoRoot: string): Parsed {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let at = 0; at < argv.length; at += 1) {
    const arg = argv[at] ?? "";
    // pnpm passes a lone "--" through on some versions; it means nothing here.
    if (arg === "--") continue;
    const [name = "", inline] = arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    if (FLAGS.has(name)) {
      if (inline !== undefined) return { ok: false, help: false, problem: `${name} takes no value.` };
      flags.add(name);
    } else if (VALUED.has(name)) {
      const value = inline ?? argv[at + 1];
      if (value === undefined || (inline === undefined && value.startsWith("--"))) return { ok: false, help: false, problem: `${name} needs a value.` };
      if (inline === undefined) at += 1;
      values.set(name, value);
    } else {
      return { ok: false, help: false, problem: `Unknown argument "${arg}".` };
    }
  }
  if (flags.has("--help")) return { ok: false, help: true, problem: "" };

  const outGiven = values.get("--out");
  if (outGiven === undefined || outGiven.trim() === "") return { ok: false, help: false, problem: "--out is required: a folder outside the repository for the pictures and the log." };
  const out = resolve(cwd, outGiven);
  if (inside(out, repoRoot)) return { ok: false, help: false, problem: `--out ${out} is inside the repository. Give a folder outside it, such as one under your temporary folder.` };

  const months = whole(values.get("--months") ?? "3", "--months", 1, MAX_MONTHS);
  if (typeof months === "string") return { ok: false, help: false, problem: months };
  const port = whole(values.get("--port") ?? String(DEFAULT_PORT), "--port", 1024, 65535);
  if (typeof port === "string") return { ok: false, help: false, problem: port };

  const urlGiven = values.get("--url");
  if (urlGiven !== undefined && values.has("--port")) return { ok: false, help: false, problem: "Give --url or --port, not both." };
  let url: string | null = null;
  if (urlGiven !== undefined) {
    if (!URL.canParse(urlGiven) || !/^https?:$/.test(new URL(urlGiven).protocol)) return { ok: false, help: false, problem: `--url must be an http address, got "${urlGiven}".` };
    url = new URL(urlGiven).origin;
  }

  const life = (values.get("--life") ?? "developer").trim().toLowerCase();
  if (!/^[a-z][a-z-]*$/.test(life)) return { ok: false, help: false, problem: `--life takes a short name such as developer, got "${life}".` };

  return {
    ok: true,
    options: { life, ready: flags.has("--ready"), months, out, url, port, skipWalkthrough: flags.has("--skip-walkthrough"), headed: flags.has("--headed") },
  };
}

/** True when `path` is `folder` or anywhere under it. */
export function inside(path: string, folder: string): boolean {
  const between = relative(resolve(folder), resolve(path));
  return between === "" || (!between.startsWith("..") && !isAbsolute(between));
}

/** The lives a player can start, by short name, read from the words: the archetypes' tiles and the ready lives' kinds. */
export interface Lives {
  readonly tiles: ReadonlyMap<string, string>;
  readonly ready: ReadonlyMap<string, string>;
}

/** Short name for a ready life's kind: "The shop worker" is shop-worker. */
export function shortName(kind: string): string {
  return kind
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function livesFrom(text: Readonly<Record<string, string>>): Lives {
  const tiles = new Map<string, string>();
  const ready = new Map<string, string>();
  for (const [key, words] of Object.entries(text)) {
    const tile = /^prologue\.archetype\.([a-z-]+)\.name$/.exec(key);
    if (tile?.[1] !== undefined) tiles.set(tile[1], words);
    if (/^scenario\.[a-z-]+\.kind$/.test(key)) ready.set(shortName(words), words);
  }
  return { tiles, ready };
}

/** The button's name on the front door for the life asked for, or the problem when there is no such life. */
export function doorButton(lives: Lives, life: string, ready: boolean): { ok: true; name: string } | { ok: false; problem: string } {
  const table = ready ? lives.ready : lives.tiles;
  const name = table.get(life);
  if (name !== undefined) return { ok: true, name: ready ? `Pick: ${name}` : name };
  const known = [...table.keys()].sort().join(", ");
  return { ok: false, problem: `No ${ready ? "ready life" : "archetype"} called "${life}". Known: ${known}.` };
}

/** A picture's file name: a two-digit count, then the step in lower case with dashes, then .png. */
export function shotName(count: number, label: string): string {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48)
      .replace(/-$/, "") || "shot";
  return `${String(count).padStart(2, "0")}-${slug}.png`;
}
