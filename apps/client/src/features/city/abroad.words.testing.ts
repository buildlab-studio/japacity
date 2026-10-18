// What the tests of the countries' words read: the game's own modules, the tests left out.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** The client's source folder. */
export const SRC = join(import.meta.dirname, "..", "..");

/** Every module under a folder, the tests left out. */
export function sources(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}
