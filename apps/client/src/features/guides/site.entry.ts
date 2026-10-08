// What the prerender step loads through Vite: the content, its words and the pages, joined.
import { content, staleGuides, text } from "@japacity/content";

import { renderSite, type SiteInput, type SitePage } from "./site";

export type SiteFiles = Omit<SiteInput, "content" | "text" | "stale" | "today" | "styles" | "scripts">;

export function buildSite(files: SiteFiles, today: string, styles: readonly string[], scripts: readonly string[] = []): SitePage[] {
  return renderSite({ ...files, content, text, today, stale: staleGuides(content, today), styles, scripts });
}
