// The command transaction (server:one-command-one-transaction, server:log-rows-hash-state, server:snapshots-bound-replay, server:rejections-write-nothing, server:authority-commands-same-path and server:paired-rows-locked-in-order,
// clock:turns-earned-from-refill-time, clock:earned-turns-granted-first, clock:full-bank-earns-nothing, clock:request-fills-missing-ticks, clock:command-uses-stamped-tick): lock the characters, load each,
// grant what real time earned, run the caller's step, and write the rows, the
// snapshots, any new segment and `refilledAt` together, or nothing at all.
import type { Command, Rejection, Sender, StepResult, World } from "@japacity/sim";
import type { CharacterWrite, PairRow, PairWrite, Refusal, Writes } from "@japacity/store";

import { earnTurns } from "../clock/turns";
import { tickAt, turnClock } from "../clock/view";
import type { ServerDeps } from "../dependencies";
import { sellTickets } from "../lottery/sell";
import { dialedContents } from "../switches/dials";
import { heldWorlds, tickRow } from "../world/ticks";
import type { Diverged, Live } from "./load";
import { apply, load } from "./load";

/** What the caller's step is given: the world of the current tick and a way to step a live character on it. */
export interface Turn {
  world: World;
  at: number;
  send: (live: Live, command: Command, sender: Sender) => StepResult;
  /** pair:only-server-writes-record: the stored records between the held characters, read under the locks. */
  pairs: readonly PairRow[];
  /** pair:only-server-writes-record: a record write, applied with the characters' writes or not at all. */
  writePair: (write: PairWrite) => void;
}

/** The caller's step, run under the locks once every character is loaded and granted. A rejection writes nothing. */
export type Act<T> = (lives: Live[], turn: Turn) => { ok: true; value: T } | Rejection;

export interface TxOptions {
  /** clock:turns-earned-from-refill-time: off only where a test stores a recorded life as it was played, with no turn granted. */
  grant?: boolean;
}

export type TxResult<T> =
  | { kind: "done"; value: T; lives: Live[]; world: World; at: number }
  | { kind: "rejected"; rejection: Rejection; lives: Live[]; world: World; at: number }
  | { kind: "diverged"; diverged: Diverged }
  | { kind: "refused"; refusal: Refusal };

/** server:one-command-one-transaction: one character's writes, or null when the transaction changed nothing of it. */
function writeOf(live: Live): CharacterWrite | null {
  const changed = live.opened !== null || live.rows.length > 0 || live.refilledAt !== live.storedRefilledAt;
  if (!changed) return null;
  return {
    id: live.id,
    ...(live.opened === null ? {} : { segment: live.opened.segment }),
    append: live.rows,
    snapshots: [...(live.opened === null ? [] : [live.opened.base]), ...live.snapshots],
    refilledAt: live.refilledAt,
  };
}

/**
 * clock:earned-turns-granted-first, clock:full-bank-earns-nothing: one `turns/grant` from the authority for what
 * real time earned, logged like any command, and `refilledAt` moved on. The tick was stamped before the lock, so a
 * command written meanwhile on a later tick makes the grant `clock-went-back`: that refusal is handed back, to write nothing.
 */
function grantEarned(deps: ServerDeps, live: Live, turn: Turn): Rejection | null {
  const earned = earnTurns(live.state, live.refilledAt, turn.at, turnClock(deps.config, live.content.tuning.turn.cap));
  if (earned.grant > 0) {
    const granted = turn.send(live, { type: "turns/grant", count: earned.grant, basedOn: live.state.v }, "authority");
    if (!granted.ok && granted.code === "clock-went-back") return granted;
    if (!granted.ok) throw new Error(`The earned grant for ${live.id} was rejected with ${granted.code}: ${granted.detail}`);
  }
  live.refilledAt = earned.refilledAt;
  return null;
}

/**
 * server:one-command-one-transaction, server:paired-rows-locked-in-order: runs `act` under the locks of `ids` (ascending
 * id order, whatever order they are given in) at the current tick. The
 * missing tick rows are made before the locks are taken (clock:request-fills-missing-ticks).
 */
export async function transact<T>(deps: ServerDeps, ids: readonly string[], act: Act<T>, options: TxOptions = {}): Promise<TxResult<T>> {
  const at = deps.now();
  const world = (await tickRow(deps, tickAt(deps.config.clock, at))).world;
  const snapshotEvery = deps.config.server.snapshotEvery;
  const send: Turn["send"] = (live, command, sender) => apply(live, command, sender, world, at, snapshotEvery);

  // person:computer-partner-offer-dial, server:overlay-change-opens-segment: the partner dial in the content, read before the locks.
  const contents = await dialedContents(deps);
  // server:one-command-one-transaction: under the locks every read and write goes through the work's own stores.
  const result = await deps.stores.player.transact(ids, async (rows, stores): Promise<{ writes: Writes; result: TxResult<T> }> => {
    const pairWrites: PairWrite[] = [];
    const turn: Turn = { world, at, send, pairs: rows.pairs, writePair: (write) => pairWrites.push(write) };
    const ticks = new Set(rows.characters.flatMap((held) => held.tail.map((logged) => logged.tick)));
    const worlds = await heldWorlds(stores.world, ticks);
    const lives: Live[] = [];
    for (const held of rows.characters) {
      const loaded = load(held, contents, worlds);
      if (!loaded.ok) return { writes: {}, result: { kind: "diverged", diverged: loaded.diverged } };
      lives.push(loaded.live);
    }
    if (options.grant !== false) {
      for (const live of lives) {
        const refused = grantEarned(deps, live, turn);
        if (refused !== null) return { writes: {}, result: { kind: "rejected", rejection: refused, lives, world, at } };
      }
    }
    const acted = act(lives, turn);
    if (!acted.ok) return { writes: {}, result: { kind: "rejected", rejection: acted, lives, world, at } };
    const unsold = await sellTickets(stores.world, lives, world);
    if (unsold !== null) return { writes: {}, result: { kind: "rejected", rejection: unsold, lives, world, at } };
    const characters = lives.map(writeOf).filter((write) => write !== null);
    return { writes: { characters, pairs: pairWrites }, result: { kind: "done", value: acted.value, lives, world, at } };
  });
  return result.ok ? result.value : { kind: "refused", refusal: result };
}
