// "Start from a ready life" in Settings (prologue.md R-PROLOGUE-013): the ready lives left the door, and the maintainer and
// reviewers reach them here. The shell hands this into Settings' slot, so the phone never imports the door. Shown only
// where a life may be started over (the local authority); a tap opens the door on the ready lives' list.
import { ArrowRight } from "lucide-react";

import { useGame } from "../../authority/GameProvider";
import { say } from "../words/text";
import { askReadyLives } from "./ready";

export function ReadyEntry() {
  const open = useGame((state) => state.openLifeChooser);
  if (open === null) return null;
  return (
    <button
      type="button"
      className="press mt-3 flex w-full items-center justify-between gap-2 rounded-[5px] border border-sheet-line px-3 py-2 text-left"
      onClick={() => {
        askReadyLives();
        open();
      }}
      data-ready-entry
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-extrabold">{say("ui.door.ready")}</span>
        <span className="block text-[12px] text-text-2">{say("ui.door.ready.hint")}</span>
      </span>
      <ArrowRight size={16} className="shrink-0" />
    </button>
  );
}
