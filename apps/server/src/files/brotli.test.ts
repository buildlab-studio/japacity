// server:production-and-staging: the bundled scripts and styles go to a browser that takes brotli as the build's copy at the best level,
// with the file's own headers; everything else is the platform's own answer, and a copy is never served under its own name.
import { brotliCompressSync } from "node:zlib";

import { describe, expect, test } from "vitest";

import { served } from "../security/noindex";
import { fileReply, takesBrotli } from "./brotli";

const SITE = "https://japacity.app";
const SCRIPT = "/assets/index-AbCd1234.js";
const SOURCE = "console.log('the game');".repeat(40);
const COPY_BYTES = brotliCompressSync(Buffer.from(SOURCE));

/** The headers `_headers` gives every file under /assets/ today, as the platform hands them back. */
const FILE_HEADERS = {
  "content-type": "application/javascript",
  "cache-control": "public, max-age=31536000, immutable",
  "content-security-policy": "default-src 'self'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

interface Asked {
  path: string;
  method: string;
  ifNoneMatch: string | null;
}

/**
 * The client's files as the ASSETS binding serves them: the script with its copy beside it, the page for any path that is no file
 * (the single-page fallback), a 304 for a matching tag. `withCopy` false leaves the copy out.
 */
function clientFiles(asked: Asked[], withCopy = true): Fetcher {
  const fetch = (input: RequestInfo | URL): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input);
    const path = new URL(request.url).pathname;
    asked.push({ path, method: request.method, ifNoneMatch: request.headers.get("if-none-match") });
    const head = request.method === "HEAD";
    if (path === SCRIPT) return Promise.resolve(new Response(head ? null : SOURCE, { headers: { ...FILE_HEADERS, etag: '"plain"' } }));
    if (path === `${SCRIPT}.br` && withCopy) {
      if (request.headers.get("if-none-match") === '"copy"') return Promise.resolve(new Response(null, { status: 304, headers: { ...FILE_HEADERS, "content-type": "application/x-brotli", etag: '"copy"' } }));
      return Promise.resolve(new Response(head ? null : COPY_BYTES, { headers: { ...FILE_HEADERS, "content-type": "application/x-brotli", etag: '"copy"', "content-length": String(COPY_BYTES.length) } }));
    }
    return Promise.resolve(new Response(head ? null : "<!doctype html>", { headers: { "content-type": "text/html", "cache-control": "public, max-age=31536000, immutable" } }));
  };
  return { fetch } as unknown as Fetcher;
}

/** A request as the edge hands it to the Worker: `Accept-Encoding` rewritten, the browser's own value kept in `cf`. */
function fromBrowser(path: string, accepts: string, headers: Record<string, string> = {}, method = "GET"): Request {
  const request = new Request(`${SITE}${path}`, { method, headers: { "accept-encoding": "br, gzip", ...headers } });
  Object.defineProperty(request, "cf", { value: { clientAcceptEncoding: accepts } });
  return request;
}

function game(called: string[]): (request: Request) => Promise<Response> {
  return (request) => {
    called.push(new URL(request.url).pathname);
    return Promise.resolve(new Response("Not Found", { status: 404 }));
  };
}

describe("the bundled files served as brotli", () => {
  test("[server:production-and-staging] given a browser that takes brotli, when a bundled script is asked for, then the copy's bytes come back marked br with the script's own type, caching and policies, the copy's tag and Vary", async () => {
    const asked: Asked[] = [];
    const reply = await fileReply(fromBrowser(SCRIPT, "gzip, deflate, br, zstd"), clientFiles(asked));
    expect(reply.status).toBe(200);
    expect(Buffer.from(await reply.arrayBuffer()).equals(COPY_BYTES)).toBe(true);
    expect(reply.headers.get("content-encoding")).toBe("br");
    expect(reply.headers.get("vary")).toBe("Accept-Encoding");
    expect(reply.headers.get("content-type")).toBe(FILE_HEADERS["content-type"]);
    for (const name of ["cache-control", "content-security-policy", "x-content-type-options", "x-frame-options"] as const) expect(reply.headers.get(name)).toBe(FILE_HEADERS[name]);
    expect(reply.headers.get("etag")).toBe('"copy"');
    expect(reply.headers.get("content-length")).toBe(String(COPY_BYTES.length));
    expect(asked.map(({ path, method }) => `${method} ${path}`).sort()).toEqual([`GET ${SCRIPT}.br`, `HEAD ${SCRIPT}`]);
  });

  test("[server:production-and-staging] given a browser that takes only gzip, though the edge's own header names br, when a bundled script is asked for, then the platform's answer comes back unchanged", async () => {
    const asked: Asked[] = [];
    const reply = await fileReply(fromBrowser(SCRIPT, "gzip, deflate"), clientFiles(asked));
    expect(await reply.text()).toBe(SOURCE);
    expect(reply.headers.get("content-encoding")).toBeNull();
    expect(reply.headers.get("etag")).toBe('"plain"');
    expect(asked.map(({ path }) => path)).toEqual([SCRIPT]);
  });

  test("[server:production-and-staging] given a copy's own address, when it is asked for, then it is not found and no file is read", async () => {
    const asked: Asked[] = [];
    const reply = await fileReply(fromBrowser(`${SCRIPT}.br`, "br"), clientFiles(asked));
    expect(reply.status).toBe(404);
    expect(reply.headers.get("x-content-type-options")).toBe("nosniff");
    expect(reply.headers.get("cache-control")).toBe("no-store");
    expect(asked).toEqual([]);
  });

  test("[server:production-and-staging] given the copy's tag kept by the browser, when the script is asked for again, then a 304 with no body keeps the encoding's headers", async () => {
    const asked: Asked[] = [];
    const reply = await fileReply(fromBrowser(SCRIPT, "br", { "if-none-match": '"copy"' }), clientFiles(asked));
    expect(reply.status).toBe(304);
    expect(reply.body).toBeNull();
    expect(reply.headers.get("content-encoding")).toBe("br");
    expect(reply.headers.get("etag")).toBe('"copy"');
    // The plain file is read whole for its headers; only the copy is asked whether it changed.
    expect(asked.find(({ method }) => method === "HEAD")?.ifNoneMatch).toBeNull();
  });

  test("[server:production-and-staging] given a script with no copy beside it, when a browser that takes brotli asks for it, then the platform's answer comes back unchanged", async () => {
    const reply = await fileReply(fromBrowser(SCRIPT, "br"), clientFiles([], false));
    expect(await reply.text()).toBe(SOURCE);
    expect(reply.headers.get("content-encoding")).toBeNull();
  });

  test("[server:production-and-staging] given a HEAD, a range or a file that is not a bundled script or style, then the copy is not read for a range or another file, and HEAD gets the copy's headers with no body", async () => {
    const asked: Asked[] = [];
    const head = await fileReply(fromBrowser(SCRIPT, "br", {}, "HEAD"), clientFiles(asked));
    expect(head.headers.get("content-encoding")).toBe("br");
    expect(head.body).toBeNull();
    asked.length = 0;
    const ranged = await fileReply(fromBrowser(SCRIPT, "br", { range: "bytes=0-9" }), clientFiles(asked));
    expect(ranged.headers.get("content-encoding")).toBeNull();
    const model = await fileReply(fromBrowser("/assets/place-AbCd1234.glb", "br"), clientFiles(asked));
    expect(model.headers.get("content-encoding")).toBeNull();
    expect(asked.map(({ path }) => path)).toEqual([SCRIPT, "/assets/place-AbCd1234.glb"]);
  });

  test("[server:production-and-staging] given no NOINDEX, as in production, when a copy's own address reaches the Worker, then it is not found without the game, and every other path still goes to the game untouched", async () => {
    const called: string[] = [];
    const copy = await served(fromBrowser(`${SCRIPT}.br`, "br"), {}, game(called));
    const missing = await served(fromBrowser(SCRIPT, "br"), {}, game(called));
    const api = await served(fromBrowser("/api/clock", "br"), {}, game(called));
    expect(copy.status).toBe(404);
    expect(copy.headers.get("x-content-type-options")).toBe("nosniff");
    expect(copy.headers.get("x-robots-tag")).toBeNull();
    expect(missing.status).toBe(404);
    expect(api.status).toBe(404);
    expect(called).toEqual([SCRIPT, "/api/clock"]);
  });

  test("[server:production-and-staging] given NOINDEX set, as on staging, when a browser that takes brotli asks for a bundled script, then the copy comes back with the noindex tag as well", async () => {
    const reply = await served(fromBrowser(SCRIPT, "br"), { NOINDEX: "1", ASSETS: clientFiles([]) }, game([]));
    expect(reply.headers.get("content-encoding")).toBe("br");
    expect(reply.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive, nosnippet");
  });

  test("[server:production-and-staging] given the browsers' Accept-Encoding values, then brotli is taken when br is named with a weight above zero, or * is with br unnamed", () => {
    expect(takesBrotli("gzip, deflate, br, zstd")).toBe(true);
    expect(takesBrotli("BR")).toBe(true);
    expect(takesBrotli("br;q=0.1")).toBe(true);
    expect(takesBrotli("gzip, br;q=0")).toBe(false);
    expect(takesBrotli("br; q=0.000")).toBe(false);
    expect(takesBrotli("*")).toBe(true);
    expect(takesBrotli("*, br;q=0")).toBe(false);
    expect(takesBrotli("gzip, *;q=0")).toBe(false);
    expect(takesBrotli("gzip, deflate")).toBe(false);
    expect(takesBrotli("")).toBe(false);
    expect(takesBrotli(null)).toBe(false);
  });
});
