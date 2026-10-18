import type { AppealRow, AppealStore, BannedIdentityStore, FeedbackRow, FeedbackStore, ModerationLogEntry, ModerationLogStore } from "@japacity/store";
import { refuse } from "@japacity/store";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";

import type { Handle } from "../handle";
import { appeals, bannedIdentities, feedback, feedbackSends, moderationLog } from "../schema";
import { accept } from "./result";

function toEntry(row: typeof moderationLog.$inferSelect): ModerationLogEntry {
  const entry: ModerationLogEntry = { id: row.id, admin: row.admin, at: row.at, item: row.item, action: row.action, params: row.params, reason: row.reason };
  return row.note === null ? entry : { ...entry, note: row.note };
}

/** moderation:admin-actions-logged-append-only: insert only. The migration's trigger refuses an update or a delete of any row. */
export function pgModerationLogStore(handle: Handle): ModerationLogStore {
  return {
    append: (entry) =>
      handle.read(async (db) => {
        const { id, admin, at, item, action, params, reason, note } = entry;
        const [row] = await db
          .insert(moderationLog)
          .values({ id, admin, at, item, action, params, reason, note: note ?? null })
          .onConflictDoNothing()
          .returning();
        return row === undefined ? refuse("exists", `Log entry ${id} exists.`) : accept(toEntry(row));
      }),

    get: (id) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(moderationLog).where(eq(moderationLog.id, id));
        return row === undefined ? null : toEntry(row);
      }),

    list: ({ item, account }) =>
      handle.read(async (db) => {
        const rows = await db
          .select()
          .from(moderationLog)
          .where(
            and(
              item === undefined ? undefined : eq(moderationLog.item, item),
              account === undefined ? undefined : sql`${moderationLog.params} ->> 'account' = ${account}`,
            ),
          )
          .orderBy(asc(moderationLog.n));
        return rows.map(toEntry);
      }),
  };
}

/** moderation:ban-survives-as-hash. */
export function pgBannedIdentityStore(handle: Handle): BannedIdentityStore {
  return {
    add: (hashes, at) =>
      handle.read(async (db) => {
        if (hashes.length === 0) return;
        await db
          .insert(bannedIdentities)
          .values(hashes.map((hash) => ({ hash, at })))
          .onConflictDoNothing();
      }),

    has: (hash) =>
      handle.read(async (db) => {
        const [row] = await db.select({ hash: bannedIdentities.hash }).from(bannedIdentities).where(eq(bannedIdentities.hash, hash));
        return row !== undefined;
      }),
  };
}

function toAppeal(row: typeof appeals.$inferSelect): AppealRow {
  const appeal: AppealRow = { id: row.id, account: row.account, entry: row.entry, at: row.at, status: row.status };
  if (row.outcome !== null) appeal.outcome = row.outcome;
  if (row.decidedBy !== null) appeal.decidedBy = row.decidedBy;
  if (row.decidedAt !== null) appeal.decidedAt = row.decidedAt;
  return appeal;
}

/** moderation:actioned-player-told-and-appeals: one appeal per log entry. */
export function pgAppealStore(handle: Handle): AppealStore {
  return {
    file: ({ id, account, entry, at }) =>
      handle.read(async (db) => {
        const [row] = await db.insert(appeals).values({ id, account, entry, at, status: "open" }).onConflictDoNothing().returning();
        return row === undefined ? refuse("exists", `Entry ${entry} already has an appeal.`) : accept(toAppeal(row));
      }),

    get: (id) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(appeals).where(eq(appeals.id, id));
        return row === undefined ? null : toAppeal(row);
      }),

    pending: () =>
      handle.read(async (db) => {
        const rows = await db.select().from(appeals).where(eq(appeals.status, "open")).orderBy(asc(appeals.n));
        return rows.map(toAppeal);
      }),

    forAccount: (account) =>
      handle.read(async (db) => {
        const rows = await db.select().from(appeals).where(eq(appeals.account, account)).orderBy(asc(appeals.n));
        return rows.map(toAppeal);
      }),

    decide: (id, { outcome, by, at }) =>
      handle.transaction(async (tx) => {
        const [row] = await tx.select().from(appeals).where(eq(appeals.id, id)).for("update");
        if (row === undefined) return refuse("missing", `No appeal ${id}.`);
        if (row.status === "decided") return refuse("closed", `Appeal ${id} is decided.`);
        const [decided] = await tx.update(appeals).set({ status: "decided", outcome, decidedBy: by, decidedAt: at }).where(eq(appeals.id, id)).returning();
        if (decided === undefined) throw new Error(`Appeal ${id} vanished under its lock.`);
        return accept(toAppeal(decided));
      }),
  };
}

function toFeedback(row: typeof feedback.$inferSelect): FeedbackRow {
  return { id: row.id, text: row.text, build: row.build, screen: row.screen, mode: row.mode, day: row.day, region: row.region };
}

/** moderation:feedback-box-in-settings. */
export function pgFeedbackStore(handle: Handle): FeedbackStore {
  return {
    take: (sender, day, perDay) =>
      handle.read(async (db) => {
        if (perDay <= 0) return false;
        // One statement, so two sends at once cannot both take the last one.
        const taken = await db
          .insert(feedbackSends)
          .values({ sender, day, count: 1 })
          .onConflictDoUpdate({
            target: [feedbackSends.sender, feedbackSends.day],
            set: { count: sql`${feedbackSends.count} + 1` },
            setWhere: lt(feedbackSends.count, perDay),
          })
          .returning({ count: feedbackSends.count });
        return taken.length > 0;
      }),

    add: (row) =>
      handle.read(async (db) => {
        const { id, text, build, screen, mode, day, region } = row;
        const [stored] = await db.insert(feedback).values({ id, text, build, screen, mode, day, region }).onConflictDoNothing().returning();
        return stored === undefined ? refuse("exists", `Feedback ${id} exists.`) : accept(toFeedback(stored));
      }),

    list: (limit) =>
      handle.read(async (db) => {
        const rows = await db.select().from(feedback).orderBy(desc(feedback.n)).limit(limit);
        return rows.map(toFeedback);
      }),

    drop: (day) =>
      handle.read(async (db) => {
        const gone = await db.delete(feedback).where(lt(feedback.day, day)).returning({ n: feedback.n });
        return gone.length;
      }),

    forget: (day) =>
      handle.read(async (db) => {
        await db.delete(feedbackSends).where(lt(feedbackSends.day, day));
      }),
  };
}
