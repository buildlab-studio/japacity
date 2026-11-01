// server:production-and-staging: staging is kept out of search engines; production never is.
// On staging every request reaches the Worker first (`run_worker_first: true`),
// so the Worker serves the client's files itself through the ASSETS binding and
// can mark every reply, serving the bundled scripts and styles as their brotli
// copies (files/brotli.ts). Production lets the platform serve its files first; its
// Worker runs first for `/api/*` and for the copies' own addresses alone, so a copy
// is never served there under its own name either. A page or a file never opens a
// database client: only `/api/*` goes on to the game.
import { copyNotFound, fileReply, isCopyPath } from "../files/brotli";

/** The robots header every staging reply carries. */
export const ROBOTS_TAG = "noindex, nofollow, noarchive, nosnippet";

/** Every crawler is asked to stay out of the whole site. */
export const ROBOTS_TXT = "User-agent: *\nDisallow: /\n";

/** RFC 6455: the status of a socket's upgrade, whose reply is not the Worker's to change. */
const SWITCHING_PROTOCOLS = 101;

/** The deployment's switch, set on staging only, and the client's files. */
export interface NoindexEnv {
  NOINDEX?: string;
  ASSETS?: Fetcher;
}

function isApi(path: string): boolean {
  return path === "/api" || path.startsWith("/api/");
}

function marked(response: Response): Response {
  if (response.status === SWITCHING_PROTOCOLS) return response;
  try {
    response.headers.set("x-robots-tag", ROBOTS_TAG);
    return response;
  } catch {
    const copy = new Response(response.body, response);
    copy.headers.set("x-robots-tag", ROBOTS_TAG);
    return copy;
  }
}

/**
 * server:production-and-staging: without `NOINDEX` a brotli copy's own address is not found and every other request goes to the game
 * untouched. With it, `/robots.txt` disallows everything, `/api/*` goes to the game and every other path to the client's files, and
 * each reply carries the tag.
 */
export async function served(request: Request, env: NoindexEnv, game: (request: Request) => Promise<Response>): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (env.NOINDEX === undefined || env.NOINDEX === "") return isCopyPath(path) ? copyNotFound() : game(request);
  if (path === "/robots.txt") {
    return marked(new Response(ROBOTS_TXT, { headers: { "content-type": "text/plain; charset=utf-8" } }));
  }
  if (isApi(path) || env.ASSETS === undefined) return marked(await game(request));
  return marked(await fileReply(request, env.ASSETS));
}
