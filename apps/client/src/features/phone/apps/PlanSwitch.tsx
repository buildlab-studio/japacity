// The plan and the switch between ways out, a way's page inside Japa (chapter:chapters-follow-lean-route): a way's page says what
// making it the plan would do to japacity against the plan, the japacity kind's figures from the view, and
// offers Keep mine or Make this the plan. Making it the plan records the choice the chapters follow from
// the next close (`chapter/lean`) and, for a way only heard of, plans its official page for the month.
import type { Id, PlayerView, SlotPick } from "@japacity/sim";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { Tile } from "../../../shared/tiles/Tile";
import { PressButton } from "../../../shared/ui/lively/PressButton";
import { actOnCard, nowSaid } from "../../../shared/words/acts";
import { blurbOf, nameOf, say } from "../../../shared/words/text";

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

/** The switch's line: "Instead of health care: -12 japacity", or the same japacity when nothing moves. */
function switchWords(choice: Switch): string {
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
    // A way only heard of is looked into at once (activity:now-acts-and-month-acts), as its official page is read anywhere else.
    if (!heard || official?.allowed !== true || official.params?.includes(route) !== true || plannedAlready(plan, route)) return;
    const acted = await actOnCard({ activity: OFFICIAL, param: route }, { send, addToPlan });
    if (acted === "answered") onSaid?.(nowSaid(OFFICIAL, route));
    else if (acted === "full") onSaid?.(say("ui.world.full"));
  }

  return (
    <div className="lively-card mt-3 p-3.5" data-plan-switch={route}>
      <p className="num text-[15px] font-bold" data-plan-change={choice.change}>
        {switchWords(choice)}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={onKeep} className="phone-ghost press w-auto shrink-0 justify-center px-3 text-[15px] whitespace-nowrap" data-plan-keep>
          {say("route.plan.keep")}
        </button>
        {/* The one yellow action, made to fit beside Keep mine on one line at a phone's width. */}
        <PressButton disabled={busy} onClick={() => void make()} className="min-h-12 min-w-0 flex-1 px-3 text-[15px] whitespace-nowrap" data-plan-make>
          {say("route.plan.make")}
        </PressButton>
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
      <button type="button" onClick={onClose} className="press mb-2 flex items-center gap-1 text-[15px] font-bold text-text-2" data-route-back>
        <ChevronLeft size={16} aria-hidden />
        {back ?? say("route.plan.back")}
      </button>
      {/* A way as a card: its picture, its name, what it is, how far the life has gone with it
          as a chip, and how ready it would make you as a bar that fills, never a percentage on screen. */}
      <div className="lively-card p-3.5" data-route-head>
        <div className="flex items-start gap-3">
          <span className="flex size-[60px] shrink-0 items-center justify-center rounded-[16px] bg-tint-study" aria-hidden>
            <span className="sticker-cut" style={{ rotate: "-5deg" }}>
              <Tile of={route} size={42} />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[20px] leading-tight font-bold">{nameOf(route)}</h3>
            {held === undefined ? null : (
              <span className="sticker-chip mt-1 bg-tint-study" style={{ rotate: "-1.5deg" }}>
                {say(`ui.route.state.${held.state}`)}
              </span>
            )}
          </div>
        </div>
        {blurb === null ? null : <p className="mt-2 text-[14px] leading-snug text-text-2">{blurb}</p>}
        {held?.state === "heard" ? <p className="mt-1 text-[14px] text-text-2">{say("ui.route.heard-only")}</p> : null}
        {held?.percent === null || held?.percent === undefined ? null : (
          <div className="phone-meter mt-2.5 h-3 w-full overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={held.percent} aria-label={nameOf(route)} data-route-percent={held.percent}>
            <span style={{ width: `${String(Math.max(4, Math.min(100, held.percent)))}%` }} />
          </div>
        )}
      </div>
      <PlanSwitch route={route} onKeep={onClose} {...(onSaid === undefined ? {} : { onSaid })} />
    </div>
  );
}
