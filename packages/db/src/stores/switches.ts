import type { DialChange, SettingChange, SwitchRow, SwitchStore } from "@japacity/store";
import { DEFAULT_SWITCH_ROW, isDialValue } from "@japacity/store";
import { asc, eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";

import type { Handle, Queries } from "../handle";
import { switchLog, switches } from "../schema";
import { accept, refuse } from "./result";

const ONE = 1;

type Values = Partial<Omit<typeof switches.$inferInsert, "id">>;
type Update = PgUpdateSetSource<typeof switches>;

function toRow(row: typeof switches.$inferSelect | undefined): SwitchRow {
  if (row === undefined) return structuredClone(DEFAULT_SWITCH_ROW);
  return {
    switches: {
      signups: row.signups,
      lottery: row.lottery,
      adverts: row.adverts,
      partnerPlay: row.partnerPlay,
      "boards.this-week.everyone": row["boards.this-week.everyone"],
      "boards.this-week.friends": row["boards.this-week.friends"],
      "boards.all-time.everyone": row["boards.all-time.everyone"],
      "boards.all-time.friends": row["boards.all-time.friends"],
      "boards.joined-week": row["boards.joined-week"],
    },
    dials: { placeTargets: row.placeTargets, computerAfterMonths: row.computerAfterMonths, topUpTickets: row.topUpTickets },
  };
}

/** The columns a dial change writes; a place target merges into the map, or leaves it with null. */
function dialValues(change: DialChange): { insert: Values; update: Update } {
  switch (change.dial) {
    case "placeTarget": {
      const insert: Values = { placeTargets: change.value === null ? {} : { [change.place]: change.value } };
      const merged =
        change.value === null
          ? sql`${switches.placeTargets} - ${change.place}::text`
          : sql`${switches.placeTargets} || jsonb_build_object(${change.place}::text, ${change.value}::integer)`;
      return { insert, update: { placeTargets: merged } };
    }
    case "computerAfterMonths":
      return { insert: { computerAfterMonths: change.value }, update: { computerAfterMonths: change.value } };
    case "topUpTickets":
      return { insert: { topUpTickets: change.value }, update: { topUpTickets: change.value } };
    default: {
      const never: never = change;
      throw new Error(`Unknown dial ${JSON.stringify(never)}.`);
    }
  }
}

/** Writes the row and its log line in one transaction, so a change is never kept without its log line. */
async function write(tx: Queries, insert: Values, update: Update, logged: { at: number; admin: string; reason: string; change: SettingChange }): Promise<SwitchRow> {
  const [row] = await tx
    .insert(switches)
    .values({ id: ONE, ...insert })
    .onConflictDoUpdate({ target: switches.id, set: update })
    .returning();
  await tx.insert(switchLog).values(logged);
  return toRow(row);
}

/** R-SERVER-030, R-SERVER-031: one row with `id` 1, made by the first write; the log is insert only. */
export function pgSwitchStore(handle: Handle): SwitchStore {
  return {
    read: () =>
      handle.read(async (db) => {
        const [row] = await db.select().from(switches).where(eq(switches.id, ONE));
        return toRow(row);
      }),

    set: (name, on, admin, reason, at) =>
      handle.transaction((tx) => write(tx, { [name]: on }, { [name]: on }, { at, admin, reason, change: { switch: name, on } })),

    setDial: async (change, admin, reason, at) => {
      if (!isDialValue(change.value)) return refuse("bad-write", `A dial is a whole number from 0 or null, not ${String(change.value)}.`);
      const { insert, update } = dialValues(change);
      return accept(await handle.transaction((tx) => write(tx, insert, update, { at, admin, reason, change })));
    },

    log: () =>
      handle.read(async (db) => {
        const rows = await db.select().from(switchLog).orderBy(asc(switchLog.n));
        return rows.map(({ n, at, admin: who, reason, change }) => ({ n, at, admin: who, reason, change }));
      }),
  };
}
