// Test support for the place and status rule tests: a ready life flown abroad
// through the real route kind, months played abroad, and a registry that
// records the obligation closes asked for. Nothing in the simulation imports this file.
import type { Registry } from "../engine/kind";
import type { BaseEvent, Content, Ctx, Effect, Id, ObligationType } from "../engine/types";
import { registry } from "../kinds";
import { answerFirst, draw, readyLife, seedWhere, toDecision } from "./route.journey";
import type { LifeOptions } from "./route.journey";
import { offerChanceBp } from "../route/route.logic";
import type { Game } from "./play";
import { NORTHGATE, UK_ROUTE } from "./ids";

/** Never refused: the floor and the ceiling of route:visa-refusal-chance pinned together. */
export const ALWAYS_GRANTED = { refusalMinBp: 0, refusalMaxBp: 0 };

/** The first seed whose first Northgate answer is an offer for a second upper. */
export function offeredSeed(content: Content): string {
  const school = content.school[NORTHGATE];
  if (school === undefined) throw new Error("The content has no Northgate.");
  return seedWhere((seed) => draw(seed, "school", 1, 10000) < offerChanceBp(school, 4, content.tuning.route));
}

/**
 * The real registry with `obligation/close` carried out by recording what was
 * asked for, in place of the obligation kind's own handler.
 */
export function recordingCloses(closed: ObligationType[]): Registry {
  return registry().map((kind) =>
    kind.kind !== "obligation"
      ? kind
      : {
          ...kind,
          effects: {
            ...kind.effects,
            "obligation/close": (_ctx: Ctx, effect: Effect): BaseEvent[] => {
              if (effect.type === "obligation/close") closed.push(effect.obligationType);
              return [];
            },
          },
        },
  );
}

/** A ready life on the UK study route, granted and flown: abroad on the student status. */
export function flown(content: Content, options: LifeOptions = {}): Game {
  const game = readyLife(content, { seed: offeredSeed(content), ...options, tuning: { ...ALWAYS_GRANTED, ...options.tuning } });
  toDecision(game);
  game.accept({ type: "route/depart", route: UK_ROUTE });
  return game;
}

/** Plays months with every slot resting, granting turns and answering any set piece as needed. */
export function playMonths(game: Game, count: number): void {
  for (let month = 0; month < count; month += 1) {
    if (game.state.setpiece.open !== null) answerFirst(game);
    if (game.state.turn.banked < 1) game.grant(game.content.tuning.turn.cap);
    game.endTurn();
  }
}

/** A place's position in the content, which must have one. */
export function positionOf(content: Content, id: string): { latE3: number; lonE3: number } {
  const position = content.place[id as Id<"place">]?.position;
  if (position === null || position === undefined) throw new Error(`${id} has no position.`);
  return position;
}
