// pnpm notices: writes NOTICES.md at the repository's root, the open source packages the game's
// client ships with their versions and licences (docs/rules/guide.md R-GUIDE-008). Read from the
// client's dependencies and each package's own package.json; a test fails when the file and the
// dependencies disagree, so the file is never stale.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { isMain, readJson, REPO_ROOT } from "./repo";

export interface ShippedPackage {
  name: string;
  version: string;
  license: string;
}

/** The packages the client ships, read from each one's own package.json. */
export function shippedPackages(clientRoot: string): ShippedPackage[] {
  const manifest = readJson<{ dependencies?: Record<string, string> }>(join(clientRoot, "package.json"));
  return Object.keys(manifest.dependencies ?? {})
    // Our own packages are the game; the Vite plugins ship no code.
    .filter((name) => !name.startsWith("@japacity/") && !name.includes("vite"))
    .sort()
    .map((name) => {
      const own = readJson<{ version?: string; license?: unknown }>(join(clientRoot, "node_modules", name, "package.json"));
      return { name, version: own.version ?? "", license: typeof own.license === "string" ? own.license : "" };
    });
}

/** NOTICES.md as the tool writes it: one table, the licence's name only; each package's own files carry its text. */
export function noticesFile(packages: readonly ShippedPackage[]): string {
  return [
    "# Notices",
    "",
    "The open source packages the game's client ships, each under its own licence. The licence's text and the copyright are in each package's own files. The game's own licences are in [LICENSES.md](LICENSES.md).",
    "",
    "Written by `pnpm notices` from the client's dependencies (`apps/client/package.json`). A test fails when the two disagree.",
    "",
    "| Package | Version | Licence |",
    "|---|---|---|",
    ...packages.map((shipped) => `| ${shipped.name} | ${shipped.version} | ${shipped.license === "" ? "see the package" : shipped.license} |`),
    "",
  ].join("\n");
}

export const CLIENT_ROOT = join(REPO_ROOT, "apps", "client");
export const NOTICES_PATH = join(REPO_ROOT, "NOTICES.md");

function main(): void {
  const packages = shippedPackages(CLIENT_ROOT);
  writeFileSync(NOTICES_PATH, noticesFile(packages));
  console.log(`notices: ${String(packages.length)} package(s) written to NOTICES.md`);
}

if (isMain(import.meta.url)) main();
