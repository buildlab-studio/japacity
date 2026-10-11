// The start screen online (R-ACCOUNT-029), as designed:
// over the scene with no title over the figure, a hook in two rows instead of a sentence (R-TEXT-006; one of three
// lines, picked once per visit, R-ACCOUNT-031), the whole game in three steps as an icon and a word each, then Play
// with its small second line, and "I already have a life here" for an account kept before. The two lights hang over the
// top of the scene (TwoLights.tsx), so a line about the light is a caption. Nothing says Lagos: the scene behind does.
import { ChevronRight } from "lucide-react";
import { useId } from "react";

import { PhoneIcon } from "../phone/icons";
import { say } from "../../shared/words/text";
import { winkFor } from "./wink";

/** The steps, each the phone app it is played in: Jobs, Papers and Japa (features/phone/PhoneApps.tsx). */
const STEPS = [
  { icon: "briefcase", word: "ui.account.start.step.hustle" },
  { icon: "folder-open", word: "ui.account.start.step.papers" },
  { icon: "plane", word: "ui.account.start.step.fly" },
] as const;

export interface StartScreenProps {
  onPlay: () => void;
  onReturning: () => void;
}

export function StartScreen({ onPlay, onReturning }: StartScreenProps) {
  const hook = winkFor("start");
  const then = useId();
  return (
    <div className="flex flex-col" data-start-screen>
      {/* A hook, not an explanation. */}
      <h1 className="title text-[30px] leading-[1.05]" data-start-hook={hook[0]}>
        {hook.map((row) => (
          <span key={row} className="block">
            {say(row)}
          </span>
        ))}
      </h1>
      {/* The whole game in three steps, an icon and a word each. */}
      <ol className="mt-3 flex items-center gap-1.5" aria-label={say("ui.account.start.steps")} data-start-steps>
        {STEPS.map((step, i) => (
          <li key={step.word} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={14} className="text-text-2" aria-hidden />}
            <span className="flex h-9 items-center gap-1.5 rounded-[6px] bg-sheet-muted px-2.5 text-[14px] font-bold">
              <PhoneIcon name={step.icon} size={18} /> {say(step.word)}
            </span>
          </li>
        ))}
      </ol>
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
