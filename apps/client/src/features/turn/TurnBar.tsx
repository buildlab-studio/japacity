// The month's action on the old page (R-WORLD-024): always on screen. On a phone it sits above the
// tab bar; on a desktop it heads the month plan. In the world, the Month sheet does this job.
import { Repeat } from "lucide-react";

import { useGame, useView } from "../../authority/GameProvider";
import { slotsUsed } from "../../authority/store";
import { Button } from "../../shared/ui/Button";
import { Rejection } from "../../shared/ui/Rejection";
import { say, words } from "../../shared/words/text";
import { TurnClock } from "./TurnClock";

/** Why the month cannot end right now, in content's words, or null when it can. */
export function blockedBy(ended: boolean, banked: number, setpieceOpen: boolean): string | null {
  if (ended) return words("reject.ended");
  if (setpieceOpen) return words("reject.setpiece-open");
  if (banked < 1) return words("reject.no-turns");
  return null;
}

export function TurnBar() {
  const view = useView();
  const plan = useGame((state) => state.plan);
  const busy = useGame((state) => state.busy);
  const endMonth = useGame((state) => state.endMonth);
  const sameAgain = useGame((state) => state.sameAgain);
  const used = slotsUsed(plan);
  // An interview with a question still to answer holds the month as a set piece does (R-INTERVIEW-004).
  const blocked = blockedBy(view.ended, view.turns.banked, view.setpiece !== null || (view.interview?.question ?? null) !== null);

  return (
    <div className="flex flex-col gap-2">
      <Rejection />
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col text-sm leading-tight">
          <span className="font-semibold">{say("ui.month.slots", { used, slots: view.freeSlots })}</span>
          <span className="text-muted">{say("ui.month.banked", { banked: view.turns.banked, cap: view.turns.cap })}</span>
          <TurnClock />
        </div>
        <Button
          small
          onClick={sameAgain}
          disabled={(view.lastSlots.length === 0 && view.report === null) || busy || view.ended}
          aria-label={say("ui.month.same-again")}
        >
          <Repeat size={16} />
          <span className="hidden sm:inline">{say("ui.month.same-again")}</span>
        </Button>
        <Button variant="primary" onClick={() => void endMonth()} disabled={busy || blocked !== null}>
          {say("ui.month.end")}
        </Button>
      </div>
      {blocked === null ? null : <p className="text-sm text-muted">{blocked}</p>}
    </div>
  );
}
