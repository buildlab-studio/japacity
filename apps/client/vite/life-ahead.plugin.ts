// world:lazy-part-fails-softly, engine:first-download-has-budget: the life's screens are a part apart from the start screen, and a
// browser that keeps a person opens a life on them. The entry can ask for them only once it has downloaded and run, so for that browser
// a small script the page loads beside the entry names them to the browser at once (`<link rel="modulepreload">` for the part's scripts
// a first visit does not bring, a style preload for its styles), and they download beside the entry instead of after it. A browser
// with no person kept is told nothing: its start screen keeps the connection to itself. The script has a fixed name at the root, so
// `_headers` serves it with no-cache like the page (server:production-and-staging), and it is written by every build, empty of names
// when the build has no such part.
import type { Plugin, Rollup } from "vite";

import { PERSON_KEY } from "../src/shared/storage/storage";

/** The script's address, beside the page. */
export const LIFE_AHEAD_FILE = "life-ahead.js";

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

/** The script: for a browser that keeps a person, a preload link for each file; for any other, nothing. Storage that throws counts as none. */
export function lifeAheadScript({ scripts, styles }: { scripts: readonly string[]; styles: readonly string[] }): string {
  return `(function () {
  try {
    if (localStorage.getItem(${JSON.stringify(PERSON_KEY)}) === null) return;
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

/** Writes the script beside the page and loads it from the page's head, ahead of the entry and without holding it up. */
export function lifeAhead(): Plugin {
  let base = "/";
  return {
    name: "japacity-life-ahead",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml() {
      return [{ tag: "script", attrs: { async: true, src: `${base}${LIFE_AHEAD_FILE}` }, injectTo: "head" }];
    },
    generateBundle(_options, bundle) {
      this.emitFile({ type: "asset", fileName: LIFE_AHEAD_FILE, source: lifeAheadScript(lifeFiles(bundle, base)) });
    },
  };
}
