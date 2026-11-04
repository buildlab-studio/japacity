// server:production-and-staging: a file missing under /assets/ is answered 404, never the page, on both deployments.
import { describe, expect, test } from "vitest";

import { SECURITY_HEADERS } from "./headers";
import { ROBOTS_TAG, served } from "./noindex";

const PAGE = "<!doctype html><title>Japacity</title>";
const SCRIPT = "export const a = 1;";

/**
 * The client's files as the ASSETS binding hands them back with `not_found_handling: "none"`: a file that exists
 * with its own headers, which cannot change, and an empty 404 for anything else.
 */
function clientFiles(asked: string[]): Fetcher {
  const files: Record<string, { body: string; type: string; cache: string }> = {
    "/": { body: PAGE, type: "text/html; charset=utf-8", cache: "no-cache" },
    "/assets/index-REAL.js": { body: SCRIPT, type: "text/javascript", cache: "public, max-age=31536000, immutable" },
  };
  const fetch = (input: RequestInfo | URL): Promise<Response> => {
    const path = new URL(input instanceof Request ? input.url : input.toString()).pathname;
    asked.push(path);
    const file = files[path];
    const reply =
      file === undefined
        ? new Response(null, { status: 404 })
        : new Response(file.body, { headers: { "content-type": file.type, "cache-control": file.cache } });
    Object.defineProperty(reply.headers, "set", {
      value: () => {
        throw new TypeError("Can't modify immutable headers.");
      },
    });
    return Promise.resolve(reply);
  };
  return { fetch } as unknown as Fetcher;
}

function game(called: string[]): (request: Request) => Promise<Response> {
  return (request) => {
    called.push(new URL(request.url).pathname);
    return Promise.resolve(Response.json({ ok: true }));
  };
}

const PRODUCTION = "https://japacity.app";
const STAGING = "https://staging.japacity.app";

function expectMissingFile(reply: Response): void {
  expect(reply.status).toBe(404);
  expect(reply.headers.get("cache-control")).toBe("no-store");
  expect(reply.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(reply.headers.get(name)).toBe(value);
}

describe("a missing file under /assets/", () => {
  test("[server:production-and-staging] given production, when a script missing from the build reaches the Worker, then it is answered 404 with no-store and the security headers, never the page", async () => {
    const asked: string[] = [];
    const called: string[] = [];
    const reply = await served(new Request(`${PRODUCTION}/assets/index-NOTREAL1.js`), { ASSETS: clientFiles(asked) }, game(called));
    expectMissingFile(reply);
    expect(await reply.text()).not.toContain("<!doctype html>");
    expect(asked).toEqual(["/assets/index-NOTREAL1.js"]);
    expect(called).toEqual([]);
  });

  test("[server:production-and-staging] given production, when a page address that is no file reaches the Worker, then the page is served from the files with its own headers", async () => {
    const asked: string[] = [];
    const called: string[] = [];
    const reply = await served(new Request(`${PRODUCTION}/i/ABCDEF`, { headers: { "sec-fetch-mode": "navigate" } }), { ASSETS: clientFiles(asked) }, game(called));
    expect(reply.status).toBe(200);
    expect(await reply.text()).toBe(PAGE);
    expect(reply.headers.get("cache-control")).toBe("no-cache");
    expect(asked).toEqual(["/i/ABCDEF", "/"]);
    expect(called).toEqual([]);
  });

  test("[server:production-and-staging] given production with the files bound, when an API route reaches the Worker, then only the game answers it and the files are never asked", async () => {
    const asked: string[] = [];
    const called: string[] = [];
    const reply = await served(new Request(`${PRODUCTION}/api/auth/callback/google?code=x`, { headers: { "sec-fetch-mode": "navigate" } }), { ASSETS: clientFiles(asked) }, game(called));
    expect(await reply.json()).toEqual({ ok: true });
    expect(asked).toEqual([]);
    expect(called).toEqual(["/api/auth/callback/google"]);
  });

  test("[server:production-and-staging] given staging, when a file that exists and one missing from the build are asked for, then the first comes as the files give it and the second is answered 404, both with the noindex tag", async () => {
    const asked: string[] = [];
    const env = { NOINDEX: "1", ASSETS: clientFiles(asked) };
    const file = await served(new Request(`${STAGING}/assets/index-REAL.js`), env, game([]));
    const missing = await served(new Request(`${STAGING}/assets/places/old/model-OLD.glb`), env, game([]));
    expect(file.status).toBe(200);
    expect(await file.text()).toBe(SCRIPT);
    expect(file.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expectMissingFile(missing);
    for (const reply of [file, missing]) expect(reply.headers.get("x-robots-tag")).toBe(ROBOTS_TAG);
  });

  test("[server:production-and-staging] given staging, when a page address that is no file is asked for, then the page is served with the noindex tag", async () => {
    const asked: string[] = [];
    const reply = await served(new Request(`${STAGING}/admin`), { NOINDEX: "1", ASSETS: clientFiles(asked) }, game([]));
    expect(reply.status).toBe(200);
    expect(await reply.text()).toBe(PAGE);
    expect(reply.headers.get("x-robots-tag")).toBe(ROBOTS_TAG);
    expect(asked).toEqual(["/admin", "/"]);
  });
});
