// The figures the boards rank (city:boards-switch-when-and-who, city:board-line-and-ranking), written after
// a commit and never inside it: the japacity figure the state now holds, and
// the one it held before, which opens a week the row has not seen.
import type { ReadCtx } from "@japacity/sim";
import { japacity } from "@japacity/sim";

import type { Live } from "../authority/load";
import { tickAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import { tickRow } from "../world/ticks";
import type { BoardPorts } from "./ports";
import { accountPorts } from "./ports";
import { lagosWeek } from "./week";

/** japacity:best-open-route-is-japacity: the figure a board shows, null for "no route yet". */
export type FigureOf = (read: ReadCtx) => number | null;

export const figureOf: FigureOf = (read) => japacity(read).percent;

/**
 * city:boards-switch-when-and-who: for each character that logged a row, writes its figure when it
 * moved, and always on its first commit so a new life has its row. A figure
 * that moves only with the world (a window closing) is written at the
 * character's next commit, since a board read never loads a life.
 */
export async function noteFigures(deps: ServerDeps, lives: readonly Live[], ports: BoardPorts = accountPorts(deps), figure: FigureOf = figureOf): Promise<void> {
  const moved = lives.filter((live) => live.rows.length > 0);
  if (moved.length === 0) return;
  const now = deps.now();
  const { world } = await tickRow(deps, tickAt(deps.config.clock, now));
  const week = lagosWeek(now);
  for (const live of moved) {
    const before = figure({ state: live.loaded, world, content: live.content });
    const after = figure({ state: live.state, world, content: live.content });
    if (before === after && live.storedV > 0) continue;
    const account = await deps.stores.account.get(live.account);
    if (account === null) continue;
    const guests = await ports.guests([live.account]);
    await deps.stores.boards.setFigure({
      character: live.id,
      account: live.account,
      scenario: live.state.scenario,
      joinedAt: account.createdAt,
      joinedWeek: lagosWeek(account.createdAt),
      listed: !guests.has(live.account),
      v: live.state.v,
      before,
      figure: after,
      week,
    });
  }
}
