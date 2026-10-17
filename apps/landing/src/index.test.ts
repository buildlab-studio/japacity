import { describe, expect, test } from "vitest";

import type { Env } from "./index";
import worker from "./index";
import { cleanEmail, INSERT } from "./join";
import shippedConfig from "../wrangler.jsonc?raw";

interface Fake {
  rows: [string, string][];
  limited: boolean;
  statements: string[];
}

interface Settings {
  waitlist: boolean;
  live: boolean;
  handle: string;
}

/** The waitlist's own tests run with it switched on; the shipped settings are tested below. */
const WAITLIST_ON: Settings = { waitlist: true, live: false, handle: "japacityapp" };

function env(fake: Fake, token = "abc123", settings: Settings = WAITLIST_ON): Env {
  const db = {
    prepare(sql: string) {
      fake.statements.push(sql);
      return {
        bind(email: string, at: string) {
          return {
            run() {
              if (!fake.rows.some(([held]) => held === email)) fake.rows.push([email, at]);
              return Promise.resolve({ success: true });
            },
          };
        },
      };
    },
  };
  const limiter = { limit: () => Promise.resolve({ success: !fake.limited }) };
  return {
    DB: db as unknown as D1Database,
    JOIN_LIMIT: limiter,
    ANALYTICS_TOKEN: token,
    SITE_URL: "https://japacity.app",
    LANDING_WAITLIST: String(settings.waitlist),
    LANDING_LIVE: String(settings.live),
    LANDING_X_HANDLE: settings.handle,
    LANDING_PLAY_URL: "https://japacity.app",
  };
}

function fresh(): Fake {
  return { rows: [], limited: false, statements: [] };
}

function post(body: Record<string, string>, ip = "1.2.3.4"): Request {
  const form = new URLSearchParams(body);
  return new Request("https://japacity.app/join", { method: "POST", body: form, headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": ip } });
}

async function serve(request: Request, fake: Fake, token?: string, settings?: Settings): Promise<Response> {
  return worker.fetch(request, env(fake, token, settings));
}

const SHIPPED: Settings = { waitlist: false, live: false, handle: "japacityapp" };

describe("the page", () => {
  test("given a visit, when the page is served, then it carries the name, the line, the privacy line, the form, the social card and the analytics script", async () => {
    const response = await serve(new Request("https://japacity.app/"), fresh());
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("<h1>Japacity</h1>");
    expect(html).toContain("One email when it opens, then we delete your address.");
    expect(html).toContain('action="/join"');
    expect(html).toContain('property="og:image" content="https://japacity.app/card.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain("static.cloudflareinsights.com/beacon.min.js");
    expect(html).toContain('"token": "abc123"');
    expect(response.headers.get("content-security-policy")).toContain("script-src https://static.cloudflareinsights.com");
  });

  test("given no analytics token, when the page is served, then no analytics script is sent", async () => {
    const html = await (await serve(new Request("https://japacity.app/"), fresh(), "")).text();
    expect(html).not.toContain("cloudflareinsights");
  });

  test("given any other path or method, when asked, then it is not found", async () => {
    for (const url of ["https://japacity.app/list", "https://japacity.app/waitlist", "https://japacity.app/join"]) {
      expect((await serve(new Request(url), fresh())).status).toBe(404);
    }
  });
});

describe("joining", () => {
  test("given a good address, when it is posted, then one row is stored with the time and the page says so", async () => {
    const fake = fresh();
    const response = await serve(post({ email: " Ada@Example.com " }), fake);
    expect(response.status).toBe(200);
    expect(fake.rows).toEqual([["ada@example.com", expect.stringMatching(/^\d{4}-\d\d-\d\dT/) as string]]);
    expect(await response.text()).toContain("You are on the list");
  });

  test("given the same address twice, when both are posted, then the table holds it once and both are told thanks", async () => {
    const fake = fresh();
    await serve(post({ email: "ada@example.com" }), fake);
    const second = await serve(post({ email: "ADA@example.com" }), fake);
    expect(second.status).toBe(200);
    expect(fake.rows).toHaveLength(1);
    expect(INSERT).toContain("INSERT OR IGNORE");
  });

  test("given the honeypot filled, when it is posted, then nothing is stored and the bot is told thanks", async () => {
    const fake = fresh();
    const response = await serve(post({ email: "bot@example.com", website: "http://spam" }), fake);
    expect(response.status).toBe(200);
    expect(fake.rows).toEqual([]);
    expect(fake.statements).toEqual([]);
  });

  test("given a bad address, when it is posted, then nothing is stored and the page says so", async () => {
    const fake = fresh();
    for (const email of ["", "ada", "ada@", "@example.com", "a b@example.com", `${"a".repeat(250)}@example.com`]) {
      const response = await serve(post({ email }), fake);
      expect(response.status).toBe(400);
    }
    expect(fake.rows).toEqual([]);
    expect(cleanEmail(null)).toBeNull();
  });

  test("given the connection over its limit, when it posts, then nothing is stored and it is told to wait", async () => {
    const fake = { ...fresh(), limited: true };
    const response = await serve(post({ email: "ada@example.com" }), fake);
    expect(response.status).toBe(429);
    expect(fake.rows).toEqual([]);
  });
});


describe("while the game is closed, with the waitlist switched off", () => {
  test("given a visit, when the page is served, then it says the game opens soon and links the X account, with no form", async () => {
    const response = await serve(new Request("https://japacity.app/"), fresh(), "", SHIPPED);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("<h1>Japacity</h1>");
    expect(html).toContain("opens soon");
    expect(html).toContain('href="https://x.com/japacityapp"');
    expect(html).not.toMatch(/<form|<input|your email|One email when it opens/);
    expect(html).not.toContain("cloudflareinsights");
  });

  test("given a visit, when the page is served, then the social preview card stays", async () => {
    const html = await (await serve(new Request("https://japacity.app/"), fresh(), "", SHIPPED)).text();
    expect(html).toContain('property="og:image" content="https://japacity.app/card.png"');
    expect(html).toContain('property="og:title" content="Japacity"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  test("given a good address, when it is posted to /join, then it is not found and nothing is stored", async () => {
    const fake = fresh();
    const response = await serve(post({ email: "ada@example.com" }), fake, "", SHIPPED);
    expect(response.status).toBe(404);
    expect(fake.rows).toEqual([]);
    expect(fake.statements).toEqual([]);
  });

  test("given the waitlist on but its bindings missing, when an address is posted, then it is not found", async () => {
    const settings = { ...WAITLIST_ON };
    const bare: Env = { ...env(fresh(), "", settings), DB: undefined, JOIN_LIMIT: undefined };
    const response = await worker.fetch(post({ email: "ada@example.com" }), bare);
    expect(response.status).toBe(404);
    expect(await (await worker.fetch(new Request("https://japacity.app/"), bare)).text()).not.toContain("<form");
  });

  test("given no handle yet, or one that is not a handle, when the page is served, then there is no X link", async () => {
    for (const handle of ["", "@japacityapp", "japacity app", "a".repeat(16), '"><script>']) {
      const html = await (await serve(new Request("https://japacity.app/"), fresh(), "", { ...SHIPPED, handle })).text();
      expect(html).not.toContain("x.com");
      expect(html).not.toContain("<script>");
    }
  });
});

describe("with the page set live", () => {
  test("given the page set live, when it is served, then it shows the play link and no form", async () => {
    const html = await (await serve(new Request("https://japacity.app/"), fresh(), "", { ...SHIPPED, live: true })).text();
    expect(html).toContain('href="https://japacity.app"');
    expect(html).toContain(">Play now<");
    expect(html).not.toContain("opens soon");
    expect(html).not.toContain("<form");
    expect(html).toContain('property="og:image" content="https://japacity.app/card.png"');
  });

  test("given the page set live while the waitlist is still on, when an address is posted, then it is not found", async () => {
    const fake = fresh();
    const response = await serve(post({ email: "ada@example.com" }), fake, "", { ...WAITLIST_ON, live: true });
    expect(response.status).toBe(404);
    expect(fake.rows).toEqual([]);
  });
});

describe("the shipped settings", () => {
  test("given wrangler.jsonc, when it is read, then the waitlist is off, the page is not live, and no database or limiter is bound", () => {
    const config = JSON.parse(shippedConfig.replace(/^\s*\/\/.*$/gm, "")) as { vars: Record<string, string>; d1_databases?: unknown; ratelimits?: unknown };
    expect(config.vars.LANDING_WAITLIST).toBe("false");
    expect(config.vars.LANDING_LIVE).toBe("false");
    expect(config.vars.ANALYTICS_TOKEN).toBe("");
    expect(config.d1_databases).toBeUndefined();
    expect(config.ratelimits).toBeUndefined();
  });
});
