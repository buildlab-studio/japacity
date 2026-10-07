// Golden replays: a save and the figures it must produce, month by month, with
// a hash of the final state. Shared by the golden test and `pnpm bless`.
import { newState } from "./state";
import { step } from "./step";
import { hashState } from "./hash";
import type { Content, Save, World } from "./types";

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
  save: Save;
}

/** Replays a save and measures what the golden records. Throws if any command is rejected. */
export function measure(save: Save, content: Content, worldAt: (tick: number) => World): GoldenExpected {
  let state = newState(save.scenario, save.seed, content);
  const months: GoldenMonth[] = [];
  save.commands.forEach(({ command, tick, sender }, index) => {
    const result = step(state, command, worldAt(tick), content, sender);
    if (!result.ok) throw new Error(`Golden: command ${String(index)} (${command.type}) was rejected with ${result.code}: ${result.detail}`);
    state = result.state;
    if (command.type === "turn/end") {
      months.push({
        month: state.turn.month,
        v: state.v,
        banked: state.turn.banked,
        nairaBank: state.wallet.pockets.NGN.bank,
        hash: hashState(state),
      });
    }
  });
  return { months, finalHash: hashState(state) };
}
