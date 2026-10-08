// The files the guide pages are built from, read in Node at build time: the rule pages,
// credits.json, the makers from the code's licence, and the licences of the packages shipped.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { CreditsFile, ShippedPackage } from "./site";
import type { SiteFiles } from "./site.entry";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** The licences of the packages the client ships, read from each one's own package.json. */
function shippedPackages(clientRoot: string): ShippedPackage[] {
  const manifest = readJson<{ dependencies?: Record<string, string> }>(join(clientRoot, "package.json"));
  return Object.keys(manifest.dependencies ?? {})
    // Our own packages are the game; the Vite plugins ship no code.
    .filter((name) => !name.startsWith("@japacity/") && !name.includes("vite"))
    .sort()
    .map((name) => {
      const own = readJson<{ version?: string; license?: string }>(join(clientRoot, "node_modules", name, "package.json"));
      return { name, version: own.version ?? "", license: own.license ?? "" };
    });
}

/** The files the pages are built from: the rule pages, credits.json, the licence's makers and the shipped packages. */
export function siteFiles(clientRoot: string): SiteFiles {
  const repo = join(clientRoot, "..", "..");
  const rules = join(repo, "docs", "rules");
  const rulePages = readdirSync(rules)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => ({ name: file.replace(/\.md$/, ""), markdown: readFileSync(join(rules, file), "utf8") }));
  const creditsPath = join(clientRoot, "public", "assets", "credits.json");
  const credits: CreditsFile = existsSync(creditsPath) ? readJson<CreditsFile>(creditsPath) : { mapData: [], assets: [], fonts: [], generated: "" };
  const copyright = readFileSync(join(repo, "LICENSE"), "utf8")
    .split("\n")
    .find((line) => line.startsWith("Copyright"));
  const makers = (copyright ?? "").replace(/^Copyright \(c\) \d{4} /, "").trim();
  return { rulePages, credits, makers, packages: shippedPackages(clientRoot) };
}
