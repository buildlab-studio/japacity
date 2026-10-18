// engine:browser-authority-for-dev-only: the card for a request that brought no answer the game can read. It says what happened in a person's
// words, by the failure's kind, over whatever sent it: the loading screen, the door's Begin, or the sheet whose choice
// is kept. Retry sends the same again; a login wall or an ended session also offers Reload, which opens the game anew.
// The game's card dress, never red text: the line in the game's voice, a plain
// detail under it, Retry as the yellow pressed button and Reload as the quiet one, as the door's buttons are. The kind
// and what failed stay on the card (`data-trouble`, `data-trouble-during`) for whoever reports it; no status, code or
// stack is ever shown.
import { RotateCw } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import type { Trouble } from "../../authority/store";
import { say } from "../words/text";
import { Wordmark } from "./Wordmark";

/** The page loaded again from the top, through whatever wall stands in front of it. */
export function reloadPage(): void {
  location.reload();
}

/**
 * The fault's card: the line, the detail small and plain under it, then its buttons. `named` puts the game's name at its
 * head, for a visitor who has seen nothing of the game yet.
 */
export function FaultCard({ line, detail, named = false, children, ...rest }: { line: string; detail: string; named?: boolean; children: ReactNode; role?: string }) {
  return (
    <div className="lively-card w-full max-w-[420px] p-4 text-left" {...rest}>
      {named ? <Wordmark ground="light" className="mb-3" /> : null}
      <p className="text-[18px] leading-snug font-bold">{line}</p>
      <p className="mt-1 text-[14px] leading-snug text-text-2" data-trouble-detail>
        {detail}
      </p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

/**
 * The card's face: the words and the buttons. `inline` sits in the loading screen's place; otherwise it covers the screen.
 * `named` puts the game's name at its head.
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
      className={inline ? "fade mx-auto w-full max-w-[420px] p-4" : "fixed inset-0 z-[70] flex items-end justify-center bg-scrim/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"}
    >
      <FaultCard line={words} detail={say(`ui.trouble.${trouble.kind}.detail`)} named={named}>
        <button type="button" className="press-button w-full" onClick={again} disabled={sending} autoFocus>
          <span>{say("ui.trouble.retry")}</span>
          <RotateCw size={18} aria-hidden />
        </button>
        {trouble.kind === "wall" ? (
          <button type="button" className="pill-button h-12! w-full" onClick={reloadPage}>
            {say("ui.trouble.reload")}
          </button>
        ) : null}
      </FaultCard>
    </div>
  );
}

/** The card over the screen, while a request waits to be sent again. */
export function TroubleCard() {
  const trouble = useGame((state) => state.trouble);
  if (trouble === null) return null;
  return <TroubleFace trouble={trouble} />;
}
