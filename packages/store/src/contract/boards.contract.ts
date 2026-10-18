import { describe, expect, test } from "vitest";

import type { BoardQuery, BoardStore, FigureWrite } from "../boards";
import type { PlayerStore } from "../types";
import { must, newCharacter } from "./contract.testing";

/** A board store and the player store its rows belong to (a row names a character that exists). */
export interface BoardStores {
  boards: BoardStore;
  player: PlayerStore;
}

const WEEK = 2_000;

/** A write for `character`, made in WEEK at version 1, with no figure before. */
function write(character: string, over: Partial<FigureWrite> = {}): FigureWrite {
  return {
    character,
    account: `account-of-${character}`,
    scenario: "scenario.ada",
    joinedAt: 1_000,
    joinedWeek: WEEK,
    listed: true,
    v: 1,
    before: null,
    figure: 0,
    week: WEEK,
    ...over,
  };
}

const allTime: BoardQuery = { when: "all-time", week: WEEK };
const thisWeek: BoardQuery = { when: "this-week", week: WEEK };

/** The contract every BoardStore keeps. `make` returns empty stores each time it is called. */
export function suiteForBoardStore(make: () => Promise<BoardStores>): void {
  async function stores(...characters: string[]): Promise<BoardStore> {
    const made = await make();
    for (const character of characters) must(await made.player.create(newCharacter(character)));
    return made.boards;
  }

  describe("BoardStore contract", () => {
    test("[R-CITY-039] given no row, when a commit writes a figure, then the row holds it and its week starts at the figure before", async () => {
      const boards = await stores("c1");
      expect(await boards.setFigure(write("c1", { before: 20, figure: 35 }))).toBe(true);
      expect(await boards.get("c1")).toEqual({
        character: "c1",
        account: "account-of-c1",
        scenario: "scenario.ada",
        joinedAt: 1_000,
        joinedWeek: WEEK,
        listed: true,
        v: 1,
        figure: 35,
        week: WEEK,
        weekStart: 20,
      });
      expect(await boards.top(thisWeek, 10)).toEqual([{ rank: 1, character: "c1", account: "account-of-c1", scenario: "scenario.ada", joinedAt: 1_000, score: 15 }]);
      expect(await boards.get("nobody")).toBeNull();
    });

    test("[R-CITY-039] given a row from last week, when a commit this week writes, then the week starts at the figure the row held and the rise counts from it", async () => {
      const boards = await stores("c1");
      await boards.setFigure(write("c1", { week: WEEK - 1, before: 0, figure: 40 }));
      await boards.setFigure(write("c1", { v: 2, before: 40, figure: 55 }));
      expect(await boards.get("c1")).toMatchObject({ figure: 55, week: WEEK, weekStart: 40 });
      expect((await boards.top(thisWeek, 10))[0]?.score).toBe(15);

      await boards.setFigure(write("c1", { v: 3, before: 55, figure: 60 }));
      expect(await boards.get("c1")).toMatchObject({ figure: 60, week: WEEK, weekStart: 40 });
    });

    test("[R-CITY-039] given a row from last week, when the week has turned and nothing was written, then its rise is 0 before the job and after it", async () => {
      const boards = await stores("c1");
      await boards.setFigure(write("c1", { week: WEEK - 1, before: 10, figure: 40 }));
      expect((await boards.top(thisWeek, 10))[0]?.score).toBe(0);
      expect((await boards.top({ when: "this-week", week: WEEK - 1 }, 10))[0]?.score).toBe(30);

      expect(await boards.turnWeek(WEEK)).toBe(1);
      expect(await boards.get("c1")).toMatchObject({ figure: 40, week: WEEK, weekStart: 40 });
      expect((await boards.top(thisWeek, 10))[0]?.score).toBe(0);
    });

    test("[R-CITY-039] given the week turned once, when the job runs again for the same week or an earlier one, then nothing moves", async () => {
      const boards = await stores("c1", "c2");
      await boards.setFigure(write("c1", { week: WEEK - 1, figure: 40 }));
      await boards.setFigure(write("c2", { week: WEEK, before: 5, figure: 50 }));
      expect(await boards.turnWeek(WEEK)).toBe(1);
      expect(await boards.turnWeek(WEEK)).toBe(0);
      expect(await boards.turnWeek(WEEK - 1)).toBe(0);
      expect(await boards.get("c2")).toMatchObject({ week: WEEK, weekStart: 5 });
    });

    test("[R-CITY-039] given a stored version, when a write comes at it or under it, then nothing changes; one above it is kept", async () => {
      const boards = await stores("c1");
      await boards.setFigure(write("c1", { v: 5, figure: 30 }));
      expect(await boards.setFigure(write("c1", { v: 5, figure: 90 }))).toBe(false);
      expect(await boards.setFigure(write("c1", { v: 4, figure: 90 }))).toBe(false);
      expect((await boards.get("c1"))?.figure).toBe(30);
      expect(await boards.setFigure(write("c1", { v: 6, figure: 31 }))).toBe(true);
      expect((await boards.get("c1"))?.figure).toBe(31);
    });

    test("[R-CITY-040] given equal figures, when the board is ranked, then the earlier account comes first, then the lower id", async () => {
      const boards = await stores("c1", "c2", "c3", "c4");
      await boards.setFigure(write("c3", { figure: 70, joinedAt: 500 }));
      await boards.setFigure(write("c2", { figure: 70, joinedAt: 500 }));
      await boards.setFigure(write("c1", { figure: 70, joinedAt: 900 }));
      await boards.setFigure(write("c4", { figure: 71, joinedAt: 2_000 }));
      expect((await boards.top(allTime, 10)).map((line) => [line.rank, line.character, line.score])).toEqual([
        [1, "c4", 71],
        [2, "c2", 70],
        [3, "c3", 70],
        [4, "c1", 70],
      ]);
    });

    test("[R-CITY-040] given more rows than the limit, when the top is read, then exactly the limit comes back and a line below it is still found with its rank", async () => {
      const boards = await stores("c1", "c2", "c3");
      await boards.setFigure(write("c1", { figure: 90 }));
      await boards.setFigure(write("c2", { figure: 60 }));
      await boards.setFigure(write("c3", { figure: 30 }));
      expect((await boards.top(allTime, 2)).map((line) => line.character)).toEqual(["c1", "c2"]);
      expect(await boards.top(allTime, 3)).toHaveLength(3);
      expect(await boards.top(allTime, 4)).toHaveLength(3);
      expect(await boards.top(allTime, 0)).toEqual([]);
      expect(await boards.lineOf(allTime, "c3")).toMatchObject({ rank: 3, score: 30 });
      expect(await boards.lineOf(allTime, "nobody")).toBeNull();
    });

    test("[R-CITY-039] given a player high on all time and a new player who rose more this week, when this week is ranked, then the new player is first", async () => {
      const boards = await stores("old", "new");
      await boards.setFigure(write("old", { joinedAt: 1, before: 80, figure: 85 }));
      await boards.setFigure(write("new", { joinedAt: 9_000, before: 0, figure: 30 }));
      expect((await boards.top(allTime, 10)).map((line) => line.character)).toEqual(["old", "new"]);
      expect((await boards.top(thisWeek, 10)).map((line) => [line.character, line.score])).toEqual([
        ["new", 30],
        ["old", 5],
      ]);
    });

    test("[R-CITY-039] given a figure that fell this week, when this week is ranked, then its rise is below 0 and it ranks under a rise of 0", async () => {
      const boards = await stores("fell", "still");
      await boards.setFigure(write("fell", { before: 60, figure: 0 }));
      await boards.setFigure(write("still", { before: 10, figure: 10 }));
      expect((await boards.top(thisWeek, 10)).map((line) => [line.character, line.score])).toEqual([
        ["still", 0],
        ["fell", -60],
      ]);
    });

    test("[R-ACCOUNT-022] given a guest's row, when any board is read, then it is not on it until the account is listed", async () => {
      const boards = await stores("guest", "secured");
      await boards.setFigure(write("guest", { account: "account.guest", listed: false, figure: 99 }));
      await boards.setFigure(write("secured", { figure: 10 }));
      expect((await boards.top(allTime, 10)).map((line) => line.character)).toEqual(["secured"]);
      expect(await boards.lineOf(thisWeek, "guest")).toBeNull();

      await boards.setListed("account.guest", true);
      expect((await boards.top(allTime, 10)).map((line) => line.character)).toEqual(["guest", "secured"]);
      await boards.setListed("account.guest", false);
      expect(await boards.lineOf(allTime, "guest")).toBeNull();
    });

    test("[R-CITY-040] given a character with no route yet, when a board is read, then it is not on it", async () => {
      const boards = await stores("none", "some");
      await boards.setFigure(write("none", { before: 40, figure: null }));
      await boards.setFigure(write("some", { figure: 0 }));
      expect((await boards.top(allTime, 10)).map((line) => line.character)).toEqual(["some"]);
      expect((await boards.top(thisWeek, 10)).map((line) => line.character)).toEqual(["some"]);
    });

    test("[R-CITY-040] given a list of friends, when the board is asked among them, then only they are ranked, from 1", async () => {
      const boards = await stores("me", "friend", "stranger");
      await boards.setFigure(write("stranger", { figure: 99 }));
      await boards.setFigure(write("friend", { figure: 50 }));
      await boards.setFigure(write("me", { figure: 40 }));
      const friends: BoardQuery = { ...allTime, among: ["me", "friend"] };
      expect((await boards.top(friends, 10)).map((line) => [line.rank, line.character])).toEqual([
        [1, "friend"],
        [2, "me"],
      ]);
      expect(await boards.lineOf(friends, "me")).toMatchObject({ rank: 2 });
      expect(await boards.lineOf(friends, "stranger")).toBeNull();
      expect(await boards.top({ ...allTime, among: [] }, 10)).toEqual([]);
    });

    test("[R-CITY-039] given accounts made in different weeks, when the joined-week board is asked, then only that week's accounts are ranked", async () => {
      const boards = await stores("early", "same", "me");
      await boards.setFigure(write("early", { joinedWeek: WEEK - 1, figure: 90 }));
      await boards.setFigure(write("same", { figure: 20 }));
      await boards.setFigure(write("me", { figure: 30 }));
      const cohort: BoardQuery = { ...allTime, joinedWeek: WEEK };
      expect((await boards.top(cohort, 10)).map((line) => line.character)).toEqual(["me", "same"]);
    });

    test("[R-ACCOUNT-017] given a row, when it is removed, then it is on no board and reads as none", async () => {
      const boards = await stores("c1");
      await boards.setFigure(write("c1", { figure: 10 }));
      await boards.remove("c1");
      expect(await boards.get("c1")).toBeNull();
      expect(await boards.top(allTime, 10)).toEqual([]);
      await boards.remove("c1");
    });

    test("[R-CITY-040] given a row read, when the caller changes it, then the stored row does not change", async () => {
      const boards = await stores("c1");
      await boards.setFigure(write("c1", { figure: 10 }));
      const read = await boards.get("c1");
      if (read !== null) read.figure = 99;
      expect((await boards.get("c1"))?.figure).toBe(10);
    });
  });
}
