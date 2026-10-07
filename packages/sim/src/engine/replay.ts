// Saves and replay (R-ENGINE-010). A save is the scenario, the seed, the
// content version and the accepted commands with their ticks; replaying it
// rebuilds the state exactly.
import { newState } from "./state";
import { step } from "./step";
import type { Command, Content, Sender, Save, State, World } from "./types";

export interface Replayed {
  state: State;
  /** One entry per command: the state version after it. */
  versions: number[];
}

/**
 * Rebuilds a state from a save. `worldAt` gives the world at a tick; the
 * stand-in world or a recorded one. A command the save says was accepted but
 * which is now rejected is a bug, so it throws.
 */
export function replay(save: Save, content: Content, worldAt: (tick: number) => World): Replayed {
  if (save.content !== content.version) throw new Error(`The save is for content ${save.content}, not ${content.version}.`);
  let state = newState(save.scenario, save.seed, content);
  const versions: number[] = [];
  save.commands.forEach(({ command, tick, sender }, index) => {
    const result = step(state, command, worldAt(tick), content, sender);
    if (!result.ok) {
      throw new Error(`Replay: command ${String(index)} (${command.type}) was rejected with ${result.code}: ${result.detail}`);
    }
    state = result.state;
    versions.push(state.v);
  });
  return { state, versions };
}

/** An empty save for a new life. */
export function newSave(scenario: Save["scenario"], seed: string, worldSeed: string, content: Content): Save {
  return { schema: 1, content: content.version, scenario, seed, worldSeed, commands: [] };
}

/** The save with one more accepted command. */
export function recordCommand(save: Save, command: Command, tick: number, sender: Sender): Save {
  return { ...save, commands: [...save.commands, { command, tick, sender }] };
}
