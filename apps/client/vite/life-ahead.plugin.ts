// world:lazy-part-fails-softly, engine:first-download-has-budget: the life's screens are a part apart from the start screen, and a
// browser with a life (a kept person, or the mark that a life opened here: authority/lifeMark.ts) opens a life on them. The entry can ask
// for them only once it has downloaded and run, so for that browser a small script in the page itself names them to the browser as the
// page is read (`<link rel="modulepreload">` for the part's scripts a first visit does not bring, a style preload for its styles), and
// they download beside the entry instead of after it. In the page, not a file beside it, the names are known with the page, with no
// further round trip. A browser with neither is told nothing: its start screen keeps the connection to itself. The script is classic and
// inline, placed ahead of the page's first script and stylesheet so nothing holds it up, and the content policy allows it by its
// sha256 hash alone, which the build writes into `_headers` in place of `{inline-script-hashes}` in both policies
// (server:csp-reports-to-own-origin, server:csp-holds-every-page); the build stops when the page's inline scripts and those hashes
// disagree. It is written by every build, empty of names when the build has no such part.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Plugin, Rollup } from "vite";

import { LIFE_MARK_KEY, PERSON_KEY } from "../src/shared/storage/storage";

/** Where the built `_headers` takes the inline script's hash, in both policies' `script-src`. */
export const SCRIPT_HASHES_TOKEN = "{inline-script-hashes}";

type OutputBundle = Rollup.OutputBundle;
type OutputChunk = Rollup.OutputChunk;

const LIFE_SHELL = /[\\/]src[\\/]app[\\/]Life\.tsx$/;

function chunksOf(bundle: OutputBundle): Map<string, OutputChunk> {
  return new Map(Object.values(bundle).flatMap((file) => (file.type === "chunk" ? [[file.fileName, file] as const] : [])));
}

/** The files of the chunks given and of every chunk they import statically. */
function withImports(start: readonly string[], chunks: ReadonlyMap<string, OutputChunk>): Set<string> {
  const seen = new Set<string>();
  const queue = [...start];
  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    queue.push(...(chunks.get(file)?.imports ?? []));
  }
  return seen;
}

/** The life's scripts a first visit does not bring, and the styles they import, as the page's addresses. */
export function lifeFiles(bundle: OutputBundle, base = "/"): { scripts: string[]; styles: string[] } {
  const chunks = chunksOf(bundle);
  const shell = [...chunks.values()].find((chunk) => chunk.facadeModuleId !== null && LIFE_SHELL.test(chunk.facadeModuleId));
  if (shell === undefined) return { scripts: [], styles: [] };
  const first = withImports([...chunks.values()].filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName), chunks);
  const life = [...withImports([shell.fileName], chunks)].filter((file) => !first.has(file));
  const styles = life.flatMap((file) => [...((chunks.get(file) as (OutputChunk & { viteMetadata?: { importedCss: Set<string> } }) | undefined)?.viteMetadata?.importedCss ?? [])]);
  return { scripts: life.map((file) => `${base}${file}`), styles: styles.map((file) => `${base}${file}`) };
}

/**
 * The script: for a browser that keeps a person or the mark of a life, a preload link for each file; for any other, nothing. Storage that
 * throws counts as none. Only `link` elements, only to the build's own files.
 */
export function lifeAheadScript({ scripts, styles }: { scripts: readonly string[]; styles: readonly string[] }): string {
  return `(function () {
  try {
    if (localStorage.getItem(${JSON.stringify(PERSON_KEY)}) === null && localStorage.getItem(${JSON.stringify(LIFE_MARK_KEY)}) !== "1") return;
  } catch (e) {
    return;
  }
  function ask(href, rel, as) {
    var link = document.createElement("link");
    link.rel = rel;
    if (as) link.as = as;
    link.crossOrigin = "";
    link.href = href;
    document.head.appendChild(link);
  }
  ${JSON.stringify(scripts)}.forEach(function (href) { ask(href, "modulepreload"); });
  ${JSON.stringify(styles)}.forEach(function (href) { ask(href, "preload", "style"); });
})();
`;
}

/**
 * The page with the script in its head, ahead of the first script, module preload or stylesheet: a classic script waits for a
 * stylesheet before it, and the entry's own tags are what it runs beside. With none of them, at the head's end.
 */
export function withLifeAhead(html: string, script: string): string {
  const head = html.indexOf("</head>");
  const firsts = [/<script\b/i, /<link\b[^>]*\brel=["']?(?:modulepreload|stylesheet)\b/i].map((tag) => html.search(tag)).filter((at) => at >= 0 && (head < 0 || at < head));
  let at = firsts.length > 0 ? Math.min(...firsts) : head;
  if (at < 0) throw new Error("The page has no head to carry the life's hint.");
  // A comment written for the tag that follows stays with that tag.
  const comment = html.lastIndexOf("<!--", at);
  const ends = comment < 0 ? -1 : html.indexOf("-->", comment) + "-->".length;
  if (comment >= 0 && ends > 2 && ends <= at && html.slice(ends, at).trim() === "") at = comment;
  return `${html.slice(0, at)}<script>${script}</script>\n    ${html.slice(at)}`;
}

/** Every inline script element's text in a page (one with no `src`), exactly as written between its tags. */
export function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter((match) => !/\ssrc\s*=/i.test(` ${match[1] ?? ""}`)).map((match) => match[2] ?? "");
}

/** The policy's source for a script's text. */
export function scriptHash(text: string): string {
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

/** The headers file with the token replaced by the hashes, or as it was when it has no token. */
export function withScriptHashes(headers: string, hashes: readonly string[]): string {
  return headers.split(SCRIPT_HASHES_TOKEN).join(hashes.join(" "));
}

/** Each content policy's `script-src` sources in a headers file, by the policy's header name. */
function scriptSources(headers: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const match of headers.matchAll(/^\s+(Content-Security-Policy(?:-Report-Only)?):\s*(.*)$/gm)) {
    const directive = (match[2] ?? "")
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .find(([name]) => name === "script-src");
    found.set(match[1] ?? "", directive?.slice(1) ?? []);
  }
  return found;
}

/**
 * What stops the build: the built pages' inline scripts and the built `_headers` disagree. Each policy (the enforced one and the one that
 * reports) must allow every inline script by its hash and allow no other hash, no `'unsafe-inline'`, and no token left unwritten; only
 * the main page may carry an inline script, and only the life's hint.
 */
export function scriptHashProblems(headers: string, pages: readonly { file: string; html: string }[], hint: string | null): string[] {
  const problems: string[] = [];
  const scripts = pages.flatMap((page) => inlineScripts(page.html).map((text) => ({ file: page.file, text })));
  for (const script of scripts) {
    if (script.file !== "index.html") problems.push(`${script.file} carries an inline script; only the main page carries one, the life's hint.`);
    else if (script.text !== hint) problems.push("index.html carries an inline script that is not the life's hint.");
  }
  const wanted = [...new Set(scripts.map((script) => scriptHash(script.text)))].sort();
  const policies = scriptSources(headers);
  for (const name of ["Content-Security-Policy", "Content-Security-Policy-Report-Only"]) {
    const sources = policies.get(name);
    if (sources === undefined) {
      problems.push(`_headers has no ${name}.`);
      continue;
    }
    const hashes = sources.filter((source) => source.startsWith("'sha256-")).sort();
    if (JSON.stringify(hashes) !== JSON.stringify(wanted)) problems.push(`${name} allows the scripts ${hashes.join(" ") || "(none)"} by hash, but the pages' inline scripts are ${wanted.join(" ") || "(none)"}.`);
    if (sources.includes("'unsafe-inline'")) problems.push(`${name} allows every inline script.`);
    if (sources.includes(SCRIPT_HASHES_TOKEN)) problems.push(`${name} still carries ${SCRIPT_HASHES_TOKEN}.`);
  }
  return problems;
}

/** Every page under the build's folder, read from disk once the build has written it, public/'s copies among them. */
function builtPages(dir: string): { file: string; html: string }[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".html"))
    .sort()
    .map((file) => ({ file: file.split("\\").join("/"), html: readFileSync(join(dir, file), "utf8") }));
}

/** Writes the script into the page's head, then its hash into the built `_headers`, and stops the build if they disagree. */
export function lifeAhead(): Plugin {
  let base = "/";
  let hint: string | null = null;
  return {
    name: "japacity-life-ahead",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        if (context.bundle === undefined || context.path !== "/index.html") return html;
        hint = lifeAheadScript(lifeFiles(context.bundle, base));
        return withLifeAhead(html, hint);
      },
    },
    writeBundle: {
      order: "post",
      handler(options) {
        const dir = options.dir ?? "dist";
        const file = join(dir, "_headers");
        if (!existsSync(file)) return;
        const pages = builtPages(dir);
        const headers = withScriptHashes(readFileSync(file, "utf8"), [...new Set(pages.flatMap((page) => inlineScripts(page.html)).map(scriptHash))].sort());
        const problems = scriptHashProblems(headers, pages, hint);
        if (problems.length > 0) throw new Error(`The page's inline script and the content policy disagree:\n${problems.join("\n")}`);
        writeFileSync(file, headers);
      },
    },
  };
}
