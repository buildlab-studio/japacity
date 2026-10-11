// The hook and the three steps (text.md R-TEXT-006, account.md R-ACCOUNT-031), as the design draws them on its start
// screen: a line with a wink in two rows, picked once per visit, then the whole game in three steps, an icon and a word
// each with a small arrow between. Online they open the start screen; offline, where the door is the first screen,
// they open the door in the same voice, with the one line of the three that needs no lights over it.
import { Briefcase, ChevronRight, FolderOpen, Plane } from "lucide-react";

import { say } from "../words/text";
import { winkAlone, winkFor } from "./wink";

/** The steps, each with the icon of the phone app it is played in: Jobs, Papers and Japa. */
const STEPS = [
  { Icon: Briefcase, word: "ui.account.start.step.hustle" },
  { Icon: FolderOpen, word: "ui.account.start.step.papers" },
  { Icon: Plane, word: "ui.account.start.step.fly" },
] as const;

/**
 * `heading`: the screen's own heading, the start screen's. On the door the question above is the heading, so the hook
 * is a line, smaller, so the looks stay in view above Next, and it is the one line that
 * stands without the lights, since none hang on the door.
 */
export function StartHook({ heading = true }: { heading?: boolean }) {
  const hook = heading ? winkFor("start") : winkAlone("start");
  const rows = hook.map((row) => (
    <span key={row} className="block">
      {say(row)}
    </span>
  ));
  return (
    <>
      {/* A hook, not an explanation. */}
      {heading ? (
        <h1 className="title text-[30px] leading-[1.05]" data-start-hook={hook[0]}>
          {rows}
        </h1>
      ) : (
        <p className="title text-[19px] leading-[1.1]" data-start-hook={hook[0]}>
          {rows}
        </p>
      )}
      {/* The whole game in three steps, an icon and a word each: a label strip to read, nothing a hand would press
         , so no chip, no fill and no press. */}
      <ol className={`${heading ? "mt-3" : "mt-1.5"} label flex items-center gap-2 text-text-2`} aria-label={say("ui.account.start.steps")} data-start-steps>
        {STEPS.map((step, i) => (
          <li key={step.word} className="flex items-center gap-2">
            {i > 0 && <ChevronRight size={12} className="opacity-60" aria-hidden />}
            <span className="flex items-center gap-1.5" data-start-step>
              <step.Icon size={heading ? 16 : 14} aria-hidden /> {say(step.word)}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
