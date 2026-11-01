// server:production-and-staging, engine:first-download-has-budget: the client's build writes a brotli copy at the best level beside every
// script and style under /assets/ (apps/client/vite/brotli.plugin.ts), smaller than what the edge makes on the fly. The Worker answers
// those paths itself: a browser that takes brotli gets the copy's bytes marked `Content-Encoding: br`, with the file's own type and the
// caching and security headers the platform gives the file; any other request gets the platform's answer unchanged. A copy is never
// served under its own name. Only the client's files are read here: no database client is ever opened.
import { DEFAULT_CACHE, SECURITY_HEADERS } from "../security/headers";

/** The bundler's scripts and styles, which have a brotli copy beside them. */
const COMPRESSED = /^\/assets\/[\w.-]+\.(?:js|css)$/;
/** A brotli copy's own address. */
const COPY = /^\/assets\/.*\.br$/;
/** The headers that ask for the file only if it changed: the plain file is read whole, so its headers are always there. */
const CONDITIONAL = ["if-none-match", "if-modified-since", "if-match", "if-unmodified-since", "if-range"];

/** Whether a path is a brotli copy's own address, which is never served. */
export function isCopyPath(path: string): boolean {
  return COPY.test(path);
}

/**
 * Whether an `Accept-Encoding` value takes brotli: `br` named with a weight above zero, or `*` with one when `br` is not named.
 * Case and spaces do not matter.
 */
export function takesBrotli(accepted: string | null | undefined): boolean {
  if (accepted === null || accepted === undefined) return false;
  let any = false;
  for (const item of accepted.split(",")) {
    const [coding = "", ...params] = item.split(";").map((part) => part.trim().toLowerCase());
    const weight = params.find((param) => param.startsWith("q="));
    const wanted = weight === undefined || Number(weight.slice(2)) > 0;
    if (coding === "br") return wanted;
    if (coding === "*") any = wanted;
  }
  return any;
}

/**
 * What the browser itself sent: the edge rewrites `Accept-Encoding` to its own value before the Worker runs and keeps the browser's in
 * `request.cf.clientAcceptEncoding` (Cloudflare's Request page, IncomingRequestCfProperties).
 */
function browserAccepts(request: Request): string | null {
  const cf = request.cf as { clientAcceptEncoding?: unknown } | undefined;
  return typeof cf?.clientAcceptEncoding === "string" ? cf.clientAcceptEncoding : request.headers.get("accept-encoding");
}

/** A copy's own address answers as an address with no file of the game's: not found, with the security headers and stored nowhere. */
export function copyNotFound(): Response {
  return new Response("Not Found", { status: 404, headers: { ...SECURITY_HEADERS, "content-type": "text/plain; charset=utf-8", "cache-control": DEFAULT_CACHE } });
}

/** The single-page fallback's answer for a file that is not there: the page, which is never a script's copy. */
function isPage(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").startsWith("text/html");
}

function unconditional(headers: Headers): Headers {
  const copy = new Headers(headers);
  for (const name of CONDITIONAL) copy.delete(name);
  return copy;
}

/**
 * server:production-and-staging: the reply for one of the client's files. A copy's own address is not found. A script or style asked for
 * with GET or HEAD, by a browser that takes brotli and with no range, is answered with its copy when the copy is there: the plain file's
 * headers (its type, caching and policies, as `_headers` gives them), the copy's tag and length, `Content-Encoding: br` and
 * `Vary: Accept-Encoding`, the body passed on as it is (`encodeBody: "manual"`, Cloudflare's Response page) so the runtime does not
 * compress it again. Anything else is the platform's own answer.
 */
export async function fileReply(request: Request, assets: Fetcher): Promise<Response> {
  const url = new URL(request.url);
  if (COPY.test(url.pathname)) return copyNotFound();
  const method = request.method.toUpperCase();
  if (!COMPRESSED.test(url.pathname) || (method !== "GET" && method !== "HEAD") || request.headers.has("range") || !takesBrotli(browserAccepts(request))) {
    return assets.fetch(request);
  }
  const [plain, copy] = await Promise.all([
    assets.fetch(new Request(url.href, { method: "HEAD", headers: unconditional(request.headers) })),
    assets.fetch(new Request(`${url.origin}${url.pathname}.br`, { method, headers: request.headers })),
  ]);
  if (plain.status !== 200 || isPage(plain) || (copy.status !== 200 && copy.status !== 304) || isPage(copy)) {
    await copy.body?.cancel();
    return assets.fetch(request);
  }
  const headers = new Headers(plain.headers);
  headers.delete("content-length");
  for (const name of ["etag", "content-length"]) {
    const value = copy.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  headers.set("content-encoding", "br");
  const vary = headers.get("vary");
  if (vary === null || !/(?:^|,)\s*accept-encoding\s*(?:,|$)/i.test(vary)) headers.set("vary", vary === null ? "Accept-Encoding" : `${vary}, Accept-Encoding`);
  return new Response(copy.body, { status: copy.status, headers, encodeBody: "manual" });
}
