// The passkey offered right after a way in (account:passkey-offered-where-it-works), as most sites offer one after a sign-up
// or a sign-in by another way. A life just kept meets it as the Kept sheet's next step (PasskeyStep, in Secure.tsx's sheet):
// "Saved", then the passkey with Not now, which closes the sheet. A kept life signed back in to meets it on a small card over
// the world that follows the way's welcome line (WayToast.tsx) once that line has been told, never over an open sheet or a
// moment that holds the screen (it waits for them to close). Both show only where a passkey can be made here and the account
// holds none, and once per device: the offer is marked as either shows. The session that just opened is fresh, so Add a
// passkey makes it at once (account:passkey-added-in-place); a cancel says nothing (the card closes, the step stands) and any
// other failure is told where it was asked, as the sheet tells it (account:passkey-errors-told-apart).
import type { AccountView } from "@japacity/api";
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

/**
 * Whether the offer is due once the browser and the account have answered: "wait" while either is unknown or the account read is
 * still the guest's, "none" where it is never made, else "ask", with the device marked as offered.
 */
function offerDue(works: boolean | null, me: AccountView | null): "wait" | "none" | "ask" {
  if (works === null || me === null) return "wait";
  if (!works || me.ways.passkeys > 0 || offeredHere()) return "none";
  // The account read before the way in finished may still be the guest's: the offer waits for the kept one.
  return me.state === "secured" ? "ask" : "wait";
}

/** Makes the passkey: null once it is made (the passkey mark set, the account read again), "" for a cancel, else the failure's words. */
async function makePasskey(account: AccountApi): Promise<string | null> {
  const result = await account.addPasskey();
  if (result.ok) {
    // account:passkey-in-email-autofill: this browser has made one, so its ways back in put the passkey first.
    markPasskeyHere();
    void refreshAccount(account);
    return null;
  }
  return result.why === "cancelled" ? "" : (failureWords(result) ?? "");
}

/** The passkey's picture, title and line, as the card and the step both say them. */
function OfferHead({ titleId, level }: { titleId: string; level: "h2" | "h3" }) {
  const Title = level;
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-accent text-accent-ink">
        <KeyRound size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Title id={titleId} className="text-[17px] leading-snug font-bold">
          {say("ui.account.passkey.card.title")}
        </Title>
        <p className="text-[14px] leading-snug text-text-2">{say("ui.account.passkey.card.line")}</p>
      </div>
    </div>
  );
}

/**
 * The Kept sheet's next step (account:passkey-offered-where-it-works, account:guest-secures-the-life): under "Saved", the passkey with Add
 * a passkey and Not now, which skips it and closes the sheet (`onSkip`). Nothing where no passkey can be made, the account holds
 * one or this device was offered one before. A cancel says nothing and the step stands.
 */
export function PasskeyStep({ account, onSkip }: { account: AccountApi; onSkip: () => void }) {
  const works = usePasskeysWork(account);
  const me = useAccountView();
  const [phase, setPhase] = useState<Phase | "none">("waiting");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (phase !== "waiting") return;
    const due = offerDue(works, me);
    if (due === "wait") return;
    if (due === "ask") markOffered();
    setPhase(due === "ask" ? "asking" : "none");
  }, [phase, works, me]);

  async function add() {
    setBusy(true);
    setProblem(null);
    const failed = await makePasskey(account);
    setBusy(false);
    if (failed === null) setPhase("added");
    else if (failed !== "") setProblem(failed);
  }

  if (phase === "waiting" || phase === "none") return null;
  return (
    <section aria-labelledby={titleId} className="look-card flex flex-col gap-3 p-4" data-passkey-step>
      <OfferHead titleId={titleId} level="h3" />
      {/* One live region from the step's start, so the passkey made is read out when its words come. */}
      <p role="status" className={phase === "added" ? "font-bold" : "sr-only"}>
        {phase === "added" ? say("ui.account.passkey.added") : ""}
      </p>
      {phase === "added" ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={busy} onClick={() => void add()}>
            {say("ui.account.passkey.add")}
          </Button>
          <Button variant="quiet" disabled={busy} onClick={onSkip}>
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
  );
}

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
    if (phase !== "waiting") return;
    const due = offerDue(works, me);
    if (due === "none") {
      done.current();
      return;
    }
    if (due === "wait" || !quiet || !clear) return;
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
    const failed = await makePasskey(account);
    setBusy(false);
    if (failed === null) setPhase("added");
    else if (failed === "") done.current();
    else setProblem(failed);
  }

  if (phase === "waiting") return null;
  // Over the world and its cards, as the world's own top cards stand; under the phone, the map and every sheet.
  return (
    <CentredColumn className="pointer-events-none fixed inset-x-0 top-0 z-[38] px-4 pt-[calc(max(10px,env(safe-area-inset-top))+64px)]">
      <section aria-labelledby={titleId} className="brief-toast slide-in pointer-events-auto flex flex-col gap-3 p-4" data-passkey-card>
        <OfferHead titleId={titleId} level="h2" />
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
