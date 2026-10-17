// `POST /api/csp-report` (server.md R-SERVER-041): where the page's content policy, which reports and blocks
// nothing, sends what it would have blocked, so the violations real play makes can be seen. Browsers send
// one of two shapes: the older `report-uri` one (`application/csp-report`, one report) and the Reporting API's
// (`application/reports+json`, a list that may hold other kinds of report too). Each violation becomes one log line
// and one count. A report carries far more than is kept: the line holds the directive, the blocked address's origin
// and the document's path, and nothing else (never the user agent, the full address, the referrer, the sample, the
// policy or a query string; R-SERVER-015, analytics.md R-ANALYTICS-007).
import { CSP_DIRECTIVES } from "@japacity/content";
import type { CounterTotal } from "@japacity/store";
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { utcDay } from "../admin/day";
import { dayName } from "../analytics/day";
import { NO_REGION } from "../analytics/list";
import type { ServerDeps } from "../deps";
import { overLimit } from "../limits/limit";
import { TOO_LARGE_DETAIL } from "../security/body";
import type { ServerRejection } from "../types";
import { writeLine } from "../log";
import { countryOf } from "./place";

export const CSP_REPORT_PATH = "/api/csp-report";

/** The two report shapes a browser sends: `report-uri`'s and the Reporting API's. */
export const CSP_REPORT_TYPES = ["application/csp-report", "application/reports+json"] as const;

/** A report body over this is refused before it is read. A violation is under 2 KiB, the policy included. */
export const CSP_REPORT_BYTES = 16 * 1024;

/** The most violations one request may add; the rest of a longer list is left out. */
export const CSP_REPORTS_PER_REQUEST = 20;

/** The counter each violation adds one to, keyed by its directive. Counts only (analytics.md R-ANALYTICS-012). */
export const CSP_COUNTER = "client/csp";

/** The directives a report may name, from the content's counter list (analytics.md R-ANALYTICS-008); any other is `other`. */
export { CSP_DIRECTIVES };

type CspDirective = (typeof CSP_DIRECTIVES)[number];

/** The words a browser writes for a blocked thing that has no address of its own. */
const BLOCKED_WORDS: ReadonlySet<string> = new Set(["inline", "eval", "wasm-eval", "trusted-types-policy", "trusted-types-sink", "self", "data", "blob", "about"]);

/** What one violation leaves behind, as logged. */
export interface CspViolation {
  directive: CspDirective;
  /** The blocked address's origin, a scheme for an address with no web origin, or one of BLOCKED_WORDS. */
  blocked: string;
  /** The document's path alone: no host, no query, no fragment, no invite code. */
  path: string;
}

/** The most characters a logged field may hold. */
const FIELD_CHARS = 120;

const UNSUPPORTED_DETAIL = "Only a content policy report is accepted here.";
const MALFORMED_DETAIL = "The report could not be read.";

function directiveOf(raw: unknown): CspDirective {
  if (typeof raw !== "string") return "other";
  // `violated-directive` may carry the directive's sources after its name; only the name is kept.
  const name = raw.trim().toLowerCase().split(/\s+/)[0] ?? "";
  return (CSP_DIRECTIVES as readonly string[]).includes(name) ? (name as CspDirective) : "other";
}

function blockedOf(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim() === "") return "none";
  const value = raw.trim();
  if (BLOCKED_WORDS.has(value.toLowerCase())) return value.toLowerCase();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "other";
  }
  if (["http:", "https:", "ws:", "wss:"].includes(url.protocol)) return url.origin.slice(0, FIELD_CHARS);
  // data:, blob: and an extension's own scheme: the scheme alone, never what follows it.
  const scheme = url.protocol.slice(0, -1);
  return /^[a-z][a-z0-9+.-]{0,30}$/.test(scheme) ? scheme : "other";
}

function pathOf(raw: unknown): string {
  if (typeof raw !== "string") return "other";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "other";
  }
  if (!["http:", "https:"].includes(url.protocol)) return "other";
  // An invite link's code lets its holder pair with the player who made it (pair.md R-PAIR-007): never kept.
  if (url.pathname.startsWith("/invite/")) return "/invite/:code";
  return url.pathname.slice(0, FIELD_CHARS);
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The violations in a report body, by its content type; null when the body is not a report of that type. */
export function violationsOf(type: (typeof CSP_REPORT_TYPES)[number], body: unknown): CspViolation[] | null {
  if (type === "application/csp-report") {
    const report = record(record(body)?.["csp-report"]);
    if (report === null) return null;
    return [{ directive: directiveOf(report["effective-directive"] ?? report["violated-directive"]), blocked: blockedOf(report["blocked-uri"]), path: pathOf(report["document-uri"]) }];
  }
  if (!Array.isArray(body)) return null;
  const found: CspViolation[] = [];
  for (const item of body as unknown[]) {
    const report = record(item);
    const inner = record(report?.["body"]);
    // The Reporting API sends other kinds of report to the same address (deprecations, interventions); only these count.
    if (report?.["type"] !== "csp-violation" || inner === null) continue;
    found.push({ directive: directiveOf(inner["effectiveDirective"]), blocked: blockedOf(inner["blockedURL"]), path: pathOf(inner["documentURL"]) });
  }
  return found;
}

/** The report's content type, its parameters left off, when it is one of the two. */
function reportType(header: string | undefined): (typeof CSP_REPORT_TYPES)[number] | null {
  const type = (header ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return CSP_REPORT_TYPES.find((each) => each === type) ?? null;
}

/** One log line for one violation: its three fields and the line's name, nothing else. */
export function cspLogLine(violation: CspViolation): string {
  return JSON.stringify({ event: "csp-report", directive: violation.directive, blocked: violation.blocked, path: violation.path });
}

function refuse(status: 400 | 413 | 415, detail: string): Response {
  return Response.json({ ok: false, code: "not-legal", detail } satisfies ServerRejection, { status });
}

export function cspReportRoute(deps: ServerDeps): Hono {
  const route = new Hono();

  // R-SERVER-026: a report carries no session worth reading, so every one counts against the address limit.
  // Then the type, before the body is read.
  const guard: MiddlewareHandler = async (c, next) => {
    const refused = await overLimit(deps, "reads", null, c.req.header("cf-connecting-ip") ?? null);
    if (refused !== null) return c.json(refused, 429);
    if (reportType(c.req.header("content-type")) === null) return refuse(415, UNSUPPORTED_DETAIL);
    await next();
    return undefined;
  };

  route.post(CSP_REPORT_PATH, guard, bodyLimit({ maxSize: CSP_REPORT_BYTES, onError: () => refuse(413, TOO_LARGE_DETAIL) }), async (c) => {
    const type = reportType(c.req.header("content-type"));
    let body: unknown;
    try {
      body = JSON.parse(await c.req.text());
    } catch {
      return refuse(400, MALFORMED_DETAIL);
    }
    const violations = type === null ? null : violationsOf(type, body);
    if (violations === null) return refuse(400, MALFORMED_DETAIL);
    const kept = violations.slice(0, CSP_REPORTS_PER_REQUEST);
    // The log line first, so a report is seen even if the count cannot be written; written through log.ts, the
    // Worker's one console writer (R-SERVER-042).
    for (const violation of kept) writeLine(cspLogLine(violation));
    if (kept.length > 0) {
      const day = dayName(utcDay(deps.now()));
      const country = countryOf(c.req.raw);
      const region = country !== null && /^[A-Z]{2}$/.test(country) ? country : NO_REGION;
      const counts = new Map<CspDirective, number>();
      for (const violation of kept) counts.set(violation.directive, (counts.get(violation.directive) ?? 0) + 1);
      const rows: CounterTotal[] = [...counts].map(([key, count]) => ({ day, region, name: CSP_COUNTER, key, count }));
      await deps.stores.counters.add(rows);
    }
    return c.body(null, 204);
  });

  return route;
}
