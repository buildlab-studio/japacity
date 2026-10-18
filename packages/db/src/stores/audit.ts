import type { AuditRow, AuditStore } from "@japacity/store";
import { asc, eq } from "drizzle-orm";

import type { Handle } from "../handle";
import { audit } from "../schema";

function toAudit(row: typeof audit.$inferSelect): AuditRow {
  return { character: row.character, why: row.why, at: row.at, note: row.note, segments: row.segments, log: row.log, snapshots: row.snapshots, n: row.n };
}

/** server:rollback-apply-one-account: insert only; `n` comes from an identity column and rises with every entry. */
export function pgAuditStore(handle: Handle): AuditStore {
  return {
    retire: (entry) =>
      handle.read(async (db) => {
        const { character, why, at, note, segments, log, snapshots } = entry;
        const [row] = await db.insert(audit).values({ character, why, at, note, segments, log, snapshots }).returning();
        if (row === undefined) throw new Error(`The audit entry for ${character} was not stored.`);
        return toAudit(row);
      }),

    list: (character) =>
      handle.read(async (db) => {
        const rows = await db.select().from(audit).where(eq(audit.character, character)).orderBy(asc(audit.n));
        return rows.map(toAudit);
      }),
  };
}
