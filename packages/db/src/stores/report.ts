import type { BlockRow, HoldRow, ModerationStore, ReportRow } from "@japacity/store";
import { newestBlockFirst, refuse } from "@japacity/store";
import { and, asc, eq, gt, gte, inArray, or } from "drizzle-orm";

import type { Handle } from "../handle";
import { blocks, holds, reports } from "../schema";
import { accept } from "./result";

function toReport(row: typeof reports.$inferSelect): ReportRow {
  const { id, reporter, subject, reason, cites, pair, unverified, at, status, outcome, decidedAt } = row;
  return { id, reporter, subject, reason, cites, pair, unverified, at, status, outcome, decidedAt };
}

function toHold(row: typeof holds.$inferSelect): HoldRow {
  return { report: row.report, messages: row.messages, pair: row.pair, until: row.until, lifted: row.lifted };
}

function toBlock(row: typeof blocks.$inferSelect): BlockRow {
  return { from: row.from, to: row.to, at: row.at };
}

/** pair:block-ends-every-bond, pair:report-holds-conversation, moderation:block-refuses-both-ways, moderation:block-ends-pair-records, moderation:report-from-every-surface, moderation:report-carries-subject-and-reason, moderation:spoken-phrases-not-stored, moderation:report-offers-block, moderation:reporter-told-outcome-only, moderation:reports-hold-cited-records and moderation:open-report-pauses-conversation: blocks, and each report written with its hold. */
export function pgModerationStore(handle: Handle): ModerationStore {
  return {
    block: (row) =>
      handle.transaction(async (tx) => {
        await tx.insert(blocks).values(row).onConflictDoNothing();
        const [held] = await tx.select().from(blocks).where(and(eq(blocks.from, row.from), eq(blocks.to, row.to)));
        if (held === undefined) throw new Error(`The block of ${row.to} by ${row.from} was not stored.`);
        return toBlock(held);
      }),

    unblock: (from, to) =>
      handle.read(async (db) => (await db.delete(blocks).where(and(eq(blocks.from, from), eq(blocks.to, to))).returning()).length > 0),

    blocked: (x, y) =>
      handle.read(async (db) => {
        const found = await db
          .select({ from: blocks.from })
          .from(blocks)
          .where(or(and(eq(blocks.from, x), eq(blocks.to, y)), and(eq(blocks.from, y), eq(blocks.to, x))))
          .limit(1);
        return found.length > 0;
      }),

    blocksBy: (account) =>
      handle.read(async (db) => (await db.select().from(blocks).where(eq(blocks.from, account))).map(toBlock).sort(newestBlockFirst)),

    blockedWith: (account) =>
      handle.read(async (db) => {
        const rows = await db
          .select()
          .from(blocks)
          .where(or(eq(blocks.from, account), eq(blocks.to, account)));
        return [...new Set(rows.map((row) => (row.from === account ? row.to : row.from)))];
      }),

    report: (report, hold) =>
      handle.transaction(async (tx) => {
        const [row] = await tx
          .insert(reports)
          .values({ ...report, status: "open", outcome: null, decidedAt: null })
          .onConflictDoNothing()
          .returning();
        if (row === undefined) return refuse("exists", `The report ${report.id} exists already.`);
        await tx.insert(holds).values({ ...hold, report: report.id, lifted: false });
        return accept(toReport(row));
      }),

    get: (id) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(reports).where(eq(reports.id, id));
        return row === undefined ? null : toReport(row);
      }),

    list: (status) => handle.read(async (db) => (await db.select().from(reports).where(eq(reports.status, status)).orderBy(asc(reports.at))).map(toReport)),

    filedSince: (reporter, since) =>
      handle.read(async (db) => (await db.select({ id: reports.id }).from(reports).where(and(eq(reports.reporter, reporter), gte(reports.at, since)))).length),

    openOn: (pair) =>
      handle.read(async (db) => (await db.select().from(reports).where(and(eq(reports.pair, pair), eq(reports.status, "open"))).orderBy(asc(reports.at))).map(toReport)),

    close: (id, outcome, at) =>
      handle.transaction(async (tx) => {
        const [row] = await tx
          .update(reports)
          .set({ status: "decided", outcome, decidedAt: at })
          .where(and(eq(reports.id, id), eq(reports.status, "open")))
          .returning();
        if (row === undefined) {
          const [known] = await tx.select({ id: reports.id }).from(reports).where(eq(reports.id, id));
          return known === undefined ? refuse("missing", `No report ${id}.`) : refuse("closed", `The report ${id} is decided already.`);
        }
        await tx.update(holds).set({ lifted: true }).where(eq(holds.report, id));
        return accept(toReport(row));
      }),

    lift: (report) =>
      handle.read(async (db) => {
        const [row] = await db.update(holds).set({ lifted: true }).where(eq(holds.report, report)).returning();
        return row === undefined ? refuse("missing", `The report ${report} holds nothing.`) : accept(toHold(row));
      }),

    holds: (now) => handle.read(async (db) => (await db.select().from(holds).where(and(eq(holds.lifted, false), gt(holds.until, now)))).map(toHold)),

    remove: (account, now) =>
      handle.transaction(async (tx) => {
        await tx.delete(blocks).where(or(eq(blocks.from, account), eq(blocks.to, account)));
        const running = await tx.select({ report: holds.report }).from(holds).where(and(eq(holds.lifted, false), gt(holds.until, now)));
        const kept = new Set(running.map((row) => row.report));
        const filed = await tx.select({ id: reports.id }).from(reports).where(eq(reports.reporter, account));
        const gone = filed.map((row) => row.id).filter((id) => !kept.has(id));
        if (gone.length > 0) await tx.delete(reports).where(inArray(reports.id, gone));
      }),
  };
}
