// The start of a life that came by the code on the ways back in (account:sign-in-without-secret, account:guest-secures-the-life):
// the right code for an address no account uses proved the address, so the player is taken into starting a life already
// kept by that email. Over its steps one line says why they are here, with "Use another email" as a quiet way back. The
// username has a step of its own: the same box as the door's, checked as it is typed, the bot check unseen (this is where
// the account is made, account:bot-check-on-guest-creation), no guest line, and one main button, Continue, which makes the
// account secured by the email with no character; the door follows, as for any signed-in account with no character. A
// proof that ran out is told on the step with a new code sent and the code form inline; its right code makes a fresh proof
// and Continue goes on with the username kept. An address an account took meanwhile is sent a code that opens it.
import { useState, type ReactNode } from "react";

import type { AccountApi } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import type { GuestDoor } from "./GuestStart";

// Inline in its line of words, with a pad round it that takes the tap (world:reach-and-read), as the code step's quiet links.
const QUIET_LINK = "press reach inline px-0.5 text-text-2 underline underline-offset-4";

/** The line over each step: no life is kept with the address yet, and the quiet way to another address. */
export function KeptLine({ email, onOther }: { email: string; onOther: () => void }) {
  return (
    <p className="rounded-[5px] border-l-4 border-l-action bg-sheet-muted p-3 text-[14px] leading-snug" data-kept-line>
      {say("ui.account.kept.why", { email })}{" "}
      <button type="button" className={QUIET_LINK} onClick={onOther}>
        {say("ui.account.kept.other")}
      </button>
    </p>
  );
}

/** Why a new code went to the address unasked: the proof ran out, or an account took the address meanwhile. */
type Asked = { why: "proof-gone" | "email-taken"; sent: boolean; problem: string | null; at: number };

export interface KeptNameProps {
  account: AccountApi;
  /** The address the code proved. */
  email: string;
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
}

export function KeptName({ account, email, door, username, onUsername, onOther, onHere, onSignedIn, back = null }: KeptNameProps) {
  const [busy, setBusy] = useState(false);
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
      const sent = await account.sendCode(email, null);
      setAsked((was) => ({ why, sent: sent.ok, problem: sent.ok ? null : failureWords(sent), at: (was?.at ?? 0) + 1 }));
      return;
    }
    setProblem(door.tell(why));
  }

  return (
    <div className="flex flex-col gap-3" data-kept-name>
      <KeptLine email={email} onOther={onOther} />
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
      )}
      {asked === null ? (
        <div>
          <Button variant="primary" disabled={busy} onClick={() => void go()}>
            {say("ui.account.kept.go")}
          </Button>
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
    </div>
  );
}
