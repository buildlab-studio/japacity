// Test helpers for the japacity and chapter tests. Only tests import this file.
//
// The route kind is built in parallel and may still be a stub, so these stand
// in for the two things the tests need from it, the way turn.test.ts stands
// in for the offer kind: putting a route in a state, and judging `route/state`.
// The stand-in uses its own test-only event, so it holds whatever the route
// kind's real events turn out to be.
import { checkWith } from "../engine/check";
import type { AnyKind, Registry } from "../engine/kind";
import { stepWith } from "../engine/step";
import type {
  Accepted,
  BaseEvent,
  Command,
  Ctx,
  Effect,
  Id,
  ReadCtx,
  Requirement,
  RequirementResult,
  RouteSlice,
  RouteStateName,
  Terms,
} from "../engine/types";
import { registry } from "../kinds";
import type { Game, Loose } from "../testing/play";
import type { Judge } from "./japacity.logic";

/** A test-only route event: the route is put straight into a state. */
interface RouteSet {
  type: "route/test-set";
  route: Id<"route">;
  to: RouteStateName;
}

function isRouteSet(event: BaseEvent): event is BaseEvent & RouteSet {
  return event.type === "route/test-set";
}

/** `route/state` as route.md reads it: the route's state is one of those listed. */
function judgeRouteState(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "route/state") throw new Error(`The stand-in cannot judge ${requirement.type}.`);
  const state = read.state.route[requirement.route]?.state ?? "unknown";
  return { met: requirement.in.includes(state) };
}

function standInRoute(kind: AnyKind, set: RouteSet | null): AnyKind {
  return {
    ...kind,
    commands: {
      ...kind.commands,
      // Any route command will do: the stand-in only needs one to carry the move.
      "route/depart": () => (set === null ? { ok: false, code: "not-legal", detail: "No move planned." } : [set]),
    },
    requirements: { ...kind.requirements, "route/state": judgeRouteState },
    evolve(slice: unknown, event: BaseEvent, state, content): unknown {
      if (!isRouteSet(event)) return kind.evolve(slice, event, state, content);
      const routes = slice as RouteSlice;
      const route = routes[event.route];
      if (route === undefined) throw new Error(`The state has no route ${event.route}.`);
      const month = state.turn.month;
      return {
        ...routes,
        [event.route]: {
          ...route,
          state: event.to,
          heardMonth: event.to === "unknown" ? null : (route.heardMonth ?? month),
          knownMonth: event.to === "unknown" || event.to === "heard" ? null : (route.knownMonth ?? month),
        },
      };
    },
  };
}

function standInOffer(kind: AnyKind, effects: Effect[]): AnyKind {
  return {
    ...kind,
    commands: {
      ...kind.commands,
      "offer/choose": (ctx: Ctx): BaseEvent[] => ctx.apply(effects, { source: "test", param: null, terms: {} }),
    },
  };
}

/**
 * The default registry with the route stand-in, and with `offer/choose`
 * carrying out `effects` so a test can reach another kind's effects through
 * the engine's own routing.
 */
export function testKinds(effects: Effect[] = [], set: RouteSet | null = null): Registry {
  return registry().map((kind): AnyKind => {
    if (kind.kind === "route") return standInRoute(kind, set);
    if (kind.kind === "offer") return standInOffer(kind, effects);
    return kind;
  });
}

/** A judge that runs through the test registry, for the japacity functions. */
export function judgeWith(read: ReadCtx, kinds: Registry = testKinds(), terms: Terms = {}): Judge {
  return (requirement) => checkWith(read, requirement, terms, kinds);
}

/** Sends a command through a registry and moves the game on. Throws if it is rejected. */
export function sendWith(kinds: Registry, game: Game, loose: Loose): Accepted {
  const command: Command = { ...loose, basedOn: game.state.v };
  const result = stepWith(kinds, game.state, command, game.world(), game.content);
  if (!result.ok) throw new Error(`${loose.type} was rejected with ${result.code}: ${result.detail}`);
  game.state = result.state;
  if (command.type === "turn/end") game.tick += 1;
  return result;
}

/** Puts a route in a state through the stand-in. */
export function setRoute(game: Game, route: Id<"route">, to: RouteStateName): Accepted {
  return sendWith(testKinds([], { type: "route/test-set", route, to }), game, { type: "route/depart", route });
}

/** Carries out effects as if an offer choice had them. */
export function carryOut(game: Game, effects: Effect[]): Accepted {
  return sendWith(testKinds(effects), game, { type: "offer/choose", offer: "test", choice: "test" });
}

/** Ends a turn, every slot resting, through the test registry so `route/state` is judged. */
export function endTurnWith(game: Game): Accepted {
  return sendWith(testKinds(), game, { type: "turn/end", slots: [] });
}
