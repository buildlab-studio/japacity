// world:lazy-part-fails-softly: a browser that keeps a person or the mark of a life is told the life's screens' files by the page itself
// as it loads, so they download beside the entry; a browser with neither is told nothing. server:csp-reports-to-own-origin: the page's one
// inline script is allowed by its hash alone in both policies, and the build stops when the two disagree.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { describe, expect, test } from "vitest";
import type { Rollup } from "vite";

import { LIFE_MARK_KEY, PERSON_KEY } from "../src/shared/storage/storage";
import { inlineScripts, lifeAhead, lifeAheadScript, lifeFiles, scriptHash, scriptHashProblems, SCRIPT_HASHES_TOKEN, withLifeAhead, withScriptHashes } from "./life-ahead.plugin";

/** A bundle shaped as the client's: the entry and a chunk both sides share, the life's part with a chunk and styles of its own. */
function bundle(): Rollup.OutputBundle {
  const chunk = (fileName: string, facadeModuleId: string | null, imports: string[], isEntry = false, css: string[] = []) =>
    ({ type: "chunk", fileName, facadeModuleId, imports, isEntry, viteMetadata: { importedCss: new Set(css), importedAssets: new Set() } }) as unknown as Rollup.OutputChunk;
  return {
    "assets/index-A.js": chunk("assets/index-A.js", "/repo/apps/client/index.html", ["assets/shared-B.js"], true),
    "assets/shared-B.js": chunk("assets/shared-B.js", null, []),
    "assets/Life-C.js": chunk("assets/Life-C.js", "/repo/apps/client/src/app/Life.tsx", ["assets/shared-B.js", "assets/index-A.js", "assets/mode-D.js"], false, ["assets/Life-C.css"]),
    "assets/mode-D.js": chunk("assets/mode-D.js", null, []),
    "assets/CityScene-E.js": chunk("assets/CityScene-E.js", "/repo/apps/client/src/features/city/scene/CityScene.tsx", ["assets/mode-D.js"]),
  };
}

/** The links the script adds to a page whose storage holds `kept` under the person's key and `mark` under the life's mark, or throws on reading when `kept` is an Error. */
function linksAdded(script: string, kept: string | null | Error, mark: string | null = null): { rel: string; as: string; href: string }[] {
  const added: { rel: string; as: string; href: string }[] = [];
  const document = {
    createElement: () => ({ rel: "", as: "", crossOrigin: null as string | null, href: "" }),
    head: { appendChild: (link: { rel: string; as: string; href: string }) => void added.push({ rel: link.rel, as: link.as, href: link.href }) },
  };
  const localStorage = {
    getItem: (key: string) => {
      if (kept instanceof Error) throw kept;
      return key === PERSON_KEY ? kept : key === LIFE_MARK_KEY ? mark : null;
    },
  };
  runInNewContext(script, { document, localStorage });
  return added;
}

describe("the life's screens named as the page loads (world:lazy-part-fails-softly)", () => {
  test("[world:lazy-part-fails-softly] given a build with the life's part, when its files are read, then they are the part's scripts a first visit does not bring and its styles, never the entry's own chunks or a part fetched later", () => {
    expect(lifeFiles(bundle())).toEqual({ scripts: ["/assets/Life-C.js", "/assets/mode-D.js"], styles: ["/assets/Life-C.css"] });
  });

  test("[world:lazy-part-fails-softly] given a browser that keeps a person, when the script runs, then each of the part's scripts is preloaded as a module and its styles as a style", () => {
    const script = lifeAheadScript(lifeFiles(bundle()));
    expect(linksAdded(script, JSON.stringify({ look: "person_ada", name: "Ada", archetype: null }))).toEqual([
      { rel: "modulepreload", as: "", href: "/assets/Life-C.js" },
      { rel: "modulepreload", as: "", href: "/assets/mode-D.js" },
      { rel: "preload", as: "style", href: "/assets/Life-C.css" },
    ]);
  });

  test("[world:lazy-part-fails-softly] given a browser with no person kept but the mark that a life opened here, when the script runs, then the part's scripts and styles are preloaded as for a kept person", () => {
    const script = lifeAheadScript(lifeFiles(bundle()));
    expect(linksAdded(script, null, "1")).toEqual(linksAdded(script, JSON.stringify({ look: "person_ada", name: "Ada", archetype: null })));
    expect(linksAdded(script, null, "1")).toHaveLength(3);
  });

  test("[world:lazy-part-fails-softly] given a browser with no person kept and no mark, or storage that cannot be read, when the script runs, then nothing is asked for", () => {
    const script = lifeAheadScript(lifeFiles(bundle()));
    expect(linksAdded(script, null)).toEqual([]);
    expect(linksAdded(script, null, "0")).toEqual([]);
    expect(linksAdded(script, new Error("SecurityError"), "1")).toEqual([]);
  });

  test("[world:lazy-part-fails-softly] given a browser with a life, when the script runs, then it adds only link elements, each to one of the build's own files", () => {
    const files = lifeFiles(bundle());
    const added = linksAdded(lifeAheadScript(files), "{}", "1");
    expect(added.map((link) => link.href).sort()).toEqual([...files.scripts, ...files.styles].sort());
    expect(added.every((link) => link.href.startsWith("/assets/") && (link.rel === "modulepreload" || (link.rel === "preload" && link.as === "style")))).toBe(true);
  });

  test("[world:lazy-part-fails-softly] given a build with no life's part, when the script is written, then it asks for nothing even for a kept person", () => {
    const script = lifeAheadScript({ scripts: [], styles: [] });
    expect(linksAdded(script, "{}")).toEqual([]);
  });
});

/** A built page as the bundler writes it: the head's comment and deferred script, the splash's style, then the entry's tags. */
const PAGE = `<!doctype html>
<html>
  <head>
    <title>Japacity</title>
    <!-- Before the entry. -->
    <script defer src="/zod-jitless.js"></script>
    <style>body{margin:0}</style>
    <script type="module" crossorigin src="/assets/index-A.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/shared-B.js">
    <link rel="stylesheet" crossorigin href="/assets/index-A.css">
  </head>
  <body></body>
</html>`;

/** A `_headers` file's two policies, their script sources ending with the token. */
const HEADERS = `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${SCRIPT_HASHES_TOKEN}; style-src 'self' 'unsafe-inline'
  Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${SCRIPT_HASHES_TOKEN}; style-src 'self'
`;

describe("the hint in the page, and its hash in the content policy (world:lazy-part-fails-softly, server:csp-reports-to-own-origin)", () => {
  const hint = lifeAheadScript(lifeFiles(bundle()));

  test("[world:lazy-part-fails-softly] given the built page, when the hint is written into it, then it is one classic inline script ahead of every script, module preload and stylesheet, and a comment stays with the tag it was written for", () => {
    const page = withLifeAhead(PAGE, hint);
    expect(inlineScripts(page)).toEqual([hint]);
    const at = page.indexOf(`<script>${hint}</script>`);
    for (const tag of ["<!-- Before the entry. -->", "<script defer", '<script type="module"', '<link rel="modulepreload"', '<link rel="stylesheet"']) expect({ tag, after: page.indexOf(tag) > at }).toEqual({ tag, after: true });
    expect(page.replace(`<script>${hint}</script>\n    `, "")).toBe(PAGE);
  });

  test("[server:csp-reports-to-own-origin] given the hint's hash written into both policies, when the page and the headers are compared, then they agree, and no policy allows every inline script", () => {
    const page = withLifeAhead(PAGE, hint);
    const headers = withScriptHashes(HEADERS, [scriptHash(hint)]);
    expect(headers).toContain(`script-src 'self' 'wasm-unsafe-eval' ${scriptHash(hint)};`);
    expect(scriptHashProblems(headers, [{ file: "index.html", html: page }], hint)).toEqual([]);
    expect(scriptHash("alert(1)")).toBe("'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='");
  });

  test("[server:csp-reports-to-own-origin] given the page and the headers disagreeing, when they are compared, then each disagreement is named: a script changed after its hash, a hash in one policy only, a token left, every inline script allowed, an inline script on another page", () => {
    const page = withLifeAhead(PAGE, hint);
    const good = withScriptHashes(HEADERS, [scriptHash(hint)]);
    const changed = page.replace("modulepreload", "prefetch");
    expect(scriptHashProblems(good, [{ file: "index.html", html: changed }], hint).length).toBeGreaterThan(0);
    const oneOnly = withScriptHashes(HEADERS.replace(SCRIPT_HASHES_TOKEN, ""), [scriptHash(hint)]);
    expect(scriptHashProblems(oneOnly, [{ file: "index.html", html: page }], hint)).toEqual([expect.stringContaining("Content-Security-Policy allows the scripts (none)")]);
    expect(scriptHashProblems(HEADERS, [{ file: "index.html", html: page }], hint)).toEqual(expect.arrayContaining([expect.stringContaining(`still carries ${SCRIPT_HASHES_TOKEN}`)]));
    const loose = good.replaceAll("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    expect(scriptHashProblems(loose, [{ file: "index.html", html: page }], hint)).toEqual([expect.stringContaining("allows every inline script"), expect.stringContaining("allows every inline script")]);
    const other = { file: "privacy.html", html: `<script>${hint}</script>` };
    expect(scriptHashProblems(good, [{ file: "index.html", html: page }, other], hint)).toEqual([expect.stringContaining("privacy.html carries an inline script")]);
  });

  test("[server:csp-reports-to-own-origin] given a build's folder, when the plugin writes the hint and then the headers, then the built headers carry its hash in both policies; when the page is changed after, then the build stops", () => {
    const dir = mkdtempSync(join(tmpdir(), "life-ahead-"));
    try {
      const plugin = lifeAhead() as unknown as {
        configResolved: (config: { base: string }) => void;
        transformIndexHtml: { handler: (html: string, context: { path: string; bundle?: Rollup.OutputBundle }) => string };
        writeBundle: { handler: (options: { dir: string }) => void };
      };
      plugin.configResolved({ base: "/" });
      const page = plugin.transformIndexHtml.handler(PAGE, { path: "/index.html", bundle: bundle() });
      expect(plugin.transformIndexHtml.handler(PAGE, { path: "/guides/index.html", bundle: bundle() })).toBe(PAGE);
      writeFileSync(join(dir, "index.html"), page);
      writeFileSync(join(dir, "_headers"), HEADERS);
      plugin.writeBundle.handler({ dir });
      const written = readFileSync(join(dir, "_headers"), "utf8");
      expect(written.split(scriptHash(hint)).length - 1).toBe(2);
      expect(written).not.toContain(SCRIPT_HASHES_TOKEN);

      writeFileSync(join(dir, "index.html"), page.replace("modulepreload", "prefetch"));
      writeFileSync(join(dir, "_headers"), HEADERS);
      expect(() => plugin.writeBundle.handler({ dir })).toThrow(/inline script and the content policy disagree/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
