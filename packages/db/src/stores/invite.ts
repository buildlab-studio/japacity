import type { InviteRow, InviteStore, RewardRow } from "@japacity/store";
import { distinctPairKeys, refuse } from "@japacity/store";
import { and, asc, eq, gt, isNotNull, or } from "drizzle-orm";

import type { Handle } from "../handle";
import { inviteRewards, invites } from "../schema";
import { accept } from "./result";

function toInvite(row: typeof invites.$inferSelect): InviteRow {
  const { code, from, account, slot, looking, fill, card, madeAt, expires, used, by, pair, usedAt, before } = row;
  return { code, from, account, slot, looking, fill, card, madeAt, expires, used, by, pair, usedAt, before };
}

function toReward(row: typeof inviteRewards.$inferSelect): RewardRow {
  return { from: row.from, friend: row.friend, reached: row.reached, frame: row.frame, line: row.line, at: row.at };
}

/** pair:invite-card-contents, pair:invite-link-single-use and pair:invite-rewards-never-cash: the links, their single use under the row's own update, and the rewards. */
export function pgInviteStore(handle: Handle): InviteStore {
  return {
    create: (invite) =>
      handle.read(async (db) => {
        const [row] = await db
          .insert(invites)
          .values({ ...invite, used: false, before: [] })
          .onConflictDoNothing()
          .returning();
        return row === undefined ? refuse("exists", `The link ${invite.code} exists already.`) : accept(toInvite(row));
      }),

    get: (code) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(invites).where(eq(invites.code, code));
        return row === undefined ? null : toInvite(row);
      }),

    open: (from, now) =>
      handle.read(async (db) => {
        const rows = await db
          .select()
          .from(invites)
          .where(and(eq(invites.from, from), eq(invites.used, false), gt(invites.expires, now)))
          .orderBy(asc(invites.madeAt));
        return rows.map(toInvite);
      }),

    use: (code, use) =>
      handle.transaction(async (tx) => {
        const [row] = await tx
          .update(invites)
          .set({ used: true, by: use.by, pair: use.pair, usedAt: use.at, before: [...use.before] })
          .where(and(eq(invites.code, code), eq(invites.used, false)))
          .returning();
        if (row !== undefined) return accept(toInvite(row));
        const [known] = await tx.select({ code: invites.code }).from(invites).where(eq(invites.code, code));
        return known === undefined ? refuse("missing", `No link ${code}.`) : refuse("closed", `The link ${code} is used.`);
      }),

    release: (code) =>
      handle.read(async (db) => {
        const [row] = await db
          .update(invites)
          .set({ used: false, by: null, pair: null, usedAt: null, before: [] })
          .where(and(eq(invites.code, code), eq(invites.used, true)))
          .returning();
        return row === undefined ? refuse("missing", `No used link ${code}.`) : accept(toInvite(row));
      }),

    pairsOf: (character) =>
      handle.read(async (db) =>
        distinctPairKeys(
          await db
            .select({ pair: invites.pair })
            .from(invites)
            .where(and(eq(invites.used, true), or(eq(invites.from, character), eq(invites.by, character)))),
        ),
      ),

    pairs: () => handle.read(async (db) => distinctPairKeys(await db.select({ pair: invites.pair }).from(invites).where(isNotNull(invites.pair)))),

    linkedBy: (friend) =>
      handle.read(async (db) => {
        const rows = await db
          .select()
          .from(invites)
          .where(and(eq(invites.used, true), eq(invites.by, friend)))
          .orderBy(asc(invites.usedAt));
        return rows.map(toInvite);
      }),

    rewards: (from) =>
      handle.read(async (db) => {
        const rows = await db.select().from(inviteRewards).where(eq(inviteRewards.from, from)).orderBy(asc(inviteRewards.n));
        return rows.map(toReward);
      }),

    reward: (reward) =>
      handle.read(async (db) => {
        const [row] = await db.insert(inviteRewards).values(reward).onConflictDoNothing().returning();
        return row === undefined ? refuse("exists", `${reward.from} has had ${reward.friend}'s ${reward.reached} already.`) : accept(toReward(row));
      }),

    remove: (character) =>
      handle.transaction(async (tx) => {
        await tx.delete(invites).where(or(eq(invites.from, character), eq(invites.by, character)));
        await tx.delete(inviteRewards).where(or(eq(inviteRewards.from, character), eq(inviteRewards.friend, character)));
      }),
  };
}
