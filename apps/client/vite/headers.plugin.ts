// The platform's `_headers` file read as Cloudflare's static assets read it, so `vite preview` serves a build with the
// same headers production gives it: the content policy above all, which the browser tests run under
// (server:csp-reports-to-own-origin). The dev server is left alone: its own scripts are inline and change on every
// edit, so no shipped policy fits it. Runs in Node, from vite.config.ts.
import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import type { Plugin } from "vite";

/** One rule of the file: the path it matches, the headers it sets, and the earlier headers it takes off. */
export interface HeadersRule {
  path: string;
  set: [name: string, value: string][];
  detach: string[];
}

/** The file's rules in order. A path line starts at the left edge; its headers are the indented lines under it. */
export function parseHeaders(text: string): HeadersRule[] {
  const rules: HeadersRule[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      rules.push({ path: trimmed, set: [], detach: [] });
      continue;
    }
    const rule = rules.at(-1);
    if (rule === undefined) throw new Error(`A header comes before any path: ${trimmed}`);
    if (trimmed.startsWith("!")) {
      rule.detach.push(trimmed.slice(1).trim().toLowerCase());
      continue;
    }
    const colon = trimmed.indexOf(":");
    if (colon <= 0) throw new Error(`A header line has no name: ${trimmed}`);
    rule.set.push([trimmed.slice(0, colon).trim(), trimmed.slice(colon + 1).trim()]);
  }
  return rules;
}

/** Whether a rule's path matches a request's path: `*` is any run of characters, `:name` one segment. */
function matches(pattern: string, path: string): boolean {
  const source = pattern
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) => (part === "*" ? ".*" : part.startsWith(":") ? "[^/]+" : part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")))
    .join("");
  return new RegExp(`^${source}$`).test(path);
}

/**
 * The headers a path is served with: every matching rule in the file's order, a header set twice joined with a comma,
 * and a `! Name` line dropping what the rules before it set.
 */
export function headersFor(rules: readonly HeadersRule[], path: string): Map<string, string> {
  const found = new Map<string, { name: string; value: string }>();
  for (const rule of rules) {
    if (!matches(rule.path, path)) continue;
    for (const name of rule.detach) found.delete(name);
    for (const [name, value] of rule.set) {
      const key = name.toLowerCase();
      const before = found.get(key);
      found.set(key, { name, value: before === undefined ? value : `${before.value}, ${value}` });
    }
  }
  return new Map([...found.values()].map(({ name, value }) => [name, value]));
}

/**
 * Where the platform's default HTML handling sends a path ending in `.html`: to the address without it, `index.html`
 * to its folder. Null for any other path, which is served as it is.
 */
export function cleanHtmlPath(path: string): string | null {
  if (path.endsWith("/index.html")) return path.slice(0, -"index.html".length);
  if (path.endsWith(".html")) return path.slice(0, -".html".length);
  return null;
}

/**
 * `vite preview` with the build's `_headers` on every reply, read again on each request so an edit shows at once,
 * and the platform's move from an `.html` address to its clean one, which carries the headers too.
 */
export function previewHeaders(): Plugin {
  return {
    name: "japacity-preview-headers",
    configurePreviewServer(server) {
      const outDir = server.config.build.outDir;
      const file = join(isAbsolute(outDir) ? outDir : join(server.config.root, outDir), "_headers");
      server.middlewares.use((request, response, next) => {
        const [path = "/", query] = (request.url ?? "/").split("?", 2);
        for (const [name, value] of headersFor(parseHeaders(readFileSync(file, "utf8")), path)) response.setHeader(name, value);
        const clean = cleanHtmlPath(path);
        if (clean !== null) {
          response.statusCode = 307;
          response.setHeader("Location", query === undefined ? clean : `${clean}?${query}`);
          response.end();
          return;
        }
        next();
      });
    },
  };
}
