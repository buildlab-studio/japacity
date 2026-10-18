// The guide pages (docs/rules/guide.md): plain pages built at build time that load without the
// game, need no sign-in and link into it (guide:guides-are-open-pages). Every word comes from the content's text
// table passed in, so a page is the content's words, never a copy of them.
import { inline, readRulePage, type RulePage } from "@japacity/content";
import type { Content, Id } from "@japacity/sim";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { fill } from "../../shared/words/text";
import { GUIDES_ROOT, guidePath, MADE_PATH, numbersPath } from "./paths";

/** credits.json as tools/assets/credits.ts writes it (city:credits-screen-attributions). */
export interface CreditsFile {
  mapData: { text: string; link: string; sources: string[] }[];
  assets: { file: string; attribution: string }[];
  fonts: { family: string; attribution: string }[];
  generated: string;
}

export interface SiteInput {
  content: Content;
  text: Record<string, string>;
  /** `YYYY-MM-DD`: the build's date, for the stale notice (guide:guides-show-checked-date). */
  today: string;
  /** Guide ids not checked for `tuning.guide.staleMonths` months on `today`. */
  stale: readonly string[];
  /** Stylesheets each page links. */
  styles: readonly string[];
  /** Scripts each page loads, for the dev server's styles only. */
  scripts?: readonly string[];
  /** Every rule page, by file name without `.md`. */
  rulePages: readonly { name: string; markdown: string }[];
  /** credits.json, for its statement of where generated media is used. */
  credits: CreditsFile;
}

export interface SitePage {
  /** The URL path, ending in `/`. */
  path: string;
  /** The file to write, relative to the build's folder. */
  file: string;
  html: string;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-10-08` as "8 Oct 2026". */
export function shownDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${String(date)} ${SHORT_MONTHS[(month ?? 1) - 1] ?? ""} ${String(year)}`;
}

type Words = (key: string, params?: Record<string, string>) => string;

function wordsFrom(text: Record<string, string>): Words {
  return (key, params = {}) => fill(text[key] ?? key, params);
}

const LINK = "underline underline-offset-4 hover:text-ink";

/** A numbers page as a player knows that part of the game, never by its rule page's own title. */
function pageName(say: Words, text: Record<string, string>, page: RulePage): string {
  const key = `guide.page.numbers.name.${page.name}`;
  return text[key] === undefined ? page.title : say(key);
}

/** A Numbers cell as a player reads it: the rule page's "working value" is an estimate on a player's page. */
function plainCell(say: Words, cell: string): string {
  return cell.replace(/\bworking values?\b/gi, (found) => {
    const word = say(found.toLowerCase().endsWith("s") ? "guide.page.numbers.estimates" : "guide.page.numbers.estimate");
    return found.charAt(0) === "W" ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  });
}

/** The routes a guide serves, by name, as one line for the guides' index. */
function routesLine(say: Words, routes: readonly string[]): string {
  const names = routes.map((route) => say(`${route}.name`)).join(", ");
  const key = routes.length === 0 ? "guide.page.index.routes.zero" : routes.length === 1 ? "guide.page.index.routes.one" : "guide.page.index.routes";
  return say(key, { routes: names });
}

function Paragraphs({ words }: { words: string }) {
  return (
    <>
      {words.split("\n\n").map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </>
  );
}

function Page({ say, title, description, input, children }: { say: Words; title: string; description: string; input: SiteInput; children: ReactNode }) {
  return (
    <html lang="en-NG">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light dark" />
        <meta name="description" content={description} />
        <title>{`${title} | ${say("guide.page.game")}`}</title>
        {input.styles.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        {(input.scripts ?? []).map((src) => (
          <script key={src} type="module" src={src} />
        ))}
      </head>
      <body className="min-h-dvh bg-sheet text-ink">
        <header className="border-b border-sheet-line">
          <nav aria-label={say("guide.page.menu")} className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
            <a href="/" className="font-semibold">
              {say("guide.page.play")}
            </a>
            <a href={GUIDES_ROOT} className={LINK}>
              {say("guide.page.all-guides")}
            </a>
          </nav>
        </header>
        <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 leading-relaxed">{children}</main>
        <footer className="border-t border-sheet-line">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-6 text-sm text-text-2">
            <p>{say("guide.page.game-note")}</p>
            <p className="flex flex-wrap gap-x-4">
              <a href="/" className={LINK}>
                {say("guide.page.play")}
              </a>
              <a href={MADE_PATH} className={LINK}>
                {say("guide.page.made")}
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

function SourceList({ say, sources }: { say: Words; sources: readonly { title: string; url: string; readOn: string | null }[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5">
      {sources.map((source) => (
        <li key={source.url}>
          <a href={source.url} className={LINK} rel="noreferrer">
            {source.title}
          </a>
          {source.readOn === null ? null : <span className="text-text-2">, {say("guide.page.read-on", { date: shownDay(source.readOn) })}</span>}
        </li>
      ))}
    </ul>
  );
}

/** The numbers pages that belong to a kind: its own rule page and any named `<kind>-...`. */
function numbersPagesFor(kinds: readonly string[], pages: readonly RulePage[]): RulePage[] {
  return pages.filter((page) => page.numbers !== null && kinds.some((kind) => page.name === kind || page.name.startsWith(`${kind}-`)));
}

function GuidePage({ input, id, pages }: { input: SiteInput; id: Id<"guide">; pages: readonly RulePage[] }) {
  const say = wordsFrom(input.text);
  const guide = input.content.guide[id];
  if (guide === undefined) throw new Error(`No guide ${id}.`);
  const title = say(`${id}.title`);
  const numbers = id === "guide.numbers" ? pages.filter((page) => page.numbers !== null) : numbersPagesFor(guide.kinds, pages);
  return (
    <Page say={say} title={title} description={say("guide.page.opening", { date: shownDay(guide.checkedOn) })} input={input}>
      <article className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-text-2" data-opening>
          {say("guide.page.opening", { date: shownDay(guide.checkedOn) })}
        </p>
        {input.stale.includes(id) ? (
          <p role="note" className="rounded-md border border-sheet-line bg-sheet-muted px-3 py-2 font-semibold" data-stale>
            {say("guide.page.stale")}
          </p>
        ) : null}
        {guide.sections.map((section) => {
          const heading = input.text[`guide.page.heading.${section}`];
          return (
            <section key={section} className="flex flex-col gap-3" data-section={section}>
              {heading === undefined ? null : <h2 className="text-xl font-semibold">{heading}</h2>}
              <Paragraphs words={say(`${id}.section.${section}`)} />
            </section>
          );
        })}
        {numbers.length === 0 ? null : (
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">{say("guide.page.numbers.index")}</h2>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {numbers.map((page) => (
                <li key={page.name}>
                  <a href={numbersPath(page.name)} className={LINK}>
                    {pageName(say, input.text, page)}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{say("guide.page.sources")}</h2>
          <SourceList say={say} sources={guide.sources} />
        </section>
        <p>
          <a href="/" className="font-semibold underline underline-offset-4">
            {say("guide.page.play")}
          </a>
        </p>
      </article>
    </Page>
  );
}

function GuidesIndex({ input }: { input: SiteInput }) {
  const say = wordsFrom(input.text);
  return (
    <Page say={say} title={say("guide.page.index.title")} description={say("guide.page.index.intro")} input={input}>
      <h1 className="text-3xl font-bold">{say("guide.page.index.title")}</h1>
      <p>{say("guide.page.index.intro")}</p>
      <ul className="flex flex-col gap-2">
        {Object.values(input.content.guide).map((guide) => (
          <li key={guide.id} className="flex flex-col" data-guide={guide.id}>
            <a href={guidePath(guide.id)} className={LINK}>
              {say(`${guide.id}.title`)}
            </a>
            <span className="text-sm text-text-2" data-routes>
              {routesLine(say, guide.routes)}
            </span>
          </li>
        ))}
      </ul>
      <p>
        <a href={MADE_PATH} className={LINK}>
          {say("guide.page.made")}
        </a>
      </p>
    </Page>
  );
}

function NumbersPage({ input, page }: { input: SiteInput; page: RulePage }) {
  const say = wordsFrom(input.text);
  const title = say("guide.page.numbers.title", { page: pageName(say, input.text, page) });
  const table = page.numbers;
  if (table === null) throw new Error(`${page.name} has no Numbers table.`);
  return (
    <Page say={say} title={title} description={say("guide.page.numbers.intro")} input={input}>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p>{say("guide.page.numbers.intro")}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {table.header.map((cell) => (
                <th key={cell} className="border-b border-sheet-line p-2 font-semibold">
                  {plainCell(say, cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index} data-working={row.working ? "" : undefined}>
                {row.cells.map((cell, at) => (
                  <td key={at} className="border-b border-sheet-line p-2 align-top">
                    {inline(cell).map((part, partAt) =>
                      part.kind === "link" ? (
                        <a key={partAt} href={part.url} className={LINK} rel="noreferrer">
                          {part.text}
                        </a>
                      ) : part.kind === "code" ? (
                        <code key={partAt}>{part.text}</code>
                      ) : (
                        <span key={partAt}>{plainCell(say, part.text)}</span>
                      ),
                    )}
                  </td>
                ))}
                {row.working ? <td className="border-b border-sheet-line p-2 font-semibold">{say("guide.page.numbers.working")}</td> : <td className="border-b border-sheet-line p-2" />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {page.sources.length === 0 ? null : (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{say("guide.page.sources")}</h2>
          <SourceList say={say} sources={page.sources} />
        </section>
      )}
    </Page>
  );
}

function MadePage({ input }: { input: SiteInput }) {
  const say = wordsFrom(input.text);
  const kinds = ["images", "clips", "voices", "music"];
  return (
    <Page say={say} title={say("guide.page.made.title")} description={say("guide.page.made.intro")} input={input}>
      <h1 className="text-3xl font-bold">{say("guide.page.made.title")}</h1>
      <p>{say("guide.page.made.intro")}</p>
      <ul className="flex list-disc flex-col gap-2 pl-5">
        {kinds.map((kind) => (
          <li key={kind} data-made={kind}>
            {say(`guide.page.made.${kind}`)}
          </li>
        ))}
      </ul>
      <p className="font-semibold">{say("guide.page.made.approved")}</p>
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{say("guide.page.made.statement")}</h2>
        <p>{input.credits.generated}</p>
      </section>
    </Page>
  );
}

function page(path: string, element: ReactNode): SitePage {
  return { path, file: `${path.replace(/^\//, "")}index.html`, html: `<!doctype html>${renderToStaticMarkup(element)}` };
}

/** Every guide page, the guides' index, the numbers pages and how the game was made. The numbers guide is the index of the numbers pages. */
export function renderSite(input: SiteInput): SitePage[] {
  const rules = input.rulePages.map((rule) => readRulePage(rule.name, rule.markdown)).sort((a, b) => a.name.localeCompare(b.name));
  const numbered = rules.filter((rule) => rule.numbers !== null);
  return [
    page(GUIDES_ROOT, <GuidesIndex input={input} />),
    ...(Object.keys(input.content.guide) as Id<"guide">[]).map((id) => page(guidePath(id), <GuidePage input={input} id={id} pages={numbered} />)),
    ...numbered.map((rule) => page(numbersPath(rule.name), <NumbersPage input={input} page={rule} />)),
    page(MADE_PATH, <MadePage input={input} />),
  ];
}
