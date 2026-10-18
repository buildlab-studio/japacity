// An account leaving (person:leaving-player-ends-bonds; account:player-deletes-account,
// account:deleted-data-removed-within-month; moderation:reports-hold-cited-records): every bond with it ends in
// the other life as an absence end, the record keeps the moments with the
// leaving side's name taken out, and at removal its rows go but what a hold keeps.
import type { PairRecord } from "@japacity/sim";

import type { ServerDeps } from "../deps";
import { pairStep, sendTo, sideLive, sideOf } from "./step";

/**
 * person:leaving-player-ends-bonds, account:player-deletes-account: called when a deletion is asked for
 * (account/deletion.ts) and when a life ends for another (authority/character.ts). The other player is told only that the bond ended.
 * `why`: `absence` for a deletion, `restart` when the player ended the life to start another (account:start-a-new-life).
 */
export async function leavePairs(deps: ServerDeps, _account: string, character: string | null, why: "absence" | "restart" = "absence"): Promise<void> {
  if (character === null) return;
  for (const key of await deps.stores.invite.pairsOf(character)) {
    const row = await deps.stores.pair.get(key);
    const record = row === null ? null : (row.record as PairRecord);
    if (record === null || sideOf(record, character) === null) continue;
    await pairStep(deps, key, ({ book, turn, lives }) => {
      const held = book.get(key);
      const at = held === null ? null : sideOf(held, character);
      if (held === null || at === null) return { ok: true, value: null };
      const stays = sideLive(lives, held, at === "a" ? "b" : "a");
      if (stays !== null && held.ended === null) {
        const ended = sendTo(turn, stays, { type: "people/ended", pair: key, why });
        if (!ended.ok) return ended;
      }
      book.write(key, at, { type: "pair/deleted", tick: turn.world.tick });
      return { ok: true, value: null };
    });
  }
}

/**
 * account:deleted-data-removed-within-month, moderation:reports-hold-cited-records: what the deletion job removes beside the
 * character: its conversations (but the messages a running hold keeps), the
 * links it made or used and their rewards, and its blocks and reports (but
 * the reports still holding). Run before `stores.player.remove`, which takes
 * the pair records.
 */
export async function forgetPairs(deps: ServerDeps, account: string, character: string | null): Promise<void> {
  const now = deps.now();
  const keep = (await deps.stores.moderation.holds(now)).flatMap((hold) => hold.messages);
  if (character !== null) {
    await deps.stores.conversation.removeFor(character, keep);
    await deps.stores.invite.remove(character);
  }
  await deps.stores.moderation.remove(account, now);
}
