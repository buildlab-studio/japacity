// The bank-full notices' scheduled job (clock:full-bank-push-notification): on
// the five-minute cron, every bank that filled since the last run.
import type { ServerDeps } from "../deps";
import type { NoticeRun } from "../notify/notice";
import { sendNotices } from "../notify/notice";
import type { PushKeys } from "../notify/webpush";
import { TICKS_CRON } from "./ticks";

/** Runs on the five-minute cron only, and only with the deployment's push keys. */
export function notifyJob(deps: ServerDeps, keys: PushKeys | null, cron: string): Promise<NoticeRun | null> {
  if (cron !== TICKS_CRON || keys === null) return Promise.resolve(null);
  return sendNotices(deps, keys);
}
