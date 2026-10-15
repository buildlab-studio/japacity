import type { DedicationLight, DedicationStore } from "@japacity/store";
import { asc, desc, eq, isNull, sql } from "drizzle-orm";

import type { Handle } from "../handle";
import { dedicationLights } from "../schema";
import { accept, refuse } from "./result";

function toLight(row: typeof dedicationLights.$inferSelect): DedicationLight {
  return { account: row.accountId, id: row.id, name: row.name, from: row.fromYear, to: row.toYear, litAt: row.litAt, approvedAt: row.approvedAt, approvedBy: row.approvedBy };
}

/** Ids compared byte by byte, as the memory store compares them. */
const byId = sql`${dedicationLights.id} collate "C"`;

/** R-SERVER-045: one row per account, gone with the account by its foreign key. */
export function pgDedicationStore(handle: Handle): DedicationStore {
  return {
    light: (light) =>
      handle.read(async (db) => {
        const values = { accountId: light.account, id: light.id, name: light.name, fromYear: light.from, toYear: light.to, litAt: light.litAt, approvedAt: null, approvedBy: null };
        const [row] = await db
          .insert(dedicationLights)
          .values(values)
          .onConflictDoUpdate({ target: dedicationLights.accountId, set: { id: values.id, name: values.name, fromYear: values.fromYear, toYear: values.toYear, litAt: values.litAt, approvedAt: null, approvedBy: null } })
          .returning();
        if (row === undefined) throw new Error("The light was not written.");
        return toLight(row);
      }),
    putOut: (account) =>
      handle.read(async (db) => {
        const gone = await db.delete(dedicationLights).where(eq(dedicationLights.accountId, account)).returning({ id: dedicationLights.id });
        return gone.length > 0;
      }),
    mine: (account) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(dedicationLights).where(eq(dedicationLights.accountId, account));
        return row === undefined ? null : toLight(row);
      }),
    shared: (most) =>
      handle.read(async (db) => {
        const [counted] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(dedicationLights);
        const rows =
          most <= 0
            ? []
            : await db
                .select()
                .from(dedicationLights)
                .orderBy(sql`(${dedicationLights.approvedAt} is not null) desc`, desc(dedicationLights.litAt), byId)
                .limit(most);
        return { count: counted?.count ?? 0, lights: rows.map(toLight) };
      }),
    pending: () =>
      handle.read(async (db) => {
        const rows = await db.select().from(dedicationLights).where(isNull(dedicationLights.approvedAt)).orderBy(asc(dedicationLights.litAt), byId);
        return rows.map(toLight);
      }),
    approve: (account, by, at) =>
      handle.read(async (db) => {
        const [row] = await db.update(dedicationLights).set({ approvedAt: at, approvedBy: by }).where(eq(dedicationLights.accountId, account)).returning();
        return row === undefined ? refuse("missing", `No light for ${account}.`) : accept(toLight(row));
      }),
  };
}
