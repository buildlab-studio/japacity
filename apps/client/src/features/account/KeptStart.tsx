// The start of a life that came by the code on the ways back in (account:sign-in-without-secret, account:guest-secures-the-life):
// the right code for an address no account uses proved the address, so the player is taken into starting a life already
// kept by that email. Over its steps one line says why they are here, with "Use another email" as a quiet way back. The
// username has a step of its own: the same box as the door's, checked as it is typed, the bot check unseen (this is where
// the account is made, account:bot-check-on-guest-creation), no guest line, and one main button, Continue, which makes the
// account secured by the email with no character; the door follows, as for any signed-in account with no character. A
// proof that ran out is told on the step with a new code sent and the code form inline; its right code makes a fresh proof
// and Continue goes on with the username kept. An address an account took meanwhile is sent a code that opens it. Where
// Google proved the address, the steps are the same and only the words for Google's way differ: "Use another way", and a
// proof run out or an address taken is told with "Continue with Google" in place of the code form, which sends no code;
// Google makes a fresh proof or signs in, and the username comes back with the step. The code sent unasked carries the code
// form's unseen bot check (account:bot-check-on-code-send), mounted with the step so its token is ready.
import { useState, type ReactNode } from "react";

import type { AccountApi } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { GoogleButton } from "../../shared/ui/GoogleButton";
import { say } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import type { GuestDoor } from "./GuestStart";
import { holdNameForGoogle } from "./marks";
import { CODE_ACTION, loadTurnstile, siteKey, type LoadTurnstile } from "./Turnstile";
import { useUnseenCheck } from "./useUnseenCheck";

// Inline in its line of words, with a pad round it that takes the tap (world:reach-and-read), as the code step's quiet links.
const QUIET_LINK = "press reach inline px-0.5 text-text-2 underline underline-offset-4";

/** The line over each step: no life is kept with the address yet, and the quiet way to another address, or another way where Google proved it. */
export function KeptLine({ email, google = false, onOther }: { email: string; google?: boolean; onOther: () => void }) {
  return (
    <p className="rounded-[5px] border-l-4 border-l-action bg-sheet-muted p-3 text-[14px] leading-snug" data-kept-line>
      {say("ui.account.kept.why", { email })}{" "}
      <button type="button" className={QUIET_LINK} onClick={onOther}>
        {say(google ? "ui.account.kept.other.google" : "ui.account.kept.other")}
      </button>
    </p>
  );
}

/** Why the step asks again unasked: the proof ran out, or an account took the address meanwhile; by the code, a new code was sent. */
type Asked = { why: "proof-gone" | "email-taken"; sent: boolean; problem: string | null; at: number };

export interface KeptNameProps {
  account: AccountApi;
  /** The address the code or Google proved. */
  email: string;
  /** Google proved it: its way stands where the code's would (account:sign-in-without-secret). */
  google?: boolean;
  /** The guest start, made with `proved` and `kept`. */
  door: GuestDoor;
  /** The username as typed, held by the gate so the full screen or a new code gives it back. */
  username: string;
  onUsername: (username: string) => void;
  /** "Use another email": drops the proof and goes back to the ways back in. */
  onOther: () => void;
  /** This browser is signed in already: another tab's Continue made the account. */
  onHere: () => void;
  /** The inline code signed in to an account that took the address meanwhile. */
  onSignedIn: () => void;
  /** The back arrow; none inside another page. */
  back?: ReactNode;
  /** account:bot-check-on-code-send: the code check's site key and script; the build's unless a test names others. */
  sitekey?: string | null;
  load?: LoadTurnstile;
}

export function KeptName({ account, email, google = false, door, username, onUsername, onOther, onHere, onSignedIn, back = null, sitekey, load = loadTurnstile }: KeptNameProps) {
  const [busy, setBusy] = useState(false);
  // Google's way sends no code, so it needs no code check.
  const codeCheck = useUnseenCheck(google ? null : sitekey === undefined ? siteKey() : sitekey, load, undefined, CODE_ACTION);
  const [problem, setProblem] = useState<string | null>(null);
  const [asked, setAsked] = useState<Asked | null>(null);

  async function go() {
    const typed = door.check(username);
    setProblem(typed);
    if (typed !== null) {
      door.reveal();
      return;
    }
    setBusy(true);
    const why = await door.attempt(username);
    if (why === null) {
      await door.started();
      return;
    }
    setBusy(false);
    if (why === "here") return onHere();
    if (why === "proof-gone" || why === "email-taken") {
      // Google's way sends no code: Google itself makes the fresh proof, or signs in to the account that took the address.
      if (google) {
        setAsked((was) => ({ why, sent: false, problem: null, at: (was?.at ?? 0) + 1 }));
        return;
      }
      const token = await codeCheck.token();
      const sent = await account.sendCode(email, token);
      if (token !== null) codeCheck.spent();
      setAsked((was) => ({ why, sent: sent.ok, problem: sent.ok ? null : failureWords(sent), at: (was?.at ?? 0) + 1 }));
      return;
    }
    setProblem(door.tell(why));
  }

  /** Google again: a fresh proof that comes back to this step with the username held, or a sign-in to the account that took the address. */
  async function againWithGoogle(why: Asked["why"]) {
    if (why === "proof-gone") holdNameForGoogle(username);
    setBusy(true);
    const result = await account.signInWithGoogle(null, "sign-in");
    // A trip that went leaves the page; one that could not start is said here and the button stands.
    setBusy(false);
    if (!result.ok) setAsked((was) => (was === null ? was : { ...was, problem: failureWords(result) }));
  }

  return (
    <div className="flex flex-col gap-3" data-kept-name>
      <KeptLine email={email} google={google} onOther={onOther} />
      <div className="flex items-center gap-2">
        {back}
        <h1 className="title text-[22px] leading-tight" tabIndex={-1}>
          {say("ui.account.kept.name.title")}
        </h1>
      </div>
      {door.fields(
        username,
        (next) => {
          onUsername(next);
          setProblem(null);
        },
        problem,
        () => {
          if (asked === null && !busy) void go();
        },
        false,
        true,
      )}
      {asked === null ? (
        <div>
          <Button variant="primary" disabled={busy} onClick={() => void go()}>
            {say("ui.account.kept.go")}
          </Button>
        </div>
      ) : google ? (
        <div className="flex flex-col gap-3" data-kept-google={asked.why}>
          <p role="alert" className="text-[14px] font-bold">
            {say(asked.why === "proof-gone" ? "ui.account.kept.gone.google" : "ui.account.kept.taken.google")}
          </p>
          <GoogleButton label={say("ui.account.google")} disabled={busy} onClick={() => void againWithGoogle(asked.why)} />
          {asked.problem === null ? null : (
            <p role="alert" className="text-[14px] font-bold text-bad">
              {asked.problem}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-kept-code={asked.why}>
          {asked.problem === null ? null : (
            <p role="alert" className="text-[14px] font-bold text-bad">
              {asked.problem}
            </p>
          )}
          <CodeForm
            key={asked.at}
            account={account}
            email={email}
            sent={asked.sent}
            check={codeCheck}
            sentSaid={say(asked.why === "proof-gone" ? "ui.account.kept.gone" : "ui.account.kept.taken", { email })}
            goLabel={say("ui.account.kept.go")}
            onSignedIn={onSignedIn}
            onNewLife={() => {
              setAsked(null);
              void go();
            }}
          />
        </div>
      )}
      {codeCheck.widget}
    </div>
  );
}
