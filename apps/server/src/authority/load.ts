// Loading a character under its lock (docs/rules/server.md R-SERVER-003,
// R-SERVER-004, R-SERVER-020, R-SERVER-021, R-SERVER-024; clock.md
// R-CLOCK-017): the latest snapshot, the log after it replayed against the
// stored world of each row's tick, the hash compared with the last row's, and
// the state carried to the current content when its segment names another.
import type { Command, Content, Sender, State, StepResult, World } from "@japacity/sim";
import { checkContent, checkInvariants, hashState, step, upgradeState } from "@japacity/sim";
import type { Held, LogRow, SegmentRow, SnapshotRow } from "@japacity/store";

import type { Contents } from "../deps";

/** One held character inside a transaction: the state the rows so far leave, and everything still to write. */
export interface Live {
  id: string;
  account: string;
  /** The version stored before this transaction. */
  storedV: number;
  content: Content;
  state: State;
  refilledAt: number;
  storedRefilledAt: number;
  /** The segment new rows belong to. */
  segment: number;
  /** R-SERVER-021, R-SERVER-024: the segment opened at this load, with its base snapshot. */
  opened: { segment: SegmentRow; base: SnapshotRow } | null;
  rows: LogRow[];
  snapshots: SnapshotRow[];
}

/** R-SERVER-003: why a load was refused. */
export interface Diverged {
  character: string;
  account: string;
  v: number;
  detail: string;
}

export type Loaded = { ok: true; live: Live } | { ok: false; diverged: Diverged };

/** R-SERVER-023: the bundled content a segment names, by version and overlay. */
export function contentNamed(contents: Contents, version: string, overlay: string | undefined): Content {
  const found = [contents.current, contents.previous].find((each) => each !== null && each.version === version && each.overlay === overlay);
  // a segment under a content the server no longer bundles cannot be replayed; R-SERVER-023's sweep is meant to leave none.
  if (found === undefined || found === null) throw new Error(`The server bundles no content ${version} under overlay ${overlay ?? "none"}.`);
  return found;
}

/** R-SERVER-020: the segment in force. */
function segmentOf(held: Held): SegmentRow {
  const segment = held.segments.find((each) => each.segment === held.character.segment);
  if (segment === undefined) throw new Error(`Character ${held.character.id} has no row for its segment ${String(held.character.segment)}.`);
  return segment;
}

const sameContent = (a: Content, b: Content) => a.version === b.version && a.overlay === b.overlay;

const checked = new WeakMap<Content, string[]>();

/** R-SERVER-021: `checkContent` once for each content object the isolate holds. */
function contentProblems(content: Content): string[] {
  const known = checked.get(content);
  if (known !== undefined) return known;
  const problems = checkContent(content);
  checked.set(content, problems);
  return problems;
}

function overlayOf(content: Content): { overlay?: string } {
  return content.overlay === undefined ? {} : { overlay: content.overlay };
}

/** R-SERVER-004: a snapshot of `state` in `segment`, named by the content it runs under. */
export function snapshotOf(character: string, segment: number, content: Content, state: State): SnapshotRow {
  return { character, v: state.v, segment, content: content.version, ...overlayOf(content), state };
}

/**
 * R-SERVER-003, R-SERVER-021: replays the held tail under the segment's own
 * content and checks the hash, then carries the state to the current content
 * when the segment names another (opening a segment with that state as its
 * base). A tail row the replay rejects, or a hash that differs, is `diverged`.
 */
export function load(held: Held, contents: Contents, worlds: ReadonlyMap<number, World>): Loaded {
  const row = held.character;
  const segment = segmentOf(held);
  const content = contentNamed(contents, segment.content, segment.overlay);
  const refuse = (detail: string): Loaded => ({ ok: false, diverged: { character: row.id, account: row.account, v: row.v, detail } });

  let state = held.snapshot.state;
  for (const logged of held.tail) {
    const world = worlds.get(logged.tick);
    if (world === undefined) throw new Error(`No stored world for tick ${String(logged.tick)}.`);
    const result = step(state, logged.command, world, content, logged.sender);
    if (!result.ok) return refuse(`Version ${String(logged.v)} (${logged.command.type}) is rejected on replay with ${result.code}.`);
    state = result.state;
    if (state.v !== logged.v) return refuse(`Version ${String(logged.v)} replays to version ${String(state.v)}.`);
  }
  const last = held.tail.at(-1);
  if (last !== undefined && hashState(state) !== last.hash) return refuse(`Version ${String(last.v)} replays to another hash.`);
  if (state.v !== row.v) return refuse(`The log ends at version ${String(state.v)}, the row says ${String(row.v)}.`);

  const live: Live = {
    id: row.id,
    account: row.account,
    storedV: row.v,
    content,
    state,
    refilledAt: row.refilledAt,
    storedRefilledAt: row.refilledAt,
    segment: row.segment,
    opened: null,
    rows: [],
    snapshots: [],
  };
  const current = contents.current;
  if (sameContent(content, current)) return { ok: true, live };

  const upgraded = upgradeState(state, content, current);
  const problems = [...checkInvariants(upgraded, current), ...contentProblems(current)];
  // an upgrade that fails its checks has no reply code of its own; it is refused as an error and nothing is written.
  if (problems.length > 0) throw new Error(`Character ${row.id} does not upgrade from ${content.version} to ${current.version}: ${problems.join(" ")}`);
  const next = row.segment + 1;
  live.opened = {
    segment: { character: row.id, segment: next, fromV: upgraded.v, content: current.version, ...overlayOf(current), start: { base: upgraded } },
    base: snapshotOf(row.id, next, current, upgraded),
  };
  live.segment = next;
  live.content = current;
  live.state = upgraded;
  return { ok: true, live };
}

/**
 * R-SERVER-002, R-SERVER-003, R-SERVER-004: steps one command for a live
 * character against `world`, and on acceptance keeps its log row (with the
 * hash after it) and a snapshot when the version is a multiple of
 * `snapshotEvery`.
 */
export function apply(live: Live, command: Command, sender: Sender, world: World, at: number, snapshotEvery: number): StepResult {
  const result = step(live.state, command, world, live.content, sender);
  if (!result.ok) return result;
  const state = result.state;
  live.state = state;
  live.rows.push({ character: live.id, v: state.v, tick: world.tick, sender, command, hash: hashState(state), at });
  if (state.v % snapshotEvery === 0) live.snapshots.push(snapshotOf(live.id, live.segment, live.content, state));
  return result;
}
