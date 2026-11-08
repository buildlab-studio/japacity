// The guest's standing reminder over the world (account:guest-reminded-to-secure, account:guest-secures-the-life): a small "Not saved"
// sticker chip the shell hangs under the band's money (world:top-band-is-a-pill), never a countdown or an alarm. A tap opens the
// keep-this-life sheet, the same one the asks open, which inside an in-app browser offers the email alone. It shows only while the
// life is a guest's, so it goes the moment the life is saved, while the sheet stays open in its Kept state; a secured account and
// the local game, which has no account, never carry it. It rides the life's screens, never the first visit
// (engine:first-download-has-budget).
import { CloudOff } from "lucide-react";
import { useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { say } from "../../shared/words/text";
import { SecureSheet } from "./Secure";
import { useGuest } from "./standing";

/** `agent`: seam for tests, the browser's user agent. */
export function SaveChip({ agent }: { agent?: string }) {
  const account = useGame((state) => state.account);
  const guest = useGuest();
  const [open, setOpen] = useState(false);
  if (account === null) return null;
  return (
    <>
      {guest ? (
        <button
          type="button"
          className="sticker-chip chip-in press reach pointer-events-auto bg-sheet-2 py-1 text-[13px]"
          style={{ rotate: "2deg" }}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          data-save-chip
        >
          <CloudOff size={14} strokeWidth={2.4} aria-hidden className="shrink-0 text-text-2" />
          {say("ui.guest.chip")}
        </button>
      ) : null}
      {/* The sheet outlives the chip once the life is saved, so its Kept state stands until it is closed. */}
      {guest || open ? <SecureSheet account={account} open={open} onOpenChange={setOpen} reason={null} {...(agent === undefined ? {} : { agent })} /> : null}
    </>
  );
}
