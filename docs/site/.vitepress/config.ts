// The documentation site (VitePress). The site's own pages live in docs/site; the rule pages in docs/rules are the
// source of truth, so the site reads them where they are instead of copying them: the source folder is docs/, every
// other folder of docs/ is left out, and docs/site/* is served at the root.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { DefaultTheme, MarkdownOptions } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

import { toPosix } from "../../../tools/repo";

const here = dirname(fileURLToPath(import.meta.url));
const siteDir = resolve(here, "..");
const docsDir = resolve(siteDir, "..");
const rulesDir = join(docsDir, "rules");

const SERVED = new Set(["site", "rules"]);

/** Every folder of docs/ but the site and the rules, so a new folder never leaks into the site. */
const leftOut = readdirSync(docsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !SERVED.has(entry.name))
  .map((entry) => `${entry.name}/**`);

/** The rule pages by their own first heading, so the sidebar follows the pages. */
const rulePages: DefaultTheme.SidebarItem[] = readdirSync(rulesDir)
  .filter((name) => name.endsWith(".md"))
  .map((name) => {
    const heading = readFileSync(join(rulesDir, name), "utf8").split("\n", 1)[0] ?? name;
    return { text: heading.replace(/^#\s*/, ""), link: `/rules/${name.replace(/\.md$/, "")}` };
  })
  .sort((a, b) => (a.text ?? "").localeCompare(b.text ?? ""));

/** A path under docs/ as the site serves it: docs/site/* sits at the root. */
function served(fromDocs: string): string {
  const path = toPosix(fromDocs);
  return path.startsWith("site/") ? path.slice("site/".length) : path;
}

/**
 * The site's pages link by their path in the repository (docs/site/built/x.md to ../../rules/engine.md), so a link reads
 * the same on the repository's own pages. The site serves docs/site/* at the root, so each relative link is turned into
 * the served path before VitePress checks it.
 */
const sourceLinks: NonNullable<MarkdownOptions["config"]> = (md) => {
  md.core.ruler.push("source-links", (state) => {
    // VitePress hands the served path as `path` and the file's own path as `realPath`.
    const env = state.env as { realPath?: string };
    const file = env.realPath;
    if (file === undefined || !file.startsWith(siteDir + sep)) return;
    const page = served(relative(docsDir, file));
    for (const block of state.tokens) {
      for (const token of block.children ?? []) {
        if (token.type !== "link_open") continue;
        const href = token.attrGet("href");
        if (href === null || /^([a-z]+:|#|\/)/i.test(href)) continue;
        const [target = "", hash] = href.split("#", 2);
        const target_ = served(relative(docsDir, resolve(dirname(file), target)));
        let link = posix.relative(posix.dirname(page), target_);
        if (!link.startsWith(".")) link = `./${link}`;
        token.attrSet("href", hash === undefined ? link : `${link}#${hash}`);
      }
    }
  });
};

const built: DefaultTheme.SidebarItem[] = [
  {
    text: "How it is built",
    items: [
      { text: "Overview", link: "/built/" },
      { text: "The simulation", link: "/built/simulation" },
      { text: "The character", link: "/built/character" },
      { text: "Chapters and routes", link: "/built/chapters" },
      { text: "The content", link: "/built/content" },
      { text: "The client", link: "/built/client" },
      { text: "The server and the data", link: "/built/server" },
      { text: "From the browser to Postgres", link: "/built/infrastructure" },
      { text: "Working on it", link: "/built/working" },
      { text: "Run your own copy", link: "/built/your-own-copy" },
    ],
  },
];

const plays: DefaultTheme.SidebarItem[] = [
  {
    text: "How it plays",
    items: [{ text: "Overview", link: "/plays/" }],
  },
  {
    text: "Starting",
    items: [
      { text: "The front door", link: "/plays/front-door" },
      { text: "The first months", link: "/plays/first-months" },
      { text: "The ready lives", link: "/plays/ready-lives" },
    ],
  },
  {
    text: "A life in Lagos",
    items: [
      { text: "The city and the places", link: "/plays/city" },
      { text: "The home", link: "/plays/home" },
      { text: "The month and the Calendar", link: "/plays/month" },
      { text: "Money", link: "/plays/money" },
      { text: "The phone", link: "/plays/phone" },
      { text: "People", link: "/plays/people" },
      { text: "The Friday draw", link: "/plays/friday-draw" },
    ],
  },
  {
    text: "Leaving",
    items: [
      { text: "Papers and the file chapter", link: "/plays/papers" },
      { text: "Routes and japacity", link: "/plays/routes" },
      { text: "The interview and the set pieces", link: "/plays/interview" },
      { text: "The road", link: "/plays/road" },
      { text: "Abroad", link: "/plays/abroad" },
    ],
  },
  {
    text: "Around the game",
    items: [
      { text: "Share cards and the japa type", link: "/plays/share" },
      { text: "Settings and a new life", link: "/plays/settings" },
      { text: "Accounts", link: "/plays/accounts" },
      { text: "Moderation and the legal pages", link: "/plays/moderation" },
      { text: "Every source", link: "/plays/sources" },
    ],
  },
];

export default withMermaid({
  title: "Japacity",
  description: "How Japacity is built and how it plays.",
  lang: "en-GB",
  srcDir: "..",
  srcExclude: leftOut,
  rewrites: { "site/:rest*": ":rest*" },
  cleanUrls: true,
  // A diagram's labels are measured at mermaid's own line height; the page's taller paragraph line would clip them.
  head: [["style", {}, ".vp-doc .mermaid p { line-height: 1.5; margin: 0; }"]],
  lastUpdated: false,
  markdown: { config: sourceLinks },
  vite: { publicDir: join(siteDir, "public") },
  themeConfig: {
    nav: [
      { text: "How it is built", link: "/built/" },
      { text: "How it plays", link: "/plays/" },
      { text: "The rules", link: "/rules/engine" },
    ],
    sidebar: {
      "/built/": built,
      "/plays/": plays,
      "/rules/": [{ text: "The rules", items: rulePages }],
    },
    outline: { level: [2, 3] },
    search: { provider: "local" },
    footer: { message: "Code MIT, docs CC BY 4.0. See LICENSES.md in the repository." },
  },
  mermaid: { securityLevel: "strict" },
});
