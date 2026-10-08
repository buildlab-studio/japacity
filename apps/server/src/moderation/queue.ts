// R-MODERATION-010, R-MODERATION-011, R-MODERATION-013: the one queue and
// what the admin view shows for each item in it.
import { text } from "@japacity/content";
import { time } from "@japacity/sim";
import type { AppealRow, ModerationLogEntry } from "@japacity/store";

import type { ServerDeps } from "../deps";
import type { Hold, Report, ReportQueueStore, ReportReason, ReportSubject, ReportCite } from "./reports";

/** R-MODERATION-010: lower goes first. Appeals carry no reason and sit with the rest. */
const WEIGHT: Record<ReportReason, number> = {
  underage: 0,
  "self-harm": 0,
  sexual: 0,
  illegal: 0,
  scam: 1,
  harassment: 2,
  impersonation: 2,
  hate: 2,
  cheating: 2,
  advert: 2,
  other: 2,
};

const APPEAL_WEIGHT = 2;

/** A held message as the admin reads it: the phrase's own words and when it was sent. */
export interface HeldMessage {
  id: string;
  sender: string;
  phrase: string;
  words: string;
  fill: string | null;
  sentAt: number;
}

/** R-MODERATION-013: one account as the admin view shows it. Never an email, a seed or a character's state. */
export interface AccountSummary {
  account: string;
  region: string | null;
  /** Milliseconds since the account was made; null once it is gone. */
  accountAge: number | null;
  made: { id: string; reason: ReportReason; at: number; status: Report["status"]; outcome?: Report["outcome"] }[];
  received: { id: string; reason: ReportReason; at: number; status: Report["status"]; outcome?: Report["outcome"] }[];
  actions: ModerationLogEntry[];
}

export type QueueItem =
  | {
      kind: "report";
      id: string;
      reason: ReportReason;
      at: number;
      age: number;
      subject: ReportSubject;
      cites: ReportCite;
      unverified: boolean;
      hold: Hold | null;
      messages: HeldMessage[];
      reporter: AccountSummary;
      reported: AccountSummary | null;
    }
  | {
      kind: "appeal";
      id: string;
      at: number;
      age: number;
      entry: ModerationLogEntry | null;
      appellant: AccountSummary;
      /** R-MODERATION-016: the admin who acted, who should not decide it while another can. */
      actedBy: string | null;
    };

export interface QueueView {
  items: QueueItem[];
  /** R-MODERATION-011: the oldest open item's age in milliseconds, 0 for an empty queue. */
  oldest: number;
  target: number;
  overdue: number;
}

function brief(report: Report) {
  const { id, reason, at, status, outcome } = report;
  return outcome === undefined ? { id, reason, at, status } : { id, reason, at, status, outcome };
}

export async function summarise(deps: ServerDeps, queue: ReportQueueStore, account: string): Promise<AccountSummary> {
  const row = await deps.stores.account.get(account);
  const reports = await queue.about(account);
  return {
    account,
    region: row?.country ?? null,
    accountAge: row === null ? null : deps.now() - row.createdAt,
    made: reports.filter((report) => report.reporter === account).map(brief),
    received: reports.filter((report) => "account" in report.subject && report.subject.account === account).map(brief),
    actions: await deps.stores.moderationLog.list({ account }),
  };
}

/** R-MODERATION-013: the cited messages as their phrases with their times. */
async function heldMessages(queue: ReportQueueStore, report: Report): Promise<HeldMessage[]> {
  if (!("messages" in report.cites)) return [];
  const rows = await queue.messages(report.cites.messages);
  return rows.map((row) => ({ id: row.id, sender: row.sender, phrase: row.phrase, words: text[`${row.phrase}.name`] ?? row.phrase, fill: row.fill, sentAt: row.sentAt }));
}

async function reportItem(deps: ServerDeps, queue: ReportQueueStore, report: Report): Promise<QueueItem> {
  return {
    kind: "report",
    id: report.id,
    reason: report.reason,
    at: report.at,
    age: deps.now() - report.at,
    subject: report.subject,
    cites: report.cites,
    unverified: report.unverified,
    hold: await queue.hold(report.id),
    messages: await heldMessages(queue, report),
    reporter: await summarise(deps, queue, report.reporter),
    reported: "account" in report.subject ? await summarise(deps, queue, report.subject.account) : null,
  };
}

async function appealItem(deps: ServerDeps, queue: ReportQueueStore, appeal: AppealRow): Promise<QueueItem> {
  const entry = await deps.stores.moderationLog.get(appeal.entry);
  return { kind: "appeal", id: appeal.id, at: appeal.at, age: deps.now() - appeal.at, entry, appellant: await summarise(deps, queue, appeal.account), actedBy: entry?.admin ?? null };
}

function weightOf(item: QueueItem): number {
  return item.kind === "report" ? WEIGHT[item.reason] : APPEAL_WEIGHT;
}

/** R-MODERATION-010: open reports and appeals by reason weight, then oldest first. */
export async function readQueue(deps: ServerDeps, queue: ReportQueueStore): Promise<QueueView> {
  const reports = await Promise.all((await queue.open()).map((report) => reportItem(deps, queue, report)));
  const appeals = await Promise.all((await deps.stores.appeals.pending()).map((appeal) => appealItem(deps, queue, appeal)));
  const items = [...reports, ...appeals].sort((x, y) => weightOf(x) - weightOf(y) || x.at - y.at);
  const target = deps.config.moderation.decideHours * time.HOUR_MS;
  return {
    items,
    oldest: items.reduce((oldest, item) => Math.max(oldest, item.age), 0),
    target,
    overdue: items.filter((item) => item.age > target).length,
  };
}
