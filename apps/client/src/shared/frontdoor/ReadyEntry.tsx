// "Start from a ready life" in Settings (prologue.md R-PROLOGUE-013): the ready lives left the door, and the maintainer and
// reviewers reach them here. The shell hands this into Settings' slot, so the phone never imports the door. Shown only
// where a life may be started over (the local authority); a tap opens the door on the ready lives' list.
import { ArrowRight } from "lucide-react";

import { useGame } from "../../authority/GameProvider";
import { Tile } from "../tiles/Tile";
import { say } from "../words/text";
import { askReadyLives } from "./ready";

export function ReadyEntry() {
  const open = useGame((state) => state.openLifeChooser);
  if (open === null) return null;
  return (
    <button
      type="button"
      className="lively-card press mt-3 flex w-full items-center gap-3 p-3 text-left"
      onClick={() => {
        askReadyLives();
        open();
      }}
      data-ready-entry
    >
      {/* A card in Settings' lively dress: the hub where a ready life starts, at work. */}
      <span className="flex size-[52px] shrink-0 items-center justify-center rounded-[16px] bg-tint-plain" aria-hidden>
        <span className="sticker-cut" style={{ rotate: "-5deg" }}>
          <Tile of="place.yaba" size={36} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold">{say("ui.door.ready")}</span>
        <span className="block text-[14px] text-text-2">{say("ui.door.ready.hint")}</span>
      </span>
      <ArrowRight size={20} className="shrink-0" />
    </button>
  );
}
