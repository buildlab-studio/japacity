// analytics:nightly-game-counters: the counters the server adds the moment it
// acts, for what the command log never holds: a guest secured and feedback
// sent. Only the day's totals by region are written; the account is read for
// its region and its sign-up day and goes no further (analytics:store-holds-nothing-personal). A
// counter that fails to write is never something the player sees.
import { time } from "@japacity/sim";
import type { ServerDeps } from "../deps";
import { regionOf, requestRegion } from "./list";

type Deps = Pick<ServerDeps, "stores" | "now">;

async function quietly(write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch {
    // analytics:server-checks-every-batch's spirit: counting never fails what was counted.
  }
}

/**
 * account:guest-secures-the-life: a guest was secured. Counted on the day it happened
 * (`players/secured`, the funnel's `secured`) and on the account's sign-up day
 * (`players/secured-by-signup`), so conversion reads by sign-up week.
 */
export function countSecured(deps: Deps, account: string): Promise<void> {
  return quietly(async () => {
    const row = await deps.stores.account.get(account);
    if (row === null) return;
    const region = regionOf(row);
    const day = time.dayName(time.utcDay(deps.now()));
    await deps.stores.counters.add([
      { day, region, name: "players/secured", key: region, count: 1 },
      { day, region, name: "funnel/step", key: "secured", count: 1 },
      { day: time.dayName(time.utcDay(row.createdAt)), region, name: "players/secured-by-signup", key: region, count: 1 },
    ]);
  });
}

/** moderation:feedback-box-in-settings: one piece of feedback kept, counted by the region it came from. */
export function countFeedback(deps: Deps, country: string | null): Promise<void> {
  return quietly(async () => {
    const region = requestRegion(country);
    await deps.stores.counters.add([{ day: time.dayName(time.utcDay(deps.now())), region, name: "feedback/sent", key: region, count: 1 }]);
  });
}
