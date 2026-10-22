// lottery:tickets-numbered-by-commit: the character's own ticket numbers, shown once the draw they
// were bought in has closed, so a number is never seen while sales still run.
import type { PlayerView, State } from "@japacity/sim";

import type { ServerDeps } from "../dependencies";

/**
 * The view with `lottery.numbers` filled: the numbers the server gave the
 * character's tickets in the draw it last bought in, once that draw is frozen
 * and is the newest drawn or the one being drawn, which the world shows closed
 * until the next draw opens. Null otherwise.
 * The view names no draw for the numbers; they belong to the draw
 * of `lottery.last` or the one closed after it, never to a draw on sale.
 */
export async function withNumbers(deps: Pick<ServerDeps, "stores">, character: string, state: State, view: PlayerView): Promise<PlayerView> {
  const shown = view.lottery;
  const bought = state.lottery.draw;
  if (shown === null || bought === null || bought < (shown.last?.draw ?? 0)) return view;
  const row = await deps.stores.world.draw(bought);
  if (row?.closedAt === null || row === null) return view;
  const numbers = (await deps.stores.world.tickets(bought)).filter((ticket) => ticket.character === character).map((ticket) => ticket.n);
  return { ...view, lottery: { ...shown, numbers: numbers.length === 0 ? null : numbers } };
}
