// Every character snapshotted before a deploy (server:snapshot-before-deploy): one
// character per transaction under its row lock (server:no-mass-rollback), loaded as a
// command loads it, then a new segment at the next version with that state
// as its base and an empty tail (server:snapshots-bound-replay, server:save-is-list-of-segments), so the rules
// deployed next never replay a command logged under the rules before. A
// character that diverges is left for the rollback tool. Nothing here writes
// a world row, an account or a ledger, and nothing is sent to a player.
import type { State } from "@japacity/sim";
import type { Held, SegmentRow, Writes } from "@japacity/store";

import type { Contents, ServerDeps } from "../dependencies";
import { load, snapshotOf } from "../authority/load";
import { dialedContents } from "../switches/dials";
import { heldWorlds } from "../world/ticks";
import type { OpenDatabase } from "./database";
import { DATABASE_ENV } from "./database";

type SnapshotDeps = Pick<ServerDeps, "config" | "contents" | "stores" | "now">;

/** What became of one character. `before` and `after` are its stored versions. */
export type Snapshotted =
  /** A new segment opened at `after`, its base the loaded state. */
  | { id: string; outcome: "snapshotted"; before: number; after: number; segment: number }
  /** Its segment in force already begins at its version from a base, with nothing logged after: nothing to replay, nothing written. */
  | { id: string; outcome: "already"; before: number; after: number }
  /** server:log-rows-hash-state: the replay did not reach the stored hash; skipped and left for the rollback tool. */
  | { id: string; outcome: "diverged"; before: number; after: number; detail: string }
  /** The load could not run (a content not bundled, a world not stored, an upgrade that fails its checks) or the write was refused. */
  | { id: string; outcome: "failed"; before: number | null; after: number | null; detail: string };

/** True when nothing is logged after the segment in force began from a base at the stored version: a load replays nothing. */
function alreadyBased(held: Held): boolean {
  const segment = held.segments.find((each) => each.segment === held.character.segment);
  return segment !== undefined && "base" in segment.start && segment.fromV === held.character.v && held.snapshot.v === held.character.v && held.tail.length === 0;
}

/** server:snapshot-before-deploy: one character in one transaction under its lock. */
async function snapshotCharacter(deps: SnapshotDeps, contents: Contents, id: string): Promise<Snapshotted> {
  let before: number | null = null;
  try {
    const done = await deps.stores.player.transact([id], async (rows, stores): Promise<{ writes: Writes; result: Snapshotted }> => {
      const held = rows.characters[0];
      if (held === undefined) throw new Error(`Character ${id} was not held.`);
      const v = held.character.v;
      before = v;
      if (alreadyBased(held)) return { writes: {}, result: { id, outcome: "already", before: v, after: v } };
      // clock:command-uses-stamped-tick: the stored world of each logged tick, read through the transaction's own client.
      const worlds = await heldWorlds(stores.world, new Set(held.tail.map((row) => row.tick)));
      const loaded = load(held, contents, worlds);
      if (!loaded.ok) return { writes: {}, result: { id, outcome: "diverged", before: v, after: v, detail: loaded.diverged.detail } };
      // A load that carried the state to the current content (server:newer-content-upgrades-state) is folded into this one new segment.
      const { content, state } = loaded.live;
      const segment = held.character.segment + 1;
      const fromV = v + 1;
      const base: State = { ...state, v: fromV };
      const opened: SegmentRow = { character: id, segment, fromV, content: content.version, ...(content.overlay === undefined ? {} : { overlay: content.overlay }), start: { base } };
      return {
        writes: { characters: [{ id, segment: opened, snapshots: [snapshotOf(id, segment, content, base)] }] },
        result: { id, outcome: "snapshotted", before: v, after: fromV, segment },
      };
    });
    if (!done.ok) return { id, outcome: "failed", before, after: before, detail: `${done.code}: ${done.detail}` };
    return done.value;
  } catch (error) {
    return { id, outcome: "failed", before, after: before, detail: error instanceof Error ? error.message : String(error) };
  }
}

/** How many character rows are read at a time; each is then snapshotted in its own transaction. */
const SNAPSHOT_PAGE = 100;

/**
 * server:snapshot-before-deploy: every character, in id order, each in its own transaction, so
 * every other character plays on while one is held. The contents are the ones
 * a command runs under (the partner dial applied, server:overlay-change-opens-segment).
 */
export async function snapshotAll(deps: SnapshotDeps, each: (done: Snapshotted) => void = () => undefined, pageSize = SNAPSHOT_PAGE): Promise<Snapshotted[]> {
  const contents = await dialedContents(deps);
  const done: Snapshotted[] = [];
  let page = await deps.stores.player.page(null, pageSize);
  while (page.length > 0) {
    for (const row of page) {
      const one = await snapshotCharacter(deps, contents, row.id);
      done.push(one);
      each(one);
    }
    const last = page.at(-1);
    page = last === undefined || page.length < pageSize ? [] : await deps.stores.player.page(last.id, pageSize);
  }
  return done;
}

export interface SnapshotCliResult {
  exit: number;
  lines: string[];
}

const USAGE = `Usage: pnpm snapshot:all (on the database at ${DATABASE_ENV})`;

/** One line for one character: its id, its versions before and after, and the outcome. */
function snapshotLine(done: Snapshotted): string {
  const versions = `v ${String(done.before ?? "unknown")} to v ${String(done.after ?? "unknown")}`;
  return "detail" in done ? `${done.id} ${versions} ${done.outcome}: ${done.detail}` : `${done.id} ${versions} ${done.outcome}`;
}

/** `pnpm snapshot:all`: ends 1 when any character was skipped, 2 when it could not start. `print` hears each line as it is made. */
export async function snapshotCli(args: readonly string[], open: OpenDatabase, print: (line: string) => void = () => undefined): Promise<SnapshotCliResult> {
  if (args.length > 0) return { exit: 2, lines: [USAGE] };
  if (open === null) return { exit: 2, lines: [`Set ${DATABASE_ENV} to the game's database first (the migrator's string, as the migration step uses).`, USAGE] };
  const lines: string[] = [];
  const say = (line: string) => {
    lines.push(line);
    print(line);
  };
  const { deps, close } = await open();
  let done: Snapshotted[];
  try {
    done = await snapshotAll(deps, (one) => say(snapshotLine(one)));
  } finally {
    await close();
  }
  const count = (outcome: Snapshotted["outcome"]) => done.filter((one) => one.outcome === outcome).length;
  const skipped = count("diverged") + count("failed");
  say(`${String(done.length)} characters: ${String(count("snapshotted"))} snapshotted, ${String(count("already"))} already, ${String(count("diverged"))} diverged, ${String(count("failed"))} failed.`);
  if (skipped > 0) say("The skipped characters are left for the rollback tool: pnpm rollback check <character>, one at a time.");
  return { exit: skipped > 0 ? 1 : 0, lines };
}
