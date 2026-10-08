import { readFileSync } from "node:fs";
import { join } from "node:path";

import { content, staleGuides, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { CREDITS_PATH, guidePath, MADE_PATH, numbersPath, SOURCES_PATH } from "./paths";
import { isoDay, readRulePage } from "./rulePage";
import { renderSite, shownDay, type SiteInput, type SitePage } from "./site";
import { siteFiles } from "./site.files";

// Vitest runs from the repository root.
const clientRoot = join(process.cwd(), "apps", "client");
const files = siteFiles(clientRoot);
const TODAY = "2026-10-08";

function input(changes: Partial<SiteInput> = {}): SiteInput {
  return { ...files, content, text, today: TODAY, stale: staleGuides(content, TODAY), styles: ["/assets/index.css"], ...changes };
}

function site(changes: Partial<SiteInput> = {}): SitePage[] {
  return renderSite(input(changes));
}

function at(pages: readonly SitePage[], path: string): Document {
  const found = pages.find((page) => page.path === path);
  if (found === undefined) throw new Error(`No page at ${path}`);
  return new DOMParser().parseFromString(found.html, "text/html");
}

const pages = site();
const masters = at(pages, guidePath("guide.uk-masters"));

describe("the guide pages", () => {
  test("[R-GUIDE-005] given the content, when the site is built, then every guide is a plain page under /guides/ with no script, linking into the game", () => {
    const paths = pages.map((page) => page.path);
    for (const id of Object.keys(content.guide)) expect(paths).toContain(guidePath(id));
    expect(paths).toEqual(expect.arrayContaining(["/guides/", SOURCES_PATH, CREDITS_PATH, MADE_PATH]));
    for (const page of pages) {
      expect(page.html.startsWith("<!doctype html><html lang=\"en-NG\">")).toBe(true);
      expect(page.file).toBe(`${page.path.slice(1)}index.html`);
      const document = new DOMParser().parseFromString(page.html, "text/html");
      expect(document.querySelectorAll("script")).toHaveLength(0);
      expect(document.querySelector('a[href="/"]')).not.toBeNull();
      expect(document.querySelector('link[rel="stylesheet"]')?.getAttribute("href")).toBe("/assets/index.css");
    }
    expect(masters.title).toBe(`${text["guide.uk-masters.title"] ?? ""} | Japacity`);
  });

  test("[R-GUIDE-005] given a guide page, when its words are read, then they are the content's words, and a change to the content shows on the page", () => {
    const real = text["guide.uk-masters.section.real"] ?? "";
    const paragraphs = [...masters.querySelectorAll('[data-section="real"] p')].map((paragraph) => paragraph.textContent);
    expect(paragraphs).toEqual(real.split("\n\n"));
    const changed = at(site({ text: { ...text, "guide.uk-masters.section.real": "Changed words." } }), guidePath("guide.uk-masters"));
    expect(changed.querySelector('[data-section="real"] p')?.textContent).toBe("Changed words.");
    // The page's code holds no copy of a guide's words.
    const code = ["site.tsx", "site.entry.ts", "prerender.ts", "GuidesMenu.tsx"].map((file) => readFileSync(join(clientRoot, "src", "features", "guides", file), "utf8")).join("\n");
    const sentences = Object.keys(content.guide).flatMap((id) => (text[`${id}.section.game`] ?? "").split(". ").filter((sentence) => sentence.length > 30));
    expect(sentences.length).toBeGreaterThan(10);
    expect(sentences.filter((sentence) => code.includes(sentence))).toEqual([]);
  });

  test("[R-GUIDE-002] given a route's guide page, when it is read, then its three parts come in order under their headings", () => {
    const headings = [...masters.querySelectorAll("section[data-section] h2")].map((heading) => heading.textContent);
    expect(headings).toEqual([text["guide.page.heading.real"], text["guide.page.heading.game"], text["guide.page.heading.next"]]);
  });

  test("[R-GUIDE-003] given every guide page, when it is read, then it opens with the general information line and its checked date", () => {
    for (const guide of Object.values(content.guide)) {
      const document = at(pages, guidePath(guide.id));
      const opening = document.querySelector("article h1 + p");
      expect(opening?.textContent).toBe(`General information, checked on ${shownDay(guide.checkedOn)}. Not immigration, legal or financial advice.`);
    }
  });

  test("[R-GUIDE-004] given a guide on the stale list, when its page is built, then the notice shows above its body; given a fresh guide, then it does not", () => {
    expect(masters.querySelector("[data-stale]")).toBeNull();
    const later = "2027-04-09";
    const stale = at(site({ today: later, stale: staleGuides(content, later) }), guidePath("guide.uk-masters"));
    const notice = stale.querySelector("[data-stale]");
    expect(notice?.textContent).toBe("These rules may have changed since.");
    expect(notice?.nextElementSibling?.getAttribute("data-section")).toBe("real");
    expect(at(site({ today: "2027-04-08", stale: staleGuides(content, "2027-04-08") }), guidePath("guide.uk-masters")).querySelector("[data-stale]")).toBeNull();
  });

  test("[R-GUIDE-001] given a guide page, when its sources are read, then each links its source with the date it was read", () => {
    const guide = content.guide["guide.uk-masters"]!;
    const items = [...masters.querySelectorAll("article section:last-of-type li")];
    expect(items.map((item) => item.querySelector("a")?.getAttribute("href"))).toEqual(guide.sources.map((source) => source.url));
    expect(items[0]?.textContent).toContain(`read on ${shownDay(guide.sources[0]!.readOn)}`);
  });
});

describe("where the numbers come from", () => {
  test("[R-GUIDE-006] given every rule page with a Numbers table, when the site is built, then each has a page listing every row, and a working value says so", () => {
    const numbered = files.rulePages.map((page) => readRulePage(page.name, page.markdown)).filter((page) => page.numbers !== null);
    expect(numbered.map((page) => page.name)).toEqual(expect.arrayContaining(["guides", "route", "route-gates", "wallet"]));
    for (const rule of numbered) {
      const document = at(pages, numbersPath(rule.name));
      expect(document.querySelectorAll("tbody tr")).toHaveLength(rule.numbers!.rows.length);
    }
    const guides = at(pages, numbersPath("guides"));
    const stale = [...guides.querySelectorAll("tbody tr")].find((row) => row.textContent.includes("tuning.guide.staleMonths"));
    expect(stale?.hasAttribute("data-working")).toBe(true);
    expect(stale?.lastElementChild?.textContent).toBe("Working value");
    const sourced = [...guides.querySelectorAll("tbody tr")].find((row) => row.textContent.includes("Segwise"));
    expect(sourced?.hasAttribute("data-working")).toBe(false);
  });

  test("[R-GUIDE-006] given a route's guide, when its page is read, then it links the numbers pages of the kinds it explains", () => {
    const links = [...masters.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(links).toEqual(expect.arrayContaining([numbersPath("route"), numbersPath("route-gates"), numbersPath("wallet")]));
  });

  test("[R-GUIDE-006] given a rule page, when its dates and tables are read, then dates come out as days and links and code are kept apart", () => {
    expect(isoDay("All read 8 Oct 2026.")).toBe("2026-10-08");
    expect(isoDay("> Status: rules, 7 October 2026.")).toBe("2026-10-07");
    expect(isoDay("no date")).toBeNull();
    const page = readRulePage("x", "# X\n\n> Status: 7 Oct 2026.\n\n## Numbers\n\n| A | B |\n|---|---|\n| `x.y` 6 | working value |\n\n## Sources\n\n- [One](https://one.example), [Two](https://two.example)\n");
    expect(page.title).toBe("X");
    expect(page.numbers).toEqual({ header: ["A", "B"], rows: [{ cells: ["`x.y` 6", "working value"], working: true }] });
    expect(page.sources).toEqual([
      { title: "One", url: "https://one.example", readOn: "2026-10-07" },
      { title: "Two", url: "https://two.example", readOn: "2026-10-07" },
    ]);
  });
});

describe("the sources page", () => {
  const sources = at(pages, SOURCES_PATH);
  const links = new Set([...sources.querySelectorAll("a")].map((link) => link.getAttribute("href")));

  test("[R-GUIDE-007] given every guide and every rule page, when the sources page is read, then each source is linked there, grouped by subject", () => {
    for (const guide of Object.values(content.guide)) {
      for (const source of guide.sources) expect(links.has(source.url), source.url).toBe(true);
      expect(sources.querySelector(`[data-group="${guide.id}"]`)).not.toBeNull();
    }
    const rules = files.rulePages.map((page) => readRulePage(page.name, page.markdown)).filter((page) => page.sources.length > 0);
    expect(rules.length).toBeGreaterThan(20);
    for (const rule of rules) {
      expect(sources.querySelector(`[data-group="rules/${rule.name}"]`)).not.toBeNull();
      for (const source of rule.sources) expect(links.has(source.url), source.url).toBe(true);
    }
    const guidesPage = rules.find((rule) => rule.name === "guides");
    expect(guidesPage?.sources[0]?.readOn).toBe("2026-10-08");
  });

  test("[R-GUIDE-007] given the real-story cards, when the sources page is read, then their journalism is credited and not reproduced", () => {
    const group = sources.querySelector('[data-group="real-story"]');
    const credits = Object.keys(text).filter((key) => key.startsWith("road.real-story.credit."));
    expect(credits.length).toBeGreaterThanOrEqual(2);
    for (const key of credits) expect(group?.textContent).toContain(text[key]);
    expect(group?.querySelector("a")?.getAttribute("href")).toMatch(/^https:\/\//);
    expect(group?.textContent).not.toContain(text["road.real-story.line"]);
  });
});

describe("the credits", () => {
  const credits = at(pages, CREDITS_PATH);

  test("[R-GUIDE-008] given the credits page, when it is read, then it names the makers, the register's attributions, the fonts and the open source code with licences", () => {
    expect(credits.querySelector('[data-credits="people"] p')?.textContent).toBe("Al-Ameen Ogundiran and Japacity contributors");
    for (const font of files.credits.fonts) expect(credits.querySelector('[data-credits="fonts"]')?.textContent).toContain(font.attribution);
    const code = credits.querySelector('[data-credits="code"]')?.textContent ?? "";
    expect(code).toMatch(/react 19\.3\.\d+, MIT/);
    expect(code).not.toContain("@japacity");
    const withAssets = at(site({ credits: { ...files.credits, assets: [{ file: "x.glb", attribution: "A bus by Someone, CC BY 4.0" }] } }), CREDITS_PATH);
    expect(withAssets.querySelector('[data-credits="assets"] li')?.textContent).toBe("A bus by Someone, CC BY 4.0");
  });

  test("[R-GUIDE-008] given every guide page and the sources page, when their links are read, then each reaches the credits", () => {
    for (const page of pages) expect(new DOMParser().parseFromString(page.html, "text/html").querySelector(`a[href="${CREDITS_PATH}"]`), page.path).not.toBeNull();
  });

  test("[R-GUIDE-009] given map data from OpenStreetMap, when the credits are read, then they carry its line linked to the copyright page; with none, then no map line", () => {
    const line = credits.querySelector('[data-credits="map"] a');
    expect(line?.textContent).toBe("© OpenStreetMap contributors. Available under the Open Database License");
    expect(line?.getAttribute("href")).toBe("https://www.openstreetmap.org/copyright");
    const none = at(site({ credits: { ...files.credits, mapData: [] } }), CREDITS_PATH);
    expect(none.querySelector('[data-credits="map"]')).toBeNull();
    const overture = at(site({ credits: { ...files.credits, mapData: [{ text: "x", link: "https://docs.overturemaps.org/attribution/", sources: ["https://overturemaps.org (place.x)"] }] } }), CREDITS_PATH);
    expect(overture.querySelector('[data-credits="map"]')?.textContent).toContain(text["guide.page.credits.overture"]);
  });

  test("[R-GUIDE-010] given the credits page, when its licences are read, then code, docs, content and art, and the reserved name are stated", () => {
    const licences = credits.querySelector('[data-credits="licences"]')?.textContent ?? "";
    for (const words of ["Code: MIT.", "Docs: CC BY 4.0.", "Game content and art: CC BY-SA 4.0.", "The name Japacity and its logo are reserved."]) expect(licences).toContain(words);
  });
});

describe("how this game was made", () => {
  test("[R-GUIDE-011] given the page, when it is read, then it says by kind where generated media is used, that a person approved it, and links the register", () => {
    const made = at(pages, MADE_PATH);
    expect([...made.querySelectorAll("[data-made]")].map((item) => item.getAttribute("data-made"))).toEqual(["images", "clips", "voices", "music"]);
    expect(made.body.textContent).toContain(files.credits.generated);
    expect(made.body.textContent).toContain(text["guide.page.made.approved"]);
    expect(made.querySelector('a[href$="assets-src/register.json"]')).not.toBeNull();
    expect(at(pages, CREDITS_PATH).querySelector(`a[href="${MADE_PATH}"]`)).not.toBeNull();
  });
});
