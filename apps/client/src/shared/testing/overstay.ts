// The overstay's stages as the engine plays them (status:grace-before-overstaying, status:detection-gives-notice): the graduate flown
// to London on the content the game ships, its student visa lost. Detection is a draw on the status stream, so the content
// here fixes the UK overstayer's chance at never or certain and nothing else; the screens then read the engine's own view.
import { content } from "@japacity/content";
import type { Content, Id, PlayerView } from "@japacity/sim";
import { applyEffects, type Game, replayedGame, setPockets } from "@japacity/sim/testing";

import { ABROAD_POCKETS } from "./fixtures";

const UK_OVERSTAYER: Id<"status"> = "status.uk-overstayer";

/** The content the game ships with the UK overstayer's detection fixed: never, or every month past the grace. */
function detecting(sure: boolean): Content {
  const entry = content.status[UK_OVERSTAYER]!;
  return { ...content, status: { ...content.status, [UK_OVERSTAYER]: { ...entry, detectBp: sure ? 10_000 : 0, rentCheckBp: 0 } } };
}

/** The graduate's careful life replayed to the flight with the pockets of `ABROAD_POCKETS` and its student visa lost: the first month of the grace. */
export function lapsedGame(sure = false): Game {
  const { game, commands } = replayedGame("graduate-careful", detecting(sure));
  for (const { command, sender } of commands) game.accept(command, sender);
  setPockets(game, ABROAD_POCKETS);
  applyEffects(game, [{ type: "status/lose" }]);
  return game;
}

/** Months played with the slots left empty. */
function play(game: Game, months: number): void {
  for (let month = 0; month < months; month += 1) game.endTurn([]);
}

/** In the grace: the month the visa was lost. */
export function graceView(): PlayerView {
  return lapsedGame().view();
}

/** Pounds in the bank for a fare home at any time of year. */
const FARE_IN_HAND = { GBP: 200_000 } as const;

/** Past the grace, never noticed: overstaying, with the fare home in the bank. */
export function overstayingGame(): Game {
  const game = lapsedGame();
  play(game, 2);
  setPockets(game, FARE_IN_HAND);
  return game;
}

/** Past the grace and noticed: a notice before removal, with the fare home in the bank. */
export function noticeGame(): Game {
  const game = lapsedGame(true);
  play(game, 2);
  setPockets(game, FARE_IN_HAND);
  return game;
}
