// Where the catalog's pictures go: CATALOG_DIR when it is set, else the build notes beside the main checkout, in a folder
// named for the commit shot (`../the notes commit>/`). The main checkout is found through git,
// so a worktree writes to the same notes as the main checkout does. Nothing is written under the repository.
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: HERE, encoding: "utf8" }).trim();
}

/** The commit the pictures are of, short. */
export function shortCommit(): string {
  return git("rev-parse", "--short", "HEAD");
}

/** The folder the pictures, the contact sheet and the checklist are written to. */
export function catalogDir(): string {
  const asked = process.env.CATALOG_DIR;
  if (asked !== undefined && asked !== "") return resolve(asked);
  const mainCheckout = dirname(git("rev-parse", "--path-format=absolute", "--git-common-dir"));
  return join(mainCheckout, ".catalog", shortCommit());
}

/** The file each test appends a line to for a screen it could not reach, read by the contact sheet. */
export const MISSED_FILE = "missed.jsonl";
