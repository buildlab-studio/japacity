// Test helpers for the japacity and chapter tests. Only tests import this file.
//
// Routes are moved by the real route kind: the tests play the journey in
// route.journey.ts. Two route states no rule reaches are written into
// the state by `writeRoute`. The offer kind's `offer/choose` is swapped for one
// that carries out given effects, so a test can set a quality or grant a
// document through the engine's own routing; the kinds that own those effects
// are the real ones.
import { checkWith } from "../engine/check";
import type { AnyKind, Registry } from "../engine/kind";
import { stepWith } from "../engine/step";
import type { Accepted, BaseEvent, Command, Ctx, Effect, Id, ReadCtx, RouteStateName, Terms } from "../engine/types";
import { registry } from "../kinds";
import type { Game, Loose } from "./play";
import type { Judge } from "../japacity/japacity.logic";

function effectsOffer(kind: AnyKind, effects: Effect[]): AnyKind {
  return {
    ...kind,
    commands: {
      ...kind.commands,
      "offer/choose": (ctx: Ctx): BaseEvent[] => ctx.apply(effects, { source: "test", param: null, terms: {} }),
    },
  };
}

/** The real registry with `offer/choose` carrying out `effects`. */
function testKinds(effects: Effect[] = []): Registry {
  return registry().map((kind): AnyKind => (kind.kind === "offer" ? effectsOffer(kind, effects) : kind));
}

/** A judge that runs through the test registry, for the japacity functions. */
export function judgeWith(read: ReadCtx, kinds: Registry = testKinds(), terms: Terms = {}): Judge {
  return (requirement) => checkWith(read, requirement, terms, kinds);
}

/** Sends a command through a registry and moves the game on. Throws if it is rejected. */
function sendWith(kinds: Registry, game: Game, loose: Loose): Accepted {
  const command: Command = { ...loose, basedOn: game.state.v };
  const result = stepWith(kinds, game.state, command, game.world(), game.content);
  if (!result.ok) throw new Error(`${loose.type} was rejected with ${result.code}: ${result.detail}`);
  game.state = result.state;
  if (command.type === "turn/end") game.tick += 1;
  return result;
}

/** Carries out effects as if an offer choice had them. */
export function carryOut(game: Game, effects: Effect[]): Accepted {
  return sendWith(testKinds(effects), game, { type: "offer/choose", offer: "test", choice: "test" });
}

/**
 * Writes a route's state straight into the game's state, for states a test
 * cannot reach in a few commands: `refused` comes only from a ban after a
 * refusal (route-gates:deception-bans-country), and no event takes a route back along an arrow
 * (route:routes-move-along-arrows).
 */
export function writeRoute(game: Game, route: Id<"route">, to: "refused" | "heard"): void {
  const held = game.state.route[route];
  if (held === undefined) throw new Error(`The state has no route ${route}.`);
  const state: RouteStateName = to;
  game.state = { ...game.state, route: { ...game.state.route, [route]: { ...held, state } } };
}
