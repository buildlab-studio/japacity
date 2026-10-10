// The start screen online (R-ACCOUNT-029): over the compound as the door draws it, the game's name, one line
// about the game (R-TEXT-006's line), Play, and "I already have a life here" for an account kept before.
import { say } from "../../shared/words/text";

export interface StartScreenProps {
  onPlay: () => void;
  onReturning: () => void;
}

export function StartScreen({ onPlay, onReturning }: StartScreenProps) {
  return (
    <div className="flex flex-col gap-3" data-start-screen>
      <p className="text-[17px] leading-snug font-semibold">{say("ui.life.intro")}</p>
      <button type="button" className="btn-main mt-1" onClick={onPlay}>
        <span>{say("ui.account.start.play")}</span>
      </button>
      <button type="button" className="press h-11 w-full rounded-[6px] text-[15px] font-bold text-text-2" onClick={onReturning}>
        {say("ui.account.start.returning")}
      </button>
    </div>
  );
}
