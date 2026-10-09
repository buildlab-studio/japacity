// The ways in (R-ACCOUNT-001): Google, a passkey, or a code by email, and the
// bot check beside the ways that can make an account (R-ACCOUNT-013). A
// passkey only signs in: it is added from the settings (R-ACCOUNT-003).
import { useState } from "react";

import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import { Turnstile, type LoadTurnstile } from "./Turnstile";

export interface SignInProps {
  account: AccountApi;
  sitekey: string | null;
  load: LoadTurnstile;
  onSignedIn: () => void;
}

export function SignIn({ account, sitekey, load, onSignedIn }: SignInProps) {
  const [bot, setBot] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{say("ui.account.title")}</h1>
        <p className="text-text-2">{say("ui.account.intro")}</p>
      </div>
      <div className="flex flex-col gap-3">
        <Button variant="primary" disabled={busy} onClick={() => void run(() => account.signInWithGoogle(bot), true)}>
          {say("ui.account.google")}
        </Button>
        <Button disabled={busy} onClick={() => void run(() => account.signInWithPasskey(), false)}>
          {say("ui.account.passkey")}
        </Button>
      </div>
      <CodeForm account={account} bot={bot} spentBot={spentBot} onSignedIn={onSignedIn} />
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
      {sitekey === null ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-2">{say("ui.account.bot")}</p>
          <Turnstile sitekey={sitekey} load={load} round={round} onToken={setBot} />
        </div>
      )}
    </div>
  );
}
