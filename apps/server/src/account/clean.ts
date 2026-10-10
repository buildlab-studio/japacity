// R-ACCOUNT-026: the guest clean-up, run by hand and never by a schedule.
// `pnpm tsx tools/guests/clean.ts --idle-days <n> [--apply]` lists the guest
// accounts with no play for that many days and, with `--apply`, removes them
// through the deletion of R-ACCOUNT-017, due at once. Secured accounts are
// never listed. Without `--idle-days` the working number `account.guestIdleDays`.
import { time } from "@japacity/sim";
import type { AccountRow } from "@japacity/store";

import type { Auth } from "../auth/auth";
import type { ServerDeps } from "../deps";
import { runDeletions } from "../jobs/deletion";
import { requestDeletion } from "./deletion";

export interface CleanResult {
  idle: AccountRow[];
  /** How many deletions completed; 0 without `apply`. */
  removed: number;
}

/** The guests with no play for `idleDays` days, and with `apply` their removal. */
export async function cleanGuests(deps: ServerDeps, auth: Auth, { idleDays, apply }: { idleDays: number; apply: boolean }): Promise<CleanResult> {
  const now = deps.now();
  const idle = await deps.stores.account.idleGuests(now - idleDays * time.DAY_MS);
  if (!apply) return { idle, removed: 0 };
  for (const row of idle) await requestDeletion(deps, row.id, now);
  return { idle, removed: await runDeletions(deps, auth) };
}

export interface CleanCli {
  exit: number;
  lines: string[];
}

const USAGE = "Usage: pnpm tsx tools/guests/clean.ts [--idle-days <whole days>] [--apply]";

/** The command line's arguments, or null when they make no sense. */
export function cleanArgs(args: readonly string[], fallbackDays: number): { idleDays: number; apply: boolean } | null {
  let idleDays = fallbackDays;
  let apply = false;
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at];
    if (arg === "--apply") apply = true;
    else if (arg === "--idle-days") {
      const days = args[at + 1] ?? "";
      if (!/^\d{1,5}$/.test(days) || Number(days) < 1) return null;
      idleDays = Number(days);
      at += 1;
    } else return null;
  }
  return { idleDays, apply };
}

export async function cleanCli(deps: ServerDeps, auth: Auth, args: readonly string[]): Promise<CleanCli> {
  const read = cleanArgs(args, deps.config.account.guestIdleDays);
  if (read === null) return { exit: 2, lines: [USAGE] };
  const result = await cleanGuests(deps, auth, read);
  const lines = result.idle.map((row) => `${row.id}  ${row.username}  last played ${new Date(row.lastPlayedAt).toISOString()}`);
  lines.push(`${String(result.idle.length)} guest accounts with no play for ${String(read.idleDays)} days.`);
  lines.push(read.apply ? `${String(result.removed)} deletions completed.` : "Nothing removed: run again with --apply to remove them.");
  return { exit: 0, lines };
}
