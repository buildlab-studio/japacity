// What the tools and the root guard tests share about the repository.
import { realpathSync } from "node:fs";
import { join } from "node:path";
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
