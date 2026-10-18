// The admin view's ports as the app builds them: the pair side's moderation
// store read as the queue, and, when the server runs with the auth library,
// its identities.
import type { ReportRow } from "@japacity/store";

import type { Accounts } from "../auth/auth";
import type { ServerDeps } from "../deps";
import { closeReport } from "../pair/moderation";
import type { ModerationPorts } from "./decide";
import { authIdentities } from "./identities";
import type { Report, ReportQueueStore } from "./reports";

function asReport(row: ReportRow): Report {
  const { id, reporter, subject, reason, cites, unverified, at, status, outcome } = row;
  const report: Report = { id, reporter, subject, reason, cites, unverified, at, status };
  return outcome === null ? report : { ...report, outcome };
}

const byAge = (left: Report, right: Report) => left.at - right.at;

/** moderation:reports-hold-cited-records, moderation:open-report-pauses-conversation and moderation:one-queue-by-reason-weight: the queue over `stores.moderation`, so a report filed on a pair is the one the admin decides. */
function storeQueue(deps: ServerDeps): ReportQueueStore {
  const moderation = deps.stores.moderation;
  return {
    open: async () => (await moderation.list("open")).map(asReport),
    get: async (id) => {
      const row = await moderation.get(id);
      return row === null ? null : asReport(row);
    },
    about: async (account) => {
      const every = [...(await moderation.list("open")), ...(await moderation.list("decided"))].map(asReport);
      return every.filter((report) => report.reporter === account || ("account" in report.subject && report.subject.account === account)).sort(byAge);
    },
    hold: async (report) => {
      const held = (await moderation.holds(deps.now())).find((each) => each.report === report);
      if (held === undefined) return null;
      return held.pair === null ? { report, messages: held.messages, until: held.until } : { report, messages: held.messages, pair: held.pair, until: held.until };
    },
    messages: async (ids) => (await deps.stores.conversation.byIds(ids)).slice().sort((left, right) => left.sentAt - right.sentAt),
    close: async (id, outcome) => {
      const row = await moderation.get(id);
      if (row === null) return { ok: false, code: "missing", detail: `No report ${id}.` };
      if (row.status === "decided") return { ok: false, code: "closed", detail: `Report ${id} is decided.` };
      // The pair side's close also lifts the hold and releases the record once no report holds it.
      const closed = await closeReport(deps, id, outcome);
      return closed === null ? { ok: false, code: "closed", detail: `Report ${id} is decided.` } : { ok: true, value: asReport(closed) };
    },
    lift: async (report) => {
      await moderation.lift(report);
    },
  };
}

export function moderationPorts(deps: ServerDeps, accounts: Accounts | undefined): ModerationPorts {
  return { reports: storeQueue(deps), identities: accounts === undefined ? null : authIdentities(accounts.auth) };
}
