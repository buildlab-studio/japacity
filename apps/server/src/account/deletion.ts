// R-ACCOUNT-016 to 018: what deleting an account does at once, and what the
// deletion job later removes and keeps.
import { time } from "@japacity/sim";
import type { DeletionRow } from "@japacity/store";

import type { ServerDeps } from "../deps";
import { sha256Hex } from "../auth/hooks";
import { leavePairs as leaveEveryPair } from "../pair/leave";
import { stopNotices } from "../notify/notice";

/** R-ACCOUNT-018: the one-way hash kept after the account is gone. */
export function accountHash(account: string): Promise<string> {
  return sha256Hex(account);
}

/**
 * R-ACCOUNT-016: the character leaves every place and pair, and the other
 * player is told only that they left (R-PEOPLE-040, pair/leave.ts).
 */
export type LeavePairs = (deps: ServerDeps, account: string, character: string | null) => Promise<void>;

export const leavePairs: LeavePairs = leaveEveryPair;

/**
 * R-ACCOUNT-016, R-ACCOUNT-017: records the deletion, due within
 * `deleteWithinDays`, or at `dueAt` when sooner (the guest clean-up of
 * R-ACCOUNT-026). Called before the library removes the user.
 */
export async function requestDeletion(deps: ServerDeps, account: string, dueAt?: number): Promise<DeletionRow> {
  const row = await deps.stores.account.get(account);
  await leavePairs(deps, account, row?.character ?? null);
  await stopNotices(deps, account);
  const requestedAt = deps.now();
  const result = await deps.stores.deletion.request({
    account,
    accountHash: await accountHash(account),
    requestedAt,
    dueAt: Math.min(dueAt ?? Number.MAX_SAFE_INTEGER, requestedAt + deps.config.account.deleteWithinDays * time.DAY_MS),
  });
  if (!result.ok) throw new Error(`Deletion of ${account} was refused: ${result.detail}`);
  return result.value;
}

/** R-ACCOUNT-018: a later request about a deleted account, answered from the hash alone. */
export async function deletionStatus(deps: ServerDeps, account: string): Promise<{ requestedAt: number; dueAt: number; completedAt: number | null } | null> {
  const row = await deps.stores.deletion.find(await accountHash(account));
  return row === null ? null : { requestedAt: row.requestedAt, dueAt: row.dueAt, completedAt: row.completedAt };
}
