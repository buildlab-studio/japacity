// R-ANALYTICS-008: `command/rejected` by code. A rejected command is never
// logged, so the nightly job cannot read it; the refusal counter in count.ts
// calls this beside `countRejection` (ops/rejections.ts) once a counted route
// has answered with a refusal.
import type { ServerCode } from "@japacity/api";

import type { ServerDeps } from "../deps";
import { utcDay } from "../ops/day";
import { dayName } from "./day";
import { NO_REGION } from "./list";

export async function countRejected(deps: Pick<ServerDeps, "stores" | "now">, account: string | null, code: ServerCode): Promise<void> {
  const row = account === null ? null : await deps.stores.account.get(account);
  const region = row === null || row.country === "" ? NO_REGION : row.country;
  await deps.stores.counters.add([{ day: dayName(utcDay(deps.now())), region, name: "command/rejected", key: code, count: 1 }]);
}
