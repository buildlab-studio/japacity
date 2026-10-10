// An act's own line over the place (docs/rules/world.md R-WORLD-005): the agent's
// "Not today", the pot on the fire. It stands until tapped, or for SAID_MS, as the party's beat does, so it
// is read; never a toast that passes in a second and gives way to the street's talk.
import { useEffect, useState } from "react";

/** A line stays until tapped, or this long: as long as the party's beat, enough to read twice. */
export const SAID_MS = 20_000;

export interface Said {
  words: string;
  at: number;
}

/** The line in hand, `show` to put a new one up (it replaces the last), `clear` to take it down. */
export function useSaid(): { said: Said | null; show: (words: string) => void; clear: () => void } {
  const [said, setSaid] = useState<Said | null>(null);
  useEffect(() => {
    if (said === null) return;
    const timer = window.setTimeout(() => setSaid(null), SAID_MS);
    return () => window.clearTimeout(timer);
  }, [said]);
  return { said, show: (words) => setSaid({ words, at: performance.now() }), clear: () => setSaid(null) };
}

/** The line itself, where the toast stands; a tap takes it down. */
export function SaidLine({ said, onTap }: { said: Said | null; onTap: () => void }) {
  if (said === null) return null;
  return (
    <button key={said.at} type="button" onClick={onTap} className="pop pointer-events-auto fixed inset-x-0 bottom-[calc(max(14px,env(safe-area-inset-bottom))+124px)] z-[45] flex justify-center px-6" data-said>
      <span role="status" className="toast px-4 py-3 text-center text-[16px] leading-snug font-bold">
        {said.words}
      </span>
    </button>
  );
}
