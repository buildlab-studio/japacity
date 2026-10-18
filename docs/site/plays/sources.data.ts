// The data of the sources page (guide:one-sources-page), built at every build of the site so it never
// goes stale: the guides' sources and the real-story cards' journalism from content, and each rule
// page's Sources list from docs/rules, read by the same reader as the game's numbers pages. Both
// are content's, imported by relative path, so the site bundles them into this loader.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { readRulePage } from "../../../packages/content/src/guide/guide.rules";
import { sourcesList, type SourcesList } from "../../../packages/content/src/guide/guide.sources";

const RULES = fileURLToPath(new URL("../../rules/", import.meta.url));

/** The list as the page shows it, from the rule pages in `rulesDir`. */
export function loadSources(rulesDir: string = RULES): SourcesList {
  const pages = readdirSync(rulesDir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => readRulePage(file.replace(/\.md$/, ""), readFileSync(join(rulesDir, file), "utf8")));
  return sourcesList(pages);
}

export default {
  watch: ["../../rules/*.md"],
  load: (): SourcesList => loadSources(),
};
