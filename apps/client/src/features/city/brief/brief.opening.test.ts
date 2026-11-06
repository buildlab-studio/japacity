// Each life tile's carried brief opens in its own giver's words (chapter:first-chapter-mission-card,
// world:world-fills-the-screen): the Japa app's log and the mission card read the same line, the one written for that
// life's path. Real content, each tile played from the front door with its preset answers.
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { ARCHETYPES, archetypeOf } from "../../../shared/front-door/archetypes";
import { playTile } from "../../../shared/front-door/archetypes.testing";
import { newGame } from "../../../shared/testing/fixtures";
import { openingKey } from "../../../shared/words/sixteen";
import { words } from "../../../shared/words/text";
import { briefLog } from "./BriefLog";

const FIRST = "chapter.find-your-feet";

/** The opening each tile's life is written for: a degree, a trade with the settlement, a trade without, the water. */
const OPENING: Readonly<Record<string, string>> = {
  developer: `${FIRST}.open.prologue.degree`,
  nurse: `${FIRST}.open.prologue.degree`,
  accountant: `${FIRST}.open.prologue.degree`,
  writer: `${FIRST}.open.prologue.degree`,
  trader: `${FIRST}.open.prologue.capital`,
  "shop-worker": `${FIRST}.open.prologue.trade`,
  water: `${FIRST}.open.prologue.water`,
};

function played(id: string, seed: string) {
  const archetype = archetypeOf(id);
  if (archetype === null) throw new Error(`No ${id} tile.`);
  const game = newGame("scenario.prologue", seed);
  playTile(game, archetype);
  return game.view();
}

describe("the carried brief's opening, life by life", () => {
  test("[chapter:first-chapter-mission-card] given the tiles, when the table of openings is read, then it holds every tile and every opening has words", () => {
    expect(Object.keys(OPENING).sort()).toEqual(ARCHETYPES.map((tile) => tile.id).sort());
    for (const key of Object.values(OPENING)) expect(text[key]).toBeDefined();
  });

  test.each(ARCHETYPES.map((tile) => tile.id))("[chapter:first-chapter-mission-card] [world:world-fills-the-screen] given the %s tile at its first brief, when the opening is read for the mission card and for the Japa app's log, then both read that life's own line", (id) => {
    const view = played(id, "brief-places-0");
    expect(view.chapter.current).toBe(FIRST);
    expect(openingKey(view)).toBe(OPENING[id]);
    expect(briefLog(view).carried?.line).toBe(words(OPENING[id] ?? ""));
  });
});
