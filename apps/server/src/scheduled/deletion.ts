// account:deleted-data-removed-within-month, account:deletion-keeps-anonymous-totals: the deletion job. Removes everything a due deletion
// names, then keeps only the hash and the dates. Runs from the daily cron.
import type { Auth } from "../auth/auth";
import { pruneLimitRows } from "../auth/hooks";
import type { ServerDeps } from "../deps";
import { forgetPairs } from "../pair/leave";

const PASSKEY_MODEL = "passkey";

/** The library's rows for one user: sessions, linked methods, passkeys, the user. Safe to run when some are gone. */
async function removeAuthUser(auth: Auth, account: string): Promise<void> {
  const context = await auth.$context;
  await context.internalAdapter.deleteUserSessions(account);
  await context.internalAdapter.deleteAccounts(account);
  await context.adapter.deleteMany({ model: PASSKEY_MODEL, where: [{ field: "userId", value: account }] });
  await context.internalAdapter.deleteUser(account);
}

/**
 * Runs every deletion due at `deps.now()` and returns how many completed.
 * Never touches the audit store, the day totals or the draws. moderation:reports-hold-cited-records:
 * what a report holds (its messages, its pair record) is kept past the removal.
 */
export async function runDeletions(deps: ServerDeps, auth: Auth): Promise<number> {
  const now = deps.now();
  let completed = 0;
  for (const due of await deps.stores.deletion.due(now)) {
    const account = due.account;
    if (account === null) continue;
    const row = await deps.stores.account.get(account);
    const character = row?.character ?? null;
    await forgetPairs(deps, account, character);
    if (character !== null) await deps.stores.player.remove(character);
    await deps.stores.push.forget(account);
    // account:name-a-light-for-yours: the dedication light goes with the account (the database's foreign key does it too).
    await deps.stores.dedication.putOut(account);
    await deps.stores.account.remove(account);
    await removeAuthUser(auth, account);
    if (character !== null) await deps.stores.ledger.dropMark(character);
    const done = await deps.stores.deletion.complete(account, now);
    if (done.ok) completed += 1;
  }
  await pruneLimitRows((await auth.$context).adapter, now);
  return completed;
}
