// What a signed-out player sees online. The start screen first, over the compound (R-ACCOUNT-029): Play goes to
// the age screen (R-ACCOUNT-012) and on to a new life; "I already have a life here" goes straight to the ways back
// in. A refusal is said plainly and nothing else is offered (R-ACCOUNT-011, R-ACCOUNT-012). While sign-ups are
// switched off, the full screen instead, which asks again once the server's wait is over (R-SERVER-032). Inside the
// invite page the card is the start, so the gate begins at the age screen there.
//
// After the age screen a new life needs an account, and this server makes one only through a way in, so Play
// passes the ways in before the door; the guest start (R-ACCOUNT-021) takes that step's place when it lands.
import { useCallback, useEffect, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { countAsk, counting } from "../../shared/analytics/start";
import { Gate, GateSheet } from "../../shared/frontdoor/Gate";
import type { AccountApi, AgeStanding, Full as FullStanding } from "../../shared/net/auth";
import { say } from "../../shared/words/text";
import { AgeScreen } from "./AgeScreen";
import { Full, type FullCheck } from "./Full";
import { SignIn } from "./SignIn";
import { StartScreen } from "./StartScreen";
import { loadTurnstile, siteKey, type LoadTurnstile } from "./Turnstile";

type Standing = AgeStanding | FullStanding | "loading" | "failed";

/** Where the player is on the way in: the start screen, the age screen, or the ways in for a new life or a kept one. */
type Step = "start" | "age" | "returning";

/** The screen a standing and a step show. */
type Shown = "start" | "age" | "sign-in" | "returning" | "other";

function shownOf(standing: Standing, step: Step, embedded: boolean): Shown {
  if (typeof standing === "object") return "other";
  if (standing !== "unasked" && standing !== "passed") return "other";
  if (step === "returning") return "returning";
  if (step === "start" && !embedded) return "start";
  return standing === "unasked" ? "age" : "sign-in";
}

/** The counter key of a screen (R-ANALYTICS-002); the start screen has none in content's list yet. */
function counted(shown: Shown): string | null {
  if (shown === "age") return "age";
  if (shown === "sign-in" || shown === "returning") return "sign-in";
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
  const earlyWin = useGame((state) => state.earlyWin);
  const [standing, setStanding] = useState<Standing>("loading");
  const [step, setStep] = useState<Step>("start");
  const shown = shownOf(standing, step, embedded);
  const key = counted(shown);

  // R-ANALYTICS-011, R-GUIDE-015: the sign-in ask is the ways in after Play, keyed by whether the early win had been shown; the player's own "I already have a life here" is no ask.
  const asked = shown === "sign-in";

  useEffect(() => {
    if (key !== null) counting().count("screen/opened", key);
  }, [key, shown]);

  useEffect(() => {
    if (asked) countAsk("sign-in", "shown", earlyWin);
  }, [asked, earlyWin]);

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
  const enter = () => {
    if (asked) countAsk("sign-in", "accepted", earlyWin);
    void signedIn();
  };
  const ways = (api: AccountApi, returning: boolean) => (
    <SignIn
      account={api}
      sitekey={sitekeyShown}
      load={load}
      returning={returning}
      onBack={toStart}
      onSignedIn={enter}
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
            return <AgeScreen account={api} sitekey={sitekeyShown} load={load} onStanding={setStanding} onBack={toStart} />;
          case "returning":
            return ways(api, true);
          case "sign-in":
          case "other":
            return ways(api, false);
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
