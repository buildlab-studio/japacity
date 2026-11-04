// server:production-and-staging: the client's files with `not_found_handling: "none"`. In production the platform
// serves every file that exists from the location nearest the player, and only a request that matches no file reaches
// the Worker; on staging every request does. A missing file under /assets/ is answered 404 with `no-store`: those
// names carry their contents' hash and are cached for a year, so the page served there would be kept under a script's
// or a model's address, and a tab open across a release would read HTML where it asked for code. Any other address
// that is no file is a page of the game and gets the page.
import { DEFAULT_CACHE, SECURITY_HEADERS } from "./headers";

/** The folder of the build's hashed files and the models. */
const HASHED = "/assets/";

/** The asset binding's status for a request that matches no file. */
const NOT_FOUND = 404;

function missingFile(): Response {
  return new Response("Not found", {
    status: NOT_FOUND,
    headers: { ...SECURITY_HEADERS, "content-type": "text/plain; charset=utf-8", "cache-control": DEFAULT_CACHE },
  });
}

/** The file asked for, a 404 for a missing one under /assets/, or the page for any other address. */
export async function fileOrPage(request: Request, files: Fetcher): Promise<Response> {
  const file = await files.fetch(request);
  if (file.status !== NOT_FOUND) return file;
  const url = new URL(request.url);
  if (url.pathname.startsWith(HASHED)) return missingFile();
  return files.fetch(new Request(new URL("/", url), request));
}
