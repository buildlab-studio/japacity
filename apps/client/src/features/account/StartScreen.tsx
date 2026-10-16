// The start screen online (R-ACCOUNT-029), as designed:
// over the scene with the lockup at the head of the sheet, no title over the figure, a hook in two rows instead of a sentence (R-TEXT-006; one of three
// lines, picked once per visit, R-ACCOUNT-031), the whole game in three steps as an icon and a word each, then Play
// with its small second line, and "I already have a life here" for an account kept before. The two lights hang over the
// top of the scene (TwoLights.tsx), so a line about the light is a caption. Nothing says Lagos: the scene behind does.
import { useId, useSyncExternalStore } from "react";

import { StartHook } from "../../shared/frontdoor/Hook";
import { Wordmark } from "../../shared/ui/Wordmark";
import { say } from "../../shared/words/text";

export interface StartScreenProps {
  onPlay: () => void;
  onReturning: () => void;
}

/** The paint on the root, the attribute the paint's tokens follow (shared/world/paint.ts), read without setting it. */
function rootPaint(): "day" | "night" {
  return typeof document !== "undefined" && document.documentElement.dataset.paint === "night" ? "night" : "day";
}

function watchRootPaint(changed: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => undefined;
  const watch = new MutationObserver(changed);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-paint"] });
  return () => watch.disconnect();
}

/** The sheet's paint as the root carries it, followed as the world's clock turns it. */
function useRootPaint(): "day" | "night" {
  return useSyncExternalStore(watchRootPaint, rootPaint, () => "day");
}

export function StartScreen({ onPlay, onReturning }: StartScreenProps) {
  const then = useId();
  return (
    <div className="flex flex-col" data-start-screen>
      {/* The lockup for the ground under it, the sheet's own paint (only the J mark showed). */}
      <Wordmark ground={useRootPaint() === "night" ? "dark" : "light"} align="start" className="mb-3" />
      <StartHook />
      {/* The button is named Play; its second line is said as its description. */}
      <button type="button" className="btn-main mt-4" onClick={onPlay} aria-label={say("ui.account.start.play")} aria-describedby={then}>
        <span>{say("ui.account.start.play")}</span>
        <span id={then} className="text-[13px] font-semibold opacity-80">
          {say("ui.account.start.play.then")}
        </span>
      </button>
      <button type="button" className="press mt-2 h-11 w-full rounded-[6px] text-[14px] font-bold text-text-2" onClick={onReturning}>
        {say("ui.account.start.returning")}
      </button>
    </div>
  );
}
