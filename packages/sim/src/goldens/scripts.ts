// The saves the goldens are measured from. `pnpm bless` turns each into a
// JSON file beside this one. Add a script here, run bless, commit both.
import type { Save, SlotPick } from "../engine/types";
import { lifeSaves } from "./lives.data";

export interface GoldenScript {
  name: string;
  save: Save;
}

const rest: SlotPick = { activity: "activity.rest", param: null };
const study: SlotPick = { activity: "activity.study", param: null };

function turns(count: number, startTick: number, slots: SlotPick[] = []): Save["commands"] {
  const commands: Save["commands"] = [];
  for (let i = 0; i < count; i += 1) {
    commands.push({ command: { type: "turn/end", slots, basedOn: -1 }, tick: startTick + i, sender: "player" });
  }
  return commands;
}

/** Fills in `basedOn` from position, since every command here is accepted. */
function numbered(commands: Save["commands"]): Save["commands"] {
  return commands.map((entry, index) => ({ ...entry, command: { ...entry.command, basedOn: index } }));
}

/** The scripts on the mini content. */
export const miniScripts: GoldenScript[] = [
  {
    name: "mini-plain-resting",
    save: {
      schema: 1,
      content: "mini.1",
      scenario: "scenario.plain",
      seed: "golden-plain",
      worldSeed: "golden-world",
      commands: numbered(turns(6, 0, [rest, rest, rest])),
    },
  },
  {
    name: "mini-worker-studying",
    save: {
      schema: 1,
      content: "mini.1",
      scenario: "scenario.worker",
      seed: "golden-worker",
      worldSeed: "golden-world",
      commands: numbered([
        ...turns(3, 0, [study]),
        { command: { type: "turns/grant", count: 2, basedOn: -1 }, tick: 3, sender: "authority" },
        ...turns(3, 3, []),
      ]),
    },
  },
];

/**
 * The three first-milestone lives, played through the real content by the
 * simulated players and recorded by tools/record-lives.ts (`pnpm record:lives`).
 * sweep/lives.test.ts replays them as well.
 */
export const lifeScripts: GoldenScript[] = Object.entries(lifeSaves).map(([name, save]) => ({ name, save }));

/** Every script with a blessed golden. */
export const goldenScripts: GoldenScript[] = [...miniScripts, ...lifeScripts];
