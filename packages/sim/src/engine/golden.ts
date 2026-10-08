// Golden replays: a save and the figures it must produce, month by month, with
// a hash of the final state. Shared by the golden test and `pnpm bless`.
import { hashState } from "./hash";
import { playSave } from "./replay";
import type { Content, FlatSave, Save, World } from "./types";

export interface GoldenMonth {
  month: number;
  v: number;
  banked: number;
  nairaBank: number;
  hash: string;
}

export interface GoldenExpected {
  months: GoldenMonth[];
  finalHash: string;
}

export interface Golden extends GoldenExpected {
  name: string;
  /** A golden blessed before decision 0006 holds the flat save; `loadSave` reads either. */
  save: Save | FlatSave;
}

/** Replays a save, every segment in order, and measures what the golden records. Throws if any command is rejected. */
export function measure(save: Save | FlatSave, contents: Content | readonly Content[], worldAt: (tick: number) => World): GoldenExpected {
  const months: GoldenMonth[] = [];
  const state = playSave(save, contents, worldAt, ({ entry, state: after }) => {
    if (entry.command.type !== "turn/end") return;
    months.push({
      month: after.turn.month,
      v: after.v,
      banked: after.turn.banked,
      nairaBank: after.wallet.pockets.NGN.bank,
      hash: hashState(after),
    });
  });
  return { months, finalHash: hashState(state) };
}
