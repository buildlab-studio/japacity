// The months held to play, from the view, and the time to the next one, counted down on the device (R-CLOCK-007). The
// server keeps the clock; reaching zero only fetches the view, and the months shown change only when the view does.
// Nothing counts down offline. Kept for R-CLOCK-007 since the month page that showed it went: the world shows no
// months held (the month turns when it is lived, decision 0034), and the Calendar keeps no count of them (R-WORLD-007),
// so it waits here, unmounted, for the rule to give it a home in the world or to retire it.
import { useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { say } from "../../shared/words/text";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
/** How often to ask again when the view still shows the old time after reaching zero (a device clock running ahead). */
export const ASK_AGAIN_MS = 30 * SECOND_MS;

/** A wait on the server's clock in words: "1h 40m", "25m", "under a minute" (R-CLOCK-007). */
export function waitWords(ms: number): string {
  if (ms < MINUTE_MS) return say("ui.clock.under-minute");
  const hours = Math.floor(ms / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  return hours > 0 ? say("ui.clock.hours", { hours, minutes: String(minutes).padStart(2, "0") }) : say("ui.clock.minutes", { minutes });
}

/** The countdown to the next month held, or nothing without a clock. */
export function TurnClock() {
  const nextTurnAt = useGame((state) => state.clock?.nextTurnAt);
  const refresh = useGame((state) => state.refresh);
  const [now, setNow] = useState(() => Date.now());
  const asked = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    if (nextTurnAt === undefined || nextTurnAt === null) return;
    const beat = () => {
      const at = Date.now();
      setNow(at);
      if (at >= nextTurnAt && at - asked.current >= ASK_AGAIN_MS) {
        asked.current = at;
        void refresh();
      }
    };
    beat();
    const timer = setInterval(beat, SECOND_MS);
    return () => {
      clearInterval(timer);
    };
  }, [nextTurnAt, refresh]);

  if (nextTurnAt === undefined) return null;
  const words = nextTurnAt === null ? say("ui.clock.full") : now >= nextTurnAt ? say("ui.clock.arriving") : say("ui.clock.next", { wait: waitWords(nextTurnAt - now) });
  return (
    <span className="text-[13px] text-text-2" data-turn-clock>
      {words}
    </span>
  );
}

/** The months held to play and the countdown to the next, one quiet card (R-CLOCK-007). */
export function MonthsHeld() {
  const view = useView();
  return (
    <div className="lively-card flex flex-col gap-0.5 px-3 py-2.5" data-months-held-card>
      <span className="text-[15px] font-bold" data-months-held>
        {say("ui.month.banked", { banked: view.turns.banked, cap: view.turns.cap })}
      </span>
      <TurnClock />
    </div>
  );
}
