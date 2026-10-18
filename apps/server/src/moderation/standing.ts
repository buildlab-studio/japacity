// R-MODERATION-007, R-MODERATION-014, R-MODERATION-016: what a player is told
// about actions on their own account and their own reports, and the mute or
// suspension in force, read from the log so the rest of the server can refuse.
import { type ActionOnMe, TOLD_ACTIONS, type Standing, type ToldAction } from "@japacity/api";
import { time } from "@japacity/sim";
import type { ModerationLogEntry } from "@japacity/store";

import type { ServerDeps } from "../deps";
import type { ReportQueueStore } from "./reports";

function told(entry: ModerationLogEntry): entry is ModerationLogEntry & { action: ToldAction } {
  return (TOLD_ACTIONS as readonly string[]).includes(entry.action);
}

function untilOf(entry: ModerationLogEntry): number | null {
  const days = entry.params.days;
  return (entry.action === "mute" || entry.action === "suspend") && typeof days === "number" ? entry.at + days * time.DAY_MS : null;
}

export async function standingOf(deps: ServerDeps, queue: ReportQueueStore, account: string): Promise<Standing> {
  const appeals = await deps.stores.appeals.forAccount(account);
  const entries = (await deps.stores.moderationLog.list({ account })).filter(told);
  const actions = entries.map((entry): ActionOnMe => {
    const appeal = appeals.find((each) => each.entry === entry.id);
    return {
      entry: entry.id,
      action: entry.action,
      reason: entry.reason,
      at: entry.at,
      until: untilOf(entry),
      appeal: appeal === undefined ? null : appeal.outcome === undefined ? { status: appeal.status } : { status: appeal.status, outcome: appeal.outcome },
    };
  });
  const standing = actions.filter((action) => action.appeal?.outcome !== "overturned");
  const latest = (kind: ToldAction) =>
    standing
      .filter((action) => action.action === kind && action.until !== null && action.until > deps.now())
      .reduce<number | null>((longest, action) => Math.max(longest ?? 0, action.until ?? 0), null);
  const reports = (await queue.about(account))
    .filter((report) => report.reporter === account)
    .map(({ id, at, status, outcome }) => (outcome === undefined ? { id, at, status } : { id, at, status, outcome }));
  return { actions, mutedUntil: latest("mute"), suspendedUntil: latest("suspend"), banned: standing.some((action) => action.action === "ban"), reports };
}
