// R-ANALYTICS-006: the "Send usage counts" setting, stored on the account.
import type { AccountRow } from "@japacity/store";

/** True unless the account has turned the setting off; it is on by default. */
export function usageCountsOn(row: AccountRow): boolean {
  return row.sendUsageCounts;
}
