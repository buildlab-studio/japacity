import { compareIds } from "@japacity/store";
import type { PushStore } from "@japacity/store";
import { and, eq } from "drizzle-orm";

import type { Handle } from "../handle";
import { pushSubscriptions } from "../schema";

/** R-CLOCK-031, R-ACCOUNT-017: one row per endpoint; a second subscribe of an endpoint replaces its row. */
export function pgPushStore(handle: Handle): PushStore {
  return {
    subscribe: (account, subscription) =>
      handle.read(async (db) => {
        const row = { endpoint: subscription.endpoint, account, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth };
        await db
          .insert(pushSubscriptions)
          .values(row)
          .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { account, p256dh: row.p256dh, auth: row.auth } });
      }),

    unsubscribe: (account, endpoint) =>
      handle.read(async (db) => {
        await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.account, account), eq(pushSubscriptions.endpoint, endpoint)));
      }),

    forAccount: (account) =>
      handle.read(async (db) => {
        const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.account, account));
        return rows
          .map((row) => ({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }))
          .sort((left, right) => compareIds(left.endpoint, right.endpoint));
      }),

    forget: (account) =>
      handle.read(async (db) => {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.account, account));
      }),
  };
}
