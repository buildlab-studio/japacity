import type { DayLog } from "@japacity/store";
import { and, gte, lt } from "drizzle-orm";

import type { Handle } from "../handle";
import { accounts, commandLog } from "../schema";
import { toAccount } from "./account";

const byCodeUnit = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

/** R-ANALYTICS-008: the day's characters and new accounts, read from the game's tables by an ordinary query. */
export function pgDayLog(handle: Handle): DayLog {
  return {
    active: (start, end) =>
      handle.read(async (db) => {
        const found = await db
          .selectDistinct({ character: commandLog.character })
          .from(commandLog)
          .where(and(gte(commandLog.at, start), lt(commandLog.at, end)));
        return found.map((row) => row.character).sort(byCodeUnit);
      }),

    created: (start, end) =>
      handle.read(async (db) => {
        const found = await db
          .select()
          .from(accounts)
          .where(and(gte(accounts.createdAt, start), lt(accounts.createdAt, end)));
        return found
          .map(toAccount)
          .sort((left, right) => byCodeUnit(left.id, right.id));
      }),
  };
}
