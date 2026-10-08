// R-ANALYTICS-008: `command/rejected` by code. A rejected command is never
// logged, so the nightly job cannot read it; the core calls this when it
// answers a command with a rejection, beside `countRejection` (admin/rejections.ts).
// the command route does not call either yet; the lead adds the call.
import type { ServerDeps } from "../deps";
import type { ServerCode } from "../types";
import { utcDay } from "../admin/day";
import { dayName } from "./day";
import { NO_REGION } from "./list";

export async function countRejected(deps: Pick<ServerDeps, "stores" | "now">, account: string | null, code: ServerCode): Promise<void> {
  const row = account === null ? null : await deps.stores.account.get(account);
  const region = row === null || row.country === "" ? NO_REGION : row.country;
  await deps.stores.counters.add([{ day: dayName(utcDay(deps.now())), region, name: "command/rejected", key: code, count: 1 }]);
}
