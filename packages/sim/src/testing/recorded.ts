// Test support for the recorded lives: a life started as its save starts it,
// with its commands to replay in order. Nothing in the simulation imports this file.
import { lifeStart, savedCommands } from "../engine/replay";
import type { Accepted, Content, SavedCommand, World } from "../engine/types";
import { lifeSaves } from "../goldens/lives.data";
import type { Game } from "./play";
import { start } from "./play";

export interface Replayed {
  game: Game;
  commands: SavedCommand[];
  /** Plays on from the last command played until one leaves `until` true, and returns that command's result. */
  to: (until: (game: Game) => boolean) => Accepted;
}

/** A recorded life on `content` at its start, nothing played yet, on the stand-in world unless `worldAt` is given. */
export function replayedGame(name: string, content: Content, worldAt?: (tick: number) => World): Replayed {
  const save = lifeSaves[name];
  if (save === undefined) throw new Error(`The ${name} life is not recorded.`);
  const first = lifeStart(save);
  if (first === null) throw new Error(`The ${name} life does not start a life.`);
  const game = start({ ...first, content, ...(worldAt === undefined ? {} : { worldAt }) });
  const commands = savedCommands(save);
  let index = 0;
  const to = (until: (game: Game) => boolean): Accepted => {
    while (index < commands.length) {
      const { command, sender } = commands[index]!;
      index += 1;
      const result = game.accept(command, sender);
      if (until(game)) return result;
    }
    throw new Error(`The ${name} life never got there.`);
  };
  return { game, commands, to };
}
