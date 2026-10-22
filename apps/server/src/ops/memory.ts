// A save put into the memory stores the way the command transaction stores
// it: one log row per accepted command with its hash, a snapshot every
// `snapshotEvery`, and the stand-in worlds as the stored world rows. For the
// rollback tool's --memory mode and for tests.
import type { FlatSave, SavedCommand, State } from "@japacity/sim";
import { hashState, newState, step, standInWorlds } from "@japacity/sim";
import type { LogRow, SnapshotRow } from "@japacity/store";

import type { ServerDeps } from "../dependencies";

type MemoryDeps = Pick<ServerDeps, "config" | "contents" | "stores">;

/** clock:world-is-stored-history: stores the stand-in world of every tick the save names as the world's history. */
export async function storeWorlds(deps: MemoryDeps, save: FlatSave): Promise<void> {
  const content = deps.contents.current;
  const upTo = Math.max(0, ...save.commands.map((entry) => entry.tick));
  for (const world of standInWorlds(save.worldSeed, upTo, content)) {
    await deps.stores.world.insertTick({ tick: world.tick, world, book: null, content: content.version, hash: hashState(world) });
  }
}

/** Makes the character at version 0 from the save's start. */
export async function createLife(deps: MemoryDeps, id: string, save: FlatSave): Promise<State> {
  const content = deps.contents.current;
  const state = newState(save.scenario, save.seed, content);
  const made = await deps.stores.player.create({
    id,
    account: `account-${id}`,
    refilledAt: 0,
    content: content.version,
    start: { scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed },
    state,
  });
  if (!made.ok) throw new Error(made.detail);
  return state;
}

export interface Played {
  state: State;
  rows: LogRow[];
}

export interface PlayOptions {
  /** Each row's real time. */
  at: (index: number) => number;
  /** Called after the store with the state before each command, as the core calls `markAfterCommit`. */
  onCommit?: (before: State, row: LogRow) => Promise<void>;
  /** Changes a row before it is stored, as a fault on the server would. */
  tamper?: (row: LogRow, index: number) => LogRow;
  /** Versions the stored rows run ahead of the replay, as after a command the server took and should not have. */
  shift?: number;
}

/** Steps the entries from `state` as the core would and stores the rows. */
export async function playRows(deps: MemoryDeps, id: string, state: State, entries: readonly SavedCommand[], options: PlayOptions): Promise<Played> {
  const content = deps.contents.current;
  const { snapshotEvery } = deps.config.server;
  const shift = options.shift ?? 0;
  const held = await deps.stores.player.load(id);
  if (held === null) throw new Error(`No character ${id}.`);
  const rows: LogRow[] = [];
  const snapshots: SnapshotRow[] = [];
  const befores: State[] = [];
  let now = state;
  for (const [index, entry] of entries.entries()) {
    const stored = await deps.stores.world.tick(entry.tick);
    if (stored === null) throw new Error(`No world stored for tick ${String(entry.tick)}.`);
    const result = step(now, { ...entry.command, basedOn: now.v }, stored.world, content, entry.sender);
    if (!result.ok) throw new Error(`${entry.command.type} was rejected with ${result.code}: ${result.detail}`);
    befores.push(now);
    now = result.state;
    const v = now.v + shift;
    const kept: State = { ...now, v };
    const row: LogRow = { character: id, v, tick: entry.tick, sender: entry.sender, command: { ...entry.command, basedOn: v - 1 }, hash: hashState(kept), at: options.at(index) };
    rows.push(options.tamper?.(row, index) ?? row);
    if (v % snapshotEvery === 0) snapshots.push({ character: id, v, segment: held.character.segment, content: content.version, state: kept });
  }
  const written = await deps.stores.player.transact([id], () => ({ writes: { characters: [{ id, append: rows, snapshots }] }, result: null }));
  if (!written.ok) throw new Error(written.detail);
  for (const [index, row] of rows.entries()) {
    const before = befores[index];
    if (before !== undefined && options.onCommit !== undefined) await options.onCommit(before, row);
  }
  return { state: now, rows };
}

/** A whole save stored as character `id`. */
export async function storeSave(deps: MemoryDeps, id: string, save: FlatSave): Promise<Played> {
  await storeWorlds(deps, save);
  const start = await createLife(deps, id, save);
  return playRows(deps, id, start, save.commands, { at: () => 0 });
}
