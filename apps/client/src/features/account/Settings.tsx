// The account settings: add a passkey (R-ACCOUNT-003), the bank-full notice
// (R-CLOCK-031), sign out, and delete
// the account (R-ACCOUNT-016). Deleting asks for a session signed in within
// the last 10 minutes; the server says when it is older, and then the player
// signs in again or takes a code by email before it goes.
import { UserRoundCog } from "lucide-react";
import { useState } from "react";

import { useGame } from "../../authority/GameProvider";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { say } from "../../shared/words/text";
import { NotifyAsk } from "../notify/NotifyAsk";
import { NotifySetting } from "../notify/NotifySetting";
import { CodeForm, failureWords } from "./CodeForm";

type Step = "idle" | "warn" | "confirm";

export function AccountSettings({ account }: { account: AccountApi }) {
  const leave = useGame((state) => state.leave);
  const [step, setStep] = useState<Step>("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  async function run(action: () => Promise<AuthResult>, after: (result: AuthResult) => void | Promise<void>) {
    setBusy(true);
    setProblem(null);
    setMessage(null);
    try {
      const result = await action();
      await after(result);
    } finally {
      setBusy(false);
    }
  }

  const remove = () =>
    run(
      () => account.deleteAccount(),
      async (result) => {
        if (result.ok) {
          leave("ui.account.notice.deleted");
          return;
        }
        if (result.why === "not-fresh") {
          setStep("confirm");
          setEmail(await account.email());
          return;
        }
        setProblem(failureWords(result));
      },
    );

  const signOut = async () => {
    setBusy(true);
    await account.signOut();
    leave("ui.account.notice.signed-out");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            void run(
              () => account.addPasskey(),
              (result) => {
                if (result.ok) setMessage(say("ui.account.passkey.added"));
                else setProblem(failureWords(result));
              },
            )
          }
        >
          {say("ui.account.passkey.add")}
        </Button>
        <Button disabled={busy} onClick={() => void signOut()}>
          {say("ui.account.sign-out")}
        </Button>
      </div>

      <NotifySetting />

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        {step === "idle" ? (
          <div>
            <Button variant="quiet" disabled={busy} onClick={() => setStep("warn")}>
              {say("ui.account.delete")}
            </Button>
          </div>
        ) : null}
        {step === "warn" ? (
          <>
            <p>{say("ui.account.delete.warn")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={busy} onClick={() => void remove()}>
                {say("ui.account.delete.confirm")}
              </Button>
              <Button disabled={busy} onClick={() => setStep("idle")}>
                {say("ui.account.delete.keep")}
              </Button>
            </div>
          </>
        ) : null}
        {step === "confirm" ? (
          <>
            <p>{say("ui.account.delete.fresh")}</p>
            <Button disabled={busy} onClick={() => void run(() => account.signInWithPasskey(), (result) => (result.ok ? remove() : setProblem(failureWords(result))))}>
              {say("ui.account.passkey")}
            </Button>
            {email === null ? null : <CodeForm account={account} email={email} sendLabel={say("ui.account.delete.code", { email })} onSignedIn={() => void remove()} />}
            <Button variant="quiet" disabled={busy} onClick={() => void run(() => account.signInWithGoogle(null), (result) => setProblem(failureWords(result)))}>
              {say("ui.account.google")}
            </Button>
            <p className="text-sm text-muted">{say("ui.account.delete.google")}</p>
            <div>
              <Button disabled={busy} onClick={() => setStep("idle")}>
                {say("ui.account.delete.keep")}
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {message === null ? null : <p role="status">{message}</p>}
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}

/** The header's way into the settings. Nothing offline. */
export function AccountButton() {
  const account = useGame((state) => state.account);
  const [open, setOpen] = useState(false);
  if (account === null) return null;
  return (
    <>
      <Button small variant="quiet" aria-label={say("ui.account.settings")} onClick={() => setOpen(true)}>
        <UserRoundCog size={18} />
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={say("ui.account.settings")}>
        <AccountSettings account={account} />
      </Sheet>
      <NotifyAsk />
    </>
  );
}
