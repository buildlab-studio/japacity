// pnpm check:assets: the build check of decision 0005 section 5. It reads files only and renders
// nothing, so it runs wherever pnpm check runs. Every check returns its problems; any problem fails.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import type { RegisterRow, Review, ReviewSheet } from "@japacity/assets";

import { measure, readGlb } from "./glb";
import { placeMapData } from "./map-data";
import { hashInName, type Manifest, sha256 } from "./manifest";
import { checkPalette } from "./palette-check";
import type { Register } from "./register";

/** R-ASSET-008, as the page writes it. */
export const FILE_NAME = /^(chr|veh|bld|shop|sign|lm|prop|cloth|hair|anim|tex)_[a-z0-9]+(-[a-z0-9]+)*(_[a-z0-9]+(-[a-z0-9]+)*)?\.(glb|png|ktx2)$/;
/** Files decision 0005 places under public/assets beside the models, and the publish step's manifest. */
export const DATA_FILES = new Set(["place.json", "credits.json", "manifest.json"]);
const IMAGE = /\.(png|jpe?g|webp|gif|avif|bmp|tiff?|heic|ktx2)$/i;

export interface AssetBudget {
  triangles?: number;
  drawCalls?: number;
  materials?: number;
  bytes?: number;
  heightMin?: number;
  heightMax?: number;
  sidePx?: number;
}

export interface Budgets {
  asset: Record<string, AssetBudget>;
  place: Record<"firstLoad" | "interior" | "exterior", { drawCalls: number; triangles: number; bytes: number }> & { game: { bytes: number } };
}

export interface PlaceFile {
  place: string;
  scope: "exterior" | "interior";
  hub: boolean;
  instances: { file: string; count: number }[];
  people: { low: number; high: number; sample: string[] };
  groundRoadSky: { drawCalls: number; triangles: number };
}

export interface ReviewConfig {
  outlineMin: number;
  dimTolerancePct: number;
  minEach: number;
  minPhone: number;
  minMean: number;
}

export interface Measured {
  file: string;
  triangles: number;
  drawCalls: number;
  materials: number;
  bytes: number;
  minY: number;
  maxY: number;
  palette: string[];
  signs: number;
}

export interface Paths {
  root: string;
  source: string;
  public: string;
  dist: string;
}

export function defaultPaths(root: string): Paths {
  return { root, source: join(root, "assets-src"), public: join(root, "apps", "client", "public", "assets"), dist: join(root, "apps", "client", "dist") };
}

/** Every file under a folder, as paths relative to it with forward slashes. */
export function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) out.push(relative(dir, path).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/** A copy pnpm assets:publish wrote beside its source, named by its hash (city.md R-CITY-018): not a shipped name of its own. */
export function isPublishedCopy(file: string): boolean {
  return hashInName(file.split("/").pop() ?? "") !== null;
}

/** The files under public/assets the checks hold to R-ASSET-008 and the register: everything but the hashed copies. */
export function sourceFiles(files: readonly string[]): string[] {
  return files.filter((file) => !isPublishedCopy(file));
}

/** A row for media made outside public/assets: a path from the repository root, `#<name>` naming one piece in a file of code. */
export function isMediaRow(row: Pick<RegisterRow, "file">): boolean {
  return /^(apps|packages|prototypes)\//.test(row.file);
}

export function prefixOf(file: string): string {
  return (file.split("/").pop() ?? "").split("_")[0] ?? "";
}

/** 1. Every name under public/assets fits R-ASSET-008. */
export function checkNames(files: readonly string[]): string[] {
  return files
    .filter((file) => !DATA_FILES.has(file.split("/").pop() ?? ""))
    .filter((file) => !FILE_NAME.test(file.split("/").pop() ?? ""))
    .map((file) => `R-ASSET-008: ${file} is not named <prefix>_<name>[_<variant>].<glb|png|ktx2>`);
}

/** 2. One row per shipped file and one file per row, with the row's figures equal to the file's (R-ASSET-009). */
export function checkRegister(rows: readonly RegisterRow[], shipped: readonly Measured[]): string[] {
  const problems: string[] = [];
  const byFile = new Map(rows.map((row) => [row.file, row]));
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.file)) problems.push(`R-ASSET-009: ${row.file} has more than one register row`);
    seen.add(row.file);
  }
  for (const file of shipped) {
    const row = byFile.get(file.file);
    if (row === undefined) {
      problems.push(`R-ASSET-009: ${file.file} has no register row`);
      continue;
    }
    for (const key of ["triangles", "drawCalls", "materials", "bytes"] as const) {
      if (row[key] !== file[key]) problems.push(`R-ASSET-009: ${file.file} register says ${key} ${String(row[key])}, the file has ${String(file[key])}`);
    }
    if (row.paletteCheck?.passed !== true) problems.push(`R-ASSET-009: ${file.file} has no passed palette check in its register row`);
  }
  const files = new Set(shipped.map((file) => file.file));
  for (const row of rows) if (!isMediaRow(row) && !files.has(row.file)) problems.push(`R-ASSET-009: register row ${row.file} names no shipped file`);
  return problems;
}

/**
 * 2b. A row for media made outside public/assets names something that is there: the file, and the
 * piece after `#` written in it. A picture's bytes are the file's.
 */
export function checkMediaRows(rows: readonly RegisterRow[], read: (path: string) => Uint8Array | null): string[] {
  const problems: string[] = [];
  for (const row of rows.filter(isMediaRow)) {
    const [path = "", piece] = row.file.split("#");
    const bytes = read(path);
    if (bytes === null) {
      problems.push(`R-ASSET-009: register row ${row.file} names no file`);
      continue;
    }
    if (piece !== undefined && !Buffer.from(bytes).toString("utf8").includes(JSON.stringify(piece))) problems.push(`R-ASSET-009: register row ${row.file} names ${piece}, which ${path} does not hold`);
    if (piece === undefined && IMAGE.test(path) && row.bytes !== bytes.byteLength) problems.push(`R-ASSET-009: ${row.file} register says bytes ${String(row.bytes)}, the file has ${String(bytes.byteLength)}`);
  }
  return problems;
}

/**
 * 2c. Every row says whether it was generated, with which tool, and who approved it (guides.md
 * R-GUIDE-013); an AI-made row names its tool, and is accepted only once it names an approver (R-ASSET-015).
 */
export function checkMadeWith(rows: readonly RegisterRow[]): string[] {
  const problems: string[] = [];
  for (const row of rows) {
    const columns = row as unknown as Record<string, unknown>;
    const missing = [typeof columns.generated === "boolean" ? null : "generated", "tool" in columns && (row.tool === null || typeof row.tool === "string") ? null : "tool", "approvedBy" in columns && (row.approvedBy === null || typeof row.approvedBy === "string") ? null : "approvedBy"].filter((name) => name !== null);
    if (missing.length > 0) {
      problems.push(`R-GUIDE-013: register row ${row.file} has no ${missing.join(", ")}`);
      continue;
    }
    if (row.source === "ai-tool" && !row.generated) problems.push(`R-ASSET-015: ${row.file} comes from an AI tool and its row says it was not generated`);
    if (row.generated && (row.tool === null || row.tool.trim() === "")) problems.push(`R-ASSET-015: ${row.file} was made with an AI tool and its row names none`);
    if (row.generated && row.status === "accepted" && (row.approvedBy === null || row.approvedBy.trim() === "")) problems.push(`R-ASSET-015: ${row.file} was made with an AI tool and is accepted with no one named as approving it`);
  }
  return problems;
}

/** 3 and 5. Each file inside its prefix's budget (R-ASSET-007), standing on y = 0 at a height inside its range (R-ASSET-003). */
export function checkBudgets(shipped: readonly Measured[], budgets: Budgets): string[] {
  const problems: string[] = [];
  for (const file of shipped) {
    const prefix = prefixOf(file.file);
    const budget = budgets.asset[prefix];
    if (budget === undefined) {
      problems.push(`R-ASSET-007: ${file.file} has no budget for prefix ${prefix}`);
      continue;
    }
    for (const key of ["triangles", "drawCalls", "materials", "bytes"] as const) {
      const limit = budget[key];
      if (limit !== undefined && file[key] > limit) problems.push(`R-ASSET-007: ${file.file} has ${String(file[key])} ${key}, over its budget of ${String(limit)}`);
    }
    if (!file.file.endsWith(".glb")) continue;
    if (Math.abs(file.minY) > 0.01) problems.push(`R-ASSET-003: ${file.file} has its lowest point at ${file.minY.toFixed(3)} m, not 0 within 0.01 m`);
    const height = file.maxY - file.minY;
    if (budget.heightMin !== undefined && height < budget.heightMin - 1e-6) problems.push(`R-ASSET-007: ${file.file} is ${height.toFixed(2)} m high, under ${String(budget.heightMin)}`);
    if (budget.heightMax !== undefined && height > budget.heightMax + 1e-6) problems.push(`R-ASSET-007: ${file.file} is ${height.toFixed(2)} m high, over ${String(budget.heightMax)}`);
  }
  return problems;
}

/** 4. Every vertex colour and pixel is a palette entry (R-ASSET-001, R-ASSET-013). */
export function checkPaletteResults(shipped: readonly Measured[]): string[] {
  return shipped.flatMap((file) => file.palette.slice(0, 3).map((problem) => `R-ASSET-001: ${file.file}: ${problem}`));
}

/** 6. No image under assets-src or public/assets that the shooter or the pattern builder did not write (R-ASSET-011). */
export function checkImages(images: readonly { path: string; bytes: Uint8Array }[], manifest: Manifest): string[] {
  const problems: string[] = [];
  const known = { ...manifest.renders, ...manifest.patterns };
  for (const image of images) {
    const hash = known[image.path];
    if (hash === undefined) problems.push(`R-ASSET-011: ${image.path} is an image no tool wrote; reference photos never enter the repository`);
    else if (hash !== sha256(image.bytes)) problems.push(`R-ASSET-011: ${image.path} differs from the hash in assets-src/manifest.json`);
  }
  const present = new Set(images.map((image) => image.path));
  for (const path of Object.keys(known)) if (!present.has(path)) problems.push(`R-ASSET-011: assets-src/manifest.json lists ${path}, which is not there`);
  return problems;
}

/** The review that counts on a sheet: the sheet itself, or the last of its rounds; null for a place's sheet, which no register row reads. */
export function lastRound(sheet: ReviewSheet): Review | null {
  if (Array.isArray(sheet)) return sheet[sheet.length - 1] ?? null;
  return "scores" in sheet ? sheet : null;
}

/** 7. An accepted row has a passing review (R-ASSET-022) and, for a landmark, passing outline scores (R-ASSET-023). */
export function checkAccepted(rows: readonly RegisterRow[], reviews: ReadonlyMap<string, Review | null>, outlines: ReadonlyMap<string, Record<string, { passes: boolean }> | null>, config: ReviewConfig): string[] {
  const problems: string[] = [];
  for (const row of rows) {
    if (row.status !== "accepted") continue;
    const review = reviews.get(row.file) ?? null;
    if (review === null) {
      problems.push(`R-ASSET-022: ${row.file} is accepted with no review.json`);
      continue;
    }
    const scores = Object.entries(review.scores).filter((entry): entry is [string, number] => typeof entry[1] === "number");
    const low = scores.filter(([key, value]) => key !== "budget" && value < config.minEach);
    if (low.length > 0) problems.push(`R-ASSET-022: ${row.file} is accepted with ${low.map(([key]) => key).join(", ")} under ${String(config.minEach)}`);
    if ((review.scores.phone ?? 0) < config.minPhone) problems.push(`R-ASSET-022: ${row.file} is accepted with phone under ${String(config.minPhone)}`);
    const mean = scores.reduce((sum, [, value]) => sum + value, 0) / scores.length;
    if (mean < config.minMean) problems.push(`R-ASSET-022: ${row.file} is accepted with a mean of ${mean.toFixed(2)}, under ${String(config.minMean)}`);
    if (review.scores.budget === 0) problems.push(`R-ASSET-022: ${row.file} is accepted over budget`);
    if (prefixOf(row.file) === "lm") {
      const outline = outlines.get(row.file) ?? null;
      if (outline === null || Object.values(outline).some((view) => !view.passes) || Object.keys(outline).length < 2) {
        problems.push(`R-ASSET-023: ${row.file} is accepted without passing outline scores in at least two views`);
      }
    }
  }
  return problems;
}

export interface PlaceTotals {
  low: { drawCalls: number; triangles: number };
  high: { drawCalls: number; triangles: number };
  bytes: number;
}

/**
 * 8. A place's count of what is in view. Buildings and props are instanced, one draw call a file;
 * each building with signs adds one for its sign faces; shopfronts, landmarks, vehicles and people
 * count every instance. People are the sample's heaviest, times the mode's crowd.
 */
export function placeTotals(place: PlaceFile, measured: ReadonlyMap<string, Measured>): { totals: PlaceTotals; missing: string[] } {
  const missing: string[] = [];
  let drawCalls = place.groundRoadSky.drawCalls;
  let triangles = place.groundRoadSky.triangles;
  const files = new Set<string>();
  for (const instance of place.instances) {
    const file = measured.get(instance.file);
    if (file === undefined) {
      missing.push(instance.file);
      continue;
    }
    files.add(instance.file);
    const prefix = prefixOf(instance.file);
    const instanced = prefix === "bld" || prefix === "prop";
    drawCalls += instanced ? file.drawCalls : file.drawCalls * instance.count;
    if ((prefix === "bld" || prefix === "prop") && file.signs > 0) drawCalls += instance.count;
    triangles += file.triangles * instance.count;
  }
  let worstCalls = 0;
  let worstTriangles = 0;
  for (const sample of place.people.sample) {
    const file = measured.get(sample);
    if (file === undefined) {
      missing.push(sample);
      continue;
    }
    files.add(sample);
    worstCalls = Math.max(worstCalls, file.drawCalls);
    worstTriangles = Math.max(worstTriangles, file.triangles);
  }
  const bytes = [...files].reduce((sum, file) => sum + (measured.get(file)?.bytes ?? 0), 0);
  return {
    totals: {
      low: { drawCalls: drawCalls + worstCalls * place.people.low, triangles: triangles + worstTriangles * place.people.low },
      high: { drawCalls: drawCalls + worstCalls * place.people.high, triangles: triangles + worstTriangles * place.people.high },
      bytes,
    },
    missing,
  };
}

/**
 * The per-place row a mode is held to. The hub's low mode is the first load (code, the hub, one
 * character); its high mode is an exterior like any other.
 */
export function rowFor(place: Pick<PlaceFile, "hub" | "scope">, mode: "low" | "high", budgets: Budgets): { drawCalls: number; triangles: number } {
  if (place.hub && mode === "low") return budgets.place.firstLoad;
  return budgets.place[place.scope];
}

export function checkPlace(place: PlaceFile, measured: ReadonlyMap<string, Measured>, budgets: Budgets): string[] {
  const { totals, missing } = placeTotals(place, measured);
  const problems = missing.map((file) => `R-ASSET-007: ${place.place} lists ${file}, which is not shipped`);
  for (const mode of ["low", "high"] as const) {
    const scope = rowFor(place, mode, budgets);
    if (totals[mode].drawCalls > scope.drawCalls) problems.push(`R-ASSET-007: ${place.place} has ${String(totals[mode].drawCalls)} draw calls in ${mode} mode, over ${String(scope.drawCalls)}`);
    if (totals[mode].triangles > scope.triangles) problems.push(`R-ASSET-007: ${place.place} has ${String(totals[mode].triangles)} triangles in ${mode} mode, over ${String(scope.triangles)}`);
  }
  const scope = budgets.place[place.scope];
  if (!place.hub && totals.bytes > scope.bytes) problems.push(`R-ASSET-007: ${place.place} downloads ${String(totals.bytes)} bytes, over ${String(scope.bytes)}`);
  return problems;
}

/** 9. The first download (code, the hub's folder, one character) and the whole game fit (R-CITY-018). */
export function checkDownloads(measured: readonly Measured[], hubFolder: string | null, codeBytes: number, budgets: Budgets): string[] {
  const problems: string[] = [];
  const characters = measured.filter((file) => prefixOf(file.file) === "chr").map((file) => file.bytes);
  const hub = hubFolder === null ? 0 : measured.filter((file) => file.file.startsWith(`${hubFolder}/`)).reduce((sum, file) => sum + file.bytes, 0);
  const first = codeBytes + hub + Math.max(0, ...characters);
  if (first > budgets.place.firstLoad.bytes) problems.push(`R-CITY-018: the first download is ${String(first)} bytes, over ${String(budgets.place.firstLoad.bytes)}`);
  const all = codeBytes + measured.reduce((sum, file) => sum + file.bytes, 0);
  if (all > budgets.place.game.bytes) problems.push(`R-CITY-018: the game is ${String(all)} bytes, over ${String(budgets.place.game.bytes)}`);
  return problems;
}

export interface Credits {
  mapData: { text: string; link: string; sources: string[] }[];
  assets: { file: string; attribution: string }[];
  fonts: { family: string; attribution: string }[];
  generated: string;
}

export const OSM_CREDIT = "Map data from OpenStreetMap, available under the Open Database Licence";
export const GENERATED =
  "The city's models and people are written as code by an AI agent working for the studio, and each is reviewed against the style rules by a reviewer that did not build it before it ships. No image, voice or music in the game is generated.";

/** What credits.json must hold (R-CITY-021): the map data credit with every source, each register attribution, the fonts, and where generated media is used. */
export function expectedCredits(register: Register, mapSources: readonly string[]): Credits {
  const osm = [...new Set(mapSources.filter((source) => source.includes("openstreetmap.org")))].sort();
  return {
    mapData: osm.length > 0 ? [{ text: OSM_CREDIT, link: "https://www.openstreetmap.org/copyright", sources: osm }] : [],
    assets: register.rows.filter((row) => row.attribution !== null).map((row) => ({ file: row.file, attribution: row.attribution ?? "" })),
    fonts: register.fonts.map((font) => ({ family: font.family, attribution: font.attribution })),
    generated: GENERATED,
  };
}

/** 10. credits.json is what the register and the map data say it must be. */
export function checkCredits(actual: Credits | null, expected: Credits): string[] {
  if (actual === null) return ["R-CITY-021: public/assets/credits.json is missing"];
  return JSON.stringify(actual) === JSON.stringify(expected) ? [] : ["R-CITY-021: public/assets/credits.json does not match the register and the map data; run pnpm assets:credits"];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** The map data the game uses: every outline source and every place entry's data source. */
export function mapSources(paths: Paths, placeData: readonly string[]): string[] {
  const sources = [...placeData];
  for (const file of listFiles(paths.source).filter((path) => path.endsWith("outline.json"))) {
    const outline = readJson<{ views: { source: string }[] }>(join(paths.source, file));
    for (const view of outline.views) {
      const match = /https:\/\/www\.openstreetmap\.org\/\S+/.exec(view.source);
      if (match !== null) sources.push(match[0]);
    }
  }
  return sources;
}

export async function measureFile(paths: Paths, file: string): Promise<Measured> {
  const bytes = readFileSync(join(paths.public, file));
  if (!file.endsWith(".glb")) return { file, triangles: 0, drawCalls: 0, materials: 0, bytes: bytes.byteLength, minY: 0, maxY: 0, palette: [], signs: 0 };
  const doc = await readGlb(bytes);
  const figures = measure(doc, bytes.byteLength);
  const root = doc.getRoot().getDefaultScene()?.listChildren()[0];
  const signs = (root?.getExtras() as { signs?: unknown[] } | undefined)?.signs?.length ?? 0;
  return { file, ...figures, palette: checkPalette(doc).map((p) => `${p.where} ${p.rgb.join(",")} is not a palette colour`), signs };
}

function codeBytes(paths: Paths): number {
  return listFiles(paths.dist)
    .filter((file) => /\.(js|css|html)$/.test(file))
    .reduce((sum, file) => sum + statSync(join(paths.dist, file)).size, 0);
}

export async function runChecks(paths: Paths, placeData: readonly string[]): Promise<{ problems: string[]; notes: string[] }> {
  const notes: string[] = [];
  const budgets = readJson<Budgets>(join(paths.source, "budgets.json"));
  const config = readJson<ReviewConfig>(join(paths.source, "review.config.json"));
  const register = readJson<Register>(join(paths.source, "register.json"));
  const manifest = readJson<Manifest>(join(paths.source, "manifest.json"));
  const files = sourceFiles(listFiles(paths.public));
  const shippedFiles = files.filter((file) => !DATA_FILES.has(file.split("/").pop() ?? ""));
  const measured = await Promise.all(shippedFiles.map((file) => measureFile(paths, file)));
  const byFile = new Map(measured.map((file) => [file.file, file]));
  const readRepo = (path: string): Uint8Array | null => {
    const full = join(paths.root, path);
    return existsSync(full) && statSync(full).isFile() ? readFileSync(full) : null;
  };
  const problems = [
    ...checkNames(files),
    ...checkRegister(register.rows, measured),
    ...checkMediaRows(register.rows, readRepo),
    ...checkMadeWith(register.rows),
    ...checkBudgets(measured, budgets),
    ...checkPaletteResults(measured),
  ];

  const images = [
    ...listFiles(paths.source).filter((file) => IMAGE.test(file)).map((file) => ({ path: `assets-src/${file}`, bytes: readFileSync(join(paths.source, file)) })),
    ...files.filter((file) => IMAGE.test(file)).map((file) => ({ path: `apps/client/public/assets/${file}`, bytes: readFileSync(join(paths.public, file)) })),
  ];
  problems.push(...checkImages(images, manifest));

  // Each asset's source folder is the one whose render manifest names its shipped file.
  const folders = new Map<string, string>();
  for (const file of listFiles(paths.source).filter((path) => path.endsWith("renders/manifest.json"))) {
    const shipped = readJson<{ file: string }>(join(paths.source, file)).file.replace(/^public\/assets\//, "");
    folders.set(shipped, join(paths.source, file.replace(/\/renders\/manifest\.json$/, "")));
  }
  const reviews = new Map<string, Review | null>();
  const outlines = new Map<string, Record<string, { passes: boolean }> | null>();
  for (const row of register.rows) {
    const folder = folders.get(row.file) ?? null;
    const reviewPath = folder === null ? null : join(folder, "review.json");
    reviews.set(row.file, reviewPath !== null && existsSync(reviewPath) ? lastRound(readJson<ReviewSheet>(reviewPath)) : null);
    const scorePath = folder === null ? null : join(folder, "outline-score.json");
    outlines.set(row.file, scorePath !== null && existsSync(scorePath) ? readJson<{ scores: Record<string, { passes: boolean }> }>(scorePath).scores : null);
  }
  problems.push(...checkAccepted(register.rows, reviews, outlines, config));

  let hub: string | null = null;
  for (const file of files.filter((path) => path.endsWith("place.json"))) {
    const place = readJson<PlaceFile>(join(paths.public, file));
    if (place.hub) hub = file.replace(/\/place\.json$/, "");
    problems.push(...checkPlace(place, byFile, budgets));
  }
  const code = codeBytes(paths);
  if (code === 0) notes.push("The client is not built, so the first download counts no code; pnpm build first to count it.");
  problems.push(...checkDownloads(measured, hub, code, budgets));

  const creditsPath = join(paths.public, "credits.json");
  problems.push(...checkCredits(existsSync(creditsPath) ? readJson<Credits>(creditsPath) : null, expectedCredits(register, mapSources(paths, placeData))));
  return { problems, notes };
}

async function main(): Promise<void> {
  const root = join(import.meta.dirname, "..", "..");
  const { problems, notes } = await runChecks(defaultPaths(root), placeMapData());
  for (const note of notes) console.log(`note: ${note}`);
  for (const problem of problems) console.log(problem);
  console.log(problems.length === 0 ? "assets: every check passed" : `assets: ${String(problems.length)} problem(s)`);
  if (problems.length > 0) process.exit(1);
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) await main();
