import { content } from "@japacity/content";
import type { Content } from "@japacity/sim";
import { hashState } from "@japacity/sim";
import { describe, expect, test } from "vitest";

// The sim's own test handle, as the client's fixtures reach it: the package exports only its contract.
import { finishPrologue, start } from "../../../../packages/sim/src/testing/play";

function played(of: Content) {
  const game = start({ content: of, scenario: "scenario.tunde" });
  finishPrologue(game);
  return game;
}

describe("adverts and the simulation", () => {
  test("[R-ADVERT-007] given the same life played with the slots and with none, when the turns are ended, then the states are identical and hold no advert", () => {
    const play = (of: Content) => {
      const game = played(of);
      for (let turn = 0; turn < 3; turn += 1) game.endTurn();
      return game;
    };
    const withAdverts = play(content);
    const without = play({ ...content, advert: {} });
    expect(hashState(withAdverts.state)).toBe(hashState(without.state));
    expect(Object.keys(withAdverts.state)).not.toContain("advert");
    expect(typeof withAdverts.view().adverts).toBe("boolean");
  });

  test("[R-ADVERT-003] given a life in its first chapter, when that chapter is marked noAdverts in content, then the view says no advert may show", () => {
    const game = played(content);
    const current = game.state.chapter.current;
    expect(game.view().adverts).toBe(true);
    const chapter = current === null ? undefined : content.chapter[current];
    if (chapter === undefined) throw new Error("A new life has a current chapter.");
    const quiet: Content = { ...content, chapter: { ...content.chapter, [chapter.id]: { ...chapter, noAdverts: true } } };
    expect(played(quiet).view().adverts).toBe(false);
  });
});
