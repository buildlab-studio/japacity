// The ways back in for a player who kept a life (R-ACCOUNT-001), in R-ACCOUNT-023's order: Google first, then a
// code by email, then a passkey, which only signs in: it is added from the settings (R-ACCOUNT-003). Inside an
// in-app browser where Google is blocked, Google is not shown and the code is offered with a way out to the phone's
// own browser. None of them makes an account: a life starts as a guest (R-ACCOUNT-021), so a sign-in that finds no
// life says so. Signing in again needs no bot check (R-ACCOUNT-013).
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { GoogleButton } from "../../shared/ui/GoogleButton";
import { say } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import { browserLink, inAppBrowser } from "./inApp";

/** The way a sign-in on this sheet went through, for the welcome that names it (R-ACCOUNT-023); Google's comes back by its own trip. */
export type SignedInBy = "email" | "passkey";

export interface SignInProps {
  account: AccountApi;
  onSignedIn: (by: SignedInBy) => void;
  /** Back to the start screen; none inside another page. */
  onBack?: (() => void) | null;
  /** What a trip to Google came back with, when it was refused. */
  problem?: string | null;
  /** Seams for tests: the browser's user agent and the page's address. */
  agent?: string;
  href?: string;
}

function browserAgent(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}

function pageHref(): string {
  return typeof location === "undefined" ? "/" : location.href;
}

export function SignIn({ account, onSignedIn, onBack = null, problem: given = null, agent = browserAgent(), href = pageHref() }: SignInProps) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(given);
  const [copied, setCopied] = useState(false);
  const inApp = inAppBrowser(agent);
  const outLink = inApp ? browserLink(href, agent) : null;

  async function run(action: () => Promise<AuthResult>, by: SignedInBy | null) {
    setBusy(true);
    setProblem(null);
    try {
      const result = await action();
      setProblem(failureWords(result));
      if (result.ok && by !== null) onSignedIn(by);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-sign-in="returning">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {onBack === null ? null : (
            <button type="button" aria-label={say("ui.account.back")} className="press flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-sheet-muted" onClick={onBack}>
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="title text-[22px] leading-tight">{say("ui.account.returning.title")}</h1>
        </div>
        <p className="text-[14px] leading-snug text-text-2">{say("ui.account.returning.intro")}</p>
      </div>
      {inApp ? (
        <div className="flex flex-col gap-2" data-in-app>
          <p className="text-[14px] leading-snug">{say("ui.account.in-app")}</p>
          <div>
            {outLink === null ? (
              <Button onClick={() => void copy()}>{say("ui.account.in-app.copy")}</Button>
            ) : (
              <a className="inline-flex min-h-11 items-center rounded-md border border-ink/70 bg-sheet-2 px-4" href={outLink}>
                {say("ui.account.in-app.open")}
              </a>
            )}
          </div>
          {copied ? <p role="status">{say("ui.account.in-app.copied")}</p> : null}
        </div>
      ) : (
        <GoogleButton label={say("ui.account.google")} disabled={busy} onClick={() => void run(() => account.signInWithGoogle(null, "sign-in"), null)} />
      )}
      <CodeForm account={account} onSignedIn={() => onSignedIn("email")} />
      <div>
        <Button variant="quiet" disabled={busy} onClick={() => void run(() => account.signInWithPasskey(), "passkey")}>
          {say("ui.account.passkey")}
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
