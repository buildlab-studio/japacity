// What a signed-out player sees: the age screen first, then the ways in
// (R-ACCOUNT-011, R-ACCOUNT-012). A refusal is said plainly and nothing else
// is offered.
import { useEffect, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import type { AccountApi, AgeStanding } from "../../shared/net/auth";
import { say } from "../../shared/words/text";
import { AgeScreen } from "./AgeScreen";
import { SignIn } from "./SignIn";
import { loadTurnstile, siteKey, type LoadTurnstile } from "./Turnstile";

export interface AccountGateProps {
  /** Seams for tests: the Turnstile script and the site key. */
  load?: LoadTurnstile;
  sitekey?: string | null;
}

export function AccountGate({ load = loadTurnstile, sitekey }: AccountGateProps) {
  const account = useGame((state) => state.account);
  const notice = useGame((state) => state.accountNotice);
  const signedIn = useGame((state) => state.signedIn);
  const [standing, setStanding] = useState<AgeStanding | "loading" | "failed">("loading");

  useEffect(() => {
    if (account === null) return;
    let gone = false;
    account
      .ageStatus()
      .then((found) => {
        if (!gone) setStanding(found);
      })
      .catch(() => {
        if (!gone) setStanding("failed");
      });
    return () => {
      gone = true;
    };
  }, [account]);

  if (account === null) return null;

  function body(api: AccountApi) {
    switch (standing) {
      case "loading":
        return <p className="text-muted">{say("ui.account.loading")}</p>;
      case "failed":
        return <p role="alert">{say("ui.account.fail.unreachable")}</p>;
      case "region-closed":
        return <p role="alert">{say("ui.account.region-closed")}</p>;
      case "refused":
        return <p role="alert">{say("ui.account.age.refused")}</p>;
      case "unasked":
        return <AgeScreen account={api} onStanding={setStanding} />;
      case "passed":
        return <SignIn account={api} sitekey={sitekey === undefined ? siteKey() : sitekey} load={load} onSignedIn={() => void signedIn()} />;
      default: {
        const never: never = standing;
        throw new Error(`Unknown age standing: ${String(never)}`);
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <p className="text-xl font-bold">{say("ui.game")}</p>
      {notice === null ? null : (
        <p role="status" className="rounded-xl border-l-4 border-l-accent bg-surface p-4">
          {say(notice)}
        </p>
      )}
      {body(account)}
    </main>
  );
}
