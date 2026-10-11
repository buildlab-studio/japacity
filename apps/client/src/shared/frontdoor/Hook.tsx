// The hook and the three steps (text.md R-TEXT-006, account.md R-ACCOUNT-031), as the design draws them on its start
// screen: a line with a wink in two rows, picked once per visit, then the whole game in three steps, an icon and a word
// each with a small arrow between. Online they open the start screen; offline, where the door is the first screen,
// they open the door the same way, so the two read as one voice.
import { Briefcase, ChevronRight, FolderOpen, Plane } from "lucide-react";

import { say } from "../words/text";
import { winkFor } from "./wink";

/** The steps, each with the icon of the phone app it is played in: Jobs, Papers and Japa. */
const STEPS = [
  { Icon: Briefcase, word: "ui.account.start.step.hustle" },
  { Icon: FolderOpen, word: "ui.account.start.step.papers" },
  { Icon: Plane, word: "ui.account.start.step.fly" },
] as const;

/** `heading`: the screen's own heading; on the door the question above is the heading, so the hook is a line. */
export function StartHook({ heading = true }: { heading?: boolean }) {
  const hook = winkFor("start");
  const rows = hook.map((row) => (
    <span key={row} className="block">
      {say(row)}
    </span>
  ));
  const look = "title text-[30px] leading-[1.05]";
  return (
    <>
      {/* A hook, not an explanation. */}
      {heading ? (
        <h1 className={look} data-start-hook={hook[0]}>
          {rows}
        </h1>
      ) : (
        <p className={look} data-start-hook={hook[0]}>
          {rows}
        </p>
      )}
      {/* The whole game in three steps, an icon and a word each. */}
      <ol className="mt-3 flex items-center gap-1.5" aria-label={say("ui.account.start.steps")} data-start-steps>
        {STEPS.map((step, i) => (
          <li key={step.word} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={14} className="text-text-2" aria-hidden />}
            <span className="flex h-9 items-center gap-1.5 rounded-[6px] bg-sheet-muted px-2.5 text-[14px] font-bold">
              <step.Icon size={18} aria-hidden /> {say(step.word)}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
