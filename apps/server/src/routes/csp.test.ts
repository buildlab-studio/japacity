// server:csp-reports-to-own-origin: the page's content policy reports to the server, and
// each report leaves one log line of three fields and one count, nothing of the person who met it.
import { CSP_BLOCKED_KINDS } from "@japacity/content";
import { time } from "@japacity/sim";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MockInstance } from "vitest";

import { NO_REGION } from "../analytics/list";
import { testServer } from "../authority/authority.testing";
import { productionConfig, testConfig } from "../config";
import { memoryLimiters } from "../limits/memory";
import { CSP_BLOCKED_COUNTER, CSP_COUNTER, CSP_REPORT_BYTES, CSP_REPORT_PATH, CSP_REPORTS_PER_REQUEST, cspLogLine, violationsOf } from "./csp";

const HEADERS = readFileSync(fileURLToPath(new URL("../../../client/public/_headers", import.meta.url).href), "utf8");

/** One policy header of the page, as its directives and their sources. */
function policyOf(header: string): Map<string, string[]> {
  const policy = new RegExp(`^\\s+${header}: (.*)$`, "m").exec(HEADERS)?.[1] ?? "";
  return new Map(policy.split(";").map((part) => part.trim().split(/\s+/)).map(([name = "", ...sources]) => [name, sources]));
}

/** The policy the browser enforces, and the stricter one it only reports. */
const ENFORCED = policyOf("Content-Security-Policy");
const REPORTED = policyOf("Content-Security-Policy-Report-Only");

/** What a person's browser would put in a report, each a sentinel that must never reach a log line. */
const PERSONAL = {
  query: "secret-query-7f3a",
  fragment: "secret-fragment-2b9c",
  referrer: "https://referrer-site.test/secret-referrer-1d4e",
  sample: "secret-sample-8a6b",
  userAgent: "Secret-Agent/9.9 (secret-device-5c2f)",
  blockedPath: "/secret-blocked-path-3e1d",
  invite: "4f1e2d3c4b5a69788796a5b4",
};

const PAGE = `https://game.japacity.test/city?${PERSONAL.query}#${PERSONAL.fragment}`;

function legacyReport(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    "csp-report": {
      "document-uri": PAGE,
      referrer: PERSONAL.referrer,
      "violated-directive": "script-src-elem",
      "effective-directive": "script-src-elem",
      "original-policy": "default-src 'self'; report-uri /api/csp-report",
      disposition: "report",
      "blocked-uri": `https://ads.example.test${PERSONAL.blockedPath}?${PERSONAL.query}`,
      "status-code": 200,
      "script-sample": PERSONAL.sample,
      "source-file": `https://game.japacity.test/assets/index.js?${PERSONAL.query}`,
      "line-number": 3,
      "column-number": 7,
      ...over,
    },
  });
}

function violation(body: Record<string, unknown>): Record<string, unknown> {
  return { type: "csp-violation", age: 10, url: PAGE, user_agent: PERSONAL.userAgent, body: { documentURL: PAGE, referrer: PERSONAL.referrer, sample: PERSONAL.sample, disposition: "report", statusCode: 200, lineNumber: 1, columnNumber: 1, ...body } };
}

interface Sent {
  status: number;
  text: string;
}

async function post(server: ReturnType<typeof testServer>, body: string, contentType: string, ip = "203.0.113.9"): Promise<Sent> {
  const reply = await server.app.request(CSP_REPORT_PATH, { method: "POST", headers: { "content-type": contentType, "cf-connecting-ip": ip, "cf-ipcountry": "NG", "user-agent": PERSONAL.userAgent }, body });
  return { status: reply.status, text: await reply.text() };
}

async function counted(server: ReturnType<typeof testServer>): Promise<{ region: string; key: string; count: number }[]> {
  const day = time.dayName(time.utcDay(server.deps.now()));
  const rows = await server.deps.stores.counters.days(day, day);
  return rows.filter((row) => row.name === CSP_COUNTER).map(({ region, key, count }) => ({ region, key, count }));
}

let logged: MockInstance<typeof console.error>;
const lines = (): Record<string, unknown>[] => logged.mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>);

beforeEach(() => {
  logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  logged.mockRestore();
});

describe("the page's policy reports", () => {
  test("[server:csp-reports-to-own-origin] given the page's _headers, when they are read, then one policy is enforced and a stricter one beside it only reports, each once, both to /api/csp-report by report-to through Reporting-Endpoints and by report-uri", () => {
    expect(HEADERS.match(/^\s+Content-Security-Policy: /gm)).toHaveLength(1);
    expect(HEADERS.match(/^\s+Content-Security-Policy-Report-Only: /gm)).toHaveLength(1);
    for (const policy of [ENFORCED, REPORTED]) {
      expect(policy.get("report-uri")).toEqual([CSP_REPORT_PATH]);
      expect(policy.get("report-to")).toEqual(["csp"]);
    }
    expect(/^\s+Reporting-Endpoints: (.*)$/m.exec(HEADERS)?.[1]).toBe(`csp="${CSP_REPORT_PATH}"`);
    // A path on the page's own origin: the one file serves every deployment and names none.
    expect(CSP_REPORT_PATH.startsWith("/api/")).toBe(true);
  });

  test("[server:csp-reports-to-own-origin] given the enforced policy, when its directives are read, then nothing loads from anywhere not named, no string runs as script, no inline script runs, and no page may frame it, change its base, embed a plugin or send a form anywhere", () => {
    expect(ENFORCED.get("default-src")).toEqual(["'self'"]);
    expect(ENFORCED.get("object-src")).toEqual(["'none'"]);
    expect(ENFORCED.get("base-uri")).toEqual(["'none'"]);
    expect(ENFORCED.get("frame-ancestors")).toEqual(["'none'"]);
    expect(ENFORCED.get("form-action")).toEqual(["'none'"]);
    expect(ENFORCED.get("script-src")?.[0]).toBe("'self'");
    for (const [name, sources] of ENFORCED) {
      for (const loose of ["'unsafe-eval'", "'unsafe-hashes'", "*", "https:", "http:", "data:"]) expect({ name, loose, allowed: sources.includes(loose) }).toEqual({ name, loose, allowed: (name === "img-src" || name === "font-src") && loose === "data:" });
      expect({ name, inlineScript: name.startsWith("script-src") && sources.includes("'unsafe-inline'") }).toEqual({ name, inlineScript: false });
      // An outside source is a whole host, never a path or a wildcard under it.
      const outside = sources.filter((source) => source.startsWith("https://"));
      expect({ name, outside: outside.filter((source) => !/^https:\/\/[a-z0-9.-]+$/.test(source)) }).toEqual({ name, outside: [] });
    }
  });

  test("[server:csp-reports-to-own-origin] given the stricter policy beside it, when its directives are read, then it is the enforced one that also asks for Trusted Types from the page's one policy, inline styles only by the build's hashes and no style attribute", () => {
    const stricter = new Set(["style-src", "style-src-attr", "require-trusted-types-for", "trusted-types"]);
    const shared = [...ENFORCED].filter(([name]) => !stricter.has(name));
    expect(shared.map(([name]) => [name, REPORTED.get(name)])).toEqual(shared);
    expect([...REPORTED.keys()].filter((name) => !ENFORCED.has(name) && !stricter.has(name))).toEqual([]);
    expect(REPORTED.get("require-trusted-types-for")).toEqual(["'script'"]);
    expect(REPORTED.get("trusted-types")).toEqual(["japacity"]);
    expect(REPORTED.get("style-src")).toEqual(["'self'", "{inline-style-hashes}"]);
    expect(REPORTED.get("style-src-attr")).toEqual(["'none'"]);
    // What the stricter one reports is not already refused: the enforced policy still lets inline styles in.
    expect(ENFORCED.get("style-src")).toEqual(["'self'", "'unsafe-inline'"]);
  });

  test("[server:csp-reports-to-own-origin] given a report-uri report, when it is posted, then it is answered 204 and leaves one line of the directive, the blocked origin and the page's path, and one count under the request's region", async () => {
    const server = testServer();
    const sent = await post(server, legacyReport(), "application/csp-report");
    expect(sent).toEqual({ status: 204, text: "" });
    expect(lines()).toEqual([{ event: "csp-report", directive: "script-src-elem", blocked: "https://ads.example.test", path: "/city" }]);
    expect(await counted(server)).toEqual([{ region: "NG", key: "script-src-elem", count: 1 }]);
  });

  test("[server:csp-reports-to-own-origin] given a Reporting API list with two violations and a report of another kind, when it is posted with a charset, then each violation is one line and one count, and the other report is left out", async () => {
    const server = testServer();
    const body = JSON.stringify([
      violation({ effectiveDirective: "img-src", blockedURL: "https://images.example.test/a.png", documentURL: `https://game.japacity.test/invite/${PERSONAL.invite}` }),
      { type: "deprecation", age: 1, url: PAGE, user_agent: PERSONAL.userAgent, body: { id: "x", message: "old" } },
      violation({ effectiveDirective: "img-src", blockedURL: "data", documentURL: PAGE }),
    ]);
    const sent = await post(server, body, "application/reports+json; charset=utf-8");
    expect(sent.status).toBe(204);
    expect(lines()).toEqual([
      { event: "csp-report", directive: "img-src", blocked: "https://images.example.test", path: "/invite/:code" },
      { event: "csp-report", directive: "img-src", blocked: "data", path: "/city" },
    ]);
    expect(await counted(server)).toEqual([{ region: "NG", key: "img-src", count: 2 }]);
  });

  test("[server:csp-reports-to-own-origin] [server:secrets-stay-on-server] given reports carrying a query, a fragment, a referrer, a sample, a user agent, a blocked path and an invite code, when they are logged, then no line holds any of them, and each line has exactly its four fields", async () => {
    const server = testServer();
    await post(server, legacyReport(), "application/csp-report");
    await post(server, legacyReport({ "document-uri": `https://game.japacity.test/invite/${PERSONAL.invite}?${PERSONAL.query}`, "blocked-uri": "inline", "effective-directive": undefined, "violated-directive": "style-src-attr 'self'" }), "application/csp-report");
    await post(server, JSON.stringify([violation({ effectiveDirective: "connect-src", blockedURL: `wss://user:pass@socket.example.test:8443${PERSONAL.blockedPath}?${PERSONAL.query}` })]), "application/reports+json");
    const written = logged.mock.calls.map((call) => String(call[0])).join("\n");
    for (const value of Object.values(PERSONAL)) expect({ value, logged: written.includes(value) }).toEqual({ value, logged: false });
    expect(written).not.toContain("user:pass");
    for (const line of lines()) expect(Object.keys(line).sort()).toEqual(["blocked", "directive", "event", "path"]);
    expect(lines().map((line) => [line["directive"], line["blocked"], line["path"]])).toEqual([
      ["script-src-elem", "https://ads.example.test", "/city"],
      ["style-src-attr", "inline", "/invite/:code"],
      ["connect-src", "wss://socket.example.test:8443", "/city"],
    ]);
  });

  test("[server:csp-reports-to-own-origin] given a directive off the list, an extension's address and fields that are not text, when they are read, then each is written as other, the scheme alone, or none", () => {
    const read = (body: Record<string, unknown>) => violationsOf("application/reports+json", [violation(body)]);
    expect(read({ effectiveDirective: "made-up-src\n{\"event\":\"forged\"}", blockedURL: "chrome-extension://abcdefghijklmnop/inject.js", documentURL: PAGE })).toEqual([{ directive: "other", blocked: "chrome-extension", path: "/city" }]);
    expect(read({ effectiveDirective: 42, blockedURL: null, documentURL: "not an address" })).toEqual([{ directive: "other", blocked: "none", path: "other" }]);
    expect(read({ effectiveDirective: "FONT-SRC", blockedURL: "about:blank", documentURL: "javascript:alert(1)" })).toEqual([{ directive: "font-src", blocked: "about", path: "other" }]);
    expect(cspLogLine({ directive: "other", blocked: "none", path: "/" })).toBe('{"event":"csp-report","directive":"other","blocked":"none","path":"/"}');
  });

  test("[server:csp-reports-to-own-origin] given a list longer than one request may add, when it is posted, then only the first violations up to the limit are logged and counted", async () => {
    const server = testServer();
    const many = Array.from({ length: CSP_REPORTS_PER_REQUEST + 5 }, () => ({ type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "data", documentURL: "https://game.japacity.test/" } }));
    expect((await post(server, JSON.stringify(many), "application/reports+json")).status).toBe(204);
    expect(logged).toHaveBeenCalledTimes(CSP_REPORTS_PER_REQUEST);
    expect(await counted(server)).toEqual([{ region: "NG", key: "img-src", count: CSP_REPORTS_PER_REQUEST }]);
  });
});

async function countedBlocked(server: ReturnType<typeof testServer>): Promise<{ region: string; key: string; count: number }[]> {
  const day = time.dayName(time.utcDay(server.deps.now()));
  const rows = await server.deps.stores.counters.days(day, day);
  return rows
    .filter((row) => row.name === CSP_BLOCKED_COUNTER)
    .map(({ region, key, count }) => ({ region, key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

describe("the blocked thing's kind", () => {
  test("[server:csp-reports-to-own-origin] given a report-uri report of an inline script the policy only reported, when it is posted, then the blocked counter adds one under report, the directive and the kind inline, beside the directive's own count", async () => {
    const server = testServer();
    expect((await post(server, legacyReport({ "blocked-uri": "inline" }), "application/csp-report")).status).toBe(204);
    expect(await counted(server)).toEqual([{ region: "NG", key: "script-src-elem", count: 1 }]);
    expect(await countedBlocked(server)).toEqual([{ region: "NG", key: "report:script-src-elem:inline", count: 1 }]);
  });

  test("[server:csp-reports-to-own-origin] given violations of every kind on the list, when they are posted, then each is counted under its kind: the browser's word, the scheme, an extension, the page's own origin, a host the policy names, or any other host", async () => {
    const server = testServer();
    const blocked: [string, string][] = [
      ["inline", "script-src-elem:inline"],
      ["eval", "script-src:eval"],
      ["wasm-eval", "script-src:wasm-eval"],
      ["trusted-types-sink", "require-trusted-types-for:trusted-types-sink"],
      ["trusted-types-policy", "trusted-types:trusted-types-policy"],
      ["data", "img-src:data"],
      ["data:image/png;base64,c2VjcmV0", "font-src:data"],
      [`blob:https://game.japacity.test/${PERSONAL.invite}`, "worker-src:blob"],
      ["chrome-extension://abcdefghijklmnop/inject.js", "script-src-elem:extension"],
      ["moz-extension://0a1b2c3d-4e5f/content.js", "style-src-elem:extension"],
      ["safari-web-extension://ABCDEF/script.js", "connect-src:extension"],
      [`https://game.japacity.test/assets/index.js?${PERSONAL.query}`, "script-src-elem:self"],
      ["self", "style-src-attr:self"],
      ["https://challenges.cloudflare.com/turnstile/v0/api.js", "frame-src:challenges.cloudflare.com"],
      ["https://static.cloudflareinsights.com/beacon.min.js/v8c78df7c7c0f484497ecbca7046644da1771523124516", "script-src-elem:static.cloudflareinsights.com"],
      ["https://cloudflareinsights.com/cdn-cgi/rum", "connect-src:cloudflareinsights.com"],
      [`https://ads.example.test${PERSONAL.blockedPath}?${PERSONAL.query}`, "img-src:other-host"],
      ["about:blank", "frame-src:other"],
      ["", "media-src:other"],
    ];
    expect(blocked.length).toBeLessThanOrEqual(CSP_REPORTS_PER_REQUEST);
    const body = blocked.map(([blockedURL, key]) => violation({ effectiveDirective: key.split(":")[0], blockedURL, documentURL: PAGE, disposition: "enforce" }));
    expect((await post(server, JSON.stringify(body), "application/reports+json")).status).toBe(204);
    const wanted = blocked.map(([, key]) => ({ region: "NG", key: `enforce:${key}`, count: 1 })).sort((a, b) => a.key.localeCompare(b.key));
    expect(await countedBlocked(server)).toEqual(wanted);
    for (const row of await countedBlocked(server)) expect(CSP_BLOCKED_KINDS as readonly string[]).toContain(row.key.split(":")[2]);
  });

  test("[server:csp-reports-to-own-origin] given a blocked address on a host the policy does not name, or the page's host on another scheme, when it is counted, then its key holds other-host and nothing of the address", async () => {
    const server = testServer();
    const body = [
      violation({ effectiveDirective: "connect-src", blockedURL: `wss://user:pass@socket.example.test:8443${PERSONAL.blockedPath}?${PERSONAL.query}` }),
      violation({ effectiveDirective: "img-src", blockedURL: "http://game.japacity.test/assets/a.png" }),
      violation({ effectiveDirective: "script-src-elem", blockedURL: "https://challenges.cloudflare.com.example.test/api.js" }),
      violation({ effectiveDirective: "script-src-elem", blockedURL: "http://static.cloudflareinsights.com/beacon.min.js" }),
    ];
    await post(server, JSON.stringify(body), "application/reports+json");
    expect(await countedBlocked(server)).toEqual([
      { region: "NG", key: "report:connect-src:other-host", count: 1 },
      { region: "NG", key: "report:img-src:other-host", count: 1 },
      { region: "NG", key: "report:script-src-elem:other-host", count: 2 },
    ]);
  });

  test("[server:csp-reports-to-own-origin] given reports the policy enforced, only reported, or said nothing of, in both shapes, when they are counted, then each is kept under enforce, report, or other", async () => {
    const server = testServer();
    await post(server, legacyReport({ "blocked-uri": "inline", disposition: "enforce" }), "application/csp-report");
    await post(server, legacyReport({ "blocked-uri": "inline", disposition: undefined }), "application/csp-report");
    const body = [
      violation({ effectiveDirective: "img-src", blockedURL: "data", disposition: "report" }),
      violation({ effectiveDirective: "img-src", blockedURL: "data", disposition: "ENFORCE" }),
      violation({ effectiveDirective: "img-src", blockedURL: "data", disposition: "made-up\n{}" }),
    ];
    await post(server, JSON.stringify(body), "application/reports+json");
    expect(await countedBlocked(server)).toEqual([
      { region: "NG", key: "enforce:img-src:data", count: 1 },
      { region: "NG", key: "enforce:script-src-elem:inline", count: 1 },
      { region: "NG", key: "other:img-src:data", count: 1 },
      { region: "NG", key: "other:script-src-elem:inline", count: 1 },
      { region: "NG", key: "report:img-src:data", count: 1 },
    ]);
  });

  test("[server:csp-reports-to-own-origin] given the shipped policy, when its hosts are read, then each is a kind the blocked counter names, so a report against an allowed host is never lost in other-host", () => {
    const hosts = new Set([...HEADERS.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map((match) => match[1] ?? ""));
    expect(hosts.size).toBeGreaterThan(0);
    for (const host of hosts) expect(CSP_BLOCKED_KINDS as readonly string[]).toContain(host);
  });
});

describe("the reports refused", () => {
  test("[server:csp-reports-to-own-origin] given a body of another type, none at all, or JSON sent as JSON, when it is posted, then it is refused 415 before it is read, and nothing is logged or counted", async () => {
    const server = testServer();
    for (const type of ["application/json", "text/plain", ""]) expect({ type, status: (await post(server, legacyReport(), type)).status }).toEqual({ type, status: 415 });
    expect(logged).not.toHaveBeenCalled();
    expect(await counted(server)).toEqual([]);
  });

  test("[server:csp-reports-to-own-origin] given a body over the report limit, when it is posted, then it is refused 413, and nothing is logged or counted", async () => {
    const server = testServer();
    const big = legacyReport({ "script-sample": "x".repeat(CSP_REPORT_BYTES) });
    expect((await post(server, big, "application/csp-report")).status).toBe(413);
    expect(logged).not.toHaveBeenCalled();
    expect(await counted(server)).toEqual([]);
  });

  test("[server:csp-reports-to-own-origin] given a body that is not JSON, or JSON that is not a report of its type, when it is posted, then it is refused 400, and nothing is logged or counted", async () => {
    const server = testServer();
    const cases: [string, string][] = [
      ["{not json", "application/csp-report"],
      [JSON.stringify({ report: {} }), "application/csp-report"],
      [JSON.stringify([violation({})]), "application/csp-report"],
      [legacyReport(), "application/reports+json"],
    ];
    for (const [body, type] of cases) expect({ body: body.slice(0, 20), status: (await post(server, body, type)).status }).toEqual({ body: body.slice(0, 20), status: 400 });
    expect(logged).not.toHaveBeenCalled();
    expect(await counted(server)).toEqual([]);
  });

  test("[server:csp-reports-to-own-origin] [server:anonymous-limit-by-address] given an address over the anonymous limit, when it posts a report, then it is refused 429 with the limit's reply, and nothing is logged or counted; another address still reports", async () => {
    const config = testConfig({ limits: { anonPer60s: 1 } });
    const now = productionConfig.clock.epoch;
    const server = testServer({ config, now: () => now, limits: memoryLimiters(config.limits, () => now) });
    expect((await post(server, legacyReport(), "application/csp-report")).status).toBe(204);
    logged.mockClear();
    const over = await post(server, legacyReport(), "application/csp-report");
    expect(over.status).toBe(429);
    expect(JSON.parse(over.text)).toMatchObject({ ok: false, code: "rate-limited" });
    expect(logged).not.toHaveBeenCalled();
    expect(await counted(server)).toEqual([{ region: "NG", key: "script-src-elem", count: 1 }]);
    expect((await post(server, legacyReport(), "application/csp-report", "198.51.100.4")).status).toBe(204);
  });

  test("[server:csp-reports-to-own-origin] [server:anonymous-limit-by-address] given an IPv6 address over the anonymous limit, when another address in its /64 posts a report, then it is refused 429, and an address in the next /64 still reports", async () => {
    const config = testConfig({ limits: { anonPer60s: 1 } });
    const now = productionConfig.clock.epoch;
    const server = testServer({ config, now: () => now, limits: memoryLimiters(config.limits, () => now) });
    expect((await post(server, legacyReport(), "application/csp-report", "2001:db8:9:9::1")).status).toBe(204);
    expect((await post(server, legacyReport(), "application/csp-report", "2001:db8:9:9::2")).status).toBe(429);
    expect((await post(server, legacyReport(), "application/csp-report", "2001:db8:9:a::1")).status).toBe(204);
  });

  test("[server:csp-reports-to-own-origin] given a request with no country, when its report is counted, then it is counted under the unknown region", async () => {
    const server = testServer();
    const reply = await server.app.request(CSP_REPORT_PATH, { method: "POST", headers: { "content-type": "application/csp-report", "cf-connecting-ip": "203.0.113.9" }, body: legacyReport() });
    expect(reply.status).toBe(204);
    expect(await counted(server)).toEqual([{ region: NO_REGION, key: "script-src-elem", count: 1 }]);
  });
});
