// R-ANALYTICS-001, R-ANALYTICS-008: what each accepted command did, found by
// stepping a character's stored rows again, as the admin tools do
// (admin/load.ts). Nothing here writes.
import type { BaseEvent, Command, ReportLine, State } from "@japacity/sim";
import { newState, step } from "@japacity/sim";
import type { LogRow } from "@japacity/store";

import { contentNamed, rowsBySegment, worldsFor } from "../admin/load";
import type { Loaded } from "../admin/load";
import type { ServerDeps } from "../deps";

/** One accepted command as the replay saw it. */
export interface Played {
  row: LogRow;
  /** False while the prologue was open when the command came. */
  afterPrologue: boolean;
  /** R-GUIDE-014: the turn the command belongs to, counting the `turn/end` commands after the prologue from 1. */
  turn: number;
  events: BaseEvent[];
  lines: ReportLine[];
}

/** R-ANALYTICS-008: where a life stood after its last command before a moment, for `economy/held`. */
export interface LifeAt {
  /** True while the years before are still open. */
  prologueOpen: boolean;
  /** `turn/end` commands after the prologue. */
  months: number;
  /** Naira in the bank, in cash and locked, in kobo. */
  nairaKobo: number;
}

export interface Life {
  account: string;
  played: Played[];
  /** Set when the replay was asked for a moment: the life after its last command before it, null with none. */
  atEnd?: LifeAt | null;
}

function lifeAt(state: State, months: number): LifeAt {
  const naira = state.wallet.pockets.NGN;
  return { prologueOpen: state.prologue.open, months, nairaKobo: naira.bank + naira.cash + naira.locked };
}

/**
 * Every stored row of the character, stepped from each segment's own start.
 * A row the replay now rejects is left out: only what the simulation accepts
 * is counted.
 */
export async function replayLife(deps: Pick<ServerDeps, "contents" | "stores">, character: string, until?: number): Promise<Loaded<Life>> {
  const held = await deps.stores.player.load(character);
  if (held === null) return { ok: false, code: "missing", detail: `No character ${character}.` };
  const log = await deps.stores.player.log(character, 0);
  const worlds = await worldsFor(deps, log);
  if (!worlds.ok) return worlds;
  const bySegment = rowsBySegment(held.segments, log);
  const played: Played[] = [];
  let turns = 0;
  let atEnd: LifeAt | null = null;
  for (const [index, segment] of held.segments.entries()) {
    const content = contentNamed(deps, segment.content, segment.overlay);
    if (content === null) return { ok: false, code: "no-content", detail: `Segment ${String(segment.segment)} ran under content ${segment.content}, which this server does not bundle.` };
    let state: State = "base" in segment.start ? segment.start.base : newState(segment.start.scenario, segment.start.seed, content);
    for (const row of bySegment[index] ?? []) {
      const world = worlds.value.get(row.tick);
      if (world === undefined) throw new Error(`The world for tick ${String(row.tick)} was not loaded.`);
      const command: Command = { ...row.command, basedOn: state.v };
      const afterPrologue = !state.prologue.open;
      const result = step(state, command, world, content, row.sender);
      if (!result.ok) continue;
      const ended = afterPrologue && command.type === "turn/end";
      if (ended) turns += 1;
      played.push({ row, afterPrologue, turn: ended ? turns : turns + 1, events: result.events, lines: result.lines });
      state = result.state;
      if (until !== undefined && row.at < until) atEnd = lifeAt(state, turns);
    }
  }
  return { ok: true, value: { account: held.character.account, played, ...(until === undefined ? {} : { atEnd }) } };
}
