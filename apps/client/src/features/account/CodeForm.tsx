// Signing in by a code sent to an email address (R-ACCOUNT-002): the address,
// then the 6 digits. Used to come in, and to confirm deleting (R-ACCOUNT-016),
// where the code goes to the server with the deletion instead of signing in.
import { useState, type FormEvent } from "react";

import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";

const CODE = /^\d{6}$/;

export const failureWords = (result: AuthResult): string | null => (result.ok ? null : say(`ui.account.fail.${result.why}`));

export interface CodeFormProps {
  account: AccountApi;
  /** The bot check's token, sent where an account could be made (R-ACCOUNT-013). */
  bot?: string | null;
  /** Called after any request that spent the token. */
  spentBot?: () => void;
  /** The address is known already: the signed-in account's own. */
  email?: string;
  sendLabel?: string;
  /** What the typed code is used for; signing in with it unless given. */
  confirm?: (code: string) => Promise<AuthResult>;
  goLabel?: string;
  /** Called once the code was taken. */
  onSignedIn: () => void;
}

const FIELD = "min-h-11 rounded-md border border-sheet-line bg-sheet-2 px-3 text-base";

export function CodeForm({ account, bot = null, spentBot, email: known, sendLabel, confirm, goLabel, onSignedIn }: CodeFormProps) {
  const [email, setEmail] = useState(known ?? "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function run(action: () => Promise<AuthResult>, after: (result: AuthResult) => void) {
    setBusy(true);
    setProblem(null);
    try {
      const result = await action();
      if (bot !== null) spentBot?.();
      setProblem(failureWords(result));
      after(result);
    } finally {
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
    void run(
      () => account.sendCode(address, bot),
      (result) => {
        if (result.ok) setSentTo(address);
      },
    );
  }

  function check(event: FormEvent) {
    event.preventDefault();
    if (sentTo === null) return;
    if (!CODE.test(code)) {
      setProblem(say("ui.account.code.short"));
      return;
    }
    void run(
      () => (confirm === undefined ? account.signInWithCode(sentTo, code, bot) : confirm(code)),
      (result) => {
        if (result.ok) onSignedIn();
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sentTo === null ? (
        <form className="flex flex-col gap-2" onSubmit={send} noValidate>
          {known === undefined ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{say("ui.account.email.label")}</span>
              <input className={FIELD} type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          ) : null}
          <div>
            <Button type="submit" disabled={busy}>
              {sendLabel ?? say("ui.account.email.send")}
            </Button>
          </div>
        </form>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={check} noValidate>
          <p role="status">{say("ui.account.code.sent", { email: sentTo })}</p>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{say("ui.account.code.label")}</span>
            <input
              className={`${FIELD} tracking-[0.3em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {goLabel ?? say("ui.account.code.go")}
            </Button>
            <Button variant="quiet" disabled={busy} onClick={() => send()}>
              {say("ui.account.code.again")}
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
