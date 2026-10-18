// R-ANALYTICS-008: `command/rejected` by code. A rejected command is never
// logged, so the nightly job cannot read it; the refusal counter in count.ts
// calls this beside `countRejection` (ops/rejections.ts) once a counted route
// has answered with a refusal.
import type { ServerCode } from "@japacity/api";
import { time } from "@japacity/sim";

import type { ServerDeps } from "../deps";
import { regionOf } from "./list";

export async function countRejected(deps: Pick<ServerDeps, "stores" | "now">, account: string | null, code: ServerCode): Promise<void> {
  const row = account === null ? null : await deps.stores.account.get(account);
  const region = regionOf(row);
  await deps.stores.counters.add([{ day: time.dayName(time.utcDay(deps.now())), region, name: "command/rejected", key: code, count: 1 }]);
}
