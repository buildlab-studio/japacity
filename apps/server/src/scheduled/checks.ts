// The checks' scheduled job (admin:checks-have-three-states, admin:check-change-sends-email): on the five-minute cron,
// every check is measured, each change of state is written and the admins are told of a change into or out of alarm.
import type { CheckView } from "@japacity/api";

import type { Accounts, Auth } from "../auth/auth";
import type { ServerDeps } from "../dependencies";
import type { CheckPorts } from "../ops/checks";
import { evaluateChecks } from "../ops/checks";
import { TICKS_CRON } from "./ticks";

/** admin:check-change-sends-email: the verified emails of the admin accounts, read from the auth library's users. */
export async function adminEmails(auth: Auth, accounts: readonly string[]): Promise<string[]> {
  const context = await auth.$context;
  const emails: string[] = [];
  for (const id of accounts) {
    const user = await context.internalAdapter.findUserById(id);
    if (user !== null && user.emailVerified && user.email !== "") emails.push(user.email);
  }
  return emails;
}

/** Runs on the five-minute cron only. Without the auth library (a test server) the checks run and no mail is sent. */
export function checksJob(deps: ServerDeps, ports: CheckPorts, accounts: Accounts | undefined, cron: string): Promise<CheckView[] | null> {
  if (cron !== TICKS_CRON) return Promise.resolve(null);
  const mail = accounts === undefined ? null : { admins: () => adminEmails(accounts.auth, deps.config.admin.accounts), send: accounts.keys.sendNotice, link: `${accounts.keys.siteUrl}/admin` };
  return evaluateChecks(deps, ports, mail);
}
