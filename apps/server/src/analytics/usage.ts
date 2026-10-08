// R-ANALYTICS-006: the "Send usage counts" setting, stored on the account.
import type { AccountRow } from "@japacity/store";

/**
 * True unless the account has turned the setting off; it is on by default.
 * the first plan says `sendUsageCounts` is on the account row, and
 * `AccountRow` in packages/store/src/types.ts does not carry it yet, so the
 * field is read where present and a row without it counts as on.
 */
export function usageCountsOn(row: AccountRow & { sendUsageCounts?: boolean }): boolean {
  return row.sendUsageCounts !== false;
}
