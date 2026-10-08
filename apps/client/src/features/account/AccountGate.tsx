// What a signed-out player sees: the age screen first, then the ways in
// (R-ACCOUNT-011, R-ACCOUNT-012). A refusal is said plainly and nothing else
// is offered. While sign-ups are switched off, the full screen instead, which
// asks again once the server's wait is over (R-SERVER-032).
import { useCallback, useEffect, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { countAsk, counting } from "../../shared/analytics/start";
import type { AccountApi, AgeStanding, Full as FullStanding } from "../../shared/net/auth";
import { say } from "../../shared/words/text";
import { AgeScreen } from "./AgeScreen";
import { Full, type FullCheck } from "./Full";
import { SignIn } from "./SignIn";
import { loadTurnstile, siteKey, type LoadTurnstile } from "./Turnstile";

type Standing = AgeStanding | FullStanding | "loading" | "failed";

/** The counter key of the screen a standing shows (R-ANALYTICS-002). */
function screenOf(standing: Standing): string | null {
  if (standing === "unasked") return "age";
  if (standing === "passed") return "sign-in";
  return null;
}

export interface AccountGateProps {
  /** Seams for tests: the Turnstile script and the site key. */
  load?: LoadTurnstile;
  sitekey?: string | null;
  /** Inside another page, as the invite link's: no page of its own around it. */
  embedded?: boolean;
}

export function AccountGate({ load = loadTurnstile, sitekey, embedded = false }: AccountGateProps) {
  const account = useGame((state) => state.account);
  const notice = useGame((state) => state.accountNotice);
  const signedIn = useGame((state) => state.signedIn);
  const earlyWin = useGame((state) => state.earlyWin);
  const [standing, setStanding] = useState<Standing>("loading");
  const shown = screenOf(standing);

  useEffect(() => {
    if (shown === null) return;
    counting().count("screen/opened", shown);
    // R-ANALYTICS-011, R-GUIDE-015: the sign-in ask, keyed by whether the early win had been shown.
    if (shown === "sign-in") countAsk("sign-in", "shown", earlyWin);
  }, [shown, earlyWin]);

  const check = useCallback(async (): Promise<FullCheck> => {
    if (account === null) return "full";
    const found = await account.ageStatus();
    if (typeof found === "object") return "full";
    setStanding(found);
    return "open";
  }, [account]);

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
  const key = sitekey === undefined ? siteKey() : sitekey;

  function body(api: AccountApi) {
    if (typeof standing === "object") return <Full retryAfter={standing.retryAfter} check={check} onOpen={() => undefined} />;
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
        return <AgeScreen account={api} sitekey={key} load={load} onStanding={setStanding} />;
      case "passed":
        return (
          <SignIn
            account={api}
            sitekey={key}
            load={load}
            onSignedIn={() => {
              countAsk("sign-in", "accepted", earlyWin);
              void signedIn();
            }}
          />
        );
      default: {
        const never: never = standing;
        throw new Error(`Unknown age standing: ${String(never)}`);
      }
    }
  }

  if (embedded) return <div className="flex flex-col gap-6">{body(account)}</div>;

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
