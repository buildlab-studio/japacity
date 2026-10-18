import { suiteForAppealStore, suiteForBannedIdentityStore, suiteForFeedbackStore, suiteForModerationLogStore } from "@japacity/store/contract";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { moderationLog } from "../schema";
import { freshHandle } from "../pglite.testing";
import { pgAppealStore, pgBannedIdentityStore, pgFeedbackStore, pgModerationLogStore } from "./moderation";

const fresh = freshHandle();

suiteForModerationLogStore(async () => pgModerationLogStore(await fresh()));
suiteForBannedIdentityStore(async () => pgBannedIdentityStore(await fresh()));
suiteForAppealStore(async () => pgAppealStore(await fresh()));
suiteForFeedbackStore(async () => pgFeedbackStore(await fresh()));

describe("the moderation log's table", () => {
  test("[moderation:admin-actions-logged-append-only] given a written entry, when an update or a delete is run on the table itself, then the database refuses both and the entry is unchanged", async () => {
    const handle = await fresh();
    const store = pgModerationLogStore(handle);
    const entry = { id: "log.1", admin: "account.admin", at: 1_000, item: "report.1", action: "warn" as const, params: { account: "account.b" }, reason: "scam" };
    await store.append(entry);

    await expect(handle.read((db) => db.update(moderationLog).set({ action: "dismiss" }).where(eq(moderationLog.id, "log.1")))).rejects.toThrow();
    await expect(handle.read((db) => db.delete(moderationLog).where(eq(moderationLog.id, "log.1")))).rejects.toThrow();
    expect(await store.get("log.1")).toEqual(entry);
  });
});
