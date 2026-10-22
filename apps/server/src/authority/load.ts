// Loading a character under its lock (server:log-rows-hash-state,
// server:snapshots-bound-replay, server:save-is-list-of-segments, server:newer-content-upgrades-state, server:overlay-change-opens-segment; clock.md
// clock:command-uses-stamped-tick): the latest snapshot, the log after it replayed against the
// stored world of each row's tick, the hash compared with the last row's, and
// the state carried to the current content when its segment names another.
import type { Command, Content, ReportLine, Sender, State, StepResult, World } from "@japacity/sim";
import { checkContent, checkInvariants, hashState, step, upgradeState } from "@japacity/sim";
import type { Held, LogRow, SegmentRow, SnapshotRow } from "@japacity/store";

import type { Contents } from "../dependencies";
import { namedContent } from "../switches/dials";

/** One held character inside a transaction: the state the rows so far leave, and everything still to write. */
export interface Live {
  id: string;
  account: string;
  /** The version stored before this transaction. */
  storedV: number;
  content: Content;
  state: State;
  /** server:daily-money-report: the state as loaded, before this transaction's commands, for the money report's mark. */
  loaded: State;
  refilledAt: number;
  storedRefilledAt: number;
  /** The segment new rows belong to. */
  segment: number;
  /** server:newer-content-upgrades-state, server:overlay-change-opens-segment: the segment opened at this load, with its base snapshot. */
  opened: { segment: SegmentRow; base: SnapshotRow } | null;
  rows: LogRow[];
  snapshots: SnapshotRow[];
  /**
   * lottery:payment-waits-for-away-player, server:client-never-predicts: the report lines of the rows its player did
   * not send (the authority's and the stand-in's), from the replayed tail and
   * this transaction, by the version each row made, for the view's reply.
   */
  sentFor: { v: number; lines: ReportLine[] }[];
}

/** server:log-rows-hash-state: why a load was refused. */
export interface Diverged {
  character: string;
  account: string;
  v: number;
  detail: string;
}

export type Loaded = { ok: true; live: Live } | { ok: false; diverged: Diverged };

/** server:older-contents-bundled: the bundled content a segment names, by version and overlay. */
export function contentNamed(contents: Contents, version: string, overlay: string | undefined): Content {
  const found = namedContent(contents, version, overlay);
  // A segment under a content the server no longer bundles cannot be replayed (server:older-contents-bundled).
  if (found === null) throw new Error(`The server bundles no content ${version} under overlay ${overlay ?? "none"}.`);
  return found;
}

/** server:save-is-list-of-segments: the segment in force. */
function segmentOf(held: Held): SegmentRow {
  const segment = held.segments.find((each) => each.segment === held.character.segment);
  if (segment === undefined) throw new Error(`Character ${held.character.id} has no row for its segment ${String(held.character.segment)}.`);
  return segment;
}

const sameContent = (a: Content, b: Content) => a.version === b.version && a.overlay === b.overlay;

const checked = new WeakMap<Content, string[]>();

/** server:newer-content-upgrades-state: `checkContent` once for each content object the isolate holds. */
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

/** server:snapshots-bound-replay: a snapshot of `state` in `segment`, named by the content it runs under. */
export function snapshotOf(character: string, segment: number, content: Content, state: State): SnapshotRow {
  return { character, v: state.v, segment, content: content.version, ...overlayOf(content), state };
}

/**
 * server:log-rows-hash-state, server:newer-content-upgrades-state: replays the held tail under the segment's own
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
  const sentFor: Live["sentFor"] = [];
  for (const logged of held.tail) {
    const world = worlds.get(logged.tick);
    if (world === undefined) throw new Error(`No stored world for tick ${String(logged.tick)}.`);
    const result = step(state, logged.command, world, content, logged.sender);
    if (!result.ok) return refuse(`Version ${String(logged.v)} (${logged.command.type}) is rejected on replay with ${result.code}.`);
    state = result.state;
    if (state.v !== logged.v) return refuse(`Version ${String(logged.v)} replays to version ${String(state.v)}.`);
    if (logged.sender !== "player") sentFor.push({ v: logged.v, lines: result.lines });
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
    loaded: state,
    refilledAt: row.refilledAt,
    storedRefilledAt: row.refilledAt,
    segment: row.segment,
    opened: null,
    rows: [],
    snapshots: [],
    sentFor,
  };
  const current = contents.current;
  if (sameContent(content, current)) return { ok: true, live };

  const upgraded = upgradeState(state, content, current);
  const problems = [...checkInvariants(upgraded, current), ...contentProblems(current)];
  // An upgrade that fails its checks has no reply code of its own; it is refused as an error and nothing is written.
  if (problems.length > 0) throw new Error(`Character ${row.id} does not upgrade from ${content.version} to ${current.version}: ${problems.join(" ")}`);
  const next = row.segment + 1;
  live.opened = {
    segment: { character: row.id, segment: next, fromV: upgraded.v, content: current.version, ...overlayOf(current), start: { base: upgraded } },
    base: snapshotOf(row.id, next, current, upgraded),
  };
  live.segment = next;
  live.content = current;
  live.state = upgraded;
  live.loaded = upgraded;
  return { ok: true, live };
}

/**
 * server:one-command-one-transaction, server:log-rows-hash-state, server:snapshots-bound-replay: steps one command for a live
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
  if (sender !== "player") live.sentFor.push({ v: state.v, lines: result.lines });
  if (state.v % snapshotEvery === 0) live.snapshots.push(snapshotOf(live.id, live.segment, live.content, state));
  return result;
}
