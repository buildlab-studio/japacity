// The passkey offered right after a way in (account:passkey-offered-where-it-works), as most sites offer one after a sign-up
// or a sign-in by another way: a small card over the world that follows the way's welcome line (WayToast.tsx) once that line
// has been told. Only where a passkey can be made here and the account holds none, never over an open sheet or a moment that
// holds the screen (it waits for them to close), and once per device: the offer is marked as it shows. The session that just
// opened is fresh, so Add a passkey makes it at once (account:passkey-added-in-place); a cancel closes the card quietly and
// any other failure is told in the card, as the sheet tells it (account:passkey-errors-told-apart).
import { KeyRound } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import type { AccountApi } from "../../shared/net/auth";
import { browserStorage, PASSKEY_OFFERED_KEY } from "../../shared/storage/storage";
import { Button } from "../../shared/ui/Button";
import { CentredColumn } from "../../shared/ui/look/CentredColumn";
import { say } from "../../shared/words/text";
import { SAID_TOAST_MS } from "../../shared/world/SaidToast";
import { CLEAR_EVERY_MS, otherSheetUp } from "./clear";
import { failureWords } from "./CodeForm";
import { markPasskeyHere } from "./marks";
import { usePasskeysWork } from "./PasskeyList";
import { refreshAccount, useAccountView } from "./standing";

/** Storage that refuses a write cannot keep the offer: it is held for this visit instead, so it is made once here. */
let offeredThisVisit = false;

function offeredHere(): boolean {
  if (offeredThisVisit) return true;
  try {
    return (browserStorage()?.getItem(PASSKEY_OFFERED_KEY) ?? null) !== null;
  } catch {
    return false;
  }
}

function markOffered(): void {
  try {
    const store = browserStorage();
    if (store === null) offeredThisVisit = true;
    else store.setItem(PASSKEY_OFFERED_KEY, "1");
  } catch {
    offeredThisVisit = true;
  }
}

type Phase = "waiting" | "asking" | "added";

/** `onDone`: the card is over, shown or not; the next way in may bring it back, where nothing marked it. */
export function PasskeyCard({ account, onDone }: { account: AccountApi; onDone: () => void }) {
  const works = usePasskeysWork(account);
  const me = useAccountView();
  const quiet = useGame((state) => state.moments.length === 0 && !state.reportOpen);
  const [clear, setClear] = useState(false);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const titleId = useId();

  useEffect(() => {
    if (phase !== "waiting") return;
    const look = () => setClear(!otherSheetUp());
    look();
    const timer = window.setInterval(look, CLEAR_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "waiting" || works === null || me === null) return;
    if (!works || me.ways.passkeys > 0 || offeredHere()) {
      done.current();
      return;
    }
    // The account read before the way in finished may still be the guest's: the card waits for the kept one.
    if (me.state !== "secured" || !quiet || !clear) return;
    markOffered();
    setPhase("asking");
  }, [phase, works, me, quiet, clear]);

  useEffect(() => {
    if (phase !== "added") return;
    const timer = window.setTimeout(() => done.current(), SAID_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  async function add() {
    setBusy(true);
    setProblem(null);
    const result = await account.addPasskey();
    setBusy(false);
    if (result.ok) {
      // account:passkey-in-email-autofill: this browser has made one, so its ways back in put the passkey first.
      markPasskeyHere();
      setPhase("added");
      void refreshAccount(account);
      return;
    }
    if (result.why === "cancelled") {
      done.current();
      return;
    }
    setProblem(failureWords(result));
  }

  if (phase === "waiting") return null;
  return (
    <CentredColumn className="pointer-events-none fixed inset-x-0 top-0 z-30 px-4 pt-[calc(max(10px,env(safe-area-inset-top))+64px)]">
      <section aria-labelledby={titleId} className="brief-toast slide-in pointer-events-auto flex flex-col gap-3 p-4" data-passkey-card>
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
            <KeyRound size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 id={titleId} className="text-[17px] leading-snug font-bold">
              {say("ui.account.passkey.card.title")}
            </h2>
            <p className="text-[14px] leading-snug text-text-2">{say("ui.account.passkey.card.line")}</p>
          </div>
        </div>
        {/* One live region from the card's start, so the passkey made is read out when its words come. */}
        <p role="status" className={phase === "added" ? "font-bold" : "sr-only"}>
          {phase === "added" ? say("ui.account.passkey.added") : ""}
        </p>
        {phase === "added" ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={busy} onClick={() => void add()}>
              {say("ui.account.passkey.add")}
            </Button>
            <Button variant="quiet" disabled={busy} onClick={() => done.current()}>
              {say("ui.account.passkey.later")}
            </Button>
          </div>
        )}
        {problem === null ? null : (
          <p role="alert" className="text-bad">
            {problem}
          </p>
        )}
      </section>
    </CentredColumn>
  );
}
