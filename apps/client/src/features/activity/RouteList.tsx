// The routes an activity asks about, as a list like the jobs list (docs/rules/world.md R-WORLD-006):
// each route the activity can ask about is a row with its name, what it is, and
// whether it is only heard of or already looked into. A row is picked by a tap.
import type { PlayerView } from "@japacity/sim";

import { blurbOf, nameOf, say } from "../../shared/words/text";
import { routesWords } from "./routes.words";

/** Heard of, looked into, or further on: the route's state now, from the view. */
function stateWords(view: PlayerView, id: string): string | null {
  const state = view.routes.find((route) => route.id === id)?.state;
  return state === undefined || state === "unknown" ? null : say(`ui.route.state.${state}`);
}

function RouteRow({ id, state, chosen, onPick }: { id: string; state: string | null; chosen: boolean; onPick: (id: string) => void }) {
  const blurb = blurbOf(id);
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={chosen}
        data-route={id}
        onClick={() => onPick(id)}
        className={`flex min-h-12 w-full items-start gap-3 rounded-md border px-3 py-2 text-left ${chosen ? "border-ink bg-sheet-muted" : "border-sheet-line bg-sheet"}`}
      >
        <span aria-hidden className={`mt-1 size-4 shrink-0 rounded-[4px] border-2 ${chosen ? "border-ink bg-ink" : "border-sheet-line"}`} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{nameOf(id)}</span>
            {state === null ? null : (
              <span className="shrink-0 text-xs font-semibold text-text-2" data-route-state>
                {state}
              </span>
            )}
          </span>
          {blurb === null ? null : <span className="text-sm text-text-2">{blurb}</span>}
        </span>
      </button>
    </li>
  );
}

/** The routes as rows to tap, in the order the view gives them; `chosen` is empty until one is picked. */
export function RouteList({ view, routes, chosen, onPick, label }: { view: PlayerView; routes: readonly string[]; chosen: string; onPick: (id: string) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium" id={label}>
        {routesWords("routes.pick")}
      </span>
      <ul role="radiogroup" aria-labelledby={label} className="flex flex-col gap-1.5" data-routes>
        {routes.map((id) => (
          <RouteRow key={id} id={id} state={stateWords(view, id)} chosen={id === chosen} onPick={onPick} />
        ))}
      </ul>
    </div>
  );
}
