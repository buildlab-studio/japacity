// The saves a browser test hands the client (live.ts seedSave): a life as the page keeps it, and the recorded lives of
// the goldens (packages/sim/src/goldens/lives.data.ts) cut where the test wants them to stand.
import type { FlatSave } from "@japacity/sim";
import { lifeSaves } from "@japacity/sim/testing";

/** A save as the page keeps it, with the clock from its start. */
export function kept(save: unknown): string {
  return JSON.stringify({ save, clock: { anchor: 0 } });
}

/** A recorded life's save by its name; throws when the goldens hold no such life. */
export function recorded(name: string): FlatSave {
  const save = lifeSaves[name];
  if (save === undefined) throw new Error(`No recorded life ${name}.`);
  return save;
}

/** A recorded life as the page keeps it, its commands cut before `upTo` (counted from the end when negative), or whole when null. */
export function recordedUpTo(name: string, upTo: number | null): string {
  const save = recorded(name);
  return kept({ ...save, commands: upTo === null ? save.commands : save.commands.slice(0, upTo) });
}

/** The graduate's recorded life up to the month before the flight: every command but the flight. */
export function graduateBeforeFlight(): string {
  return recordedUpTo("graduate-careful", -1);
}
