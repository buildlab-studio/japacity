/// <reference types="@cloudflare/vitest-plugin/types" />
import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, test } from "vitest";

import { COOKIE } from "./gate";
import worker from "./index";
import type { Env } from "./index";
import { cleanEmail, INSERT } from "./join";
import schema from "../schema.sql?raw";

// The game behind the gate is a stand-in Worker named in vitest.config.ts: it answers
// "game <path>", echoes a posted body, streams /api/stream in two parts and echoes on its socket.
// The waitlist's table and limit are the local ones the gate's wrangler.jsonc binds.
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

/** What a reply shows, so a test can compare it with the waitlist page in one assertion. */
async function shown(response: Response) {
  const html = await response.text();
  return {
    status: response.status,
    type: response.headers.get("content-type"),
    cookie: response.headers.get("set-cookie"),
    waitlist: html.includes("<h1>Japacity</h1>") && html.includes('action="/join"'),
    xLink: html.includes('href="https://x.com/japacityapp"'),
    game: html.includes("game /"),
  };
}

const PAGE = { status: 200, type: "text/html; charset=utf-8", cookie: null, waitlist: true, xLink: true, game: false };

function post(body: Record<string, string>, ip: string): Promise<Response> {
  const form = new URLSearchParams(body);
  return visit("/join", { method: "POST", body: form, headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": ip } });
}

async function rows(): Promise<{ email: string; joined_at: string }[]> {
  return (await env.DB?.prepare("SELECT email, joined_at FROM waitlist ORDER BY email").all<{ email: string; joined_at: string }>())?.results ?? [];
}

beforeAll(async () => {
  const create = schema.replace(/^--.*$/gm, "").replace(/\s+/g, " ").trim();
  await env.DB?.exec(create);
});

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

  test("given a wrong code, when the link is opened without the cookie, then there is no cookie and only the waitlist page shows", async () => {
    for (const code of ["wrong", env.GATE_SECRET.slice(1), `${env.GATE_SECRET}x`]) {
      expect(await shown(await visit(invite(code)))).toEqual(PAGE);
    }
  });

  test("given a phone already admitted, when it opens an invite with another code, then the game gets it, since the game's own pair invites share the path", async () => {
    const cookie = await admittedCookie();
    const response = await visit("/invite/PAIR42", { headers: { cookie } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("game /invite/PAIR42");
  });

  test("given the old form of the link, when /?code=<the code> is opened, then it admits nobody", async () => {
    expect(await shown(await visit(`/?code=${encodeURIComponent(env.GATE_SECRET)}`))).toEqual(PAGE);
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
  test("given a visit to the root, when it is served, then the waitlist page shows: the name, the form, the privacy line, the X link and the social card on japacity.app", async () => {
    const response = await visit("/");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    const html = await response.clone().text();
    expect(html).toContain("One email when it opens, then we delete your address.");
    expect(html).toContain("Got an invite link from a friend? Open it again on this phone.");
    expect(html).toContain('property="og:image" content="https://japacity.app/card.png"');
    expect(html).toContain('<link rel="canonical" href="https://japacity.app/">');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).not.toMatch(/<script|mailto/);
    expect(await shown(response)).toEqual(PAGE);
  });

  test("given a deeper page, when it is opened, then the same page shows", async () => {
    expect(await shown(await visit("/play?card=granted"))).toEqual(PAGE);
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

  test("given the card picture the page names, when it is asked for, then the gate serves it itself", async () => {
    const response = await visit("/card.png");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  test("given a cookie that is not ours, when the game is opened, then the waitlist page shows", async () => {
    expect(await shown(await visit("/", { headers: { cookie: `${COOKIE}=1800000000.forged` } }))).toEqual(PAGE);
  });

  test("given an analytics token, when the page is served, then the analytics script is sent, and only from Cloudflare", async () => {
    const response = await worker.fetch(new Request(`${HOST}/`), { ...env, ANALYTICS_TOKEN: "abc123" });
    const html = await response.text();
    expect(html).toContain("static.cloudflareinsights.com/beacon.min.js");
    expect(html).toContain('"token": "abc123"');
    expect(response.headers.get("content-security-policy")).toContain("script-src https://static.cloudflareinsights.com");
  });

  test("given no handle yet, or one that is not a handle, when the page is served, then there is no X link", async () => {
    for (const handle of ["", "@japacityapp", "japacity app", "a".repeat(16), '"><script>']) {
      const html = await (await worker.fetch(new Request(`${HOST}/`), { ...env, GATE_X_HANDLE: handle })).text();
      expect(html).not.toContain("x.com");
      expect(html).not.toContain("<script>");
    }
  });
});

describe("joining the waitlist", () => {
  test("given a good address, when it is posted, then one row is stored with the time and the page says so", async () => {
    const response = await post({ email: " Ada@Example.com " }, "192.0.2.1");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("You are on the list");
    expect(await rows()).toContainEqual({ email: "ada@example.com", joined_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) as string });
  });

  test("given the same address twice, when both are posted, then the table holds it once and both are told thanks", async () => {
    await post({ email: "bola@example.com" }, "192.0.2.2");
    const second = await post({ email: "BOLA@example.com" }, "192.0.2.2");
    expect(second.status).toBe(200);
    expect((await rows()).filter((row) => row.email === "bola@example.com")).toHaveLength(1);
    expect(INSERT).toContain("INSERT OR IGNORE");
  });

  test("given the honeypot filled, when it is posted, then nothing is stored and the bot is told thanks", async () => {
    const response = await post({ email: "bot@example.com", website: "http://spam" }, "192.0.2.3");
    expect(response.status).toBe(200);
    expect((await rows()).map((row) => row.email)).not.toContain("bot@example.com");
  });

  test("given a bad address, when it is posted, then nothing is stored and the page says so", async () => {
    const before = await rows();
    for (const email of ["", "ada", "ada@", "@example.com", "a b@example.com", `${"a".repeat(250)}@example.com`]) {
      const response = await post({ email }, "192.0.2.4");
      expect(response.status).toBe(400);
    }
    expect(await rows()).toEqual(before);
    expect(cleanEmail(null)).toBeNull();
  });

  test("given the connection over its limit, when it posts, then nothing is stored and it is told to wait", async () => {
    const limited: Env = { ...env, JOIN_LIMIT: { limit: () => Promise.resolve({ success: false }) } };
    const request = new Request(`${HOST}/join`, { method: "POST", body: new URLSearchParams({ email: "chidi@example.com" }), headers: { "content-type": "application/x-www-form-urlencoded" } });
    const response = await worker.fetch(request, limited);
    expect(response.status).toBe(429);
    expect((await rows()).map((row) => row.email)).not.toContain("chidi@example.com");
  });

  test("given a phone already admitted, when it posts to /join, then the game gets it and nothing is stored", async () => {
    const cookie = await admittedCookie();
    const response = await visit("/join", { method: "POST", body: "email=dayo%40example.com", headers: { cookie } });
    expect((await response.json<{ body: string }>()).body).toBe("email=dayo%40example.com");
    expect((await rows()).map((row) => row.email)).not.toContain("dayo@example.com");
  });

  test("given either binding missing, when the page is served or an address posted, then there is no form and nothing is taken", async () => {
    for (const bare of [{ ...env, DB: undefined }, { ...env, JOIN_LIMIT: undefined }] satisfies Env[]) {
      const html = await (await worker.fetch(new Request(`${HOST}/`), bare)).text();
      expect(html).not.toMatch(/<form|<input/);
      expect(html).toContain("opens soon");
      const request = new Request(`${HOST}/join`, { method: "POST", body: new URLSearchParams({ email: "efe@example.com" }), headers: { "content-type": "application/x-www-form-urlencoded" } });
      expect((await worker.fetch(request, bare)).status).toBe(403);
    }
    expect((await rows()).map((row) => row.email)).not.toContain("efe@example.com");
  });
});
