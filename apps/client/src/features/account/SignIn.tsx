// The ways back in for a player who kept a life (account:sign-in-without-secret), in account:guest-secures-the-life's order: Google first, then a
// code by email, then a passkey, which only signs in: it is added once signed in, from the card after a way in or the settings
// (account:passkey-needs-signed-in-session, account:passkey-offered-where-it-works). Inside an
// in-app browser where Google is blocked, Google is not shown and the code is offered with a way out to the phone's
// own browser, and no passkey, which is unreliable there. The email field offers this browser's passkeys in its autofill where the browser can,
// with the button kept for when the field did not do it, and where a passkey was added or used in this browser the email field comes first
// (account:passkey-in-email-autofill).
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
  // Whether the email field's autofill offers passkeys here, once the browser has said so; until then the button stands.
  const [inField, setInField] = useState(false);
  // The field did not do it: its request failed, or a player whose browser holds a passkey typed into it. The browser never
  // says whether its list showed, so either brings the button back.
  const [fieldMissed, setFieldMissed] = useState(false);
  // Each start of the field's request; a cancel of the button's prompt starts it again.
  const [fieldAsk, setFieldAsk] = useState(0);
  useEffect(() => setReturned(given), [given]);
  const inApp = inAppBrowser(agent);
  // Passkeys are not offered inside an app's own browser, where they are unreliable: no button, no autofill.
  const passkeys = !inApp;
  const passkeyFirst = passkeys && passkeyUsed;
  const withAutofill = passkeys && account.signInWithPasskeyAutofill !== undefined;
  const signedIn = useRef(onSignedIn);
  signedIn.current = onSignedIn;

  // account:passkey-in-email-autofill: once the field is there, the browser is asked to offer this site's passkeys in its
  // autofill, where it can. The button's own ask cancels this one; a cancel or a refusal here says nothing, and a failure
  // that is not a cancel brings the button back (account:passkey-errors-told-apart). Each ask fetches a fresh challenge.
  useEffect(() => {
    // The sheet is still up and this is the latest ask: a passkey picked from an autofill after it went opens nothing.
    let live = true;
    if (withAutofill) {
      void autofill().then(async (can) => {
        if (!can || !live) return;
        setInField(true);
        const result = await account.signInWithPasskeyAutofill?.();
        if (result === undefined || !live) return;
        if (!result.ok) {
          if (result.why !== "cancelled") setFieldMissed(true);
          return;
        }
        markPasskeyHere();
        signedIn.current("passkey");
      });
    }
    return () => {
      live = false;
    };
  }, [account, withAutofill, autofill, fieldAsk]);

  async function run(action: () => Promise<AuthResult>, by: SignedInBy | null) {
    setBusy(true);
    setProblem(null);
    setReturned(null);
    try {
      const result = await action();
      const cancelled = !result.ok && result.why === "cancelled";
      setProblem(cancelled ? null : failureWords(result));
      setQuiet(cancelled ? failureWords(result) : null);
      // The button's prompt cancelled the field's request too: whatever the prompt answered short of a sign-in, the field's
      // request starts again, so the autofill still works after it.
      if (!result.ok && by === "passkey" && inField) setFieldAsk((asks) => asks + 1);
      if (result.ok && by === "passkey") markPasskeyHere();
      if (result.ok && by !== null) onSignedIn(by);
    } finally {
      setBusy(false);
    }
  }

  const usePasskey = () => void run(() => account.signInWithPasskey(), "passkey");
  // A player whose browser holds a passkey and who types an address was not signed in by the field: the passkey stands beside the code.
  const typed = passkeyUsed ? () => setFieldMissed(true) : undefined;
  const codeForm = (
    <CodeForm account={account} passkeyAutofill={withAutofill} {...(filled === null ? {} : { filled })} {...(typed === undefined ? {} : { onEmailTyped: typed })} onSignedIn={() => onSignedIn("email")} />
  );

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
      {/* Where a passkey was used here before, the email field that offers it comes first. */}
      {passkeyFirst ? codeForm : null}
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
      {passkeyFirst ? null : codeForm}
      {/* Where the field's autofill offers passkeys, the button waits for a sign that the field did not do it. */}
      {!passkeys || (inField && !fieldMissed) ? null : (
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
