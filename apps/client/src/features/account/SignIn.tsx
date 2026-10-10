// The ways in (R-ACCOUNT-001), in R-ACCOUNT-023's order: Google first, then a code by email, then a passkey,
// which only signs in: it is added from the settings (R-ACCOUNT-003). Inside an in-app browser where Google is
// blocked, Google is not shown and the code is offered with a way out to the phone's own browser. The bot check
// runs unseen beside the ways that can make an account (R-ACCOUNT-013, R-ACCOUNT-029).
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import { browserLink, inAppBrowser } from "./inApp";
import { Turnstile, type LoadTurnstile } from "./Turnstile";

export interface SignInProps {
  account: AccountApi;
  sitekey: string | null;
  load: LoadTurnstile;
  onSignedIn: () => void;
  /** Reached from "I already have a life here": its own heading and a way back to the start screen. */
  returning?: boolean;
  onBack?: (() => void) | null;
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

export function SignIn({ account, sitekey, load, onSignedIn, returning = false, onBack = null, agent = browserAgent(), href = pageHref() }: SignInProps) {
  const [bot, setBot] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inApp = inAppBrowser(agent);
  const outLink = inApp ? browserLink(href, agent) : null;

  const spentBot = () => {
    setBot(null);
    setRound((count) => count + 1);
  };

  async function run(action: () => Promise<AuthResult>, spends: boolean) {
    setBusy(true);
    setProblem(null);
    try {
      const result = await action();
      if (spends && bot !== null) spentBot();
      setProblem(failureWords(result));
      if (result.ok) onSignedIn();
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
    <div className="flex flex-col gap-4" data-sign-in={returning ? "returning" : "new"}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {onBack === null ? null : (
            <button type="button" aria-label={say("ui.account.back")} className="press flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-sheet-muted" onClick={onBack}>
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="title text-[22px] leading-tight">{say(returning ? "ui.account.returning.title" : "ui.account.title")}</h1>
        </div>
        <p className="text-[14px] leading-snug text-text-2">{say(returning ? "ui.account.returning.intro" : "ui.account.intro")}</p>
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
        <Button variant="primary" disabled={busy} onClick={() => void run(() => account.signInWithGoogle(bot), true)}>
          {say("ui.account.google")}
        </Button>
      )}
      <CodeForm account={account} bot={bot} spentBot={spentBot} onSignedIn={onSignedIn} />
      <div>
        <Button variant="quiet" disabled={busy} onClick={() => void run(() => account.signInWithPasskey(), false)}>
          {say("ui.account.passkey")}
        </Button>
      </div>
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
      {/* Unseen unless Cloudflare needs a tap (R-ACCOUNT-029). */}
      {sitekey === null ? null : <Turnstile sitekey={sitekey} load={load} round={round} onToken={setBot} />}
    </div>
  );
}
