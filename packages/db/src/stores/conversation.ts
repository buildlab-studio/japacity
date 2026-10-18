import type { ConversationRow, ConversationStore } from "@japacity/store";
import { byTime, refuse } from "@japacity/store";
import { and, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";

import type { Handle } from "../handle";
import { conversationRows } from "../schema";
import { accept } from "./result";

function toRow(row: typeof conversationRows.$inferSelect): ConversationRow {
  return { id: row.id, conversation: row.conversation, sender: row.sender, phrase: row.phrase as ConversationRow["phrase"], fill: row.fill, sentAt: row.sentAt, readAt: row.readAt };
}

/** pair:conversation-phrases-stored: the stored phrases; order is worked out in JavaScript so no collation decides it. */
export function pgConversationStore(handle: Handle): ConversationStore {
  return {
    add: (row) =>
      handle.read(async (db) => {
        const [stored] = await db.insert(conversationRows).values(row).onConflictDoNothing().returning();
        return stored === undefined ? refuse("exists", `The message ${row.id} exists already.`) : accept(toRow(stored));
      }),

    list: (conversation, after) =>
      handle.read(async (db) => {
        const rows = (await db.select().from(conversationRows).where(eq(conversationRows.conversation, conversation))).map(toRow).sort(byTime);
        const mark = after === null ? undefined : rows.find((row) => row.id === after);
        return mark === undefined ? rows : rows.filter((row) => byTime(row, mark) > 0);
      }),

    markRead: (conversation, reader, at) =>
      handle.read(async (db) => {
        const marked = await db
          .update(conversationRows)
          .set({ readAt: at })
          .where(and(eq(conversationRows.conversation, conversation), ne(conversationRows.sender, reader), isNull(conversationRows.readAt)))
          .returning({ id: conversationRows.id });
        return marked.length;
      }),

    sentSince: (conversation, sender, since) =>
      handle.read(async (db) => {
        const rows = await db
          .select({ sentAt: conversationRows.sentAt })
          .from(conversationRows)
          .where(and(eq(conversationRows.conversation, conversation), eq(conversationRows.sender, sender), gte(conversationRows.sentAt, since)));
        return rows.map((row) => row.sentAt).sort((x, y) => x - y);
      }),

    byIds: (ids) =>
      handle.read(async (db) => {
        if (ids.length === 0) return [];
        return (await db.select().from(conversationRows).where(inArray(conversationRows.id, [...ids]))).map(toRow).sort(byTime);
      }),

    removeFor: (character, keep) =>
      handle.read(async (db) => {
        // The conversation id is the pair key: the two character ids joined by a tilde.
        const names = or(sql`split_part(${conversationRows.conversation}, '~', 1) = ${character}`, sql`split_part(${conversationRows.conversation}, '~', 2) = ${character}`);
        const kept = keep.length === 0 ? undefined : sql`${conversationRows.id} not in (${sql.join(keep.map((id) => sql`${id}`), sql`, `)})`;
        const gone = await db.delete(conversationRows).where(and(names, kept)).returning({ id: conversationRows.id });
        return gone.length;
      }),
  };
}
