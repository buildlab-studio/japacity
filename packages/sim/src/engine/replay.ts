// Saves and replay (engine:state-is-plain-data, server:save-is-list-of-segments, server:newer-content-upgrades-state and server:upgrade-state-is-pure, decision 0004). A save
// is a list of segments, each the commands accepted under one content version
// and one overlay. The first starts from the scenario and the seeds; a later
// one starts from a base state, the state the segment before ended in carried
// to the newer content by `upgradeState`. Replaying the segments in order
// rebuilds the state exactly.
import { hashState } from "./hash";
import { newState, upgradeState } from "./state";
import { step } from "./step";
import type { Command, Content, FlatSave, Id, Save, SaveSegment, SavedCommand, Sender, State, World } from "./types";

/** The shape of the save this code writes. */
const SAVE_SCHEMA = 3;

export interface Replayed {
  state: State;
  /** One entry per command, across every segment: the state version after it. */
  versions: number[];
}

/** One command as a replay steps it, with the state after it. */
export interface ReplayedCommand {
  entry: SavedCommand;
  state: State;
  content: Content;
}

export function isFlatSave(save: Save | FlatSave): save is FlatSave {
  return !("segments" in save);
}

/** A save in either shape as a save in segments: a flat save of schema 1 or 2 is one segment that starts from its scenario. */
export function loadSave(save: Save | FlatSave): Save {
  if (!isFlatSave(save)) return save;
  const segment: SaveSegment = {
    content: save.content,
    ...(save.overlay === undefined ? {} : { overlay: save.overlay }),
    start: { scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed },
    commands: save.commands,
  };
  return { schema: SAVE_SCHEMA, segments: [segment] };
}

/** The scenario and seeds the life began with, or null when its first segment starts from a base. */
export function lifeStart(save: Save | FlatSave): { scenario: Id<"scenario">; seed: string; worldSeed: string } | null {
  const first = loadSave(save).segments[0];
  return first === undefined || "base" in first.start ? null : first.start;
}

/** Every command of the save, segment after segment. */
export function savedCommands(save: Save | FlatSave): SavedCommand[] {
  return loadSave(save).segments.flatMap((segment) => segment.commands);
}

/** The segment commands are being added to. */
export function lastSegment(save: Save | FlatSave): SaveSegment {
  const last = loadSave(save).segments.at(-1);
  if (last === undefined) throw new Error("A save has at least one segment.");
  return last;
}

/**
 * The content a segment names, by its version and overlay. Given one content,
 * a segment under anything else is refused: numbers an overlay changed would
 * replay the commands to another life (engine:numbers-read-from-content).
 */
function contentFor(segment: SaveSegment, contents: Content | readonly Content[]): Content {
  if (!Array.isArray(contents)) {
    const content = contents as Content;
    if (segment.content !== content.version) throw new Error(`The save is for content ${segment.content}, not ${content.version}.`);
    if (segment.overlay !== content.overlay) {
      throw new Error(`The save was made under overlay ${segment.overlay ?? "none"}, not ${content.overlay ?? "none"}.`);
    }
    return content;
  }
  const found = (contents as readonly Content[]).find((content) => content.version === segment.content && content.overlay === segment.overlay);
  if (found === undefined) throw new Error(`No content ${segment.content} under overlay ${segment.overlay ?? "none"} is given for the save.`);
  return found;
}

/** The state a segment begins from (server:newer-content-upgrades-state): a later segment's base must be the upgrade of the state before it. */
function startOf(segment: SaveSegment, index: number, before: { state: State; content: Content } | null, content: Content, family: Save["family"]): State {
  const { start } = segment;
  if (before === null) {
    if (!("base" in start)) return newState(start.scenario, start.seed, content, family === undefined ? {} : { family });
    if (start.base.content !== content.version) throw new Error(`The first segment's base is for content ${start.base.content}, not ${content.version}.`);
    return start.base;
  }
  if (!("base" in start)) throw new Error(`Segment ${String(index)} starts a new life; only the first segment may.`);
  if (hashState(upgradeState(before.state, before.content, content)) !== hashState(start.base)) {
    throw new Error(`Segment ${String(index)}'s base is not the state the segment before ended in, carried to ${content.version}.`);
  }
  return start.base;
}

/**
 * Plays a save's segments in order and hands each accepted command to
 * `visit`. `contents` is the one content every segment ran under, or the
 * contents the segments name. A command the save says was accepted but which
 * is now rejected is a bug, so it throws.
 */
export function playSave(
  save: Save | FlatSave,
  contents: Content | readonly Content[],
  worldAt: (tick: number) => World,
  visit: (played: ReplayedCommand) => void = () => undefined,
): State {
  const { segments, family } = loadSave(save);
  let before: { state: State; content: Content } | null = null;
  for (const [index, segment] of segments.entries()) {
    const content = contentFor(segment, contents);
    let state = startOf(segment, index, before, content, family);
    for (const [at, entry] of segment.commands.entries()) {
      const result = step(state, entry.command, worldAt(entry.tick), content, entry.sender);
      if (!result.ok) {
        throw new Error(`Replay: segment ${String(index)}, command ${String(at)} (${entry.command.type}) was rejected with ${result.code}: ${result.detail}`);
      }
      state = result.state;
      visit({ entry, state, content });
    }
    before = { state, content };
  }
  if (before === null) throw new Error("A save has at least one segment.");
  return before.state;
}

/** Rebuilds a state from a save. `worldAt` gives the world at a tick; the stand-in world or a stored one. */
export function replay(save: Save | FlatSave, contents: Content | readonly Content[], worldAt: (tick: number) => World): Replayed {
  const versions: number[] = [];
  const state = playSave(save, contents, worldAt, (played) => versions.push(played.state.v));
  return { state, versions };
}

function segmentOf(content: Content, start: SaveSegment["start"]): SaveSegment {
  return { content: content.version, ...(content.overlay === undefined ? {} : { overlay: content.overlay }), start, commands: [] };
}

/** An empty save for a new life. */
export function newSave(scenario: Id<"scenario">, seed: string, worldSeed: string, content: Content): Save {
  return { schema: SAVE_SCHEMA, segments: [segmentOf(content, { scenario, seed, worldSeed })] };
}

/** The save with one more accepted command, in its last segment. */
export function recordCommand(save: Save, command: Command, tick: number, sender: Sender): Save {
  const last = lastSegment(save);
  return { ...save, segments: [...save.segments.slice(0, -1), { ...last, commands: [...last.commands, { command, tick, sender }] }] };
}

/** The save with a new segment under `content`, beginning from `base` (server:newer-content-upgrades-state, server:overlay-change-opens-segment). */
export function openSegment(save: Save, base: State, content: Content): Save {
  if (base.content !== content.version) throw new Error(`The base is for content ${base.content}, not ${content.version}.`);
  return { ...save, segments: [...save.segments, segmentOf(content, { base })] };
}
