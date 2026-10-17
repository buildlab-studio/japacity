import type { ConversationRow, ConversationStore } from "../pair.types";
import { accept, copy, refuse } from "./copy.memory";

/** R-PAIR-011: the order rows are read in. */
function byTime(x: ConversationRow, y: ConversationRow): number {
  if (x.sentAt !== y.sentAt) return x.sentAt - y.sentAt;
  if (x.id === y.id) return 0;
  return x.id < y.id ? -1 : 1;
}

/** The conversation id is the pair key, so it names both characters between its tildes. */
function names(conversation: string, character: string): boolean {
  return conversation.split("~").includes(character);
}

/** R-PAIR-011: every stored phrase, in one array. */
export function memoryConversationStore(): ConversationStore {
  let rows: ConversationRow[] = [];
  const of = (conversation: string) => rows.filter((row) => row.conversation === conversation).sort(byTime);

  return {
    add: (row) => {
      if (rows.some((held) => held.id === row.id)) return Promise.resolve(refuse("exists", `The message ${row.id} exists already.`));
      rows.push(copy(row));
      return Promise.resolve(accept(row));
    },
    list: (conversation, after) => {
      const ordered = of(conversation);
      const mark = after === null ? undefined : ordered.find((row) => row.id === after);
      return Promise.resolve(copy(mark === undefined ? ordered : ordered.filter((row) => byTime(row, mark) > 0)));
    },
    markRead: (conversation, reader, at) => {
      const unread = rows.filter((row) => row.conversation === conversation && row.sender !== reader && row.readAt === null);
      for (const row of unread) row.readAt = at;
      return Promise.resolve(unread.length);
    },
    sentSince: (conversation, sender, since) =>
      Promise.resolve(of(conversation).filter((row) => row.sender === sender && row.sentAt >= since).map((row) => row.sentAt)),
    byIds: (ids) => Promise.resolve(copy(rows.filter((row) => ids.includes(row.id)).sort(byTime))),
    removeFor: (character, keep) => {
      const before = rows.length;
      rows = rows.filter((row) => !names(row.conversation, character) || keep.includes(row.id));
      return Promise.resolve(before - rows.length);
    },
  };
}
