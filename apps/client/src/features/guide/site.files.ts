// The files the guide pages are built from, read in Node at build time: the rule pages and
// credits.json. The makers and the shipped packages' licences are the repository's own account
// (LICENSE, LICENSES.md, NOTICES.md), not a page of the site (guide.md R-GUIDE-008).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { CreditsFile } from "./site";
import type { SiteFiles } from "./site.entry";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** The files the pages are built from: the rule pages and credits.json. */
export function siteFiles(clientRoot: string): SiteFiles {
  const repo = join(clientRoot, "..", "..");
  const rules = join(repo, "docs", "rules");
  const rulePages = readdirSync(rules)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => ({ name: file.replace(/\.md$/, ""), markdown: readFileSync(join(rules, file), "utf8") }));
  const creditsPath = join(clientRoot, "public", "assets", "credits.json");
  const credits: CreditsFile = existsSync(creditsPath) ? readJson<CreditsFile>(creditsPath) : { mapData: [], assets: [], fonts: [], generated: "" };
  return { rulePages, credits };
}
