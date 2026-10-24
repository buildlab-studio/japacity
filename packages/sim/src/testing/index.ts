// The test support other packages reach for, as @japacity/sim/testing: the
// game handle, the journeys that build a life to a point, the recorded lives
// and the simulated players. Nothing in the simulation's own code imports it.
export { answerPrologue, finishPrologue, playPrologueBy, start } from "./play";
export { replayedGame } from "./recorded";
export type { Replayed } from "./recorded";
export type { Game, StartOptions } from "./play";
export { miniContent } from "./miniContent";
export { NORTHGATE } from "./ids";
export { chapterPicks, FIRST_SESSION_MONTHS, playFirstSession, startingLives } from "./firstSession";
export type { FirstSession, NextStep, StartingLife, WaysOrder } from "./firstSession";
export {
  answerFirst,
  applyEffects,
  draw,
  drawnQuestions,
  northgateOffers,
  raiseSeed,
  readyLife,
  seedWhere,
  slot,
  toApplied,
  toKnown,
  uk,
  withEffects,
} from "./route.journey";
export { flownGraduate } from "./goal.journey";
export { ALWAYS_GRANTED, offeredSeed, positionOf } from "./place.journey";
export { bondWith } from "./read";
export { setPockets } from "./wallet";
export type { Held, SetOptions } from "./wallet";
export { measure } from "../engine/golden";
export type { Golden } from "../engine/golden";
export { goldenScripts } from "../goldens/scripts";
export { lifeSaves } from "../goldens/lives.data";
export { simulatedLifeSaves } from "../simulated-play/lives.data";
export { countryLifeSaves } from "../simulated-play/lives.countries.data";
export { FLIGHT_WINDOW, flightWindowOf, MASTERS_WINDOW, MONTHS_ABROAD } from "../simulated-play/lives.window";
export { runLife } from "../simulated-play/players";
export type { StrategyName } from "../simulated-play/players";
