// What rule tests read off a game and off a step's result, and the plain month
// they end. Nothing in the simulation imports this file.
import { check } from "../engine/check";
import type { Accepted, BaseEvent, Id, ReadCtx, ReportLine, Requirement, RouteState } from "../engine/types";
import type { Game } from "./play";

/** The game as the requirement checks and the kinds' reads see it. */
export function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

/** Ends a month resting, granting turns first when none are banked. */
export function restMonth(game: Game): Accepted {
  if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
  return game.endTurn();
}

/** The naira held, cash and bank. */
export function naira(game: Game): number {
  const { cash, bank } = game.state.wallet.pockets.NGN;
  return cash + bank;
}

/** The pounds held, cash and bank. */
export function pounds(game: Game): number {
  const { cash, bank } = game.state.wallet.pockets.GBP;
  return cash + bank;
}

/** The naira held in cash. */
export function cash(game: Game): number {
  return game.state.wallet.pockets.NGN.cash;
}

/** A quality's value in the state, 0 when it was never set. */
export function quality(game: Game, id: Id<"quality">): number {
  return game.state.quality[id] ?? 0;
}

/** Whether a requirement holds for the game now. */
export function judge(game: Game, requirement: Requirement): boolean {
  return check(readOf(game), requirement).met;
}

/** A route the state holds. */
export function routeOf(game: Game, route: Id<"route">): RouteState {
  return game.state.route[route]!;
}

/** An event with its fields open to reading. */
export type Fields = BaseEvent & Record<string, unknown>;

/** The events of a result with this type. */
export function eventsOf(result: { events: BaseEvent[] }, type: string): Fields[] {
  return result.events.filter((event) => event.type === type) as Fields[];
}

/** What left a pocket. */
export function debits(result: { events: BaseEvent[] }): BaseEvent[] {
  return result.events.filter((event) => event.type === "wallet/debited");
}

export interface MoneyEvent {
  type: string;
  currency: string;
  pocket: string;
  amount: number;
  reason: string;
}

/** The credits and debits under a reason. */
export function moneyOf(result: { events: BaseEvent[] }, reason: string): MoneyEvent[] {
  return result.events.filter((event): event is BaseEvent & MoneyEvent => (event.type === "wallet/credited" || event.type === "wallet/debited") && (event as unknown as MoneyEvent).reason === reason);
}

/** The keys of a result's report lines. */
export function keys(result: Accepted): string[] {
  return result.lines.map((line) => line.key);
}

/** The keys of the route's report lines. */
export function routeKeys(lines: ReportLine[]): string[] {
  return lines.filter((line) => line.key.startsWith("line.route.")).map((line) => line.key);
}

/** The ride a result took, if any. */
export function rode(result: Accepted): BaseEvent | undefined {
  return result.events.find((event) => event.type === "place/rode");
}

/** The chapters a result closed. */
export function closed(result: { events: { type: string }[] }): unknown[] {
  return result.events.filter((event) => event.type === "chapter/closed");
}

/** The naira salaries a result paid. */
export function salaries(result: Accepted): number[] {
  return result.events
    .filter((event): event is BaseEvent & { reason: string; amount: number; currency: string } => event.type === "wallet/credited" && (event as unknown as { reason: string }).reason === "salary")
    .filter((event) => event.currency === "NGN")
    .map((event) => event.amount);
}
