/// <reference types="@cloudflare/vitest-plugin/types" />
import { env, exports } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

import { COOKIE } from "./gate";
import worker from "./index";

// The game behind the gate is a stand-in Worker named in vitest.config.ts: it answers
// "game <path>", echoes a posted body, streams /api/stream in two parts and echoes on its socket.
const HOST = "https://japacity.app";

function visit(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(new Request(`${HOST}${path}`, { redirect: "manual", ...init }));
}

function invite(code: string): string {
  return `/invite/${encodeURIComponent(code)}`;
}

async function admittedCookie(): Promise<string> {
  const response = await visit(invite(env.GATE_SECRET));
  const setCookie = response.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0] ?? "";
}

/** What a reply shows, so a test can compare it with the holding screen in one assertion. */
async function shown(response: Response) {
  const html = await response.text();
  return {
    status: response.status,
    type: response.headers.get("content-type"),
    cookie: response.headers.get("set-cookie"),
    screen: html.includes("<h1>Japacity</h1>") && html.includes("The game opens soon."),
    xLink: html.includes('href="https://x.com/japacityapp"'),
    game: html.includes("game /"),
  };
}

const SCREEN = { status: 200, type: "text/html; charset=utf-8", cookie: null, screen: true, xLink: true, game: false };

describe("the invite link", () => {
  test("given the right code at /invite/<code>, when the link is opened, then the phone gets the cookie and is sent on to the game's front page", async () => {
    const response = await visit(invite(env.GATE_SECRET));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie.startsWith(`${COOKIE}=`)).toBe(true);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain(env.GATE_SECRET);
  });

  test("given the right code with a trailing slash, when the link is opened, then it admits the same", async () => {
    const response = await visit(`${invite(env.GATE_SECRET)}/`);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
  });

  test("given a wrong code, when the link is opened without the cookie, then there is no cookie and only the holding screen shows", async () => {
    for (const code of ["wrong", env.GATE_SECRET.slice(1), `${env.GATE_SECRET}x`]) {
      expect(await shown(await visit(invite(code)))).toEqual(SCREEN);
    }
  });

  test("given a phone already admitted, when it opens an invite with another code, then the game gets it, since the game's own pair invites share the path", async () => {
    const cookie = await admittedCookie();
    const response = await visit("/invite/PAIR42", { headers: { cookie } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("game /invite/PAIR42");
  });

  test("given the old form of the link, when /?code=<the code> is opened, then it admits nobody", async () => {
    expect(await shown(await visit(`/?code=${encodeURIComponent(env.GATE_SECRET)}`))).toEqual(SCREEN);
  });

  test("given no secret set on the server, when any invite is tried, then nobody is admitted", async () => {
    const response = await worker.fetch(new Request(`${HOST}/invite/anything`), { ...env, GATE_SECRET: "" });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("the cookie", () => {
  test("given the cookie, when the game is opened, then the game answers", async () => {
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

describe("without the cookie", () => {
  test("given a visit to the root, when it is served, then the holding screen shows: the name, opens soon, the invite line, the X link and the card on japacity.app, with no script and no form", async () => {
    const response = await visit("/");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("form-action 'none'");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("content-security-policy")).not.toContain("script-src");
    const html = await response.clone().text();
    expect(html).toContain("Got an invite link from a friend? Open it again on this phone.");
    expect(html).toContain('property="og:image" content="https://japacity.app/card.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).not.toMatch(/<form|<input|<button|<script|mailto|\/join/);
    expect(await shown(response)).toEqual(SCREEN);
  });

  test("given a deeper page, when it is opened, then the same screen shows", async () => {
    expect(await shown(await visit("/play?card=granted"))).toEqual(SCREEN);
  });

  test("given the game's routes or socket, when they are asked, then they are refused and never reach the game", async () => {
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

  test("given a form posted to /join, when it is sent, then it is refused, nothing is taken and the game never gets it", async () => {
    const posted = await visit("/join", { method: "POST", body: new URLSearchParams({ email: "ada@example.com" }), headers: { "content-type": "application/x-www-form-urlencoded" } });
    expect(posted.status).toBe(403);
    expect(await posted.text()).not.toContain("game");
  });

  test("given the card picture the screen names, when it is asked for, then the gate serves it itself", async () => {
    const response = await visit("/card.png");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  test("given a cookie that is not ours, when the game is opened, then the screen shows", async () => {
    expect(await shown(await visit("/", { headers: { cookie: `${COOKIE}=1800000000.forged` } }))).toEqual(SCREEN);
  });

  test("given the terms, the privacy notice, the official accounts or the credits page, when they are opened with no cookie, then the game answers each, for anyone", async () => {
    for (const path of ["/terms", "/terms.html", "/privacy", "/privacy.html", "/official", "/official/", "/official/index.html"]) {
      const response = await visit(path);
      expect([path, response.status, response.headers.get("set-cookie")]).toEqual([path, 200, null]);
      expect(await response.text()).toBe(`game ${path}`);
    }
    expect(await (await visit("/terms?from=start")).text()).toBe("game /terms");
    expect(await (await visit("/privacy", { method: "HEAD" })).text()).toBe("");
  });

  test("given the public pages open, when the root or any page beside them is opened with no cookie, then the holding screen still shows", async () => {
    for (const path of ["/", "/play", "/termsx", "/terms/more", "/privacy.htm", "/officials", "/guides", "/guides/", "/guides/credits/more", "/legal/terms.html"]) {
      expect([path, await shown(await visit(path))]).toEqual([path, SCREEN]);
    }
  });

  test("given a public page, when anything but a read is sent to it with no cookie, then it is refused and the game never gets it", async () => {
    for (const path of ["/terms", "/official/index.html"]) {
      const posted = await visit(path, { method: "POST", body: "{}" });
      expect(posted.status).toBe(403);
      expect(await posted.text()).not.toContain("game");
    }
  });

  test("given no handle yet, or one that is not a handle, when the screen is served, then there is no X link and the rest is the same", async () => {
    for (const handle of ["", "@japacityapp", "japacity app", "a".repeat(16), '"><script>']) {
      const response = await worker.fetch(new Request(`${HOST}/`), { ...env, GATE_X_HANDLE: handle });
      const html = await response.clone().text();
      expect(html).not.toContain("x.com");
      expect(html).not.toContain("<script>");
      expect(await shown(response)).toEqual({ ...SCREEN, xLink: false });
    }
  });
});

describe("Web Analytics on the screen", () => {
  const TOKEN = "0123456789abcdef0123456789abcdef";

  test("given no analytics token, when the screen is served, then it carries no script and its policy allows none", async () => {
    for (const token of ["", undefined]) {
      const response = await worker.fetch(new Request(`${HOST}/`), { ...env, ANALYTICS_TOKEN: token });
      const html = await response.clone().text();
      expect(html).not.toMatch(/<script|cloudflareinsights/);
      expect(response.headers.get("content-security-policy")).not.toMatch(/script-src|connect-src/);
      expect(await shown(response)).toEqual(SCREEN);
    }
  });

  test("given the analytics token, when the screen is served, then the beacon is its one script, with the token, and the policy allows that script and its reports and nothing else", async () => {
    const response = await worker.fetch(new Request(`${HOST}/`), { ...env, ANALYTICS_TOKEN: TOKEN });
    const html = await response.clone().text();
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).toContain(`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${TOKEN}", "spa": false}'></script>`);
    expect(html).not.toMatch(/<form|<input|<button/);
    const policy = response.headers.get("content-security-policy") ?? "";
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("script-src https://static.cloudflareinsights.com;");
    expect(policy.endsWith("connect-src https://cloudflareinsights.com")).toBe(true);
    expect(policy.match(/script-src [^;]+/)?.[0]).toBe("script-src https://static.cloudflareinsights.com");
    expect(await shown(response)).toEqual(SCREEN);
  });

  test("given a token that is not one, when the screen is served, then no script is sent", async () => {
    for (const token of ["'><script>alert(1)</script>", "abc def", "a".repeat(65)]) {
      const response = await worker.fetch(new Request(`${HOST}/`), { ...env, ANALYTICS_TOKEN: token });
      expect(await response.clone().text()).not.toContain("<script");
      expect(response.headers.get("content-security-policy")).not.toContain("script-src");
    }
  });

  test("given an admitted phone and the token set, when the game is opened, then the game's reply is handed on untouched", async () => {
    const cookie = await admittedCookie();
    const response = await worker.fetch(new Request(`${HOST}/`, { headers: { cookie } }), { ...env, ANALYTICS_TOKEN: TOKEN });
    expect(await response.text()).toBe("game /");
  });
});
