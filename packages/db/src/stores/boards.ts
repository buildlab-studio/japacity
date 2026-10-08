import type { BoardQuery, BoardStore, FigureRow, RankedRow } from "@japacity/store";
import { and, asc, desc, eq, inArray, isNotNull, lt, sql, type SQL } from "drizzle-orm";

import type { Handle } from "../handle";
import { boardFigures } from "../schema";

/** R-CITY-040: the figure on all time, its rise since the week began on this week (a week behind has risen by nothing). */
function scoreSql(query: BoardQuery): SQL<number> {
  if (query.when === "all-time") return sql<number>`${boardFigures.figure}`;
  return sql<number>`coalesce(${boardFigures.figure}, 0) - case when ${boardFigures.week} >= ${query.week} then coalesce(${boardFigures.weekStart}, 0) else coalesce(${boardFigures.figure}, 0) end`;
}

/** The rows on the board: listed, with a figure, and inside the friends or the joined week when asked. */
function onBoard(query: BoardQuery): SQL | undefined {
  return and(
    eq(boardFigures.listed, true),
    isNotNull(boardFigures.figure),
    query.among === undefined ? undefined : query.among.length === 0 ? sql`false` : inArray(boardFigures.character, [...query.among]),
    query.joinedWeek === undefined ? undefined : eq(boardFigures.joinedWeek, query.joinedWeek),
  );
}

const byId = sql`${boardFigures.character} collate "C"`;

function lineColumns(query: BoardQuery) {
  return {
    character: boardFigures.character,
    account: boardFigures.account,
    scenario: boardFigures.scenario,
    joinedAt: boardFigures.joinedAt,
    score: scoreSql(query).mapWith(Number),
  };
}

/** R-CITY-039, R-CITY-040: one row per character, ranked in the query. */
export function pgBoardStore(handle: Handle): BoardStore {
  return {
    setFigure: ({ before, ...write }) =>
      handle.read(async (db) => {
        const opens = sql`${boardFigures.week} < excluded.week`;
        const written = await db
          .insert(boardFigures)
          .values({ ...write, weekStart: before })
          .onConflictDoUpdate({
            target: boardFigures.character,
            set: {
              account: sql`excluded.account`,
              scenario: sql`excluded.scenario`,
              joinedAt: sql`excluded.joined_at`,
              joinedWeek: sql`excluded.joined_week`,
              listed: sql`excluded.listed`,
              v: sql`excluded.v`,
              figure: sql`excluded.figure`,
              weekStart: sql`case when ${opens} then ${boardFigures.figure} else ${boardFigures.weekStart} end`,
              week: sql`case when ${opens} then excluded.week else ${boardFigures.week} end`,
            },
            setWhere: lt(boardFigures.v, sql`excluded.v`),
          })
          .returning({ character: boardFigures.character });
        return written.length > 0;
      }),

    turnWeek: (week) =>
      handle.read(async (db) => {
        const moved = await db
          .update(boardFigures)
          .set({ week, weekStart: sql`${boardFigures.figure}` })
          .where(lt(boardFigures.week, week))
          .returning({ character: boardFigures.character });
        return moved.length;
      }),

    setListed: (account, listed) =>
      handle.read(async (db) => {
        await db.update(boardFigures).set({ listed }).where(eq(boardFigures.account, account));
      }),

    get: (character) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(boardFigures).where(eq(boardFigures.character, character));
        return row === undefined ? null : ({ ...row } satisfies FigureRow);
      }),

    top: (query, limit) =>
      handle.read(async (db) => {
        if (limit <= 0) return [];
        const score = scoreSql(query);
        const rows = await db
          .select(lineColumns(query))
          .from(boardFigures)
          .where(onBoard(query))
          .orderBy(desc(score), asc(boardFigures.joinedAt), asc(byId))
          .limit(limit);
        return rows.map((row, at): RankedRow => ({ rank: at + 1, ...row }));
      }),

    lineOf: (query, character) =>
      handle.read(async (db) => {
        const score = scoreSql(query);
        const [own] = await db
          .select(lineColumns(query))
          .from(boardFigures)
          .where(and(onBoard(query), eq(boardFigures.character, character)));
        if (own === undefined) return null;
        const ahead = sql`(${score} > ${own.score} or (${score} = ${own.score} and (${boardFigures.joinedAt} < ${own.joinedAt} or (${boardFigures.joinedAt} = ${own.joinedAt} and ${byId} < ${character} collate "C"))))`;
        const [counted] = await db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(boardFigures)
          .where(and(onBoard(query), ahead));
        return { rank: (counted?.count ?? 0) + 1, ...own };
      }),

    remove: (character) =>
      handle.read(async (db) => {
        await db.delete(boardFigures).where(eq(boardFigures.character, character));
      }),
  };
}
