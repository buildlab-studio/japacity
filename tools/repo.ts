// What the tools and the root guard tests share about the repository.
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

/** The repository's root folder, without a trailing slash. */
export const REPO_ROOT = join(import.meta.dirname, "..");

/**
 * Whether the module at `moduleUrl` (its `import.meta.url`) is the script node was started with.
 * The entry is resolved through links first, so a script reached through a linked folder still counts.
 */
export function isMain(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return moduleUrl === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

/** The path with forward slashes, as the repository's files name each other. */
export function toPosix(path: string): string {
  return path.split(sep).join("/");
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Every file under a folder, as paths relative to it with forward slashes, in order. A missing folder has none. */
export function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) out.push(toPosix(relative(dir, path)));
    }
  };
  walk(dir);
  return out.sort();
}
