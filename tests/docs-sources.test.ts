// The documentation site's sources page (docs/rules/guide.md R-GUIDE-007): the list its data loader
// builds at every build of the site, read here exactly as the page reads it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import loader, { loadSources } from "../docs/site/plays/sources.data";
import { content, readRulePage, sourcesList, text } from "../packages/content/src/index";

const root = fileURLToPath(new URL("..", import.meta.url));
const rulesDir = join(root, "docs", "rules");
const list = loader.load();

describe("the sources page of the documentation site", () => {
  test("[R-GUIDE-007] given every guide and every rule page, when the site's list is built, then each source is there with its link and date, grouped by guide and by rule page", () => {
    expect(list.guides.map((group) => group.id)).toEqual(Object.keys(content.guide));
    for (const guide of Object.values(content.guide)) {
      const group = list.guides.find((found) => found.id === guide.id);
      expect(group?.title).toBe(text[`${guide.id}.title`]);
      expect(group?.sources).toEqual(guide.sources);
    }
    const pages = readdirSync(rulesDir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => readRulePage(file.replace(/\.md$/, ""), readFileSync(join(rulesDir, file), "utf8")))
      .filter((page) => page.sources.length > 0);
    expect(pages.length).toBeGreaterThan(20);
    expect(list.rules.map((group) => group.name)).toEqual(pages.map((page) => page.name).sort((a, b) => a.localeCompare(b)));
    for (const page of pages) expect(list.rules.find((group) => group.name === page.name)?.sources).toEqual(page.sources);
    expect(list.rules.find((group) => group.name === "guides")?.sources[0]?.readOn).toBe("2026-10-08");
  });

  test("[R-GUIDE-007] given a rule page's sources changed, when the list is built again, then it shows the change: the page never goes stale", () => {
    const page = { name: "x", title: "X", sources: [{ title: "One", url: "https://one.example", readOn: "2026-10-07" }] };
    expect(sourcesList([page]).rules).toEqual([page]);
    expect(sourcesList([{ ...page, sources: [] }]).rules).toEqual([]);
    expect(loadSources(rulesDir)).toEqual(list);
  });

  test("[R-GUIDE-007] [R-ROAD-011] given the real-story cards, when the list is built, then every credit is there in order with its link from content where content has one, and nothing from the journalism is reproduced", () => {
    const credits = Object.keys(text).filter((key) => key.startsWith("road.real-story.credit.")).sort();
    expect(credits.length).toBeGreaterThanOrEqual(2);
    expect(list.journalism.map((item) => item.credit)).toEqual(credits.map((key) => text[key]));
    list.journalism.forEach((item, at) => expect(item.link).toBe(text[`road.real-story.link.${String(at + 1)}`] ?? null));
    expect(list.journalism.filter((item) => item.link !== null).length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(list)).not.toContain(text["road.real-story.line"]);
  });

  test("[R-ROAD-011] given the real-story card's words, when its links are read, then each link stands beside a credit in content and is an https address", () => {
    const links = Object.keys(text).filter((key) => key.startsWith("road.real-story.link."));
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const key of links) {
      expect(text[key.replace(".link.", ".credit.")]).toBeTruthy();
      expect(text[key]).toMatch(/^https:\/\/\S+$/);
    }
  });

  test("[R-GUIDE-007] given the documentation site, then the page reads the list from its loader and the sidebar of how it plays reaches it", () => {
    const page = readFileSync(join(root, "docs", "site", "plays", "sources.md"), "utf8");
    expect(page).toContain('import { data } from "./sources.data";');
    expect(readFileSync(join(root, "docs", "site", ".vitepress", "config.ts"), "utf8")).toContain('{ text: "Every source", link: "/plays/sources" }');
  });
});
