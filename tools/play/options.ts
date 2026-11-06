// The play driver's command line and its picture names, kept apart from the browser so a test can
// check them without one. `pnpm play --help` prints USAGE.
import { isAbsolute, relative, resolve } from "node:path";

export const USAGE = `pnpm play --out <folder> [--life <name>] [--ready] [--months <n>] [--url <address> | --port <n>] [--keep <file>] [--resume <file>] [--stop <door|planned>] [--played] [--headed]

  --out <folder>       Where the pictures and play.log go. Required. Must be outside the repository.
  --life <name>        The life to play, by its short name: developer, nurse, trader and so on (default developer).
  --ready              Start from the ready life of that kind instead of the archetype's tile.
  --months <n>         Months to end after reaching the world, 1 to 60 (default 3).
  --url <address>      Use a server that is already running at this address: a dev server, or the local
                       stack at https://localhost:8787 (pnpm dev:full), whose own certificate is accepted.
  --port <n>           The port for the dev server this tool starts, or reuses if one answers there (default 5190).
  --keep <file>        At the end, save the browser's storage (cookies and local storage) to this file, mode 600,
                       outside the repository. Its values are never printed.
  --resume <file>      Open with the storage a --keep saved: the front door is skipped, the life opens where it
                       stands and plays --months more. Use the same --url or --port it was kept on.
  --stop <where>       Stop the life part way and keep it there: door (the life made, its years before not played)
                       or planned (after --months, the next month's nudge followed and the month not ended).
  --played             Mark the device as played, so the first-use labels on the thumbs never show.
  --headed             Show the browser window.
  --help               Print this and stop.`;

export interface PlayOptions {
  readonly life: string;
  readonly ready: boolean;
  readonly months: number;
  readonly out: string;
  readonly url: string | null;
  readonly port: number;
  /** The device marked as played: no first-use label shows (world:no-walkthrough-before-play). */
  readonly played: boolean;
  readonly headed: boolean;
  /** The file the browser's storage is saved to at the end, outside the repository; absent when not asked. */
  readonly keep?: string;
  /** The file a kept storage is opened from, skipping the front door; absent for a new life. */
  readonly resume?: string;
  /** Where the life is stopped part way; absent to play every month asked and the phone. */
  readonly stop?: Stop;
}

/** Where a run stops part way: with the life made and its years before unplayed, or with the next month planned and not ended. */
export type Stop = "door" | "planned";
const STOPS: readonly Stop[] = ["door", "planned"];

export type Parsed = { readonly ok: true; readonly options: PlayOptions } | { readonly ok: false; readonly help: boolean; readonly problem: string };

export const DEFAULT_PORT = 5190;
const MAX_MONTHS = 60;

const FLAGS = new Set(["--ready", "--played", "--headed", "--help"]);
const VALUED = new Set(["--life", "--months", "--out", "--url", "--port", "--keep", "--resume", "--stop"]);

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

  const kept: Record<"--keep" | "--resume", string | null> = { "--keep": null, "--resume": null };
  for (const name of ["--keep", "--resume"] as const) {
    const given = values.get(name);
    if (given === undefined) continue;
    if (given.trim() === "") return { ok: false, help: false, problem: `${name} needs a file.` };
    const file = resolve(cwd, given);
    // The file holds a signed-in session: it never lands where git could pick it up.
    if (inside(file, repoRoot)) return { ok: false, help: false, problem: `${name} ${file} is inside the repository. Give a file outside it: it holds a signed-in session.` };
    kept[name] = file;
  }
  const resume = kept["--resume"];
  if (resume !== null && (values.has("--life") || flags.has("--ready"))) return { ok: false, help: false, problem: "--resume opens the life that was kept: give no --life or --ready with it." };

  const stopGiven = values.get("--stop");
  const stop = stopGiven === undefined ? null : (STOPS.find((each) => each === stopGiven) ?? null);
  if (stopGiven !== undefined && stop === null) return { ok: false, help: false, problem: `--stop takes ${STOPS.join(" or ")}, got "${stopGiven}".` };
  if (stop === "door" && resume !== null) return { ok: false, help: false, problem: "--stop door stops a new life at the door; a resumed life is past it." };

  return {
    ok: true,
    options: {
      life,
      ready: flags.has("--ready"),
      months,
      out,
      url,
      port,
      played: flags.has("--played"),
      headed: flags.has("--headed"),
      ...(kept["--keep"] === null ? {} : { keep: kept["--keep"] }),
      ...(resume === null ? {} : { resume }),
      ...(stop === null ? {} : { stop }),
    },
  };
}

/** The part of a kept storage the driver reads to say what it holds: Playwright's storage state, by count alone. */
export interface KeptStorage {
  readonly cookies: readonly unknown[];
  readonly origins: readonly { readonly origin: string; readonly localStorage: readonly unknown[] }[];
}

/** A kept storage read back, or the problem with it. Its values are never part of a problem. */
export function readKept(json: string): { ok: true; kept: KeptStorage } | { ok: false; problem: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, problem: "the kept file is not JSON" };
  }
  const shape = parsed as Partial<KeptStorage> | null;
  if (shape === null || typeof shape !== "object" || !Array.isArray(shape.cookies) || !Array.isArray(shape.origins)) return { ok: false, problem: "the kept file is not a browser's storage" };
  return { ok: true, kept: shape as KeptStorage };
}

/** What a kept storage holds, said by count only: never a name or a value. */
export function keptSummary(kept: KeptStorage, origin: string): string {
  const here = kept.origins.find((each) => each.origin === origin);
  return `${String(kept.cookies.length)} cookies, ${String(here?.localStorage.length ?? 0)} local storage keys for ${origin}`;
}

/**
 * True for an https address on this machine: the local stack's, which wrangler serves with its own
 * self-signed certificate (server:production-and-staging). Only there are certificate errors ignored.
 */
export function localCertificate(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const { protocol, hostname } = new URL(url);
  return protocol === "https:" && (hostname === "localhost" || hostname === "127.0.0.1");
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
function shortName(kind: string): string {
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

/** A button on a thing's fan as the driver reads it: the act's id (`data-fan-act`), its kind (`data-fan-kind`) and whether it can be tapped. */
export interface FanButton {
  id: string;
  kind: string;
  enabled: boolean;
}

/**
 * The fan button the driver takes, as a player doing what the nudge says would: the act the nudge's step opens when the fan
 * carries it open; else the first open act that stages an entry (an activity, a set piece, a chapter's step), so the racks'
 * Work the racks comes before their Look; else the first open act. Never a Stop, which takes an act out of the month's
 * plan. Null when nothing but a Stop is open.
 */
export function fanChoice(buttons: readonly FanButton[], opens: string | null): string | null {
  const open = buttons.filter((button) => button.enabled && button.kind !== "stop");
  if (opens !== null && open.some((button) => button.id === opens)) return opens;
  return (open.find((button) => button.id.includes(".")) ?? open[0])?.id ?? null;
}

/**
 * The username the driver types on Where you live online (account:username-typed-and-checked): the life's letters and the
 * moment in base 36, so each run's account is new and can be told apart in the database. Letters, digits and underscores,
 * at most 20, as the username rule asks.
 */
export function playUsername(now: number, life: string): string {
  const stamp = now.toString(36);
  const letters = life.replace(/[^a-z0-9]/g, "").slice(0, 20 - stamp.length - 1);
  return `${letters === "" ? "play" : letters}_${stamp}`;
}
