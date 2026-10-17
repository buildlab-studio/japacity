import { readFileSync } from "node:fs";
import { join } from "node:path";

import { content, isoDay, readRulePage, staleGuides, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { guidePath, MADE_PATH, NUMBERS_PATH, numbersPath } from "./paths";
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
    expect(paths).toEqual(expect.arrayContaining(["/guides/", MADE_PATH]));
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
    expect(stale?.lastElementChild?.textContent).toBe(text["guide.page.numbers.working"]);
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

describe("the words a player reads", () => {
  const numbered = files.rulePages.map((page) => readRulePage(page.name, page.markdown)).filter((page) => page.numbers !== null);

  test("[R-GUIDE-006] given every page of the site, when it is read, then no number is called a working value: a player reads an estimate", () => {
    for (const page of pages) {
      const document = new DOMParser().parseFromString(page.html, "text/html");
      expect(`${page.path}: ${document.body.textContent}`).not.toMatch(/working value/i);
    }
    const guides = at(pages, numbersPath("guides"));
    const stale = [...guides.querySelectorAll("tbody tr")].find((row) => row.textContent.includes("tuning.guide.staleMonths"));
    expect(stale?.textContent.toLowerCase()).toContain(text["guide.page.numbers.estimate"]);
  });

  test("[R-GUIDE-006] given every rule page with numbers, then its numbers page has a name a player knows, and the lists and titles use it instead of the rule page's title", () => {
    expect(numbered.filter((page) => text[`guide.page.numbers.name.${page.name}`] === undefined).map((page) => page.name)).toEqual([]);
    // The numbers guide is served at the numbers index, and it alone: two pages never share a path.
    expect(guidePath("guide.numbers")).toBe(NUMBERS_PATH);
    expect(new Set(pages.map((page) => page.path)).size).toBe(pages.length);
    const index = at(pages, NUMBERS_PATH);
    const shown = [...index.querySelectorAll("article a")].filter((link) => link.getAttribute("href")?.startsWith(NUMBERS_PATH)).map((link) => link.textContent);
    expect([...shown].sort()).toEqual(numbered.map((page) => text[`guide.page.numbers.name.${page.name}`]).sort());
    const director = at(pages, numbersPath("director"));
    expect(director.querySelector("h1")?.textContent).toBe(`Where the numbers come from: ${text["guide.page.numbers.name.director"]!}`);
    const road = at(pages, guidePath("guide.road"));
    const listed = [...road.querySelectorAll("article a")].filter((link) => link.getAttribute("href")?.startsWith(NUMBERS_PATH)).map((link) => link.textContent);
    const titles = new Set(numbered.map((page) => page.title));
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.filter((name) => titles.has(name) && !Object.values(text).includes(name))).toEqual([]);
    expect(listed).not.toContain("Route gates: sponsor, points, endorsement, contract");
    expect(listed).not.toContain("Offers");
  });

  test("[R-GUIDE-001] given the guides' index, then each guide says which routes it serves, by name, or that it serves every route", () => {
    const index = at(pages, "/guides/");
    const lines = Object.values(content.guide).map((guide) => ({ guide, line: index.querySelector(`[data-guide="${guide.id}"] [data-routes]`)?.textContent ?? "" }));
    expect(lines.filter(({ guide }) => guide.routes.length === 0).map(({ line }) => line)).toEqual(expect.arrayContaining([text["guide.page.index.routes.zero"]]));
    const missing = lines.flatMap(({ guide, line }) => (guide.routes.length === 0 ? (line === text["guide.page.index.routes.zero"] ? [] : [guide.id]) : guide.routes.filter((route) => !line.includes(text[`${route}.name`]!))));
    expect(missing).toEqual([]);
  });

  test("[R-GUIDE-003] given every guide page, then each short name is spelled out where the page first uses it", () => {
    const short = ["UKCISA", "IOM", "CRS", "NAPTIP", "NMC", "UAE", "TB"];
    const unexplained = Object.values(content.guide).flatMap((guide) => {
      const body = [...at(pages, guidePath(guide.id)).querySelectorAll("[data-section]")].map((section) => section.textContent).join(" ");
      const bare = short.filter((name) => {
        const first = body.search(new RegExp(`\\b${name}\\b`));
        return first >= 0 && body.charAt(first - 1) !== "(";
      });
      const finance = body.indexOf("Appendix Finance");
      if (finance >= 0 && !body.startsWith("Appendix Finance, the part of the UK immigration rules on money", finance)) bare.push("Appendix Finance");
      return bare.map((name) => `${guide.id}: ${name}`);
    });
    expect(unexplained).toEqual([]);
  });
});

describe("how this game was made", () => {
  test("[R-GUIDE-011] given the page, when it is read, then it says by kind where generated media is used, that a person approved it, and links the register; no page links a credits page", () => {
    const made = at(pages, MADE_PATH);
    expect([...made.querySelectorAll("[data-made]")].map((item) => item.getAttribute("data-made"))).toEqual(["images", "clips", "voices", "music"]);
    expect(made.body.textContent).toContain(files.credits.generated);
    expect(made.body.textContent).toContain(text["guide.page.made.approved"]);
    // The voices line agrees with the register: the one generated voice, with its tool, and its lines shown as text.
    const voices = made.querySelector('[data-made="voices"]')?.textContent ?? "";
    const voiceRow = files.credits.assets.find((row) => row.file.includes("/voice/"));
    expect(voiceRow?.attribution).toContain("Kokoro-82M");
    expect(voices).toContain("Kokoro-82M");
    expect(voices).toContain("every line is also shown as text");
    expect(voices).not.toMatch(/no voice in the game is generated/i);
    // While the repository is private, the page links no register (R-GUIDE-011).
    expect(made.querySelector('a[href*="github.com"]')).toBeNull();
    // The credits are a screen of the game and the sources a page of the documentation site (R-GUIDE-007, R-GUIDE-008).
    const paths = pages.map((page) => page.path);
    expect(paths.filter((path) => path.startsWith("/guides/credits") || path.startsWith("/guides/sources"))).toEqual([]);
    const linking = pages.filter((page) => /href="\/guides\/(credits|sources)\//.test(page.html));
    expect(linking.map((page) => page.path)).toEqual([]);
  });
});
