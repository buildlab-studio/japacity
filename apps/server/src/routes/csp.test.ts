// R-SERVER-041: the page's content policy reports to the server, and
// each report leaves one log line of three fields and one count, nothing of the person who met it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MockInstance } from "vitest";

import { utcDay } from "../admin/day";
import { dayName } from "../analytics/day";
import { NO_REGION } from "../analytics/list";
import { testServer } from "../authority/authority.testing";
import { productionConfig, testConfig } from "../config";
import { memoryLimiters } from "../limits/memory";
import { CSP_COUNTER, CSP_REPORT_BYTES, CSP_REPORT_PATH, CSP_REPORTS_PER_REQUEST, cspLogLine, violationsOf } from "./csp";

const HEADERS = readFileSync(fileURLToPath(new URL("../../../client/public/_headers", import.meta.url).href), "utf8");

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
  const day = dayName(utcDay(server.deps.now()));
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
  test("[R-SERVER-041] given the page's _headers, when they are read, then the policy still only reports, and reports to /api/csp-report by report-to through Reporting-Endpoints and by report-uri", () => {
    const policy = /^\s+Content-Security-Policy-Report-Only: (.*)$/m.exec(HEADERS)?.[1] ?? "";
    const directives = new Map(policy.split(";").map((part) => part.trim().split(/\s+/)).map(([name = "", ...sources]) => [name, sources]));
    expect(directives.get("report-uri")).toEqual([CSP_REPORT_PATH]);
    expect(directives.get("report-to")).toEqual(["csp"]);
    expect(/^\s+Reporting-Endpoints: (.*)$/m.exec(HEADERS)?.[1]).toBe(`csp="${CSP_REPORT_PATH}"`);
    expect(HEADERS).not.toMatch(/^\s+Content-Security-Policy:/m);
    // A path on the page's own origin: the one file serves every deployment and names none.
    expect(CSP_REPORT_PATH.startsWith("/api/")).toBe(true);
  });

  test("[R-SERVER-041] given a report-uri report, when it is posted, then it is answered 204 and leaves one line of the directive, the blocked origin and the page's path, and one count under the request's region", async () => {
    const server = testServer();
    const sent = await post(server, legacyReport(), "application/csp-report");
    expect(sent).toEqual({ status: 204, text: "" });
    expect(lines()).toEqual([{ event: "csp-report", directive: "script-src-elem", blocked: "https://ads.example.test", path: "/city" }]);
    expect(await counted(server)).toEqual([{ region: "NG", key: "script-src-elem", count: 1 }]);
  });

  test("[R-SERVER-041] given a Reporting API list with two violations and a report of another kind, when it is posted with a charset, then each violation is one line and one count, and the other report is left out", async () => {
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

  test("[R-SERVER-041] [R-SERVER-015] given reports carrying a query, a fragment, a referrer, a sample, a user agent, a blocked path and an invite code, when they are logged, then no line holds any of them, and each line has exactly its four fields", async () => {
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

  test("[R-SERVER-041] given a directive off the list, an extension's address and fields that are not text, when they are read, then each is written as other, the scheme alone, or none", () => {
    const read = (body: Record<string, unknown>) => violationsOf("application/reports+json", [violation(body)]);
    expect(read({ effectiveDirective: "made-up-src\n{\"event\":\"forged\"}", blockedURL: "chrome-extension://abcdefghijklmnop/inject.js", documentURL: PAGE })).toEqual([{ directive: "other", blocked: "chrome-extension", path: "/city" }]);
    expect(read({ effectiveDirective: 42, blockedURL: null, documentURL: "not an address" })).toEqual([{ directive: "other", blocked: "none", path: "other" }]);
    expect(read({ effectiveDirective: "FONT-SRC", blockedURL: "about:blank", documentURL: "javascript:alert(1)" })).toEqual([{ directive: "font-src", blocked: "about", path: "other" }]);
    expect(cspLogLine({ directive: "other", blocked: "none", path: "/" })).toBe('{"event":"csp-report","directive":"other","blocked":"none","path":"/"}');
  });

  test("[R-SERVER-041] given a list longer than one request may add, when it is posted, then only the first violations up to the limit are logged and counted", async () => {
    const server = testServer();
    const many = Array.from({ length: CSP_REPORTS_PER_REQUEST + 5 }, () => ({ type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "data", documentURL: "https://game.japacity.test/" } }));
    expect((await post(server, JSON.stringify(many), "application/reports+json")).status).toBe(204);
    expect(logged).toHaveBeenCalledTimes(CSP_REPORTS_PER_REQUEST);
    expect(await counted(server)).toEqual([{ region: "NG", key: "img-src", count: CSP_REPORTS_PER_REQUEST }]);
  });
});

describe("the reports refused", () => {
  test("[R-SERVER-041] given a body of another type, none at all, or JSON sent as JSON, when it is posted, then it is refused 415 before it is read, and nothing is logged or counted", async () => {
    const server = testServer();
    for (const type of ["application/json", "text/plain", ""]) expect({ type, status: (await post(server, legacyReport(), type)).status }).toEqual({ type, status: 415 });
    expect(logged).not.toHaveBeenCalled();
    expect(await counted(server)).toEqual([]);
  });

  test("[R-SERVER-041] given a body over the report limit, when it is posted, then it is refused 413, and nothing is logged or counted", async () => {
    const server = testServer();
    const big = legacyReport({ "script-sample": "x".repeat(CSP_REPORT_BYTES) });
    expect((await post(server, big, "application/csp-report")).status).toBe(413);
    expect(logged).not.toHaveBeenCalled();
    expect(await counted(server)).toEqual([]);
  });

  test("[R-SERVER-041] given a body that is not JSON, or JSON that is not a report of its type, when it is posted, then it is refused 400, and nothing is logged or counted", async () => {
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

  test("[R-SERVER-041] [R-SERVER-026] given an address over the anonymous limit, when it posts a report, then it is refused 429 with the limit's reply, and nothing is logged or counted; another address still reports", async () => {
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

  test("[R-SERVER-041] given a request with no country, when its report is counted, then it is counted under the unknown region", async () => {
    const server = testServer();
    const reply = await server.app.request(CSP_REPORT_PATH, { method: "POST", headers: { "content-type": "application/csp-report", "cf-connecting-ip": "203.0.113.9" }, body: legacyReport() });
    expect(reply.status).toBe(204);
    expect(await counted(server)).toEqual([{ region: NO_REGION, key: "script-src-elem", count: 1 }]);
  });
});
