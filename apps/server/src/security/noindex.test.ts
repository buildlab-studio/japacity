// server:production-and-staging: staging stays out of search engines, production is left untouched.
import { describe, expect, test } from "vitest";

import { ROBOTS_TAG, ROBOTS_TXT, served } from "./noindex";

const SITE = "https://staging.japacity.app";

/** The client's files as the ASSETS binding hands them back: the headers of a fetched reply cannot change. */
function clientFiles(asked: string[]): Fetcher {
  const fetch = (input: RequestInfo | URL): Promise<Response> => {
    const path = new URL(input instanceof Request ? input.url : input.toString()).pathname;
    asked.push(path);
    const type = path === "/assets/app.js" ? "text/javascript" : "text/html";
    const reply = new Response(type === "text/html" ? "<!doctype html>" : "console.log(1)", { headers: { "content-type": type } });
    Object.defineProperty(reply.headers, "set", {
      value: () => {
        throw new TypeError("Can't modify immutable headers.");
      },
    });
    return Promise.resolve(reply);
  };
  return { fetch } as unknown as Fetcher;
}

/** The game's API: what the Hono app would answer, and a 404 for a path it does not know. */
function game(called: string[]): (request: Request) => Promise<Response> {
  return (request) => {
    const path = new URL(request.url).pathname;
    called.push(path);
    return Promise.resolve(path.startsWith("/api/") ? Response.json({ ok: true }) : new Response("Not Found", { status: 404 }));
  };
}

describe("staging's noindex", () => {
  test("[server:production-and-staging] given NOINDEX set, when a page, a file and an API route are asked for, then each reply carries the noindex tag, the page and the file come from the client's files and only the API reaches the game", async () => {
    const asked: string[] = [];
    const called: string[] = [];
    const env = { NOINDEX: "1", ASSETS: clientFiles(asked) };
    const page = await served(new Request(`${SITE}/home`), env, game(called));
    const file = await served(new Request(`${SITE}/assets/app.js`), env, game(called));
    const api = await served(new Request(`${SITE}/api/clock`), env, game(called));
    for (const reply of [page, file, api]) expect(reply.headers.get("x-robots-tag")).toBe(ROBOTS_TAG);
    expect(await page.text()).toBe("<!doctype html>");
    expect(file.headers.get("content-type")).toBe("text/javascript");
    expect(await api.json()).toEqual({ ok: true });
    expect(asked).toEqual(["/home", "/assets/app.js"]);
    expect(called).toEqual(["/api/clock"]);
  });

  test("[server:production-and-staging] given NOINDEX set, when robots.txt is asked for, then it disallows every crawler from the whole site and neither the files nor the game is asked", async () => {
    const asked: string[] = [];
    const called: string[] = [];
    const reply = await served(new Request(`${SITE}/robots.txt`), { NOINDEX: "1", ASSETS: clientFiles(asked) }, game(called));
    expect(reply.status).toBe(200);
    expect(await reply.text()).toBe(ROBOTS_TXT);
    expect(ROBOTS_TXT).toBe("User-agent: *\nDisallow: /\n");
    expect(reply.headers.get("x-robots-tag")).toBe(ROBOTS_TAG);
    expect([...asked, ...called]).toEqual([]);
  });

  test("[server:production-and-staging] given no NOINDEX, as in production, when an API route and robots.txt reach the Worker, then neither carries the tag and robots.txt is not the disallowing one", async () => {
    const called: string[] = [];
    const api = await served(new Request("https://japacity.app/api/clock"), {}, game(called));
    const robots = await served(new Request("https://japacity.app/robots.txt"), {}, game(called));
    expect(api.headers.get("x-robots-tag")).toBeNull();
    expect(robots.headers.get("x-robots-tag")).toBeNull();
    expect(robots.status).toBe(404);
    expect(called).toEqual(["/api/clock", "/robots.txt"]);
  });

  test("[server:production-and-staging] given NOINDEX set, when the game answers a socket's upgrade, then that reply is handed on untouched", async () => {
    const upgrade = { status: 101, headers: new Headers() } as unknown as Response;
    const reply = await served(new Request(`${SITE}/api/place/socket`), { NOINDEX: "1" }, () => Promise.resolve(upgrade));
    expect(reply).toBe(upgrade);
    expect(reply.headers.get("x-robots-tag")).toBeNull();
  });
});
