// What the admin view reads and writes of the pair side's moderation store
// (reports, holds, blocks), typed from moderation.md's contract until that
// store lands, with a memory stand-in for the tests.
import type { ConversationRow } from "@japacity/sim";
import type { StoreResult } from "@japacity/store";

/** R-MODERATION-004. */
export const REPORT_REASONS = ["scam", "harassment", "impersonation", "underage", "sexual", "hate", "self-harm", "illegal", "cheating", "advert", "other"] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportCite =
  | { messages: string[] }
  | { place: string; phrase: string; at: number }
  | { card: string }
  | { pair: string }
  | { campaign: string; slot: string };

export type ReportSubject = { account: string } | { campaign: string };

export interface Report {
  id: string;
  reporter: string;
  subject: ReportSubject;
  reason: ReportReason;
  cites: ReportCite;
  unverified: boolean;
  at: number;
  status: "open" | "decided";
  outcome?: "acted" | "no-action";
}

/** R-MODERATION-008. */
export interface Hold {
  report: string;
  messages: string[];
  pair?: string;
  until: number;
}

/**
 * The part of the pair side's `ModerationStore` the queue uses. typed
 * from moderation.md's contract and the pair brief (`list(open)`, `close`, the
 * hold's lift); swap for the landed interface when it merges.
 */
export interface ReportQueueStore {
  /** Open reports, oldest first. */
  open: () => Promise<Report[]>;
  get: (id: string) => Promise<Report | null>;
  /** Every report the account made or is the subject of, oldest first. */
  about: (account: string) => Promise<Report[]>;
  hold: (report: string) => Promise<Hold | null>;
  /** The held conversation's rows, by id, in the order sent. */
  messages: (ids: readonly string[]) => Promise<ConversationRow[]>;
  /** Refused with `missing` for an unknown report and `closed` once decided. */
  close: (report: string, outcome: "acted" | "no-action", at: number) => Promise<StoreResult<Report>>;
  /** R-MODERATION-008: the hold ends; deletion that was waiting goes ahead. */
  lift: (report: string) => Promise<void>;
}

const ID = /^[\w.:~-]{1,128}$/;

function ids(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((each) => typeof each === "string" && ID.test(each));
}

function text(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

/** R-MODERATION-004: the cite a report carries, or null when it cites nothing the page lists. */
export function readCite(value: unknown): ReportCite | null {
  if (typeof value !== "object" || value === null) return null;
  const cite = value as Record<string, unknown>;
  const keys = Object.keys(cite).sort().join(",");
  switch (keys) {
    case "messages":
      return ids(cite.messages) ? { messages: [...cite.messages] } : null;
    case "at,phrase,place":
      return text(cite.place) && text(cite.phrase) && Number.isSafeInteger(cite.at) && (cite.at as number) >= 0 ? { place: cite.place, phrase: cite.phrase, at: cite.at as number } : null;
    case "card":
      return text(cite.card) ? { card: cite.card } : null;
    case "pair":
      return text(cite.pair) ? { pair: cite.pair } : null;
    case "campaign,slot":
      return text(cite.campaign) && text(cite.slot) ? { campaign: cite.campaign, slot: cite.slot } : null;
    default:
      return null;
  }
}

export interface ReportInput {
  subject: ReportSubject;
  reason: ReportReason;
  cites: ReportCite;
  /** R-MODERATION-005: a phrase heard in a place is not stored, so its report is what the client heard. */
  unverified: boolean;
}

/**
 * R-MODERATION-004, R-MODERATION-005: a report's body as sent, or why it is
 * refused. A report with no cites is refused. For the pair side's report route.
 */
export function readReport(body: unknown): { ok: true; report: ReportInput } | { ok: false; detail: string } {
  if (typeof body !== "object" || body === null) return { ok: false, detail: "A report is an object." };
  const { subject, reason, cites } = body as Record<string, unknown>;
  const reasonOk = typeof reason === "string" && (REPORT_REASONS as readonly string[]).includes(reason);
  if (!reasonOk) return { ok: false, detail: `reason is one of ${REPORT_REASONS.join(", ")}.` };
  const who = typeof subject === "object" && subject !== null ? (subject as Record<string, unknown>) : {};
  const keys = Object.keys(who).join(",");
  const named: ReportSubject | null = keys === "account" && text(who.account) ? { account: who.account } : keys === "campaign" && text(who.campaign) ? { campaign: who.campaign } : null;
  if (named === null) return { ok: false, detail: "subject is an account or an advert's campaign." };
  const cite = readCite(cites);
  if (cite === null) return { ok: false, detail: "A report cites what it is about: messages, a phrase heard in a place, a card, a pair, or an advert's slot." };
  return { ok: true, report: { subject: named, reason: reason as ReportReason, cites: cite, unverified: "place" in cite } };
}

/** The tests' stand-in for the pair side's store: reports and holds in arrays. */
export function memoryReportQueue(seed: { reports?: Report[]; holds?: Hold[]; messages?: ConversationRow[] } = {}): ReportQueueStore & { reports: Report[]; holds: Hold[] } {
  const reports = structuredClone(seed.reports ?? []);
  const holds = structuredClone(seed.holds ?? []);
  const rows = structuredClone(seed.messages ?? []);
  const byAge = (list: Report[]) => list.slice().sort((x, y) => x.at - y.at);

  return {
    reports,
    holds,
    open: () => Promise.resolve(structuredClone(byAge(reports.filter((report) => report.status === "open")))),
    get: (id) => Promise.resolve(structuredClone(reports.find((report) => report.id === id) ?? null)),
    about: (account) =>
      Promise.resolve(structuredClone(byAge(reports.filter((report) => report.reporter === account || ("account" in report.subject && report.subject.account === account))))),
    hold: (report) => Promise.resolve(structuredClone(holds.find((hold) => hold.report === report) ?? null)),
    messages: (wanted) => Promise.resolve(structuredClone(rows.filter((row) => wanted.includes(row.id)).sort((x, y) => x.sentAt - y.sentAt))),
    close: (id, outcome) => {
      const report = reports.find((each) => each.id === id);
      if (report === undefined) return Promise.resolve({ ok: false, code: "missing", detail: `No report ${id}.` });
      if (report.status === "decided") return Promise.resolve({ ok: false, code: "closed", detail: `Report ${id} is decided.` });
      report.status = "decided";
      report.outcome = outcome;
      return Promise.resolve({ ok: true, value: structuredClone(report) });
    },
    lift: (report) => {
      const at = holds.findIndex((hold) => hold.report === report);
      if (at >= 0) holds.splice(at, 1);
      return Promise.resolve();
    },
  };
}
