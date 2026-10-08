// Test support for the whole-life rules that cross kinds: a recorded life
// replayed to a point, months played abroad, and the events of a result read
// by type. Nothing in the simulation imports this file.
import type { Accepted, BaseEvent, Content, Id, Save } from "../engine/types";
import { lifeSaves } from "../goldens/lives.data";
import type { Game } from "../testing/play";
import { start } from "../testing/play";

/** A recorded life replayed command by command until `until` holds after a command. */
export function replayTo(name: string, content: Content, until: (game: Game) => boolean): Game {
  const save: Save | undefined = lifeSaves[name];
  if (save === undefined) throw new Error(`${name} is not recorded.`);
  const game = start({ scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed, content });
  for (const { command, sender } of save.commands) {
    game.accept(command, sender);
    if (until(game)) return game;
  }
  throw new Error(`${name} never reaches the point asked for.`);
}

/** Answers any open set piece with its first answer, grants turns when the bank is empty, and ends the month with the slots given. */
export function month(game: Game, slots: Parameters<Game["endTurn"]>[0] = []): Accepted {
  for (let guard = 0; guard < 10 && game.state.setpiece.open !== null; guard += 1) {
    const question = game.view().setpiece?.question;
    const answer = question?.answers[0];
    if (question === undefined || question === null || answer === undefined) throw new Error("A set piece is open with no answer.");
    game.accept({ type: "setpiece/answer", question: question.id, answer });
  }
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn(slots);
}

export type Fields = BaseEvent & Record<string, unknown>;

export function eventsOf(result: { events: BaseEvent[] }, type: string): Fields[] {
  return result.events.filter((event) => event.type === type) as Fields[];
}

/** The one open instance of an obligation entry, or undefined. */
export function owing(game: Game, entry: Id<"obligation">) {
  return Object.values(game.state.obligation.items).find((item) => item.entry === entry);
}
