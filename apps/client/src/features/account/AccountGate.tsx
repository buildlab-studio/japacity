// What a signed-out player sees online. The start screen first, over the compound (R-ACCOUNT-029): Play goes to
// the age screen (R-ACCOUNT-012) and on to a new life; "I already have a life here" goes straight to the ways back
// in. A refusal is said plainly and nothing else is offered (R-ACCOUNT-011, R-ACCOUNT-012). While sign-ups are
// switched off, the full screen instead, which asks again once the server's wait is over (R-SERVER-032). Inside the
// invite page the card is the start, so the gate begins at the age screen there.
//
// After the age screen a new life starts as a guest's (R-ACCOUNT-021): a username and the bot check, unseen. No sign-in
// method is asked for at the door; the ways back in are for a life kept already, and none of them makes an account.
import { useCallback, useEffect, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { counting } from "../../shared/analytics/start";
import { Gate, GateSheet } from "../../shared/frontdoor/Gate";
import type { AccountApi, AgeStanding, Full as FullStanding } from "../../shared/net/auth";
import { say } from "../../shared/words/text";
import { AgeScreen } from "./AgeScreen";
import { failureWords } from "./CodeForm";
import { Full, type FullCheck } from "./Full";
import { SignIn } from "./SignIn";
import { refreshAccount } from "./standing";
import { StartScreen } from "./StartScreen";
import { loadTurnstile, siteKey, type LoadTurnstile } from "./Turnstile";
import { UsernameScreen } from "./UsernameScreen";

type Standing = AgeStanding | FullStanding | "loading" | "failed";

/** Where the player is on the way in: the start screen, the age screen, or the ways back in to a kept life. */
type Step = "start" | "age" | "returning";

/** The screen a standing and a step show. */
type Shown = "start" | "age" | "username" | "returning" | "other";

function shownOf(standing: Standing, step: Step, embedded: boolean): Shown {
  if (typeof standing === "object") return "other";
  if (standing !== "unasked" && standing !== "passed") return "other";
  if (step === "returning") return "returning";
  if (step === "start" && !embedded) return "start";
  return standing === "unasked" ? "age" : "username";
}

/** The counter key of a screen (R-ANALYTICS-002); the start screen has none in content's list yet. */
function counted(shown: Shown): string | null {
  if (shown === "age") return "age";
  if (shown === "returning") return "sign-in";
  return null;
}

export interface AccountGateProps {
  /** Seams for tests: the Turnstile script and the site key. */
  load?: LoadTurnstile;
  sitekey?: string | null;
  /** Inside another page, as the invite link's: no page of its own around it, and no start screen. */
  embedded?: boolean;
  /** Seams for tests: the browser's user agent and the page's address, for the in-app browser rule. */
  agent?: string;
  href?: string;
}

export function AccountGate({ load = loadTurnstile, sitekey, embedded = false, agent, href }: AccountGateProps) {
  const account = useGame((state) => state.account);
  const notice = useGame((state) => state.accountNotice);
  const signedIn = useGame((state) => state.signedIn);
  const [standing, setStanding] = useState<Standing>("loading");
  const [step, setStep] = useState<Step>("start");
  const [back, setBack] = useState<string | null>(null);
  const shown = shownOf(standing, step, embedded);
  const key = counted(shown);

  useEffect(() => {
    if (key !== null) counting().count("screen/opened", key);
  }, [key, shown]);

  // A trip to Google that found no life comes back here with the reason (R-ACCOUNT-021).
  useEffect(() => {
    const failed = account?.returnedFromGoogle() ?? null;
    if (failed === null) return;
    setStep("returning");
    setBack(failureWords({ ok: false, why: failed }));
  }, [account]);

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
  const sitekeyShown = sitekey === undefined ? siteKey() : sitekey;
  const toStart = embedded ? null : () => setStep("start");
  const enter = (api: AccountApi) => {
    void refreshAccount(api);
    void signedIn();
  };
  const ways = (api: AccountApi) => (
    <SignIn
      account={api}
      problem={back}
      onBack={toStart}
      onSignedIn={() => enter(api)}
      {...(agent === undefined ? {} : { agent })}
      {...(href === undefined ? {} : { href })}
    />
  );

  function body(api: AccountApi) {
    if (typeof standing === "object") return <Full retryAfter={standing.retryAfter} check={check} onOpen={() => undefined} />;
    switch (standing) {
      case "loading":
        return <p className="text-text-2">{say("ui.account.loading")}</p>;
      case "failed":
        return <p role="alert">{say("ui.account.fail.unreachable")}</p>;
      case "region-closed":
        return <p role="alert">{say("ui.account.region-closed")}</p>;
      case "refused":
        return <p role="alert">{say("ui.account.age.refused")}</p>;
      case "unasked":
      case "passed":
        switch (shown) {
          case "start":
            return <StartScreen onPlay={() => setStep("age")} onReturning={() => setStep("returning")} />;
          case "age":
            return <AgeScreen account={api} onStanding={setStanding} onBack={toStart} />;
          case "returning":
            return ways(api);
          case "username":
          case "other":
            return (
              <UsernameScreen
                account={api}
                sitekey={sitekeyShown}
                load={load}
                onStarted={() => enter(api)}
                onExpired={() => setStanding("unasked")}
                onFull={() => setStanding({ full: true, retryAfter: 30 })}
                onReturning={() => setStep("returning")}
              />
            );
          default: {
            const never: never = shown;
            throw new Error(`Unknown screen: ${String(never)}`);
          }
        }
      default: {
        const never: never = standing;
        throw new Error(`Unknown age standing: ${String(never)}`);
      }
    }
  }

  if (embedded) return <div className="flex flex-col gap-6">{body(account)}</div>;

  return (
    <Gate
      mark="start"
      over={
        <p className="band title mx-auto mt-3 rounded-[6px] px-4 py-2 text-center text-[26px] leading-none shadow-[0_8px_20px_rgba(10,14,30,0.3)]" data-start-name>
          {say("ui.game")}
        </p>
      }
    >
      <GateSheet mark={shown} label={say("ui.game")}>
        {notice === null ? null : (
          <p role="status" className="mb-3 rounded-[5px] border-l-4 border-l-action bg-sheet-muted p-3 text-[14px]">
            {say(notice)}
          </p>
        )}
        {body(account)}
      </GateSheet>
    </Gate>
  );
}
