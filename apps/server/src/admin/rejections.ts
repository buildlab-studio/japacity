// R-SERVER-005: rejections counted by code for the admin page only. The counts
// live in the isolate's memory and start again at zero when it restarts.
import type { ServerCode } from "../types";

const counts = new Map<ServerCode, number>();

/** The core calls this once for every command it answers with a rejection. */
export function countRejection(code: ServerCode): void {
  counts.set(code, (counts.get(code) ?? 0) + 1);
}

/** The counts so far in this isolate, by code. */
export function rejectionCounts(): Partial<Record<ServerCode, number>> {
  return Object.fromEntries(counts);
}
