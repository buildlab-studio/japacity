// The hashes of the built pages' inline styles, written into the built `_headers` in place of the token
// `{inline-style-hashes}`, so the content policy can allow exactly these styles and no other inline one
// (server:csp-holds-every-page). The build rewrites each page's style (the splash in index.html, the legal and official
// pages' own), so the hashes can only be taken from what it writes. A built page with a style attribute stops the
// build: the policy allows none, and an attribute cannot be allowed by its hash without 'unsafe-hashes'. Runs in Node,
// from vite.config.ts.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Plugin } from "vite";

/** Where the built `_headers` takes the hashes. */
export const STYLE_HASHES_TOKEN = "{inline-style-hashes}";

/** Every inline `<style>` element's text in a page, exactly as written between its tags. */
function inlineStyles(html: string): string[] {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1] ?? "");
}

/** The policy's source for each distinct inline style across the pages, in a stable order. */
export function styleHashes(pages: readonly string[]): string[] {
  const hashes = pages.flatMap(inlineStyles).map((text) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`);
  return [...new Set(hashes)].sort();
}

/** The start of each element in a page that carries a style attribute. */
export function styleAttributes(html: string): string[] {
  return [...html.matchAll(/<[a-z][\w-]*\b[^>]*?\sstyle\s*=/gi)].map((match) => match[0]);
}

/** The headers file with the token replaced by the hashes, or as it was when it has no token. */
export function withStyleHashes(headers: string, hashes: readonly string[]): string {
  return headers.split(STYLE_HASHES_TOKEN).join(hashes.join(" "));
}

export function inlineStyleHashes(): Plugin {
  return {
    name: "japacity-inline-style-hashes",
    apply: "build",
    writeBundle: {
      order: "post",
      handler(options, bundle) {
        const pages = Object.values(bundle).flatMap((output) => (output.type === "asset" && output.fileName.endsWith(".html") ? [{ file: output.fileName, html: typeof output.source === "string" ? output.source : new TextDecoder().decode(output.source) }] : []));
        const attributes = pages.flatMap((page) => styleAttributes(page.html).map((element) => `${page.file}: ${element}`));
        if (attributes.length > 0) throw new Error(`A built page carries a style attribute, which the content policy refuses:\n${attributes.join("\n")}`);
        const file = join(options.dir ?? "dist", "_headers");
        if (!existsSync(file)) return;
        writeFileSync(file, withStyleHashes(readFileSync(file, "utf8"), styleHashes(pages.map((page) => page.html))));
      },
    },
  };
}
