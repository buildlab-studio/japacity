// Signing in by a code sent to an email address (account:email-code-is-short-lived, account:code-form-forgives): the address,
// then the 6 digits. It signs the player in, and confirms deleting (account:player-deletes-account),
// where the code goes to the server with the deletion instead of signing in. Once the code is sent the field for it
// takes the focus; a typed address can be changed; a pasted code keeps its digits whatever stands between them and
// goes by itself at the sixth; a new code waits a little after the last; and the line that says where the code went is
// one polite live region, mounted from the start, whose words change.
import { useEffect, useRef, useState, type FormEvent } from "react";

import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";

const CODE = /^\d{6}$/;
const CODE_DIGITS = 6;

/** A light look at the address before it is sent: something, an @, something, a dot, something; the server judges the rest. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** How long "Send a new code" waits after a code is sent, in seconds; the server allows 3 sends a minute. */
export const RESEND_WAIT_S = 30;

export const failureWords = (result: AuthResult): string | null => (result.ok ? null : say(`ui.account.fail.${result.why}`));

export interface CodeFormProps {
  account: AccountApi;
  /** The bot check's token, sent where an account could be made (account:bot-check-on-guest-creation). */
  bot?: string | null;
  /** Called after any request that spent the token. */
  spentBot?: () => void;
  /** The address is known already: the signed-in account's own. */
  email?: string;
  /** The address the field starts with, which the player can change. */
  filled?: string;
  /** The field also offers this browser's passkeys in its autofill (account:passkey-in-email-autofill). */
  passkeyAutofill?: boolean;
  /** Called as the player types into the address field: its autofill did not sign them in (account:passkey-in-email-autofill). */
  onEmailTyped?: () => void;
  sendLabel?: string;
  /** What the typed code is used for; signing in with it unless given. */
  confirm?: (code: string) => Promise<AuthResult>;
  goLabel?: string;
  /** Called once the code was taken. */
  onSignedIn: () => void;
  /** The code was refused because the address already has a life (account:guest-secures-the-life). */
  onTaken?: (email: string) => void;
}

const FIELD = "min-h-11 rounded-md border border-sheet-line bg-sheet-2 px-3 text-base";

/** The seconds left on the wait for a new code, counted down once a second from each send. */
function useResendWait(): [number, () => void] {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft((was) => Math.max(0, was - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);
  return [left, () => setLeft(RESEND_WAIT_S)];
}

export function CodeForm({ account, bot = null, spentBot, email: known, filled, passkeyAutofill = false, onEmailTyped, sendLabel, confirm, goLabel, onSignedIn, onTaken }: CodeFormProps) {
  const [email, setEmail] = useState(known ?? filled ?? "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sends, setSends] = useState(0);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [wait, startWait] = useResendWait();
  const codeField = useRef<HTMLInputElement>(null);
  const emailField = useRef<HTMLInputElement>(null);
  // The field the focus goes to once the form has turned: the code's after a send, the address's after a change.
  const focusNext = useRef<"code" | "email" | null>(null);

  useEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;
    if (next === "code") codeField.current?.focus();
    if (next === "email") emailField.current?.focus();
  }, [sentTo]);

  // One request at a time: the sixth digit sends the code, and a press of Sign in at the same moment adds nothing.
  const inFlight = useRef(false);

  async function run(action: () => Promise<AuthResult>, after: (result: AuthResult) => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const result = await action();
      if (bot !== null) spentBot?.();
      setProblem(failureWords(result));
      after(result);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function send(event?: FormEvent) {
    event?.preventDefault();
    const address = email.trim();
    if (address === "") {
      setProblem(say("ui.account.email.empty"));
      return;
    }
    if (known === undefined && !EMAIL_SHAPE.test(address)) {
      setProblem(say("ui.account.email.shape"));
      return;
    }
    void run(
      () => account.sendCode(address, bot),
      (result) => {
        if (!result.ok) return;
        focusNext.current = "code";
        setSentTo(address);
        setSends((count) => count + 1);
        setCode("");
        startWait();
      },
    );
  }

  function check(typed: string) {
    if (sentTo === null) return;
    if (!CODE.test(typed)) {
      setProblem(say("ui.account.code.short"));
      return;
    }
    void run(
      () => (confirm === undefined ? account.signInWithCode(sentTo, typed, bot) : confirm(typed)),
      (result) => {
        if (result.ok) onSignedIn();
        else if (result.why === "taken") onTaken?.(sentTo);
      },
    );
  }

  function typeCode(value: string) {
    // The digits alone, cut to six, so "123 456" pasted keeps all six; the sixth sends it.
    const digits = value.replace(/\D/g, "").slice(0, CODE_DIGITS);
    const grew = digits.length > code.length;
    setCode(digits);
    if (grew && digits.length === CODE_DIGITS) check(digits);
  }

  function change() {
    focusNext.current = "email";
    setSentTo(null);
    setCode("");
    setProblem(null);
  }

  const sentLine = sentTo === null ? "" : say(sends > 1 ? "ui.account.code.resent" : "ui.account.code.sent", { email: sentTo });

  return (
    <div className="flex flex-col gap-3">
      {/* One live region, mounted from the start, so the line is read out when its words come. */}
      <p role="status" className={sentTo === null ? "sr-only" : ""} data-code-sent={sentTo === null ? undefined : String(sends)}>
        {sentLine}
      </p>
      {sentTo === null ? (
        <form className="flex flex-col gap-2" onSubmit={send} noValidate>
          {known === undefined ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{say("ui.account.email.label")}</span>
              <input
                ref={emailField}
                className={FIELD}
                type="email"
                name="email"
                autoComplete={passkeyAutofill ? "username webauthn" : "email"}
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  onEmailTyped?.();
                }}
              />
            </label>
          ) : null}
          <div>
            <Button type="submit" disabled={busy}>
              {sendLabel ?? say("ui.account.email.send")}
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            check(code);
          }}
          noValidate
        >
          <p className="text-[13px] text-text-2">{say("ui.account.code.spam")}</p>
          {known === undefined ? (
            <div>
              <button type="button" className="press min-h-11 text-[14px] text-text-2 underline underline-offset-4" onClick={change}>
                {say("ui.account.code.change")}
              </button>
            </div>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{say("ui.account.code.label")}</span>
            <input
              ref={codeField}
              className={`${FIELD} tracking-[0.3em]`}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              value={code}
              onChange={(event) => typeCode(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {goLabel ?? say("ui.account.code.go")}
            </Button>
            <Button variant="quiet" disabled={busy || wait > 0} onClick={() => send()}>
              {wait > 0 ? say("ui.account.code.again.wait", { seconds: String(wait) }) : say("ui.account.code.again")}
            </Button>
          </div>
        </form>
      )}
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}
