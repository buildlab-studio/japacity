import type { BlockRow, HoldRow, ModerationStore, ReportRow } from "../pair.types";
import { refuse } from "../result";
import { accept, copy } from "./copy.memory";

/** pair:block-ends-every-bond, pair:report-holds-conversation, moderation:block-refuses-both-ways, moderation:block-ends-pair-records, moderation:report-from-every-surface, moderation:report-carries-subject-and-reason, moderation:spoken-phrases-not-stored, moderation:report-offers-block, moderation:reporter-told-outcome-only, moderation:reports-hold-cited-records and moderation:open-report-pauses-conversation: blocks, reports and their holds in arrays. */
export function memoryModerationStore(): ModerationStore {
  let blocks: BlockRow[] = [];
  let reports: ReportRow[] = [];
  let holds: HoldRow[] = [];
  const oldestFirst = (x: ReportRow, y: ReportRow) => x.at - y.at;
  const holding = (hold: HoldRow, now: number) => !hold.lifted && hold.until > now;

  return {
    block: (row) => {
      const held = blocks.find((each) => each.from === row.from && each.to === row.to);
      if (held !== undefined) return Promise.resolve(copy(held));
      blocks.push(copy(row));
      return Promise.resolve(copy(row));
    },
    unblock: (from, to) => {
      const before = blocks.length;
      blocks = blocks.filter((each) => each.from !== from || each.to !== to);
      return Promise.resolve(blocks.length < before);
    },
    blocked: (x, y) => Promise.resolve(blocks.some((each) => (each.from === x && each.to === y) || (each.from === y && each.to === x))),
    blocksBy: (account) => Promise.resolve(copy(blocks.filter((each) => each.from === account).sort((p, q) => p.at - q.at))),
    blockedWith: (account) => {
      const others = blocks.flatMap((each) => (each.from === account ? [each.to] : each.to === account ? [each.from] : []));
      return Promise.resolve([...new Set(others)]);
    },
    report: (report, hold) => {
      if (reports.some((each) => each.id === report.id)) return Promise.resolve(refuse("exists", `The report ${report.id} exists already.`));
      const row: ReportRow = { ...copy(report), status: "open", outcome: null, decidedAt: null };
      reports.push(row);
      holds.push({ ...copy(hold), report: report.id, lifted: false });
      return Promise.resolve(accept(row));
    },
    get: (id) => Promise.resolve(copy(reports.find((each) => each.id === id) ?? null)),
    list: (status) => Promise.resolve(copy(reports.filter((each) => each.status === status).sort(oldestFirst))),
    filedSince: (reporter, since) => Promise.resolve(reports.filter((each) => each.reporter === reporter && each.at >= since).length),
    openOn: (pair) => Promise.resolve(copy(reports.filter((each) => each.status === "open" && each.pair === pair).sort(oldestFirst))),
    close: (id, outcome, at) => {
      const row = reports.find((each) => each.id === id);
      if (row === undefined) return Promise.resolve(refuse("missing", `No report ${id}.`));
      if (row.status === "decided") return Promise.resolve(refuse("closed", `The report ${id} is decided already.`));
      Object.assign(row, { status: "decided", outcome, decidedAt: at });
      for (const hold of holds) if (hold.report === id) hold.lifted = true;
      return Promise.resolve(accept(row));
    },
    lift: (report) => {
      const hold = holds.find((each) => each.report === report);
      if (hold === undefined) return Promise.resolve(refuse("missing", `The report ${report} holds nothing.`));
      hold.lifted = true;
      return Promise.resolve(accept(hold));
    },
    holds: (now) => Promise.resolve(copy(holds.filter((hold) => holding(hold, now)))),
    remove: (account, now) => {
      blocks = blocks.filter((each) => each.from !== account && each.to !== account);
      const kept = new Set(holds.filter((hold) => holding(hold, now)).map((hold) => hold.report));
      const gone = new Set(reports.filter((each) => each.reporter === account && !kept.has(each.id)).map((each) => each.id));
      reports = reports.filter((each) => !gone.has(each.id));
      holds = holds.filter((hold) => !gone.has(hold.report));
      return Promise.resolve();
    },
  };
}
