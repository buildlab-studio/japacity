import { must, newCharacter, suiteForBoardStore } from "@japacity/store/contract";
import { expect, test } from "vitest";

import { freshHandle } from "../pglite.testing";
import { pgBoardStore } from "./boards";
import { pgPlayerStores } from "./player";

const fresh = freshHandle();

suiteForBoardStore(async () => {
  const handle = await fresh();
  return { boards: pgBoardStore(handle), player: pgPlayerStores(handle).player };
});

test("[account:deleted-data-removed-within-month] given a character on a board, when the character is removed, then its board row goes with it", async () => {
  const handle = await fresh();
  const boards = pgBoardStore(handle);
  const { player } = pgPlayerStores(handle);
  must(await player.create(newCharacter("c1")));
  await boards.setFigure({ character: "c1", account: "account-of-c1", scenario: "scenario.graduate", joinedAt: 1, joinedWeek: 1, listed: true, v: 1, before: null, figure: 50, week: 1 });
  await player.remove("c1");
  expect(await boards.get("c1")).toBeNull();
  expect(await boards.top({ when: "all-time", week: 1 }, 10)).toEqual([]);
});
