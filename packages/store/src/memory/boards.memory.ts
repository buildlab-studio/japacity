import type { BoardQuery, BoardStore, FigureRow, RankedRow } from "../boards";
import { scoreOf } from "../boards";
import { compareIds } from "../pairKeys";
import { copy } from "./copy.memory";

/** city:board-line-and-ranking: higher score first, then the earlier account, then the lower id. */
function ahead(x: { score: number; joinedAt: number; character: string }, y: { score: number; joinedAt: number; character: string }): number {
  if (x.score !== y.score) return y.score - x.score;
  if (x.joinedAt !== y.joinedAt) return x.joinedAt - y.joinedAt;
  return compareIds(x.character, y.character);
}

function ranked(rows: Iterable<FigureRow>, query: BoardQuery): RankedRow[] {
  const lines: Omit<RankedRow, "rank">[] = [];
  for (const row of rows) {
    const score = scoreOf(row, query);
    if (score === null) continue;
    lines.push({ character: row.character, account: row.account, scenario: row.scenario, joinedAt: row.joinedAt, score });
  }
  return lines.sort(ahead).map((line, at) => ({ rank: at + 1, ...line }));
}

/** city:boards-switch-when-and-who, city:board-line-and-ranking: a map by character, ranked on each read. */
export function memoryBoardStore(): BoardStore {
  const rows = new Map<string, FigureRow>();

  return {
    setFigure: (write) => {
      const held = rows.get(write.character);
      if (held !== undefined && write.v <= held.v) return Promise.resolve(false);
      const opens = held === undefined || held.week < write.week;
      const { before, ...rest } = write;
      rows.set(write.character, {
        ...rest,
        week: opens ? write.week : held.week,
        weekStart: held === undefined ? before : opens ? held.figure : held.weekStart,
      });
      return Promise.resolve(true);
    },
    turnWeek: (week) => {
      let moved = 0;
      for (const row of rows.values()) {
        if (row.week >= week) continue;
        row.week = week;
        row.weekStart = row.figure;
        moved += 1;
      }
      return Promise.resolve(moved);
    },
    setListed: (account, listed) => {
      for (const row of rows.values()) if (row.account === account) row.listed = listed;
      return Promise.resolve();
    },
    get: (character) => Promise.resolve(copy(rows.get(character) ?? null)),
    top: (query, limit) => Promise.resolve(ranked(rows.values(), query).slice(0, Math.max(0, limit))),
    lineOf: (query, character) => Promise.resolve(ranked(rows.values(), query).find((line) => line.character === character) ?? null),
    remove: (character) => {
      rows.delete(character);
      return Promise.resolve();
    },
  };
}
