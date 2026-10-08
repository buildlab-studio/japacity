import { describe, expect, test } from "vitest";

import type { Env } from "./index";
import worker from "./index";
import { cleanEmail, INSERT } from "./join";

interface Fake {
  rows: [string, string][];
  limited: boolean;
  statements: string[];
}

function env(fake: Fake, token = "abc123"): Env {
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
  return { DB: db as unknown as D1Database, JOIN_LIMIT: limiter, ANALYTICS_TOKEN: token, SITE_URL: "https://japacity.com" };
}

function fresh(): Fake {
  return { rows: [], limited: false, statements: [] };
}

function post(body: Record<string, string>, ip = "1.2.3.4"): Request {
  const form = new URLSearchParams(body);
  return new Request("https://japacity.com/join", { method: "POST", body: form, headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": ip } });
}

async function serve(request: Request, fake: Fake, token?: string): Promise<Response> {
  return worker.fetch(request, env(fake, token));
}

describe("the page", () => {
  test("given a visit, when the page is served, then it carries the name, the line, the privacy line, the form, the social card and the analytics script", async () => {
    const response = await serve(new Request("https://japacity.com/"), fresh());
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("<h1>Japacity</h1>");
    expect(html).toContain("One email when it opens, then we delete your address.");
    expect(html).toContain('action="/join"');
    expect(html).toContain('property="og:image" content="https://japacity.com/card.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain("static.cloudflareinsights.com/beacon.min.js");
    expect(html).toContain('"token": "abc123"');
    expect(response.headers.get("content-security-policy")).toContain("script-src https://static.cloudflareinsights.com");
  });

  test("given no analytics token, when the page is served, then no analytics script is sent", async () => {
    const html = await (await serve(new Request("https://japacity.com/"), fresh(), "")).text();
    expect(html).not.toContain("cloudflareinsights");
  });

  test("given any other path or method, when asked, then it is not found", async () => {
    for (const url of ["https://japacity.com/list", "https://japacity.com/waitlist", "https://japacity.com/join"]) {
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

