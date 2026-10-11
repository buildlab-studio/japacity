// Every source the game cites, as one list (docs/rules/guides.md R-GUIDE-007): each guide's
// sources, each rule page's sources and the journalism the road's real-story cards draw on
// (road.md R-ROAD-011), each credit with its link and nothing from it reproduced. The documentation
// site builds its sources page from this at every build, so the list never goes stale.
// Plain data in, plain data out: the rule pages are read by the caller, who has the files.
import type { GuideEntry } from "@japacity/sim";

import { routeText } from "../route/route.text";
import { guideTable } from "./guide.data";
import { guideText } from "./guide.text";

export interface ListedSource {
  title: string;
  url: string;
  /** `YYYY-MM-DD`, or null when the page gives no date. */
  readOn: string | null;
}

/** A rule page's sources as the rule page reader gives them. */
export interface RulePageSources {
  /** The file name without `.md`: `route-gates`. */
  name: string;
  title: string;
  sources: readonly ListedSource[];
}

export interface SourcesList {
  guides: { id: string; title: string; sources: ListedSource[] }[];
  /** The real-story cards' credits, in their order; `link` is null for a credit content gives no link. */
  journalism: { credit: string; link: string | null }[];
  rules: { name: string; title: string; sources: ListedSource[] }[];
}

/** The list, grouped by guide, by the journalism and by rule page. Rule pages with no sources are left out. */
export function sourcesList(
  rulePages: readonly RulePageSources[],
  guides: Readonly<Record<string, GuideEntry>> = guideTable,
  text: Readonly<Record<string, string>> = { ...guideText, ...routeText },
): SourcesList {
  const journalism: SourcesList["journalism"] = [];
  for (let number = 1; text[`road.real-story.credit.${String(number)}`] !== undefined; number += 1) {
    journalism.push({ credit: text[`road.real-story.credit.${String(number)}`] ?? "", link: text[`road.real-story.link.${String(number)}`] ?? null });
  }
  return {
    guides: Object.values(guides).map((guide) => ({
      id: guide.id,
      title: text[`${guide.id}.title`] ?? guide.id,
      sources: guide.sources.map((source) => ({ title: source.title, url: source.url, readOn: source.readOn })),
    })),
    journalism,
    rules: rulePages
      .filter((page) => page.sources.length > 0)
      .map((page) => ({ name: page.name, title: page.title, sources: [...page.sources] }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
