// Keeping a guest life (R-ACCOUNT-021 to 023, 027). The securing sheet: Google
// first, then a code by email; inside an in-app browser no Google, and a way
// out to the phone's own browser. The asks that open it: after the first
// chapter, before the visa decision (the decision-day chapter), and at every
// `guest-only` refusal; never at the door and never before the early win
// (guides.md R-GUIDE-015). And the quiet lines: on the chapter screen while
// the life starts, on the settings and on the month report after the first
// chapter, each saying plainly that the life lives only on this phone.
import type { PlayerView } from "@japacity/sim";
import { useEffect, useRef, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { countAsk } from "../../shared/analytics/start";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { onGuestOnly } from "../../shared/net/guest";
import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { say } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import { browserLink, inAppBrowser } from "./inApp";
import { refreshAccount, useAccountView, useGuest } from "./standing";

const userAgent = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);

/** The way out of an in-app browser: a link on Android, the address copied elsewhere. */
function OpenInBrowser({ agent }: { agent: string }) {
  const [copied, setCopied] = useState(false);
  const here = typeof location === "undefined" ? "" : location.href;
  const link = here === "" ? null : browserLink(here, agent);
  if (link !== null) {
    return (
      <a className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink/70 bg-surface px-4" href={link}>
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
  /** Seam for tests: the browser's user agent. */
  agent?: string;
}

/** R-ACCOUNT-023: Google first, then the emailed code; a passkey waits for the settings once the life is kept. */
export function SecureSheet({ account, open, onOpenChange, reason, problem: given = null, agent }: SecureSheetProps) {
  const earlyWin = useGame((state) => state.earlyWin);
  const [problem, setProblem] = useState<string | null>(given);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const browser = agent ?? userAgent();
  const inApp = inAppBrowser(browser);

  useEffect(() => setProblem(given), [given]);

  async function google() {
    setBusy(true);
    setProblem(null);
    const result: AuthResult = await account.signInWithGoogle(null);
    setBusy(false);
    setProblem(failureWords(result));
  }

  function kept() {
    countAsk("sign-in", "accepted", earlyWin);
    setDone(true);
    void refreshAccount(account);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={say("ui.secure.title")} description={reason ?? say("ui.secure.why")}>
      {done ? (
        <p role="status">{say("ui.secure.done")}</p>
      ) : (
        <div className="flex flex-col gap-4" data-secure-sheet>
          {inApp ? (
            <div className="flex flex-col gap-2">
              <p>{say("ui.secure.in-app")}</p>
              <OpenInBrowser agent={browser} />
            </div>
          ) : (
            <Button variant="primary" disabled={busy} onClick={() => void google()}>
              {say("ui.secure.google")}
            </Button>
          )}
          <div className="flex flex-col gap-2">
            {inApp ? null : <p className="text-sm text-muted">{say("ui.secure.or")}</p>}
            <CodeForm account={account} sendLabel={say("ui.secure.code.send")} goLabel={say("ui.secure.code.go")} onSignedIn={kept} />
          </div>
          {problem === null ? null : (
            <p role="alert" className="text-bad">
              {problem}
            </p>
          )}
          <div>
            <Button variant="quiet" onClick={() => onOpenChange(false)}>
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
 * moment or the month report.
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
  const won = useRef(earlyWin);
  useEffect(() => {
    won.current = earlyWin;
  }, [earlyWin]);

  useEffect(
    () =>
      onGuestOnly(() => {
        setReason(say("reject.guest-only"));
        setProblem(null);
        setOpen(true);
        countAsk("sign-in", "shown", won.current);
      }),
    [],
  );

  useEffect(() => {
    if (account === null) return;
    const back = account.returnedFromGoogle();
    if (back === null) return;
    setReason(null);
    setProblem(failureWords({ ok: false, why: back }));
    setOpen(true);
  }, [account]);

  const guest = me?.state === "guest";
  const moment = guest && earlyWin ? askMoment(view) : null;
  useEffect(() => {
    if (moment === null || me === null || !quiet || open) return;
    const key = `japacity-secure-asked:${me.id}:${moment}`;
    if (askedBefore(key)) return;
    markAsked(key);
    setReason(say(`ui.secure.ask.${moment}`));
    setProblem(null);
    setOpen(true);
    countAsk("sign-in", "shown", true);
  }, [moment, me, quiet, open]);

  if (account === null) return null;
  return <SecureSheet account={account} open={open} onOpenChange={setOpen} reason={reason} problem={problem} />;
}

/** R-ACCOUNT-027: the quiet reminder, a line and a way to keep the life. Nothing for a secured account or offline. */
export function GuestReminder({ afterFirstChapter = false }: { afterFirstChapter?: boolean }) {
  const account = useGame((state) => state.account);
  const firstDone = useGame((state) => (state.view?.chapter.done.length ?? 0) > 0);
  const guest = useGuest();
  const [open, setOpen] = useState(false);
  if (account === null || !guest || (afterFirstChapter && !firstDone)) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3" data-guest-reminder>
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

/** R-ACCOUNT-021: said plainly when the life starts, on the chapter screen of the first chapter. Not an ask: no button. */
export function GuestNote() {
  const firstChapter = useGame((state) => state.view !== null && state.view.chapter.done.length === 0);
  const guest = useGuest();
  if (!guest || !firstChapter) return null;
  return (
    <p className="rounded-xl border-l-4 border-l-accent bg-surface p-3 text-sm" data-guest-note>
      {say("ui.guest.note")}
    </p>
  );
}
