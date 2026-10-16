// Keeping a guest life (R-ACCOUNT-021 to 023, 027). The securing sheet: Google
// first, then a code by email; inside an in-app browser no Google, and a way
// out to the phone's own browser. The asks that open it: after the first
// chapter, before the visa decision (the decision-day chapter), and at every
// `guest-only` refusal; never at the door and never before the early win
// (guides.md R-GUIDE-015). And the quiet lines, on the settings and on the
// month results after the first chapter, each saying plainly that the life
// lives only on this phone; the page at the door says it when the life starts
// (GuestStart.tsx). Once kept, by the code here or by the trip to Google and back, the sheet says so in its kept
// state, and as it closes the world says which way in a short line (WayToast.tsx).
import type { PlayerView } from "@japacity/sim";
import { useEffect, useRef, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { countAsk } from "../../shared/analytics/start";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { onGuestOnly } from "../../shared/net/guest";
import { Button } from "../../shared/ui/Button";
import { GoogleButton } from "../../shared/ui/GoogleButton";
import { Sheet } from "../../shared/ui/Sheet";
import { Wordmark } from "../../shared/ui/Wordmark";
import { say } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import { browserLink, inAppBrowser } from "./inApp";
import { refreshAccount, useAccountView, useGuest } from "./standing";
import { tellWay, WayToast } from "./WayToast";

const userAgent = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);

/** The way out of an in-app browser: a link on Android, the address copied elsewhere. */
function OpenInBrowser({ agent }: { agent: string }) {
  const [copied, setCopied] = useState(false);
  const here = typeof location === "undefined" ? "" : location.href;
  const link = here === "" ? null : browserLink(here, agent);
  if (link !== null) {
    return (
      <a className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink/70 bg-sheet-2 px-4" href={link}>
        {say("ui.secure.open")}
      </a>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Button
        onClick={() => {
          void navigator.clipboard
            ?.writeText(here)
            .then(() => setCopied(true))
            .catch(() => undefined);
        }}
      >
        {say("ui.secure.copy")}
      </Button>
      {copied ? <p role="status">{say("ui.secure.copied")}</p> : null}
    </div>
  );
}

export interface SecureSheetProps {
  account: AccountApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Why the sheet opened, in the player's words; the plain reason when null. */
  reason: string | null;
  /** A failure to say as the sheet opens, as when Google came back refused. */
  problem?: string | null;
  /** The life came back kept from Google: the sheet opens in its kept state. */
  kept?: "google" | null;
  /** Seam for tests: the browser's user agent. */
  agent?: string;
}

/**
 * R-ACCOUNT-023: Google first, on Google's own button, then the emailed code; a passkey waits for the settings once the
 * life is kept. Once kept, the sheet says only that: the kept heading, the one line and its close; the reason, the ways
 * to keep and Not now are gone.
 */
export function SecureSheet({ account, open, onOpenChange, reason, problem: given = null, kept: back = null, agent }: SecureSheetProps) {
  const earlyWin = useGame((state) => state.earlyWin);
  const [problem, setProblem] = useState<string | null>(given);
  // Which way the life was kept, once it is: the sheet's kept state, and the line the world says as it closes.
  const [keptWith, setKeptWith] = useState<"google" | "email" | null>(back);
  const done = keptWith !== null;
  const [busy, setBusy] = useState(false);
  const browser = agent ?? userAgent();
  const inApp = inAppBrowser(browser);

  useEffect(() => setProblem(given), [given]);
  useEffect(() => {
    if (back !== null) setKeptWith(back);
  }, [back]);

  async function google() {
    setBusy(true);
    setProblem(null);
    const result: AuthResult = await account.signInWithGoogle(null, "keep");
    setBusy(false);
    setProblem(failureWords(result));
  }

  function kept() {
    countAsk("sign-in", "accepted", earlyWin);
    setKeptWith("email");
    void refreshAccount(account);
  }

  function openChange(next: boolean) {
    if (!next && keptWith !== null) tellWay(account, `kept.${keptWith}`);
    onOpenChange(next);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={openChange}
      title={say(done ? "ui.secure.done.title" : "ui.secure.title")}
      {...(done ? {} : { description: reason ?? say("ui.secure.why") })}
      top={<Wordmark ground="light" />}
    >
      {done ? (
        <p role="status" data-secure-kept>
          {say("ui.secure.done")}
        </p>
      ) : (
        <div className="flex flex-col gap-4" data-secure-sheet>
          {inApp ? (
            <div className="flex flex-col gap-2">
              <p>{say("ui.secure.in-app")}</p>
              <OpenInBrowser agent={browser} />
            </div>
          ) : (
            <GoogleButton label={say("ui.secure.google")} disabled={busy} onClick={() => void google()} />
          )}
          <div className="flex flex-col gap-2">
            {inApp ? null : <p className="text-sm text-text-2">{say("ui.secure.or")}</p>}
            <CodeForm account={account} sendLabel={say("ui.secure.code.send")} goLabel={say("ui.secure.code.go")} onSignedIn={kept} />
          </div>
          {problem === null ? null : (
            <p role="alert" className="text-bad">
              {problem}
            </p>
          )}
          <div>
            <Button variant="quiet" onClick={() => openChange(false)}>
              {say("ui.secure.later")}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** The staged moments of R-ACCOUNT-023 the view is at, if any. */
export type AskMoment = "first-chapter" | "visa";

const DECISION_DAY = "chapter.decision-day";

export function askMoment(view: PlayerView | null): AskMoment | null {
  if (view === null) return null;
  if (view.chapter.current === DECISION_DAY) return "visa";
  if (view.chapter.done.length > 0) return "first-chapter";
  return null;
}

/** How often a staged ask that is due looks again for the sheet or card over it to close. */
const CLEAR_EVERY_MS = 500;

/**
 * Another sheet or card is up (a chapter's opening, an ask, the results), or the first brief's card is still waiting for
 * the place's first frame (its pending mark, R-CHAPTER-011 as amended 16 Oct 2026): a staged ask waits for it to close.
 */
function otherSheetUp(): boolean {
  return typeof document !== "undefined" && document.querySelector('[role="dialog"][data-open], [data-brief-pending]') !== null;
}

/** An ask is made once per account and moment; kept in this browser, as the life is. */
const askedHere = new Set<string>();

function askedBefore(key: string): boolean {
  if (askedHere.has(key)) return true;
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function markAsked(key: string): void {
  askedHere.add(key);
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Private windows refuse storage; the set above still holds for this visit.
  }
}

/**
 * The asks, mounted once in the shell while a life plays. A `guest-only`
 * refusal from any route opens the sheet with the server's own reason; the
 * staged moments open it once each, after the early win and never over a
 * moment, the month report or another sheet or card that is up.
 */
export function SecureAsk() {
  const account = useGame((state) => state.account);
  const view = useGame((state) => state.view);
  const earlyWin = useGame((state) => state.earlyWin);
  const quiet = useGame((state) => state.moments.length === 0 && !state.reportOpen);
  const me = useAccountView();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [kept, setKept] = useState<"google" | null>(null);
  const won = useRef(earlyWin);
  useEffect(() => {
    won.current = earlyWin;
  }, [earlyWin]);

  useEffect(
    () =>
      onGuestOnly(() => {
        setReason(say("reject.guest-only"));
        setProblem(null);
        setKept(null);
        setOpen(true);
        countAsk("sign-in", "shown", won.current);
      }),
    [],
  );

  useEffect(() => {
    if (account === null) return;
    const back = account.returnedFromGoogle();
    if (back === null) return;
    // A kept life signed back in to with Google: the world says so, and nothing opens.
    if (back === "signed-in") {
      tellWay(account, "in.google");
      return;
    }
    setReason(null);
    if (back === "kept") {
      // R-ACCOUNT-023: the guest's life came back kept from Google; the sheet opens kept, as the emailed code's does.
      setProblem(null);
      setKept("google");
      setOpen(true);
      void refreshAccount(account);
      return;
    }
    setKept(null);
    setProblem(failureWords({ ok: false, why: back }));
    setOpen(true);
  }, [account]);

  const guest = me?.state === "guest";
  const moment = guest && earlyWin ? askMoment(view) : null;
  const due = moment !== null && me !== null && quiet && !open;
  const [clear, setClear] = useState(true);
  useEffect(() => {
    if (!due) return;
    const look = () => setClear(!otherSheetUp());
    look();
    const timer = window.setInterval(look, CLEAR_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [due]);
  useEffect(() => {
    if (moment === null || me === null || !quiet || open || !clear || otherSheetUp()) return;
    const key = `japacity-secure-asked:${me.id}:${moment}`;
    if (askedBefore(key)) return;
    markAsked(key);
    setReason(say(`ui.secure.ask.${moment}`));
    setProblem(null);
    setKept(null);
    setOpen(true);
    countAsk("sign-in", "shown", true);
  }, [moment, me, quiet, open, clear]);

  if (account === null) return null;
  return (
    <>
      <SecureSheet account={account} open={open} onOpenChange={setOpen} reason={reason} problem={problem} kept={kept} />
      <WayToast account={account} />
    </>
  );
}

/** R-ACCOUNT-027: the quiet reminder, a line and a way to keep the life. Nothing for a secured account or offline. */
export function GuestReminder({ afterFirstChapter = false }: { afterFirstChapter?: boolean }) {
  const account = useGame((state) => state.account);
  const firstDone = useGame((state) => (state.view?.chapter.done.length ?? 0) > 0);
  const guest = useGuest();
  const [open, setOpen] = useState(false);
  if (account === null || !guest || (afterFirstChapter && !firstDone)) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-sheet-line bg-sheet-2 p-3" data-guest-reminder>
      <p>{say("ui.guest.reminder")}</p>
      <div>
        <Button small onClick={() => setOpen(true)}>
          {say("ui.guest.keep")}
        </Button>
      </div>
      <SecureSheet account={account} open={open} onOpenChange={setOpen} reason={null} />
    </div>
  );
}
