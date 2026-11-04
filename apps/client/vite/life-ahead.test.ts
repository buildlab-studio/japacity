// world:lazy-part-fails-softly: a browser that keeps a person is told the life's screens' files as the page loads, so they download
// beside the entry; a browser with none is told nothing.
import { runInNewContext } from "node:vm";

import { describe, expect, test } from "vitest";
import type { Rollup } from "vite";

import { PERSON_KEY } from "../src/shared/storage/storage";
import { lifeAheadScript, lifeFiles } from "./life-ahead.plugin";

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

/** The links the script adds to a page whose storage holds `kept` under the person's key, or throws on reading when `kept` is an Error. */
function linksAdded(script: string, kept: string | null | Error): { rel: string; as: string; href: string }[] {
  const added: { rel: string; as: string; href: string }[] = [];
  const document = {
    createElement: () => ({ rel: "", as: "", crossOrigin: null as string | null, href: "" }),
    head: { appendChild: (link: { rel: string; as: string; href: string }) => void added.push({ rel: link.rel, as: link.as, href: link.href }) },
  };
  const localStorage = {
    getItem: (key: string) => {
      if (kept instanceof Error) throw kept;
      return key === PERSON_KEY ? kept : null;
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

  test("[world:lazy-part-fails-softly] given a browser with no person kept, or storage that cannot be read, when the script runs, then nothing is asked for", () => {
    const script = lifeAheadScript(lifeFiles(bundle()));
    expect(linksAdded(script, null)).toEqual([]);
    expect(linksAdded(script, new Error("SecurityError"))).toEqual([]);
  });

  test("[world:lazy-part-fails-softly] given a build with no life's part, when the script is written, then it asks for nothing even for a kept person", () => {
    const script = lifeAheadScript({ scripts: [], styles: [] });
    expect(linksAdded(script, "{}")).toEqual([]);
  });
});
