// The ways back in for a player who kept a life (account:sign-in-without-secret), in account:guest-secures-the-life's order: Google first, then a
// code by email, then a passkey, which only signs in: it is added once signed in, from the card after a way in or the settings
// (account:passkey-needs-signed-in-session, account:passkey-offered-where-it-works). Inside an
// in-app browser where Google is blocked, Google is not shown and the code is offered with a way out to the phone's
// own browser, and no passkey, which is unreliable there. The email field offers this browser's passkeys in its autofill where the browser can,
// with the button kept for when the field did not do it, and where a passkey was added or used in this browser the email field comes first
// (account:passkey-in-email-autofill).
// None of them makes an account: a life starts as a guest (account:guest-and-secured-states). The code's send looks for the
// account first, and an address no account uses is answered at once with a new life kept with that email
// (account:sign-in-without-secret, account:guest-secures-the-life): its own code proves the address, then the new life's start
// goes on as Play's does. A passkey or a trip to Google that finds no account keeps its words, in the same answer's shape.
// Once a code is sent the sheet holds the code step alone (account:code-form-forgives). Signing in again needs no bot check
// (account:bot-check-on-guest-creation).
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { GoogleButton } from "../../shared/ui/GoogleButton";
import { say } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import { inAppBrowser } from "./inApp";
import { markPasskeyHere, passkeyHere } from "./marks";
import { NoAccount } from "./NoAccount";
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
  /** That trip found no account behind the Google address: its words stand with a new life under them. */
  noneFound?: boolean;
  /** The address to fill the email field with: the one a guest typed before choosing its kept life. */
  filled?: string | null;
  /** On to a new life's start: from a way in that found no account, or once a new life's address is proved (account:guest-secures-the-life). */
  onNewLife?: () => void;
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

/** The field's refusals that follow a passkey the player picked and confirmed: each is told, as the button's are. */
const PICKED_AND_REFUSED: ReadonlySet<string> = new Set(["passkey-gone", "other-account"]);

/** The refusals of a way in that found no account behind it: told in their own words, with a new life under them. */
const NONE_FOUND: ReadonlySet<string> = new Set(["passkey-gone", "no-life"]);

/**
 * Where the sheet stands: the ways in, the address's form keyed so "Use another email" and "Change" open it afresh; the answer
 * to an address no account uses; or a new life's code step for that address.
 */
type Stand = { kind: "ways"; filled: string | null; focus: boolean; at: number } | { kind: "none"; email: string } | { kind: "new-life"; email: string };

export function SignIn({ account, onSignedIn, onBack = null, problem: given = null, noneFound = false, filled = null, onNewLife = () => undefined, agent = browserAgent(), href = pageHref(), autofill = browserAutofill, passkeyUsed = passkeyHere() }: SignInProps) {
  const [busy, setBusy] = useState(false);
  const [stand, setStand] = useState<Stand>({ kind: "ways", filled, focus: false, at: 0 });
  // The address a code went to from the ways in: the sheet then holds the code step alone.
  const [codeTo, setCodeTo] = useState<string | null>(null);
  // What the new life's send answered when it did not go through.
  const [noneProblem, setNoneProblem] = useState<string | null>(null);
  // What the trip to Google came back with stands at the top; what a way on this sheet answers stands at its foot, by the ways.
  const [returned, setReturned] = useState<string | null>(given);
  const [problem, setProblem] = useState<string | null>(null);
  // Why the last way on this sheet was refused, so a way that found no account shows the new life under its words.
  const [refusal, setRefusal] = useState<string | null>(null);
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
  // autofill, where it can. The button's own ask cancels this one; a cancel here says nothing, a failure that is not a cancel
  // brings the button back, and a passkey picked there that the server refuses is told as the button's is
  // (account:passkey-errors-told-apart). Each ask fetches a fresh challenge.
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
          if (PICKED_AND_REFUSED.has(result.why)) {
            setProblem(failureWords(result));
            setRefusal(result.why);
          }
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
      setRefusal(result.ok ? null : result.why);
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
  const ways = stand.kind === "ways";
  // The ways in stand only before a code is sent: the code step and the answer to an address stand alone.
  const first = ways && codeTo === null;
  const backTo = (address: string) => {
    setCodeTo(null);
    setNoneProblem(null);
    setStand((was) => ({ kind: "ways", filled: address, focus: true, at: (was.kind === "ways" ? was.at : 0) + 1 }));
  };
  const codeForm = ways ? (
    <CodeForm
      key={stand.at}
      account={account}
      passkeyAutofill={withAutofill}
      {...(stand.filled === null ? {} : { filled: stand.filled })}
      focusEmail={stand.focus}
      {...(typed === undefined ? {} : { onEmailTyped: typed })}
      onStep={setCodeTo}
      onNoAccount={(email) => {
        setProblem(null);
        setReturned(null);
        setStand({ kind: "none", email });
      }}
      onSignedIn={() => onSignedIn("email")}
    />
  ) : null;

  // account:guest-secures-the-life: the new life's own code goes to the address; its code step is the one form's, under the code's heading.
  async function startWith(email: string) {
    setBusy(true);
    setNoneProblem(null);
    try {
      const result = await account.sendCode(email, null, true);
      if (result.ok) setStand({ kind: "new-life", email });
      else setNoneProblem(failureWords(result));
    } finally {
      setBusy(false);
    }
  }

  // A way in that found no account keeps its words, with a new life under them.
  const noneShape = (said: string, bad: boolean) => <NoAccount said={said} bad={bad} label={say("ui.account.start.kept.play")} onGo={onNewLife} />;
  const codeStep = stand.kind === "new-life" || codeTo !== null;

  return (
    <div className="flex flex-col gap-4" data-sign-in="returning" data-sign-in-step={stand.kind === "ways" ? (codeTo === null ? "ways" : "code") : stand.kind} data-passkey-first={passkeyFirst ? "" : undefined}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {onBack === null ? null : (
            <button type="button" aria-label={say("ui.account.back")} className="press flex size-11 shrink-0 items-center justify-center rounded-[6px] bg-sheet-muted" onClick={onBack}>
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="title text-[22px] leading-tight" tabIndex={-1}>
            {say(codeStep ? "ui.account.code.title" : "ui.account.returning.title")}
          </h1>
        </div>
        {codeStep ? null : <p className="text-[14px] leading-snug text-text-2">{say("ui.account.returning.intro")}</p>}
      </div>
      {!first || returned === null ? null : noneFound ? (
        <div data-google-returned>{noneShape(returned, true)}</div>
      ) : (
        <p role="alert" className="font-bold text-bad" data-google-returned>
          {returned}
        </p>
      )}
      {stand.kind === "none" ? (
        <NoAccount
          said={say("ui.account.none", { email: stand.email })}
          label={say("ui.account.none.new")}
          onGo={() => void startWith(stand.email)}
          other={{ label: say("ui.account.none.other"), onClick: () => backTo("") }}
          busy={busy}
          problem={noneProblem}
        />
      ) : null}
      {stand.kind === "new-life" ? (
        <CodeForm account={account} email={stand.email} sent newLife confirm={(code) => account.proveNewLife(stand.email, code)} goLabel={say("ui.account.none.go")} onChange={() => backTo(stand.email)} onSignedIn={onNewLife} />
      ) : null}
      {/* Where a passkey was used here before, the email field that offers it comes first. */}
      {passkeyFirst ? codeForm : null}
      {!first ? null : inApp ? (
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
      {!first || !passkeys || (inField && !fieldMissed) ? null : (
        <div>
          <Button variant="quiet" disabled={busy} onClick={usePasskey}>
            {say("ui.account.passkey")}
          </Button>
        </div>
      )}
      <p role="status" className={quiet === null ? "sr-only" : "text-[14px] text-text-2"}>
        {quiet ?? ""}
      </p>
      {!first || problem === null ? null : refusal !== null && NONE_FOUND.has(refusal) ? (
        noneShape(problem, true)
      ) : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}
