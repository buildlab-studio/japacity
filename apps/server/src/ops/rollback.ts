// The rollback tool (server:rollback-check-finds-divergence, server:rollback-apply-one-account and server:no-mass-rollback): one character at a time, always.
// The check reads only; the correction runs under that character's lock and
// touches no other row. Nothing here takes or walks a list of characters.
import type { LoadFailure, RollbackCheck, RollbackReport } from "@japacity/api";
import type { State } from "@japacity/sim";
import type { Held, LogRow, Writes } from "@japacity/store";

import type { ServerDeps } from "../dependencies";
import type { Loaded } from "./replay";
import { replaySegments, worldsFor } from "./replay";

type AdminDeps = Pick<ServerDeps, "contents" | "stores" | "now">;

export type RollbackApply =
  | { ok: true; corrected: false; report: RollbackReport }
  /** `segment` and `v` are the new segment and its base version; `audit` is the audit row holding the old rows. */
  | { ok: true; corrected: true; report: RollbackReport; segment: number; v: number; audit: number }
  | LoadFailure
  | { ok: false; code: "moved-on" | "refused"; detail: string };

interface Plan {
  held: Held;
  log: LogRow[];
  report: RollbackReport;
  state: State;
}

async function plan(deps: AdminDeps, character: string): Promise<Loaded<Plan>> {
  const held = await deps.stores.player.load(character);
  if (held === null) return { ok: false, code: "missing", detail: `No character ${character}.` };
  const first = held.segments[0];
  if (first === undefined) return { ok: false, code: "missing", detail: `Character ${character} has no stored segment.` };
  const log = await deps.stores.player.log(character, first.fromV);
  const worlds = await worldsFor(deps, log);
  if (!worlds.ok) return worlds;
  const replayed = replaySegments(deps, held.segments, log, worlds.value);
  if (!replayed.ok) return replayed;
  const { firstDiff, dropped, state } = replayed.value;
  return { ok: true, value: { held, log, state, report: { character, v: held.character.v, replayed: log.length, firstDiff, dropped } } };
}

/** server:rollback-check-finds-divergence: replays the character from the base of its first segment and reports the first version whose hash differs. Reads only. */
export async function rollbackCheck(deps: AdminDeps, character: string): Promise<RollbackCheck> {
  const planned = await plan(deps, character);
  return planned.ok ? { ok: true, report: planned.value.report } : planned;
}

/**
 * server:rollback-apply-one-account: corrects one character. The replayed state, with every command
 * now rejected left out, becomes the base of a new segment at the next
 * version, so the client's next command is `stale`. The old segments are
 * copied to the audit store before they are retired, in the same transaction.
 */
export async function rollbackApply(deps: AdminDeps, character: string): Promise<RollbackApply> {
  const planned = await plan(deps, character);
  if (!planned.ok) return planned;
  const { held, log, report, state } = planned.value;
  if (report.firstDiff === null) return { ok: true, corrected: false, report };

  const segment = held.character.segment + 1;
  const fromV = held.character.v + 1;
  const last = held.segments.at(-1);
  if (last === undefined) return { ok: false, code: "missing", detail: `Character ${character} has no stored segment.` };
  const overlay = last.overlay === undefined ? {} : { overlay: last.overlay };
  const base: State = { ...state, v: fromV };

  const done = await deps.stores.player.transact([character], async (rows, stores): Promise<{ writes: Writes; result: RollbackApply }> => {
    const locked = rows.characters[0];
    // The log was read before the lock; a command committed since means the replay is out of date.
    if (locked === undefined || locked.character.v !== held.character.v || locked.character.segment !== held.character.segment) {
      return { writes: {}, result: { ok: false, code: "moved-on", detail: `Character ${character} took a command during the check. Run the tool again.` } };
    }
    const dropped = report.dropped.map((each) => `${String(each.v)} ${each.type} (${each.code})`).join(", ");
    const audit = await stores.audit.retire({
      character,
      why: "rollback",
      at: deps.now(),
      note: `First difference at version ${String(report.firstDiff?.v)}. Dropped: ${dropped === "" ? "none" : dropped}. New segment ${String(segment)} at version ${String(fromV)}.`,
      segments: held.segments,
      log,
      snapshots: [held.snapshot],
    });
    return {
      writes: {
        characters: [
          {
            id: character,
            segment: { character, segment, fromV, content: last.content, ...overlay, start: { base } },
            snapshots: [{ character, v: fromV, segment, content: last.content, ...overlay, state: base }],
            retire: held.segments.map((each) => each.segment),
          },
        ],
      },
      result: { ok: true, corrected: true, report, segment, v: fromV, audit: audit.n },
    };
  });
  if (!done.ok) return { ok: false, code: "refused", detail: `${done.code}: ${done.detail}` };
  return done.value;
}
