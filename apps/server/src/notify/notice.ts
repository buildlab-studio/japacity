// clock:full-bank-push-notification: the bank-full notices. Every fill whose time has come is
// claimed once, and only then sent, to every device of an account whose
// setting is on: a second run, or two at once, never sends a fill twice.
import type { ServerDeps } from "../deps";
import { NOTICE_TITLE, notifyText } from "./notify.text";
import type { PushKeys } from "./webpush";
import { sendPush } from "./webpush";

/** What one run did, for the logs and the tests. */
export interface NoticeRun {
  /** Characters whose fill was claimed and told to at least one device. */
  told: string[];
  /** Characters whose fill was claimed with the setting off or no device. */
  quiet: string[];
  /** Endpoints the push services no longer know, now removed. */
  gone: string[];
  failed: number;
}

const SALT_BYTES = 16;

/** The notice as the service worker reads it. */
export function noticePayload(): string {
  return JSON.stringify({ title: NOTICE_TITLE, body: notifyText["notify.bank-full"], tag: "notify.bank-full" });
}

export async function sendNotices(deps: ServerDeps, keys: PushKeys): Promise<NoticeRun> {
  const run: NoticeRun = { told: [], quiet: [], gone: [], failed: 0 };
  const now = deps.now();
  for (const row of await deps.stores.player.filled(now)) {
    if (row.fullAt === null || !(await deps.stores.player.claimFull(row.id, row.fullAt, now))) continue;
    const account = await deps.stores.account.get(row.account);
    const devices = account?.notifyBankFull === true ? await deps.stores.push.forAccount(row.account) : [];
    if (devices.length === 0) {
      run.quiet.push(row.id);
      continue;
    }
    for (const device of devices) {
      const outcome = await sendPush(keys, device, noticePayload(), now, new Uint8Array(deps.randomBytes(SALT_BYTES)));
      if (outcome === "gone") {
        await deps.stores.push.unsubscribe(row.account, device.endpoint);
        run.gone.push(device.endpoint);
      }
      if (outcome === "failed") run.failed += 1;
    }
    run.told.push(row.id);
  }
  return run;
}

/** clock:full-bank-push-notification, account:only-needed-data-kept: the setting off and every device forgotten, as when the player turns it off or the account goes. */
export async function stopNotices(deps: ServerDeps, account: string): Promise<void> {
  await deps.stores.push.forget(account);
  await deps.stores.account.setNotify(account, false);
}
