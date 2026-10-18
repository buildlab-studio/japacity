// pnpm assets:export <name...> | examples | all
// Builds each model from its builder in Node, bakes it, compresses it, writes it under
// apps/client/public/assets, reads it back, checks its palette and fills its register row's
// measured columns (decision 0009 section 3). Nothing here opens a browser.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { type CatalogEntry, findEntries, PUBLIC } from "./catalog";
import { isMain, REPO_ROOT } from "../repo";
import { measure, readGlb, toDocument, writeGlb } from "./glb";
import { checkPalette } from "./palette-check";
import { readRegister, rowFor, writeRegister } from "./register";

export async function exportEntry(entry: CatalogEntry, today: string): Promise<{ bytes: Uint8Array; problems: string[] }> {
  const model = entry.build();
  const bytes = await writeGlb(toDocument(model));
  const path = join(PUBLIC, entry.file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  const doc = await readGlb(bytes);
  const figures = measure(doc, bytes.byteLength);
  const problems = checkPalette(doc).map((p) => `${p.where}: ${p.rgb.join(",")} is not a palette colour`);
  const register = readRegister();
  const row = rowFor(register, entry.file, { place: entry.place, author: entry.author }, today);
  row.triangles = figures.triangles;
  row.drawCalls = figures.drawCalls;
  row.materials = figures.materials;
  row.bytes = figures.bytes;
  row.paletteCheck = { passed: problems.length === 0, date: today };
  writeRegister(register);
  console.log(
    `${entry.name}: ${String(figures.triangles)} triangles, ${String(figures.drawCalls)} draw calls, ${String(figures.materials)} materials, ${String(figures.bytes)} bytes, ` +
      `height ${figures.maxY.toFixed(2)} m, lowest ${figures.minY.toFixed(3)} m -> ${relative(REPO_ROOT, path)}${problems.length > 0 ? ` PALETTE: ${problems.slice(0, 3).join("; ")}` : ""}`,
  );
  return { bytes, problems };
}

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  let failed = 0;
  for (const entry of findEntries(process.argv.slice(2))) {
    const { problems } = await exportEntry(entry, today);
    if (problems.length > 0) failed += 1;
  }
  if (failed > 0) {
    console.log(`${String(failed)} model(s) failed the palette check`);
    process.exit(1);
  }
}

if (isMain(import.meta.url)) await main();
