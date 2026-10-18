// The test support other packages reach for, as @japacity/sim/testing: the
// game handle, the journeys that build a life to a point, the recorded lives
// and the simulated players. Nothing in the simulation's own code imports it.
export { start, finishPrologue } from "./play";
export type { Game, StartOptions } from "./play";
export { miniContent } from "./miniContent";
export { chapterPicks, FIRST_SESSION_MONTHS, playFirstSession, startingLives } from "./firstSession";
export type { FirstSession, NextStep, StartingLife, WaysOrder } from "./firstSession";
export {
  answerFirst,
  applyEffects,
  draw,
  drawnQuestions,
  NORTHGATE,
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
export { flownAda } from "./goal.journey";
export { ALWAYS_GRANTED, offeredSeed, positionOf } from "./place.journey";
export { bondWith } from "./read";
export { measure } from "../engine/golden";
export type { Golden } from "../engine/golden";
export { goldenScripts } from "../goldens/scripts";
export { lifeSaves } from "../goldens/lives.data";
export { newLifeSaves } from "../sweep/lives.data";
export { countryLifeSaves } from "../sweep/lives.countries.data";
export { FLIGHT_WINDOW, MONTHS_ABROAD } from "../sweep/lives.window";
export { runLife } from "../sweep/players";
export type { StrategyName } from "../sweep/players";
