// Replay for the admin tools: a character's stored rows stepped again against
// the stored world rows (R-CLOCK-017) under the content each segment names.
// Everything here reads; nothing writes.
import type { Command, Content, RejectionCode, State, World } from "@japacity/sim";
import { hashState, newState, step, upgradeState } from "@japacity/sim";
import type { Held, LogRow, SegmentRow } from "@japacity/store";

import type { ServerDeps } from "../deps";

/** Why a replay could not run at all. */
export interface LoadFailure {
  ok: false;
  code: "missing" | "no-world" | "no-content";
  detail: string;
}

export type Loaded<T> = { ok: true; value: T } | LoadFailure;

/** R-SERVER-008: the first logged version whose stored hash differs from the replay's. `replayed` is null when the command is now rejected. */
export interface Diff {
  v: number;
  stored: string;
  replayed: string | null;
}

/** R-SERVER-009: a command the log says was accepted that the replay now rejects. */
export interface Dropped {
  v: number;
  type: Command["type"];
  code: RejectionCode;
  detail: string;
}

export interface Replayed {
  state: State;
  firstDiff: Diff | null;
  dropped: Dropped[];
}

/** R-SERVER-023: the bundled content a segment or snapshot names, the current or the one before, under the same overlay. */
export function contentNamed(deps: Pick<ServerDeps, "contents">, version: string, overlay: string | undefined): Content | null {
  for (const content of [deps.contents.current, deps.contents.previous]) {
    if (content !== null && content.version === version && content.overlay === overlay) return content;
  }
  return null;
}

/** R-CLOCK-017: the stored world of every tick the rows name. */
export async function worldsFor(deps: Pick<ServerDeps, "stores">, rows: readonly LogRow[]): Promise<Loaded<Map<number, World>>> {
  const ticks = [...new Set(rows.map((row) => row.tick))];
  const stored = await Promise.all(ticks.map((tick) => deps.stores.world.tick(tick)));
  const worlds = new Map<number, World>();
  for (const [index, tick] of ticks.entries()) {
    const row = stored[index] ?? null;
    if (row === null) return { ok: false, code: "no-world", detail: `No world is stored for tick ${String(tick)}.` };
    worlds.set(tick, row.world);
  }
  return { ok: true, value: worlds };
}

/**
 * Steps the rows from `start` in version order. A command now rejected is
 * dropped, and every later command is stepped on the version the replay has
 * reached, so one drop does not reject the rest as stale.
 */
export function replayRows(start: State, rows: readonly LogRow[], content: Content, worlds: ReadonlyMap<number, World>): Replayed {
  let state = start;
  let firstDiff: Diff | null = null;
  const dropped: Dropped[] = [];
  for (const row of rows) {
    const world = worlds.get(row.tick);
    if (world === undefined) throw new Error(`The world for tick ${String(row.tick)} was not loaded.`);
    const command: Command = { ...row.command, basedOn: state.v };
    const result = step(state, command, world, content, row.sender);
    if (!result.ok) {
      dropped.push({ v: row.v, type: row.command.type, code: result.code, detail: result.detail });
      firstDiff ??= { v: row.v, stored: row.hash, replayed: null };
      continue;
    }
    state = result.state;
    const hash = hashState(state);
    if (hash !== row.hash) firstDiff ??= { v: row.v, stored: row.hash, replayed: hash };
  }
  return { state, firstDiff, dropped };
}

/** The log rows that belong to each segment: after its `fromV`, up to the next segment's. */
export function rowsBySegment(segments: readonly SegmentRow[], log: readonly LogRow[]): LogRow[][] {
  return segments.map((segment, index) => {
    const next = segments[index + 1];
    return log.filter((row) => row.v > segment.fromV && (next === undefined || row.v <= next.fromV));
  });
}

/**
 * R-SERVER-008: replays every stored segment from its own start. Once an
 * earlier segment has changed, a later one begins from the replayed state
 * carried to its content (R-SERVER-021) instead of its stored base.
 */
export function replaySegments(
  deps: Pick<ServerDeps, "contents">,
  segments: readonly SegmentRow[],
  log: readonly LogRow[],
  worlds: ReadonlyMap<number, World>,
): Loaded<Replayed & { content: Content }> {
  const rows = rowsBySegment(segments, log);
  let before: { state: State; content: Content } | null = null;
  let firstDiff: Diff | null = null;
  const dropped: Dropped[] = [];
  for (const [index, segment] of segments.entries()) {
    const content = contentNamed(deps, segment.content, segment.overlay);
    if (content === null) {
      return { ok: false, code: "no-content", detail: `Segment ${String(segment.segment)} ran under content ${segment.content} and overlay ${segment.overlay ?? "none"}, which this server does not bundle.` };
    }
    const changed = firstDiff !== null;
    let start: State;
    if (!("base" in segment.start)) start = newState(segment.start.scenario, segment.start.seed, content);
    else if (before !== null && changed) start = upgradeState(before.state, before.content, content);
    else start = segment.start.base;
    const replayed = replayRows(start, rows[index] ?? [], content, worlds);
    firstDiff ??= replayed.firstDiff;
    dropped.push(...replayed.dropped);
    before = { state: replayed.state, content };
  }
  if (before === null) return { ok: false, code: "missing", detail: "The character has no stored segment." };
  return { ok: true, value: { state: before.state, content: before.content, firstDiff, dropped } };
}

/** The character's state now: its latest snapshot and the rows after it, with any difference from the stored hashes. */
export async function stateNow(deps: Pick<ServerDeps, "contents" | "stores">, held: Held): Promise<Loaded<Replayed & { content: Content }>> {
  const { snapshot, tail } = held;
  const content = contentNamed(deps, snapshot.content, snapshot.overlay);
  if (content === null) return { ok: false, code: "no-content", detail: `The snapshot is under content ${snapshot.content}, which this server does not bundle.` };
  const worlds = await worldsFor(deps, tail);
  if (!worlds.ok) return worlds;
  return { ok: true, value: { ...replayRows(snapshot.state, tail, content, worlds.value), content } };
}
