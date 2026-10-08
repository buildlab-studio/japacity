// The account settings: add a passkey (R-ACCOUNT-003), any setting the shell
// places in it, sign out, and delete the account (R-ACCOUNT-016) through the
// server's `DELETE /api/account`. Deleting needs a session signed in within
// the last 10 minutes; when the server says it is older, the player signs in
// again or sends the code the server's email carries along with the deletion.
import { UserRoundCog } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { say } from "../../shared/words/text";
import { counting, setUsageCounts } from "../../shared/analytics/start";
import { CodeForm, failureWords } from "./CodeForm";

/**
 * R-ANALYTICS-006: "Send usage counts", stored on the account and on by
 * default. Off stops the interface counters at once; the server's own game
 * counters go on, as the rule says.
 */
export function UsageCounts({ account }: { account: AccountApi }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void account.usageCounts().then((kept) => {
      if (!live) return;
      const value = kept ?? true;
      setOn(value);
      setUsageCounts(value);
    });
    return () => {
      live = false;
    };
  }, [account]);

  async function change(next: boolean) {
    setBusy(true);
    setProblem(null);
    const saved = await account.setUsageCounts(next);
    setBusy(false);
    if (!saved) return setProblem(say("ui.account.usage.failed"));
    setOn(next);
    setUsageCounts(next);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5 accent-ink" checked={on ?? true} disabled={on === null || busy} onChange={(event) => void change(event.target.checked)} />
        {say("ui.account.usage")}
      </label>
      <p className="text-sm text-muted">{say("ui.account.usage.help")}</p>
      {problem === null ? null : (
        <p role="alert" className="text-sm text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}

type Step = "idle" | "warn" | "confirm";

export function AccountSettings({ account, more = null }: { account: AccountApi; more?: ReactNode }) {
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

  const gone = () => leave("ui.account.notice.deleted");

  const remove = () =>
    run(
      () => account.deleteAccount(null),
      async (result) => {
        if (result.ok) {
          gone();
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

      <UsageCounts account={account} />

      {more}

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
            {email === null ? null : (
              <CodeForm
                account={account}
                email={email}
                sendLabel={say("ui.account.delete.code", { email })}
                confirm={(code) => account.deleteAccount(code)}
                goLabel={say("ui.account.delete.code.go")}
                onSignedIn={gone}
              />
            )}
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

/** The header's way into the settings. Nothing offline. `more`: another feature's settings, placed by the shell. */
export function AccountButton({ more = null }: { more?: ReactNode }) {
  const account = useGame((state) => state.account);
  const [open, setOpen] = useState(false);
  if (account === null) return null;
  return (
    <>
      <Button
        small
        variant="quiet"
        aria-label={say("ui.account.settings")}
        onClick={() => {
          counting().count("screen/opened", "settings");
          setOpen(true);
        }}
      >
        <UserRoundCog size={18} />
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={say("ui.account.settings")}>
        <AccountSettings account={account} more={more} />
      </Sheet>
    </>
  );
}
