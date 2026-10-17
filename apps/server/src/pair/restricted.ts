// R-MODERATION-014: a mute (no phrases or invites) and a suspension (no
// sign-in, and so nothing else) in force, read from the admin log as the
// player's standing reads them, an overturned appeal undoing the action.
import { time } from "@japacity/sim";

import type { ServerDeps } from "../deps";
import type { PairRejection } from "./codes";

export type Restriction = "mute" | "suspend";

/** The latest end of the account's mutes or suspensions still running at `deps.now()`, or null. */
export async function restrictedUntil(deps: Pick<ServerDeps, "stores" | "now">, account: string, kind: Restriction): Promise<number | null> {
  const entries = (await deps.stores.moderationLog.list({ account })).filter((entry) => entry.action === kind && typeof entry.params.days === "number");
  if (entries.length === 0) return null;
  const overturned = new Set((await deps.stores.appeals.forAccount(account)).filter((appeal) => appeal.outcome === "overturned").map((appeal) => appeal.entry));
  const now = deps.now();
  let until: number | null = null;
  for (const entry of entries) {
    if (overturned.has(entry.id)) continue;
    const ends = entry.at + (entry.params.days as number) * time.DAY_MS;
    if (ends > now) until = Math.max(until ?? 0, ends);
  }
  return until;
}

/**
 * R-MODERATION-014: the refusal for a phrase or an invite from a muted or
 * suspended account, or null. ServerCode has no code of its own for a mute,
 * so `not-possible` is used, with the end in the detail.
 */
export async function silenced(deps: Pick<ServerDeps, "stores" | "now">, account: string): Promise<{ status: 200; body: PairRejection } | null> {
  const until = Math.max((await restrictedUntil(deps, account, "mute")) ?? 0, (await restrictedUntil(deps, account, "suspend")) ?? 0);
  if (until === 0) return null;
  return { status: 200, body: { ok: false, code: "not-possible", detail: `Phrases and invites are paused on this account until ${new Date(until).toISOString()}.` } };
}
