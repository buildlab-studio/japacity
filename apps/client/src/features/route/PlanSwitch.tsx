// The plan and the switch between ways out (docs/rules/chapter.md R-CHAPTER-009): a way's page says what
// making it the plan would do to japacity against the plan, the japacity kind's figures from the view, and
// offers Keep mine or Make this the plan. Making it the plan records the choice the chapters follow from
// the next close (`chapter/lean`) and, for a way only heard of, plans its official page for the month.
import type { Id, PlayerView, SlotPick } from "@japacity/sim";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { blurbOf, nameOf, say } from "../../shared/words/text";

const OFFICIAL = "activity.look-into-route";

/** What a switch would do: the plan it replaces and the figure's rise (above 0) or fall (below). */
export interface Switch {
  plan: Id<"route">;
  change: number;
}

/**
 * The switch on a way's page, or null on the plan's own page and wherever no switch is open: no plan yet,
 * the life over, abroad, or a visa already granted.
 */
export function switchOf(view: PlayerView, route: Id<"route">): Switch | null {
  const plan = view.plan.route;
  if (plan === null || plan === route || view.ended || view.place.where !== "home") return null;
  if (view.routes.some((held) => held.state === "granted" || held.state === "departed")) return null;
  const mine = view.plan.ways.find((way) => way.route === plan);
  const other = view.plan.ways.find((way) => way.route === route);
  if (mine === undefined || other === undefined) return null;
  return { plan, change: other.percent - mine.percent };
}

/** The switch's line: "Instead of care work: -12 japacity", or the same japacity when nothing moves. */
export function switchWords(choice: Switch): string {
  const plan = say(`${choice.plan}.short`);
  if (choice.change === 0) return say("route.plan.same", { plan });
  return say("route.plan.instead", { plan, change: choice.change > 0 ? `+${String(choice.change)}` : String(choice.change) });
}

function plannedAlready(plan: (SlotPick | null)[], route: Id<"route">): boolean {
  return plan.some((pick) => pick !== null && pick.activity === OFFICIAL && pick.param === route);
}

/** The block on a way's page: the switch with its two buttons, or that this is the plan. */
export function PlanSwitch({ route, onKeep, onSaid }: { route: Id<"route">; onKeep: () => void; onSaid?: (words: string) => void }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const addToPlan = useGame((state) => state.addToPlan);
  const plan = useGame((state) => state.plan);
  const [made, setMade] = useState(false);
  const choice = switchOf(view, route);
  if (choice === null) {
    if (view.plan.route !== route) return null;
    return (
      <div className="mt-3 rounded-[6px] border-l-4 border-signal bg-sheet-2 px-3 py-2 text-[14px]" data-plan-mine={route}>
        <p className="font-bold">{say("route.plan.mine")}</p>
        {made ? <p className="text-[13px] text-text-2">{say("route.plan.next")}</p> : null}
      </div>
    );
  }

  async function make(): Promise<void> {
    const official = view.activities.find((option) => option.id === OFFICIAL);
    const heard = view.routes.find((held) => held.id === route)?.state === "heard";
    const reply = await send({ type: "chapter/lean", route });
    if (reply?.ok !== true) return;
    setMade(true);
    // A way only heard of is looked into this month, as its official page is planned anywhere else.
    if (!heard || official?.allowed !== true || official.params?.includes(route) !== true || plannedAlready(plan, route)) return;
    const planned = addToPlan({ activity: OFFICIAL, param: route });
    onSaid?.(planned ? say("ui.world.planned", { what: nameOf(OFFICIAL) }) : say("ui.world.full"));
  }

  return (
    <div className="mt-3 rounded-[6px] bg-sheet-2 p-3" data-plan-switch={route}>
      <p className="num text-[14px] font-bold" data-plan-change={choice.change}>
        {switchWords(choice)}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={onKeep} className="press h-12 shrink-0 rounded-[6px] border-2 border-sheet-line px-4 text-[14px] font-bold" data-plan-keep>
          {say("route.plan.keep")}
        </button>
        <button type="button" disabled={busy} onClick={() => void make()} className="btn-main press h-12 flex-1 justify-center text-[14px] font-bold disabled:opacity-70" data-plan-make>
          {say("route.plan.make")}
        </button>
      </div>
    </div>
  );
}

/** A way's page: its name, what it is, how far the life has gone with it, and the switch. */
export function RoutePage({ route, onClose, back, onSaid }: { route: Id<"route">; onClose: () => void; back?: string; onSaid?: (words: string) => void }) {
  const view = useView();
  const held = view.routes.find((each) => each.id === route);
  const blurb = blurbOf(route);
  return (
    <div data-route-page={route}>
      <button type="button" onClick={onClose} className="press mb-2 flex items-center gap-1 text-[14px] font-bold text-text-2" data-route-back>
        <ChevronLeft size={16} aria-hidden />
        {back ?? say("route.plan.back")}
      </button>
      <div className="flex items-start justify-between gap-3">
        <h3 className="title text-[18px]">{nameOf(route)}</h3>
        {held?.percent === null || held?.percent === undefined ? null : (
          <span className="num shrink-0 text-[24px] leading-none">
            {held.percent}
            <span className="text-[15px]">%</span>
          </span>
        )}
      </div>
      {blurb === null ? null : <p className="mt-1 text-[13px] text-text-2">{blurb}</p>}
      {held === undefined ? null : <p className="mt-1 text-[13px] font-bold">{say(`ui.route.state.${held.state}`)}</p>}
      {held?.state === "heard" ? <p className="mt-1 text-[13px] text-text-2">{say("ui.route.heard-only")}</p> : null}
      <PlanSwitch route={route} onKeep={onClose} {...(onSaid === undefined ? {} : { onSaid })} />
    </div>
  );
}
