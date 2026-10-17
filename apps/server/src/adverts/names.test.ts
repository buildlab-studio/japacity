import { content } from "@japacity/content";
import { hashState, standInWorld } from "@japacity/sim";
import { finishPrologue, start } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

describe("a real name on a place", () => {
  test("[R-ADVERT-018] given a world that puts a real name on a place, when a life is played through it, then every state is the same as under the made-up name", () => {
    const play = (named: boolean) => {
      const game = start({
        content,
        scenario: "scenario.tunde",
        worldAt: (tick) => {
          const world = standInWorld("world-1", tick, content);
          return named ? { ...world, placeNames: { "place.yaba-hub": { name: "Realname Hub", sign: "REALNAME HUB" } } } : world;
        },
      });
      finishPrologue(game);
      for (let turn = 0; turn < 3; turn += 1) game.endTurn();
      return game;
    };
    const plain = play(false);
    const named = play(true);
    expect(hashState(named.state)).toBe(hashState(plain.state));
    expect(named.view()).toEqual(plain.view());
  });
});
