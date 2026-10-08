/// <reference types="@cloudflare/vitest-plugin/types" />
import { env, exports } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

import { COOKIE } from "./gate";
import worker from "./index";

// The game behind the gate is a stand-in Worker named in vitest.config.ts: it answers
// "game <path>", echoes a posted body, streams /api/stream in two parts and echoes on its socket.
const GAME = "https://play.japacity.com";

function visit(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(new Request(`${GAME}${path}`, { redirect: "manual", ...init }));
}

async function admittedCookie(): Promise<string> {
  const response = await visit(`/?code=${encodeURIComponent(env.GATE_SECRET)}`);
  const setCookie = response.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0] ?? "";
}

/** What a reply shows, so a test can compare it with the screen in one assertion. */
async function shown(response: Response) {
  const html = await response.text();
  return {
    status: response.status,
    type: response.headers.get("content-type"),
    cookie: response.headers.get("set-cookie"),
    opensSoon: html.includes("The game opens soon."),
    xLink: html.includes('href="https://x.com/japacityapp"'),
    game: html.includes("game /"),
  };
}

const SCREEN = { status: 200, type: "text/html; charset=utf-8", cookie: null, opensSoon: true, xLink: true, game: false };

describe("the invite link", () => {
  test("given the right code, when the link is opened, then the phone gets the cookie and is sent on to the clean address", async () => {
    const response = await visit(`/?code=${encodeURIComponent(env.GATE_SECRET)}`);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${GAME}/`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie.startsWith(`${COOKIE}=`)).toBe(true);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain(env.GATE_SECRET);
  });

  test("given the right code on a deeper link, when it is opened, then only the code leaves the address", async () => {
    const response = await visit(`/play?card=granted&code=${encodeURIComponent(env.GATE_SECRET)}`);
    expect(response.headers.get("location")).toBe(`${GAME}/play?card=granted`);
  });

  test("given a wrong code, when the link is opened, then there is no cookie and only the screen shows", async () => {
    for (const code of ["wrong", "", env.GATE_SECRET.slice(1)]) {
      expect(await shown(await visit(`/?code=${encodeURIComponent(code)}`))).toEqual(SCREEN);
    }
  });

  test("given a phone already admitted, when it opens the link again, then the code still leaves the address", async () => {
    const cookie = await admittedCookie();
    const response = await visit("/?code=whatever", { headers: { cookie } });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${GAME}/`);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test("given no secret set on the server, when an empty code is tried, then nobody is admitted", async () => {
    const response = await worker.fetch(new Request(`${GAME}/?code=`), { ...env, GATE_SECRET: "" });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("the cookie", () => {
  test("given the cookie, when the game is opened without the code, then the game answers", async () => {
    const cookie = await admittedCookie();
    const response = await visit("/somewhere", { headers: { cookie } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("game /somewhere");
  });

  test("given the cookie, when a command is posted, then the game gets the body and headers untouched", async () => {
    const cookie = await admittedCookie();
    const body = JSON.stringify({ type: "turn/end" });
    const response = await visit("/api/command", { method: "POST", body, headers: { cookie, "content-type": "application/json", authorization: "Bearer abc" } });
    expect(await response.json()).toEqual({ body, cookie, authorization: "Bearer abc" });
  });

  test("given the cookie, when the game streams a reply, then the first part arrives before the game has finished", async () => {
    const cookie = await admittedCookie();
    const response = await visit("/api/stream", { headers: { cookie } });
    const reader = (response.body ?? new ReadableStream<Uint8Array>()).getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(new TextDecoder().decode(first.value as Uint8Array)).toBe("first ");
    const rest = await reader.read();
    expect(new TextDecoder().decode(rest.value as Uint8Array)).toBe("second");
  });

  test("given the cookie, when the place socket is opened, then it passes through and talks to the game", async () => {
    const cookie = await admittedCookie();
    const response = await visit("/api/place/place.market/socket", { headers: { cookie, upgrade: "websocket" } });
    expect(response.status).toBe(101);
    const socket = response.webSocket;
    expect(socket).not.toBeNull();
    socket?.accept();
    const heard = new Promise<string>((resolve) => socket?.addEventListener("message", (event) => resolve(String(event.data))));
    socket?.send("hello");
    expect(await heard).toBe("echo hello");
    socket?.close();
  });
});

describe("without the cookie or the code", () => {
  test("given neither, when the game's address is opened, then one screen shows: opens soon, with the X link, and nothing else", async () => {
    const response = await visit("/");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    const html = await response.clone().text();
    expect(html).not.toMatch(/<form|<input|<script|mailto/);
    expect(html).toContain('property="og:image" content="https://japacity.com/card.png"');
    expect(await shown(response)).toEqual(SCREEN);
  });

  test("given neither, when a deeper page is opened, then the same screen shows", async () => {
    expect(await shown(await visit("/play?card=granted"))).toEqual(SCREEN);
  });

  test("given neither, when the game's routes or socket are asked, then they are refused and never reach the game", async () => {
    for (const [path, headers] of [
      ["/api/health", {}],
      ["/api/place/place.market/socket", { upgrade: "websocket" }],
    ] as const) {
      const response = await visit(path, { headers });
      expect(response.status).toBe(403);
      expect(response.webSocket).toBeNull();
      expect(await response.text()).not.toContain("game");
    }
    const posted = await visit("/api/command", { method: "POST", body: "{}" });
    expect(posted.status).toBe(403);
  });

  test("given a cookie that is not ours, when the game is opened, then the screen shows", async () => {
    expect(await shown(await visit("/", { headers: { cookie: `${COOKIE}=1800000000.forged` } }))).toEqual(SCREEN);
  });
});
