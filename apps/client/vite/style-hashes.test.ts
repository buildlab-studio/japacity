// server:csp-holds-every-page: the content policy allows the built pages' inline styles by their hashes and no other,
// and no style attribute at all, so the hashes are taken from the build and a style attribute stops it.
import { createHash } from "node:crypto";

import { describe, expect, test } from "vitest";

import { STYLE_HASHES_TOKEN, styleAttributes, styleHashes, withStyleHashes } from "./style-hashes.plugin";

const hashOf = (text: string) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

describe("the inline styles' hashes", () => {
  test("[server:csp-holds-every-page] given pages with inline styles, one repeated, when they are hashed, then each distinct style's text between its tags gives one sha256 source, in a stable order", () => {
    const splash = "body{margin:0}.splash{padding:22vh 16px}";
    const legal = "\n  main { max-width: 40rem; }\n";
    const pages = [`<head><style>${splash}</style></head>`, `<style media="all">${legal}</style><p>ẹ</p>`, `<style>${splash}</style>`];
    expect(styleHashes(pages)).toEqual([hashOf(splash), hashOf(legal)].sort());
    expect(styleHashes(["<p>no style</p>"])).toEqual([]);
    // The hash a browser takes: of the UTF-8 bytes of the text, as written.
    expect(hashOf("body{margin:0}")).toBe(`'sha256-${createHash("sha256").update(Buffer.from("body{margin:0}", "utf8")).digest("base64")}'`);
  });

  test("[server:csp-holds-every-page] given a headers file with the token, when the hashes are written, then each token becomes the hashes and the rest is as it was; a file with no token is unchanged", () => {
    const headers = `/*\n  Content-Security-Policy-Report-Only: style-src 'self' ${STYLE_HASHES_TOKEN}; style-src-attr 'none'\n`;
    expect(withStyleHashes(headers, ["'sha256-a'", "'sha256-b'"])).toBe("/*\n  Content-Security-Policy-Report-Only: style-src 'self' 'sha256-a' 'sha256-b'; style-src-attr 'none'\n");
    expect(withStyleHashes("/*\n  X-One: a\n", ["'sha256-a'"])).toBe("/*\n  X-One: a\n");
  });

  test("[server:csp-holds-every-page] given pages, when their style attributes are looked for, then an element with one is found and a style element, a data attribute or a word in the text is not", () => {
    expect(styleAttributes('<svg style="position:absolute" aria-hidden="true"></svg>')).toEqual(["<svg style="]);
    expect(styleAttributes('<div class="a" STYLE = "x">')).toEqual(['<div class="a" STYLE =']);
    expect(styleAttributes('<style>p{}</style><p data-style="x">style="no"</p><svg class="splash-defs"></svg>')).toEqual([]);
  });
});
