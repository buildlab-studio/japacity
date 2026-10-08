// The time to the next banked month, counted down on the device (R-CLOCK-007).
// The server keeps the clock; reaching zero only fetches the view, and the
// bank on screen changes only when the view does. Nothing shows offline.
import { useEffect, useRef, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { say } from "../../shared/words/text";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
/** How often to ask again when the view still shows the old time after reaching zero (a device clock running ahead). */
export const ASK_AGAIN_MS = 30 * SECOND_MS;

export function waitWords(ms: number): string {
  if (ms < MINUTE_MS) return say("ui.clock.under-minute");
  const hours = Math.floor(ms / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  return hours > 0 ? say("ui.clock.hours", { hours, minutes: String(minutes).padStart(2, "0") }) : say("ui.clock.minutes", { minutes });
}

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
    <span className="text-xs text-muted" data-turn-clock>
      {words}
    </span>
  );
}
