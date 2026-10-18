// The build for players (vite.config.ts and apps/client/vite/shipping.plugin.ts): the client is built twice into folders of its own, once as pnpm check:size
// builds it (production mode, placeholder settings in a deploy's shape) and once in development mode, and the files
// are read. A build for players ships no source map and no comment naming one, no console chatter and no debugger
// statement, none of the development pages' code, and the licences of the libraries it bundles in a file beside the
// page; the credits still name what they must. The development build is read too, to prove each development marker the
// test looks for is real and is what the production build leaves out. Reads and writes only local files.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { buildEnv } from "../tools/check/size";
import { shippedPackages } from "../tools/notices";
import { filesUnder, readJson, REPO_ROOT } from "../tools/repo";

const CLIENT = join(REPO_ROOT, "apps/client");

/** The console calls a build for players keeps: the boundary's report and the libraries' faults, and the build's line. */
const KEPT_CONSOLE = new Set(["error", "info"]);
/**
 * The one console call the bundler cannot drop: react-three-fiber's renderer disposal hands the warning's value on as
 * a promise's result (`.catch(e=>console.warn(...))`), so the call is not a statement the bundler may remove.
 */
const UNDROPPABLE_CONSOLE = /\.catch\(\w+=>console\.warn\(`\[R3F\] Error disposing renderer`/g;
/** What the development switches leave in code that reads them: `?paint=`, `?clock=`, `?sleep=`, `?morning=`, `?tiles`, `?lively`, and the lines' hook (`?fan=off` went with the chip, R-WORLD-034). */
const DEV_SWITCH = /\.(?:get|has)\([`"'](paint|clock|sleep|morning|tiles|lively)[`"']\)/g;
const DEV_SWITCHES = ["paint", "clock", "sleep", "morning", "tiles", "lively"];
const DEV_HOOK = "__wink";
/** The development pages' own chunks. */
const DEV_PAGES = /^assets\/(?:TileSheet|LivelyPreview)-[\w-]+\.js$/;
const TEXT = /\.(?:js|mjs|css|html|json|txt|webmanifest)$/;

interface Built {
  out: string;
  /** Every file of the build, relative to its folder. */
  files: string[];
  /** The bundler's script chunks, relative to the folder, as the size report names them. */
  chunks: string[];
}

let work = "";
let shipped: Built;
let development: Built;

function build(name: string, mode: "production" | "development"): Built {
  const out = join(work, name);
  const report = join(work, `${name}.json`);
  const env = mode === "production" ? buildEnv(report) : { ...buildEnv(report), NODE_ENV: "development" };
  const built = spawnSync("pnpm", ["--filter", "@japacity/client", "exec", "vite", "build", "--mode", mode, "--outDir", out, "--emptyOutDir", "--logLevel", "error"], { cwd: REPO_ROOT, encoding: "utf8", env });
  if (built.status !== 0) throw new Error(`The client did not build in ${mode} mode: ${built.stderr}`);
  const { chunks } = readJson<{ chunks: { file: string }[] }>(report);
  return { out, files: filesUnder(out), chunks: chunks.map((chunk) => chunk.file) };
}

function read(built: Built, file: string): string {
  return readFileSync(join(built.out, file), "utf8");
}

/** Every chunk's text, joined, with its name before it. */
function code(built: Built): string {
  return built.chunks.map((file) => `\n/* ${file} */\n${read(built, file)}`).join("");
}

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "japacity-shipped-"));
  shipped = build("shipped", "production");
  development = build("development", "development");
}, 240_000);

afterAll(() => {
  if (work !== "") rmSync(work, { recursive: true, force: true });
});

describe("the build for players", () => {
  test("[R-ENGINE-020] given the production build, then no source map ships and no shipped file names one", () => {
    expect(shipped.chunks.length).toBeGreaterThan(10);
    expect(shipped.files.filter((file) => file.endsWith(".map"))).toEqual([]);
    expect(shipped.files.filter((file) => TEXT.test(file) && /sourceMappingURL/.test(read(shipped, file)))).toEqual([]);
  });

  test("[R-ENGINE-020] [R-ANALYTICS-002] given the production build's chunks, then the only console calls left are console.error (the boundary's report of a broken screen) and console.info (the build's line), and no debugger statement", () => {
    const text = code(shipped);
    const left = text.replace(UNDROPPABLE_CONSOLE, "");
    const calls = [...left.matchAll(/\bconsole\.(\w+)/g)].map((match) => match[1] ?? "");
    expect([...new Set(calls.filter((call) => !KEPT_CONSOLE.has(call)))]).toEqual([]);
    expect(calls).toContain("error");
    // The boundary's own line (CountedBoundary.tsx): the screen's break, said with the build.
    expect(text).toMatch(/console\.error\([^)]*\)/);
    expect(text).toContain("Japacity build ");
    expect(text).not.toMatch(/\bdebugger\b/);
  });

  test("[R-ENGINE-020] given the development build's chunks, then the console calls the production build drops are there, so it is the build's setting that drops them", () => {
    const calls = new Set([...code(development).matchAll(/\bconsole\.(\w+)/g)].map((match) => match[1]));
    expect(calls.has("warn")).toBe(true);
    expect(calls.has("log")).toBe(true);
  });

  test("[R-ENGINE-020] given both builds, then every development switch, the lines' hook and the development pages are in the development build and none is in the production build", () => {
    const dev = code(development);
    const found = (text: string): string[] => [...new Set([...text.matchAll(DEV_SWITCH)].map((match) => match[1] ?? ""))].sort();
    expect(found(dev)).toEqual([...DEV_SWITCHES].sort());
    expect(dev).toContain(DEV_HOOK);
    expect(development.chunks.filter((file) => DEV_PAGES.test(file))).toHaveLength(2);

    const text = code(shipped);
    expect(found(text)).toEqual([]);
    expect(text).not.toContain(DEV_HOOK);
    expect(shipped.chunks.filter((file) => DEV_PAGES.test(file))).toEqual([]);
  });

  test("[R-ENGINE-020] given the production build, then beside the page a licences file holds every package the client ships with its licence's text, and the development build has none", () => {
    expect(shipped.files).toContain("licenses.txt");
    const licences = read(shipped, "licenses.txt");
    const packages = shippedPackages(CLIENT);
    expect(packages.length).toBeGreaterThan(5);
    const heads = licences.split("\n").filter((line) => line.startsWith("## "));
    const missing = packages.filter(({ name, license }) => !heads.some((head) => head.startsWith(`## ${name} - `) && head.endsWith(`(${license})`)));
    expect(missing).toEqual([]);
    expect(licences).toContain("Permission is hereby granted, free of charge");
    expect(licences).toContain("SIL OPEN FONT LICENSE");
    expect(development.files).not.toContain("licenses.txt");
  });

  test("[R-ENGINE-020] given the production build, then the file names stay hashed and the code is minified, not obfuscated: the words a player reads are there as written", () => {
    const scripts = shipped.chunks;
    expect(scripts.every((file) => /^assets\/[\w.-]+-[\w-]{8}\.js$/.test(file))).toBe(true);
    const text = code(shipped);
    expect(text).toContain("Japacity build ");
    expect(text).not.toMatch(/\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i);
  });

  test("[R-CITY-021] given the production build, then the credits still carry the map data line with its link and the way to the full list of licences", () => {
    const credits = JSON.parse(read(shipped, "assets/credits.json")) as { mapData: { text: string; link: string }[]; fonts: unknown[] };
    expect(credits.mapData.some((line) => line.text.includes("OpenStreetMap") && line.link.includes("openstreetmap.org/copyright"))).toBe(true);
    expect(credits.fonts.length).toBeGreaterThan(0);
    // The way to the full list is the licence file the build writes beside the page (R-GUIDE-010), not the private repository.
    expect(code(shipped)).toContain("licenses.txt");
  });
});
