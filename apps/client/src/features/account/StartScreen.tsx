// The start screen online (R-ACCOUNT-029), as designed:
// over the scene with no title over the figure, a hook in two rows instead of a sentence (R-TEXT-006; one of three
// lines, picked once per visit, R-ACCOUNT-031), the whole game in three steps as an icon and a word each, then Play
// with its small second line, and "I already have a life here" for an account kept before. The two lights hang over the
// top of the scene (TwoLights.tsx), so a line about the light is a caption. Nothing says Lagos: the scene behind does.
import { useId } from "react";

import { StartHook } from "../../shared/frontdoor/Hook";
import { say } from "../../shared/words/text";

export interface StartScreenProps {
  onPlay: () => void;
  onReturning: () => void;
}

export function StartScreen({ onPlay, onReturning }: StartScreenProps) {
  const then = useId();
  return (
    <div className="flex flex-col" data-start-screen>
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
