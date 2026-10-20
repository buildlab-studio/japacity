// Test support for the goal and chapter rule tests of the whole life: the graduate's
// recorded life up to the flight, then months abroad played through `step`.
// Nothing in the simulation imports this file.
import type { Accepted, Content, Id, SlotPick, World } from "../engine/types";
import { lifeSaves } from "../goldens/lives.data";
import type { Game } from "./play";
import { replayedGame } from "./recorded";
import { standInWorld } from "../world/standIn";
import { HUNT } from "./ids";

const JOB_OFFER: Id<"offer"> = "offer.job";

/**
 * The graduate's careful life, replayed command by command up to and including the
 * flight. The world is the stand-in with one change: the tick of the flight,
 * in which the first month abroad is played, is a December tick, and every
 * twelfth after it, whatever month the recorded life flies in, so the tests
 * of the visit do not move with it.
 */
export function flownGraduate(content: Content): Game {
  const save = lifeSaves["graduate-careful"];
  if (save === undefined) throw new Error("The graduate-careful life is not recorded.");
  const flight = save.commands[save.commands.length - 1]?.tick ?? 0;
  const worldAt = (tick: number): World => {
    const world = standInWorld(save.worldSeed, tick, content);
    // The flight and the first month abroad are played in the same tick.
    if (tick < flight) return world;
    const december = (tick - flight) % 12 === 0 ? 1 : 0;
    return { ...world, vars: { ...world.vars, "var.season-december": december } };
  };
  const { game, commands } = replayedGame("graduate-careful", content, worldAt);
  for (const { command, tick, sender } of commands) {
    if (game.tick !== tick) throw new Error(`The replay is at tick ${String(game.tick)}, the save at ${String(tick)}.`);
    // The handle fills `basedOn` from the state.
    game.accept(command, sender);
  }
  if (game.state.place.where !== "abroad") throw new Error("The graduate's recorded life ends before it is abroad.");
  return game;
}

/**
 * Answers the open set piece, if any, each question with its first answer or
 * its last. In the December scene the first answer is the one that costs nothing.
 */
export function answerOpen(game: Game, pick: "first" | "last" = "first"): void {
  for (let guard = 0; guard < 10 && game.state.setpiece.open !== null; guard += 1) {
    const question = game.view().setpiece?.question;
    if (question === undefined || question === null) throw new Error("A set piece is open with no question.");
    const answer = pick === "first" ? question.answers[0] : question.answers[question.answers.length - 1];
    if (answer === undefined) throw new Error(`${question.id} has no answers.`);
    game.accept({ type: "setpiece/answer", question: question.id, answer });
  }
}

/**
 * One month abroad as a careful player plays it: any set piece answered first,
 * turns granted when the bank is empty, a job hunted for while there is none
 * and the job taken when it is offered. Other slots are the ones given.
 */
export function monthAbroad(game: Game, slots: SlotPick[] = []): Accepted {
  answerOpen(game);
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  const hunt = game.view().activities.find((option) => option.id === HUNT && option.allowed);
  const job = game.state.activity.job === null && hunt?.params?.[0] !== undefined ? [{ activity: HUNT, param: hunt.params[0] }] : [];
  const result = game.endTurn([...job, ...slots].slice(0, game.view().freeSlots));
  for (const offer of game.view().offers.filter((item) => item.entry === JOB_OFFER)) game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
  return result;
}

/** Plays months abroad until the given chapter is current. Returns the turn it opened on. */
export function playUntil(game: Game, chapter: Id<"chapter">, most = 24): Accepted {
  for (let month = 0; month < most; month += 1) {
    const result = monthAbroad(game);
    if (game.state.chapter.current === chapter) return result;
  }
  throw new Error(`${chapter} did not open in ${String(most)} months.`);
}
