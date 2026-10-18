// account.md R-ACCOUNT-031, analytics.md R-ANALYTICS-008: the
// lives being played, counted at 00:00 UTC as the day that has just ended
// closes, for the two lights. A life is counted when it has not ended
// (turn.md R-TURN-007) and its account still exists and still names it; it is
// counted by where it stands (place.md R-PLACE-001), under its account's
// region and once more under the whole game's. Every character is read a page
// at a time from the characters store, its state the latest snapshot and the
// rows after it. Only counts leave here: no character or account is kept,
// returned or logged.
import type { Where } from "@japacity/sim";
import { time } from "@japacity/sim";
import type { CounterTotal } from "@japacity/store";

import { stateNow } from "../ops/replay";
import { LIVES_KEYS, LIVES_PLAYING } from "../analytics/lights";
import { NO_REGION, WHOLE_GAME } from "../analytics/list";
import type { ServerDeps } from "../deps";

/** The cron in `wrangler.jsonc` that runs this job, beside the other nightly ones. */
export const LIVES_CRON = "0 0 * * *";

/** How many characters one read of the store brings. */
const PAGE = 200;

export interface LivesDay {
  day: string;
  /** False when the day had been counted already. */
  added: boolean;
  /** The whole game's lives by where they stand. */
  lives: Record<Where, number>;
  /** How many characters could not be read (their state's content is not bundled, or a world row is missing). */
  skipped: number;
}

const none = (): Record<Where, number> => ({ home: 0, abroad: 0, road: 0 });

/** R-ACCOUNT-031: counts the lives being played as `day` ends and adds them once for that day. */
export async function countLives(deps: Pick<ServerDeps, "contents" | "stores">, day: number): Promise<LivesDay> {
  const byRegion = new Map<string, Record<Where, number>>();
  const whole = none();
  let skipped = 0;
  let after: string | null = null;
  for (;;) {
    const rows = await deps.stores.player.page(after, PAGE);
    for (const row of rows) {
      const account = await deps.stores.account.get(row.account);
      if (account?.character !== row.id) continue;
      const held = await deps.stores.player.load(row.id);
      if (held === null) continue;
      const now = await stateNow(deps, held);
      if (!now.ok) {
        skipped += 1;
        continue;
      }
      const { state } = now.value;
      if (state.turn.ended) continue;
      const region = account.country === "" ? NO_REGION : account.country;
      const counts = byRegion.get(region) ?? none();
      counts[state.place.where] += 1;
      byRegion.set(region, counts);
      whole[state.place.where] += 1;
    }
    const last = rows.at(-1);
    if (rows.length < PAGE || last === undefined) break;
    after = last.id;
  }
  const named = time.dayName(day);
  const row = (region: string, key: Where, count: number): CounterTotal => ({ day: named, region, name: LIVES_PLAYING, key, count });
  const totals = [
    ...[...byRegion].flatMap(([region, counts]) => LIVES_KEYS.flatMap((key) => (counts[key] > 0 ? [row(region, key, counts[key])] : []))),
    ...LIVES_KEYS.map((key) => row(WHOLE_GAME, key, whole[key])),
  ];
  const added = await deps.stores.counters.addOnce(`lives:${named}`, totals);
  return { day: named, added, lives: whole, skipped };
}

/** On the 00:00 cron: the day that has just ended. */
export function livesJob(deps: ServerDeps): Promise<LivesDay> {
  return countLives(deps, time.utcDay(deps.now()) - 1);
}
