// R-ACCOUNT-016 to 018: what deleting an account does at once, and what the
// deletion job later removes and keeps.
import { time } from "@japacity/sim";
import type { DeletionRow } from "@japacity/store";

import type { ServerDeps } from "../deps";
import { sha256Hex } from "../auth/hooks";

/** R-ACCOUNT-018: the one-way hash kept after the account is gone. */
export function accountHash(account: string): Promise<string> {
  return sha256Hex(account);
}

/**
 * R-ACCOUNT-016: the character leaves every place and pair, and the other
 * player is told only that they left. No pair exists before the people
 * milestone; its pair store is `stores.pair`, and the leaving is added here.
 */
export type LeavePairs = (deps: ServerDeps, account: string, character: string | null) => Promise<void>;

export const leavePairs: LeavePairs = () => Promise.resolve();

/** R-ACCOUNT-016, R-ACCOUNT-017: records the deletion, due within `deleteWithinDays`. Called before the library removes the user. */
export async function requestDeletion(deps: ServerDeps, account: string): Promise<DeletionRow> {
  const row = await deps.stores.account.get(account);
  await leavePairs(deps, account, row?.character ?? null);
  const requestedAt = deps.now();
  const result = await deps.stores.deletion.request({
    account,
    accountHash: await accountHash(account),
    requestedAt,
    dueAt: requestedAt + deps.config.account.deleteWithinDays * time.DAY_MS,
  });
  if (!result.ok) throw new Error(`Deletion of ${account} was refused: ${result.detail}`);
  return result.value;
}

/** R-ACCOUNT-018: a later request about a deleted account, answered from the hash alone. */
export async function deletionStatus(deps: ServerDeps, account: string): Promise<{ requestedAt: number; dueAt: number; completedAt: number | null } | null> {
  const row = await deps.stores.deletion.find(await accountHash(account));
  return row === null ? null : { requestedAt: row.requestedAt, dueAt: row.dueAt, completedAt: row.completedAt };
}
