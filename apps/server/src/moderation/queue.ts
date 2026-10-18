// moderation:one-queue-by-reason-weight, moderation:reports-decided-within-target, moderation:queue-item-shows-context: the one queue and
// what the admin view shows for each item in it.
import type { AccountSummary, HeldMessage, QueueItem, QueueView, ReportReason } from "@japacity/api";
import { text } from "@japacity/content";
import { time } from "@japacity/sim";
import type { AppealRow } from "@japacity/store";

import type { ServerDeps } from "../deps";
import type { Report, ReportQueueStore } from "./reports";

/** moderation:one-queue-by-reason-weight: lower goes first. Appeals carry no reason and sit with the rest. */
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

/** moderation:queue-item-shows-context: the cited messages as their phrases with their times. */
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

/** moderation:one-queue-by-reason-weight: open reports and appeals by reason weight, then oldest first. */
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
