// Signing in by a code sent to an email address (account:email-code-is-short-lived, account:code-form-forgives): the address,
// then the 6 digits. It signs the player in, or, for an address no account uses, hands on the address its right code proved
// for a new life (account:sign-in-without-secret); and it confirms deleting (account:player-deletes-account), where the code
// goes to the server with the deletion instead of signing in. Every send carries the unseen bot check's token
// (account:bot-check-on-code-send). Each step's field is the first to fill there and takes the
// focus as the step opens on a desktop, never on a touch phone; a refusal for it focuses it on both. Once the
// code is sent the step says one thing at a time: where the code went, with a quiet way back to the address; the field,
// which sends itself at the sixth digit; the one button; and one status slot under them, a polite live
// region mounted from the start, holding one line at a time, an error replacing whatever stood there. A refused code is
// never sent again unchanged, a code that is spent or ran out leaves only "Send a new code", and the way to a new code
// shows once the wait after a send is over.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { FIRST_FIELD, focusFirstField } from "../../shared/ui/firstField";
import { say } from "../../shared/words/text";
import { CODE_ACTION, loadTurnstile, siteKey, type LoadTurnstile } from "./Turnstile";
import { useUnseenCheck, type UnseenCheck } from "./useUnseenCheck";

const CODE = /^\d{6}$/;
const CODE_DIGITS = 6;

/** A light look at the address before it is sent: something, an @, something, a dot, something; the server judges the rest. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** How long the way to a new code waits after a code is sent, in seconds; the server allows 3 sends a minute. */
export const RESEND_WAIT_S = 30;

export const failureWords = (result: AuthResult): string | null => (result.ok ? null : say(`ui.account.fail.${result.why}`));

/** account:bot-check-on-code-send: what a send refused for its bot check is told as, when the check said why no pass came. */
const BOT_WORDS = { unloaded: "ui.account.bot.unloaded.code", error: "ui.account.bot.error.code" } as const;

/** The answers that leave the code with nothing to try: its tries are used up, or it ran out. */
const DEAD: ReadonlySet<string> = new Set(["used-up", "expired"]);

export interface CodeFormProps {
  account: AccountApi;
  /** account:bot-check-on-code-send: the site key and the script of the form's own unseen check; the build's unless a test names others. */
  sitekey?: string | null;
  load?: LoadTurnstile;
  /** A code check the parent holds and mounts, used for the sends in place of the form's own: one that sent a code before the form stood. */
  check?: UnseenCheck;
  /** The address is known already: the signed-in account's own, or a new life's. */
  email?: string;
  /** The address the field starts with, which the player can change. */
  filled?: string;
  /** A code went to the known address already: the form opens on the code step. */
  sent?: boolean;
  /** The line the code step opens with in place of "We sent a code to {email}.": why a new code was sent unasked. */
  sentSaid?: string;
  /** The address field takes the focus as the form opens, on a desktop (account:code-form-forgives). */
  focusEmail?: boolean;
  /** The field also offers this browser's passkeys in its autofill (account:passkey-in-email-autofill). */
  passkeyAutofill?: boolean;
  /** Called as the player types into the address field: its autofill did not sign them in (account:passkey-in-email-autofill). */
  onEmailTyped?: () => void;
  sendLabel?: string;
  /** What the typed code is used for; signing in with it unless given. */
  confirm?: (code: string) => Promise<AuthResult>;
  goLabel?: string;
  /** The look of the button that sends the code: the warning colour where the code itself confirms a costly act (account:player-deletes-account). */
  goVariant?: "primary" | "warning";
  /** Called once the code was taken. */
  onSignedIn: () => void;
  /** The code signed in to nothing and proved the address for a new life instead (account:sign-in-without-secret); signing in when left out. */
  onNewLife?: (email: string) => void;
  /** The code was refused because the address already has a life (account:guest-secures-the-life). */
  onTaken?: (email: string) => void;
  /** The form turned: the address a code went to, or null back at the address. */
  onStep?: (sentTo: string | null) => void;
  /** "Change" on the code step, for a known address whose form is the parent's; with no known address the form goes back itself. */
  onChange?: () => void;
}

const FIELD = "min-h-11 rounded-md border border-sheet-line bg-sheet-2 px-3 text-base";
// Inline in its line of words, with a pad round it that takes the tap (world:reach-and-read).
const QUIET_LINK = "press reach inline px-0.5 text-text-2 underline underline-offset-4";

/** The line the status slot holds when no error stands: nothing, the new code's line, or the way to a new code once the wait is over. */
type Line = "none" | "resent" | "nudge";

/** A line of words with one quiet button standing in for its `{again}`. */
function withButton(line: string, button: ReactNode): ReactNode {
  const [before = "", after = ""] = line.split("{again}");
  return (
    <>
      {before}
      {button}
      {after}
    </>
  );
}

/**
 * The sent line with Change glued to the address's end: the words after the address and Change stand in one piece that never
 * breaks, joined to the address with no space, so a narrow screen wraps before the address and Change goes down with it.
 */
function withAddress(line: string, email: string, button: ReactNode): ReactNode {
  const [before = "", after = ""] = line.split("{email}");
  return (
    <>
      {before}
      {email}
      <span className="whitespace-nowrap">
        {after}
        {"\u00a0"}
        {button}
      </span>
    </>
  );
}

export function CodeForm({ account, sitekey, load = loadTurnstile, check: held, email: known, filled, sent = false, sentSaid, focusEmail = false, passkeyAutofill = false, onEmailTyped, sendLabel, confirm, goLabel, goVariant = "primary", onSignedIn, onNewLife, onTaken, onStep, onChange }: CodeFormProps) {
  const [email, setEmail] = useState(known ?? filled ?? "");
  const [sentTo, setSentTo] = useState<string | null>(sent && known !== undefined ? known : null);
  // Each code sent, counted: the wait for the way to a new one starts again with each.
  const [sends, setSends] = useState(sent && known !== undefined ? 1 : 0);
  const [code, setCode] = useState("");
  // The code the server refused as wrong: it is never sent again unchanged.
  const [refused, setRefused] = useState<string | null>(null);
  // The code is spent or ran out: only a new one helps.
  const [dead, setDead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [line, setLine] = useState<Line>("none");
  // The form's own check is mounted only where the parent holds none.
  const own = useUnseenCheck(held !== undefined ? null : sitekey === undefined ? siteKey() : sitekey, load, undefined, CODE_ACTION);
  const bot = held ?? own;
  const codeField = useRef<HTMLInputElement>(null);
  const emailField = useRef<HTMLInputElement>(null);
  // The field the focus goes to once the form has turned, the first to fill on its step: the code's after a send, the
  // address's after a change; on a desktop only, so no phone's keyboard rises over the step by itself.
  const focusNext = useRef<"code" | "email" | null>(sentTo !== null ? "code" : focusEmail ? "email" : null);
  // After a wrong code the field's digits are selected, so typing replaces them.
  const selectNext = useRef(false);

  useEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;
    if (next === "code") focusFirstField(codeField.current);
    if (next === "email") focusFirstField(emailField.current);
  }, [sentTo, sends]);

  useEffect(() => {
    if (!selectNext.current) return;
    selectNext.current = false;
    codeField.current?.focus();
    codeField.current?.select();
  }, [refused]);

  // The way to a new code shows once the wait after the latest send is over, replacing the new code's line.
  useEffect(() => {
    if (sends === 0) return;
    const timer = window.setTimeout(() => setLine("nudge"), RESEND_WAIT_S * 1000);
    return () => window.clearTimeout(timer);
  }, [sends]);

  // One request at a time: the sixth digit sends the code, and a press of Sign in at the same moment adds nothing.
  const inFlight = useRef(false);

  async function run(action: () => Promise<AuthResult>, after: (result: AuthResult) => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      after(await action());
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function send(event?: FormEvent) {
    event?.preventDefault();
    const again = sentTo !== null;
    const address = (sentTo ?? email).trim();
    // A send refused for the address: the field it is about takes the focus on every device.
    if (address === "") {
      setProblem(say("ui.account.email.empty"));
      focusFirstField(emailField.current, true);
      return;
    }
    if (known === undefined && !EMAIL_SHAPE.test(address)) {
      setProblem(say("ui.account.email.shape"));
      focusFirstField(emailField.current, true);
      return;
    }
    void run(
      async () => {
        const token = await bot.token();
        const result = await account.sendCode(address, token);
        if (token !== null) bot.spent();
        return result;
      },
      (result) => {
        const trouble = bot.trouble();
        if (!result.ok && result.why === "bot-check" && trouble !== null) return setProblem(say(BOT_WORDS[trouble]));
        if (!result.ok) return setProblem(failureWords(result));
        focusNext.current = "code";
        if (!again) {
          setSentTo(address);
          onStep?.(address);
        }
        setSends((count) => count + 1);
        setCode("");
        setRefused(null);
        setDead(false);
        setLine(again ? "resent" : "none");
      },
    );
  }

  function check(typed: string) {
    if (sentTo === null || typed === refused) return;
    if (!CODE.test(typed)) {
      setProblem(say("ui.account.code.short"));
      focusFirstField(codeField.current, true);
      return;
    }
    void run(
      () => (confirm === undefined ? account.signInWithCode(sentTo, typed, null) : confirm(typed)),
      (result) => {
        if (result.ok && result.newLife === true && onNewLife !== undefined) return onNewLife(sentTo);
        if (result.ok) return onSignedIn();
        setProblem(failureWords(result));
        if (result.why === "taken") onTaken?.(sentTo);
        if (DEAD.has(result.why)) setDead(true);
        if (result.why === "wrong-code" || result.why === "bad-code") {
          selectNext.current = true;
          setRefused(typed);
        }
      },
    );
  }

  function typeCode(value: string) {
    // The digits alone, cut to six, so "123 456" pasted keeps all six; the sixth sends it.
    const digits = value.replace(/\D/g, "").slice(0, CODE_DIGITS);
    const grew = digits.length > code.length;
    if (digits !== code) setProblem(null);
    setCode(digits);
    if (grew && digits.length === CODE_DIGITS) check(digits);
  }

  function change() {
    if (onChange !== undefined) return onChange();
    focusNext.current = "email";
    setSentTo(null);
    setSends(0);
    setCode("");
    setRefused(null);
    setDead(false);
    setLine("none");
    setProblem(null);
    onStep?.(null);
  }

  const again = (
    <button type="button" className={QUIET_LINK} disabled={busy} onClick={() => send()}>
      {say("ui.account.code.nudge.again")}
    </button>
  );
  // One thing at a time: an error, else the line the step is at.
  const said: ReactNode = problem ?? (sentTo === null || line === "none" ? "" : line === "resent" ? say("ui.account.code.resent") : withButton(say("ui.account.code.nudge"), again));

  return (
    <div className="flex flex-col gap-3">
      {sentTo === null ? (
        <form className="flex flex-col gap-2" onSubmit={send} noValidate>
          {known === undefined ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{say("ui.account.email.label")}</span>
              <input
                ref={emailField}
                className={FIELD}
                {...{ [FIRST_FIELD]: "" }}
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
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (dead) send();
            else check(code);
          }}
          noValidate
        >
          {/* Change is glued to the address by a space that never breaks, so it wraps with the words and never stands alone. */}
          <p className="text-[15px] leading-snug break-words" data-code-sent={String(sends)}>
            {sentSaid !== undefined
              ? sentSaid
              : known === undefined || onChange !== undefined
              ? withAddress(
                  say("ui.account.code.sent"),
                  sentTo,
                  <button type="button" className={QUIET_LINK} onClick={change}>
                    {say("ui.account.code.change")}
                  </button>,
                )
              : say("ui.account.code.sent", { email: sentTo })}
          </p>
          {dead ? null : (
            <input
              ref={codeField}
              className={`${FIELD} tracking-[0.3em]`}
              {...{ [FIRST_FIELD]: "" }}
              name="code"
              aria-label={say("ui.account.code.label")}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              value={code}
              onChange={(event) => typeCode(event.target.value)}
            />
          )}
          <div>
            {dead ? (
              <Button type="submit" variant="primary" disabled={busy}>
                {say("ui.account.code.again")}
              </Button>
            ) : (
              <Button type="submit" variant={goVariant} disabled={busy || code === refused}>
                {goLabel ?? say("ui.account.code.go")}
              </Button>
            )}
          </div>
        </form>
      )}
      {/* One status slot, a polite live region by its role, mounted from the start, so each line is read out as it comes. */}
      <p role="status" className={`text-[14px] leading-snug ${problem === null ? "text-text-2" : "text-bad"}`} data-code-said={problem === null ? line : "problem"}>
        {said}
      </p>
      {own.widget}
    </div>
  );
}
