// R-ENGINE-015: the card for a request that brought no answer the game can read. It says what happened in a person's
// words, by the failure's kind, over whatever sent it: the loading screen, the door's Begin, or the sheet whose choice
// is kept. Retry sends the same again; a login wall or an ended session also offers Reload, which opens the game anew.
import { CircleAlert, RotateCw } from "lucide-react";
import { useState } from "react";

import { useGame } from "../../authority/GameProvider";
import type { Trouble } from "../../authority/store";
import { say } from "../words/text";
import { Wordmark } from "./Wordmark";

/** The page loaded again from the top, through whatever wall stands in front of it. */
function reloadPage(): void {
  location.reload();
}

/**
 * The card's face: the words and the buttons. `inline` sits in the loading screen's place; otherwise it covers the screen.
 * `named` puts the game's name at its head, for a visitor who has seen nothing of the game yet.
 */
export function TroubleFace({ trouble, inline = false, named = false }: { trouble: Trouble; inline?: boolean; named?: boolean }) {
  const retry = useGame((state) => state.retry);
  const [sending, setSending] = useState(false);
  const again = (): void => {
    setSending(true);
    void retry().finally(() => setSending(false));
  };
  const words = say(`ui.trouble.${trouble.kind}`);
  return (
    <div
      role="alertdialog"
      aria-modal={!inline}
      aria-label={words}
      data-trouble={trouble.kind}
      data-trouble-during={trouble.during}
      className={inline ? "mx-auto w-full max-w-[420px] p-4" : "fixed inset-0 z-[70] flex items-end justify-center bg-scrim/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"}
    >
      <div className="w-full max-w-[420px] rounded-[8px] border-2 border-strong bg-sheet p-4 text-text">
        {named ? <Wordmark ground="light" className="mb-3" /> : null}
        <p className="flex items-start gap-2 text-[17px] leading-snug font-extrabold">
          <CircleAlert size={22} className="mt-0.5 shrink-0 text-bad" aria-hidden />
          <span>{words}</span>
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="btn-main" onClick={again} disabled={sending} autoFocus>
            <span>{say("ui.trouble.retry")}</span>
            <RotateCw size={18} aria-hidden />
          </button>
          {trouble.kind === "wall" ? (
            <button type="button" className="btn-dark min-h-12 px-4" onClick={reloadPage}>
              {say("ui.trouble.reload")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The card over the screen, while a request waits to be sent again. */
export function TroubleCard() {
  const trouble = useGame((state) => state.trouble);
  if (trouble === null) return null;
  return <TroubleFace trouble={trouble} />;
}
