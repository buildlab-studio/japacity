// Keeping a guest life (account:guest-and-secured-states, account:social-needs-secured-account, account:guest-secures-the-life, account:guest-reminded-to-secure). The securing sheet: Google
// first, then a code by email; inside an in-app browser the code alone, here, since the life lives in that app's own
// browser and nowhere else, and once it is kept the way out to the phone's own browser. A way in that already has a life is refused, with the way to open that kept life
// instead, which ends this one; the account sheet offers the same. The asks that open it: after the first
// chapter, before the visa decision (the decision-day chapter), and at every
// `guest-only` refusal; never at the door and never before the early win
// (guide:nothing-asked-before-early-win). And the quiet lines, on the settings and on the
// month results after the first chapter, each saying plainly that the life
// lives only on this phone; the page at the door says it when the life starts
// (GuestStart.tsx). Once kept, by the code here or by the trip to Google and back, the sheet says so in its kept
// state, and as it closes the world says which way in a short line (WayToast.tsx).
import type { PlayerView } from "@japacity/sim";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import { countAsk } from "../../shared/analytics/start";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { onGuestOnly } from "../../shared/net/guest";
import { Button } from "../../shared/ui/Button";
import { GoogleButton } from "../../shared/ui/GoogleButton";
import { Sheet } from "../../shared/ui/Sheet";
import { useEarlyWin } from "../../shared/ui/stage";
import { Wordmark } from "../../shared/ui/Wordmark";
import { say } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import { inAppBrowser } from "./inApp";
import { askWaysBackIn, backFromDeleteTrip } from "./marks";
import { OpenInBrowser } from "./OpenInBrowser";
import { refreshAccount, useAccountView, useGuest } from "./standing";
import { tellWay, WayToast } from "./WayToast";
import { loadAccountSheet, type AccountSheet } from "./AccountButton";
import { secureAskedKey } from "../../shared/storage/storage";

const userAgent = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);

/**
 * Leaves this guest life for a kept one (account:guest-secures-the-life): signs the guest out and opens the ways back in, the
 * address the guest typed filled in. The guest life has no way back after it, which is said before.
 */
export function useOpenKeptLife(): (email: string | null) => Promise<AuthResult> {
  const account = useGame((state) => state.account);
  const leave = useGame((state) => state.leave);
  return async (email) => {
    if (account === null) return { ok: false, why: "unreachable" };
    // A sign-out that never reached the server leaves this guest signed in, and the kept life's sign-in would be refused as taken again.
    const out = await account.signOut();
    if (!out.ok) return out;
    askWaysBackIn(email);
    leave(null);
    return out;
  };
}

/**
 * The way to the kept life, with what it costs said first. It throws this guest life away, so Carry on playing is the main
 * button and the way out wears the warning colour apart from it (world:costly-acts-confirmed).
 */
function OpenKeptLife({ email, lead = null, onKeep }: { email: string | null; lead?: ReactNode; onKeep: () => void }) {
  const open = useOpenKeptLife();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2" data-open-kept>
      {lead}
      <p className="text-[14px]">{say("ui.secure.taken.ends")}</p>
      <div>
        <Button variant="primary" disabled={busy} onClick={onKeep}>
          {say("ui.guest.sign-out.stay")}
        </Button>
      </div>
      <div className="mt-1 border-t border-sheet-line pt-3">
        <Button
          variant="warning"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setProblem(null);
            void open(email)
              .then((result) => {
                if (!result.ok) setProblem(failureWords(result));
              })
              .finally(() => setBusy(false));
          }}
        >
          {say("ui.secure.taken.open")}
        </Button>
      </div>
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}

export interface SecureSheetProps {
  account: AccountApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Why the sheet opened, in the player's words; the plain reason when null. */
  reason: string | null;
  /** A failure to say at the top as the sheet opens, as when Google came back refused (account:guest-secures-the-life). */
  problem?: string | null;
  /** The life came back kept from Google: the sheet opens in its kept state. */
  kept?: "google" | null;
  /** Google came back refused because its address already has a life: the way to that life is offered. */
  taken?: boolean;
  /** Seam for tests: the browser's user agent. */
  agent?: string;
}

/**
 * account:guest-secures-the-life: Google first, on Google's own button, then the emailed code; a passkey waits for the settings once the
 * life is kept. Once kept, the sheet says only that: the kept heading, the one line and its close, with no reason, no
 * ways to keep and no Not now.
 */
export function SecureSheet({ account, open, onOpenChange, reason, problem: given = null, kept: back = null, taken: takenBack = false, agent }: SecureSheetProps) {
  const earlyWin = useEarlyWin();
  // What the trip to Google came back with stands at the top; what a way on this sheet answers stands at its foot, by the ways.
  const [returned, setReturned] = useState<string | null>(given);
  const [problem, setProblem] = useState<string | null>(null);
  // Which way the life was kept, once it is: the sheet's kept state, and the line the world says as it closes.
  const [keptWith, setKeptWith] = useState<"google" | "email" | null>(back);
  const done = keptWith !== null;
  const [busy, setBusy] = useState(false);
  const browser = agent ?? userAgent();
  const inApp = inAppBrowser(browser);
  // A way in that already has a life, with the address when the code was the way: the kept life can be opened instead.
  const [taken, setTaken] = useState<{ email: string | null } | null>(takenBack ? { email: null } : null);

  useEffect(() => setReturned(given), [given]);
  useEffect(() => setTaken(takenBack ? { email: null } : null), [takenBack]);
  useEffect(() => {
    if (back !== null) setKeptWith(back);
  }, [back]);

  async function google() {
    setBusy(true);
    setProblem(null);
    setReturned(null);
    setTaken(null);
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
        <div className="flex flex-col gap-3">
          <p role="status" data-secure-kept>
            {say("ui.secure.done")}
          </p>
          {/* Kept inside an app's own browser: now the life can go to the phone's own. */}
          {inApp ? (
            <div>
              <OpenInBrowser agent={browser} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-secure-sheet>
          {returned === null ? null : (
            <p role="alert" className="font-bold text-bad" data-google-returned>
              {returned}
            </p>
          )}
          {/* Inside an in-app browser the life lives in that app's own browser: it is kept here, by the code. */}
          {inApp ? (
            <p data-in-app>{say("ui.secure.in-app")}</p>
          ) : (
            <GoogleButton label={say("ui.secure.google")} disabled={busy} onClick={() => void google()} />
          )}
          <div className="flex flex-col gap-2">
            {inApp ? null : <p className="text-sm text-text-2">{say("ui.secure.or")}</p>}
            <CodeForm account={account} sendLabel={say("ui.secure.code.send")} goLabel={say("ui.secure.code.go")} onSignedIn={kept} onTaken={(email) => setTaken({ email })} />
          </div>
          {problem === null ? null : (
            <p role="alert" className="text-bad">
              {problem}
            </p>
          )}
          {taken === null ? null : <OpenKeptLife email={taken.email} onKeep={() => setTaken(null)} />}
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

/** The staged moments of account:guest-secures-the-life the view is at, if any. */
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
 * the place's first frame (its pending mark, chapter:first-chapter-mission-card): a staged ask waits for it to close.
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
  const earlyWin = useEarlyWin();
  const quiet = useGame((state) => state.moments.length === 0 && !state.reportOpen);
  const me = useAccountView();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [kept, setKept] = useState<"google" | null>(null);
  const [taken, setTaken] = useState(false);
  // account:player-deletes-account: the account sheet's code, fetched to open the delete confirmation again after Google.
  const [again, setAgain] = useState<AccountSheet | null>(null);
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
    // account:player-deletes-account: back from Google to confirm a deletion: the confirmation stands open again, for the same account only.
    if (back === "delete") {
      void refreshAccount(account).then((now) => {
        if (now !== null && backFromDeleteTrip(now.id)) loadAccountSheet().then(setAgain, () => undefined);
      });
      return;
    }
    // A kept life signed back in to with Google: the world says so, and nothing opens.
    if (back === "signed-in") {
      tellWay(account, "in.google");
      return;
    }
    setReason(null);
    if (back === "kept") {
      // account:guest-secures-the-life: the guest's life came back kept from Google; the sheet opens kept, as the emailed code's does.
      setProblem(null);
      setKept("google");
      setOpen(true);
      void refreshAccount(account);
      return;
    }
    setKept(null);
    setTaken(back === "taken");
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
    const key = secureAskedKey(me.id, moment);
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
      <SecureSheet account={account} open={open} onOpenChange={setOpen} reason={reason} problem={problem} kept={kept} taken={taken} />
      {again === null ? null : <again.DeleteAgain account={account} onClose={() => setAgain(null)} />}
      <WayToast account={account} />
    </>
  );
}

/**
 * account:guest-reminded-to-secure: the quiet reminder, a line and a way to keep the life. Nothing for a secured account or offline.
 * On the account sheet (`returning`, there unless it stands after the first chapter) it also offers "Sign in"
 * (account:guest-secures-the-life): a first press says that this life ends, a second opens the ways back in.
 */
export function GuestReminder({ afterFirstChapter = false, returning = !afterFirstChapter }: { afterFirstChapter?: boolean; returning?: boolean }) {
  const account = useGame((state) => state.account);
  const firstDone = useGame((state) => (state.view?.chapter.done.length ?? 0) > 0);
  const guest = useGuest();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  if (account === null || !guest || (afterFirstChapter && !firstDone)) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-sheet-line bg-sheet-2 p-3" data-guest-reminder>
      <p>{say("ui.guest.reminder")}</p>
      <div>
        <Button small onClick={() => setOpen(true)}>
          {say("ui.guest.keep")}
        </Button>
      </div>
      {!returning ? null : leaving ? (
        <OpenKeptLife email={null} onKeep={() => setLeaving(false)} />
      ) : (
        <div>
          <Button variant="quiet" small onClick={() => setLeaving(true)}>
            {say("ui.account.start.returning")}
          </Button>
        </div>
      )}
      <SecureSheet account={account} open={open} onOpenChange={setOpen} reason={null} />
    </div>
  );
}
