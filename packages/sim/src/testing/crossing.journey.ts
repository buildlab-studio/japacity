// Test support for the whole-life rules that cross kinds: a recorded life
// replayed to a point and months played abroad. Nothing in the simulation
// imports this file.
import type { Accepted, Content, Id } from "../engine/types";
import type { Game } from "./play";
import { replayedGame } from "./recorded";

/** A recorded life replayed command by command until `until` holds after a command. */
export function replayTo(name: string, content: Content, until: (game: Game) => boolean): Game {
  const replayed = replayedGame(name, content);
  replayed.to(until);
  return replayed.game;
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

/** The one open instance of an obligation entry, or undefined. */
export function owing(game: Game, entry: Id<"obligation">) {
  return Object.values(game.state.obligation.items).find((item) => item.entry === entry);
}
