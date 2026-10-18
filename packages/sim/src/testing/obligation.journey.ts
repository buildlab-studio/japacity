// Test support for the credit and obligation rule tests abroad: a life flown to
// the UK through the real route kind, held there on a status with no end, and
// effects applied through the engine as an activity or an offer would apply
// them. Nothing in the simulation imports this file.
import type { Accepted, Content, Effect, Id, ObligationState, Terms } from "../engine/types";
import { answerFirst } from "./route.journey";
import { flown } from "./place.journey";
import { applyEffects } from "./route.journey";
import type { LifeOptions } from "./route.journey";
import type { Game } from "./play";

export const UK: Id<"country"> = "country.uk";
const SETTLED: Id<"status"> = "status.uk-settled";
export const RENT_ROOM: Id<"obligation"> = "obligation.rent-room-uk";
export const RENT_FLAT: Id<"obligation"> = "obligation.rent-flat-uk";
export const PHONE: Id<"obligation"> = "obligation.phone-uk";
export const UPKEEP: Id<"obligation"> = "obligation.upkeep-uk";
export const TUITION: Id<"obligation"> = "obligation.tuition";
export const CAR: Id<"obligation"> = "obligation.car";
export const SHORTFALL: Id<"obligation"> = "obligation.car-shortfall";
export const AGENT_DEBT: Id<"obligation"> = "obligation.agent-debt";

/** Ada flown to the UK on the student status: her room and upkeep are open, and her file is empty. */
export function abroad(content: Content, options: LifeOptions = {}): Game {
  return flown(content, options);
}

/** Abroad with a status that never lapses, so a test may play years there. */
export function settledAbroad(content: Content, options: LifeOptions = {}): Game {
  const game = flown(content, options);
  // A settled worker, not a student: the tuition the study gate opened on departure is not theirs.
  applyEffects(game, [{ type: "obligation/close", obligationType: "tuition" }, { type: "status/grant", status: SETTLED }]);
  return game;
}

/** Leaves exactly `bank` pence in the GBP bank pocket and none in cash. */
export function setPounds(game: Game, bank: number): void {
  const pocket = game.state.wallet.pockets.GBP;
  const effects: Effect[] = [];
  if (pocket.cash > 0) effects.push({ type: "money/take", currency: "GBP", pocket: "cash", amount: pocket.cash, reason: "mishap" });
  if (pocket.bank > bank) effects.push({ type: "money/take", currency: "GBP", pocket: "bank", amount: pocket.bank - bank, reason: "mishap" });
  if (pocket.bank < bank) effects.push({ type: "money/add", currency: "GBP", pocket: "bank", amount: bank - pocket.bank, reason: "gift" });
  if (effects.length > 0) applyEffects(game, effects);
}

/** Opens an obligation by effect, as an activity or an offer would, and returns the one new instance. */
export function openOwed(game: Game, obligation: Id<"obligation">, principal?: number, terms: Terms = {}): ObligationState {
  const before = new Set(Object.keys(game.state.obligation.items));
  const effect: Effect = { type: "obligation/open", obligation };
  if (principal !== undefined) effect.principal = principal;
  applyEffects(game, [effect], terms);
  const added = Object.values(game.state.obligation.items).filter((item) => !before.has(item.id));
  if (added.length !== 1) throw new Error(`Expected one new obligation, got ${String(added.length)}.`);
  return added[0]!;
}

/** The one open instance of an entry. */
export function owedOf(game: Game, entry: Id<"obligation">): ObligationState {
  const found = Object.values(game.state.obligation.items).filter((item) => item.entry === entry);
  if (found.length !== 1) throw new Error(`Expected one open ${entry}, found ${String(found.length)}.`);
  return found[0]!;
}

export function isOpen(game: Game, entry: Id<"obligation">): boolean {
  return Object.values(game.state.obligation.items).some((item) => item.entry === entry);
}

/** Ends one month with every slot resting, granting turns and answering a set piece first if needed. */
export function nextMonth(game: Game): Accepted {
  if (game.state.setpiece.open !== null) answerFirst(game);
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn();
}

/** Moves the credit file where the character is by `amount` points, as a payment would. */
export function markBy(game: Game, amount: number): void {
  applyEffects(game, [{ type: "credit/mark", amount }]);
}

/** Closes every open obligation of the types given, so nothing else is charged or reported. */
export function closeTypes(game: Game, ...types: ("rent" | "upkeep" | "phone" | "tuition")[]): void {
  applyEffects(
    game,
    types.map((obligationType): Effect => ({ type: "obligation/close", obligationType })),
  );
}

/** The mark of the file where the character is, as the view shows it. */
export function markOf(game: Game): number {
  const credit = game.view().credit;
  if (credit === null) throw new Error("The view shows no credit file here.");
  return credit.mark;
}
