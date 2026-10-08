import type { AppealRow, AppealStore, BannedIdentityStore, FeedbackRow, FeedbackStore, ModerationLogEntry, ModerationLogStore } from "../moderation.types";
import { accept, copy, refuse } from "./copy.memory";

/** R-MODERATION-015: an array that only grows. */
export function memoryModerationLogStore(): ModerationLogStore {
  const rows: ModerationLogEntry[] = [];

  return {
    append: (entry) => {
      if (rows.some((row) => row.id === entry.id)) return Promise.resolve(refuse("exists", `Log entry ${entry.id} exists.`));
      rows.push(copy(entry));
      return Promise.resolve(accept(entry));
    },
    get: (id) => Promise.resolve(copy(rows.find((row) => row.id === id) ?? null)),
    list: ({ item, account }) =>
      Promise.resolve(copy(rows.filter((row) => (item === undefined || row.item === item) && (account === undefined || row.params.account === account)))),
  };
}

/** R-MODERATION-018. */
export function memoryBannedIdentityStore(): BannedIdentityStore {
  const held = new Map<string, number>();

  return {
    add: (hashes, at) => {
      for (const hash of hashes) if (!held.has(hash)) held.set(hash, at);
      return Promise.resolve();
    },
    has: (hash) => Promise.resolve(held.has(hash)),
  };
}

/** R-MODERATION-016. */
export function memoryAppealStore(): AppealStore {
  const rows: AppealRow[] = [];

  return {
    file: (appeal) => {
      if (rows.some((row) => row.id === appeal.id || row.entry === appeal.entry)) return Promise.resolve(refuse("exists", `Entry ${appeal.entry} already has an appeal.`));
      const row: AppealRow = { ...copy(appeal), status: "open" };
      rows.push(row);
      return Promise.resolve(accept(row));
    },
    get: (id) => Promise.resolve(copy(rows.find((row) => row.id === id) ?? null)),
    pending: () => Promise.resolve(copy(rows.filter((row) => row.status === "open"))),
    forAccount: (account) => Promise.resolve(copy(rows.filter((row) => row.account === account))),
    decide: (id, { outcome, by, at }) => {
      const row = rows.find((each) => each.id === id);
      if (row === undefined) return Promise.resolve(refuse("missing", `No appeal ${id}.`));
      if (row.status === "decided") return Promise.resolve(refuse("closed", `Appeal ${id} is decided.`));
      Object.assign(row, { status: "decided", outcome, decidedBy: by, decidedAt: at });
      return Promise.resolve(accept(row));
    },
  };
}

/** R-MODERATION-020: the rows in the order they came, and the send counts by sender and day. */
export function memoryFeedbackStore(): FeedbackStore {
  const rows: FeedbackRow[] = [];
  const sends = new Map<string, { day: string; count: number }>();
  const keyOf = (sender: string, day: string) => `${day}~${sender}`;

  return {
    take: (sender, day, perDay) => {
      const key = keyOf(sender, day);
      const count = sends.get(key)?.count ?? 0;
      if (count >= perDay) return Promise.resolve(false);
      sends.set(key, { day, count: count + 1 });
      return Promise.resolve(true);
    },
    add: (row) => {
      if (rows.some((each) => each.id === row.id)) return Promise.resolve(refuse("exists", `Feedback ${row.id} exists.`));
      rows.push(copy(row));
      return Promise.resolve(accept(row));
    },
    list: (limit) => Promise.resolve(copy(rows.slice().reverse().slice(0, limit))),
    drop: (day) => {
      const before = rows.length;
      const kept = rows.filter((row) => row.day >= day);
      rows.splice(0, rows.length, ...kept);
      return Promise.resolve(before - kept.length);
    },
    forget: (day) => {
      for (const [key, value] of sends) if (value.day < day) sends.delete(key);
      return Promise.resolve();
    },
  };
}
