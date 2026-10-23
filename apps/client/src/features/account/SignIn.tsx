// The ways back in for a player who kept a life (account:sign-in-without-secret), in account:guest-secures-the-life's order: Google first, then a
// code by email, then a passkey, which only signs in: it is added from the settings (account:passkey-needs-signed-in-session). Inside an
// in-app browser where Google is blocked, Google is not shown and the code is offered with a way out to the phone's
// own browser, and no passkey, which is unreliable there. The email field offers this browser's passkeys in its autofill where the browser can, and where a
// passkey was added or used in this browser the passkey comes first, at Google's weight (account:passkey-in-email-autofill).
// None of them makes an account: a life starts as a guest (account:guest-and-secured-states), so a sign-in that finds no
// life says so. Signing in again needs no bot check (account:bot-check-on-guest-creation).
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { GoogleButton } from "../../shared/ui/GoogleButton";
import { say } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import { inAppBrowser } from "./inApp";
import { markPasskeyHere, passkeyHere } from "./marks";
import { OpenInBrowser } from "./OpenInBrowser";

/** The way a sign-in on this sheet went through, for the welcome that names it (account:guest-secures-the-life); Google's comes back by its own trip. */
export type SignedInBy = "email" | "passkey";

export interface SignInProps {
  account: AccountApi;
  onSignedIn: (by: SignedInBy) => void;
  /** Back to the start screen; none inside another page. */
  onBack?: (() => void) | null;
  /** What a trip to Google came back with, when it was refused: said at the top of the sheet (account:guest-secures-the-life). */
  problem?: string | null;
  /** The address to fill the email field with: the one a guest typed before choosing its kept life. */
  filled?: string | null;
  /** Seams for tests: the browser's user agent and the page's address, whether the browser offers passkeys in a field's autofill, and whether a passkey was used here. */
  agent?: string;
  href?: string;
  autofill?: () => Promise<boolean>;
  passkeyUsed?: boolean;
}

function browserAgent(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}

function pageHref(): string {
  return typeof location === "undefined" ? "/" : location.href;
}

/** The parts of WebAuthn's `PublicKeyCredential` asked about, any of which an older browser lacks. */
interface CredentialAsk {
  getClientCapabilities?: () => Promise<Record<string, boolean | undefined>>;
  isConditionalMediationAvailable?: () => Promise<boolean>;
}

/**
 * Whether this browser offers passkeys in a field's autofill, as WebAuthn says (https://web.dev/articles/passkey-form-autofill,
 * https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential/getClientCapabilities_static); an older browser that
 * lacks the capabilities is asked the older way.
 */
export async function browserAutofill(): Promise<boolean> {
  const credential = typeof window === "undefined" ? undefined : (window as { PublicKeyCredential?: CredentialAsk }).PublicKeyCredential;
  if (credential === undefined) return false;
  try {
    if (credential.getClientCapabilities !== undefined) return (await credential.getClientCapabilities()).conditionalGet === true;
    return (await credential.isConditionalMediationAvailable?.()) === true;
  } catch {
    return false;
  }
}

export function SignIn({ account, onSignedIn, onBack = null, problem: given = null, filled = null, agent = browserAgent(), href = pageHref(), autofill = browserAutofill, passkeyUsed = passkeyHere() }: SignInProps) {
  const [busy, setBusy] = useState(false);
  // What the trip to Google came back with stands at the top; what a way on this sheet answers stands at its foot, by the ways.
  const [returned, setReturned] = useState<string | null>(given);
  const [problem, setProblem] = useState<string | null>(null);
  // account:passkey-errors-told-apart: a prompt the player cancelled is told as nothing happened, quietly, never as a refusal.
  const [quiet, setQuiet] = useState<string | null>(null);
  useEffect(() => setReturned(given), [given]);
  const inApp = inAppBrowser(agent);
  // Passkeys are not offered inside an app's own browser, where they are unreliable: no button, no autofill.
  const passkeys = !inApp;
  const passkeyFirst = passkeys && passkeyUsed;
  const withAutofill = passkeys && account.signInWithPasskeyAutofill !== undefined;
  // The sheet is still up: a passkey picked from the field's autofill after it closed opens nothing.
  const up = useRef(true);
  const signedIn = useRef(onSignedIn);
  signedIn.current = onSignedIn;

  // account:passkey-in-email-autofill: once the field is there, the browser is asked to offer this site's passkeys in its
  // autofill, where it can. The button's own ask cancels this one; a cancel or a refusal here says nothing.
  useEffect(() => {
    up.current = true;
    if (withAutofill) {
      void autofill().then(async (can) => {
        if (!can || !up.current) return;
        const result = await account.signInWithPasskeyAutofill?.();
        if (result?.ok !== true || !up.current) return;
        markPasskeyHere();
        signedIn.current("passkey");
      });
    }
    return () => {
      up.current = false;
    };
  }, [account, withAutofill, autofill]);

  async function run(action: () => Promise<AuthResult>, by: SignedInBy | null) {
    setBusy(true);
    setProblem(null);
    setReturned(null);
    try {
      const result = await action();
      const cancelled = !result.ok && result.why === "cancelled";
      setProblem(cancelled ? null : failureWords(result));
      setQuiet(cancelled ? failureWords(result) : null);
      if (result.ok && by === "passkey") markPasskeyHere();
      if (result.ok && by !== null) onSignedIn(by);
    } finally {
      setBusy(false);
    }
  }

  const usePasskey = () => void run(() => account.signInWithPasskey(), "passkey");

  return (
    <div className="flex flex-col gap-4" data-sign-in="returning" data-passkey-first={passkeyFirst ? "" : undefined}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {onBack === null ? null : (
            <button type="button" aria-label={say("ui.account.back")} className="press flex size-11 shrink-0 items-center justify-center rounded-[6px] bg-sheet-muted" onClick={onBack}>
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="title text-[22px] leading-tight" tabIndex={-1}>
            {say("ui.account.returning.title")}
          </h1>
        </div>
        <p className="text-[14px] leading-snug text-text-2">{say("ui.account.returning.intro")}</p>
      </div>
      {returned === null ? null : (
        <p role="alert" className="font-bold text-bad" data-google-returned>
          {returned}
        </p>
      )}
      {/* A passkey used here before comes first, as tall and as wide as Google's button. */}
      {passkeyFirst ? (
        <Button variant="primary" className="min-h-12 w-full text-[16px]" disabled={busy} onClick={usePasskey}>
          {say("ui.account.passkey.first")}
        </Button>
      ) : null}
      {inApp ? (
        <div className="flex flex-col gap-2" data-in-app>
          <p className="text-[14px] leading-snug">{say("ui.account.in-app")}</p>
          <div>
            <OpenInBrowser agent={agent} href={href} />
          </div>
        </div>
      ) : (
        <GoogleButton label={say("ui.account.google")} disabled={busy} onClick={() => void run(() => account.signInWithGoogle(null, "sign-in"), null)} />
      )}
      <CodeForm account={account} passkeyAutofill={withAutofill} {...(filled === null ? {} : { filled })} onSignedIn={() => onSignedIn("email")} />
      {/* The button stays where a browser offers no autofill (Firefox among them). */}
      {!passkeys || passkeyFirst ? null : (
        <div>
          <Button variant="quiet" disabled={busy} onClick={usePasskey}>
            {say("ui.account.passkey")}
          </Button>
        </div>
      )}
      <p role="status" className={quiet === null ? "sr-only" : "text-[14px] text-text-2"}>
        {quiet ?? ""}
      </p>
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}
