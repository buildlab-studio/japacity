// What a signed-out player sees online. The start screen first, over the compound (R-ACCOUNT-029): Play goes to
// the age screen (R-ACCOUNT-012) and on to the door, where Begin on the page makes the guest life (R-ACCOUNT-021)
// with the username filled in from the name and the bot check run unseen (GuestStart.tsx); "I already have a life
// here" goes straight to the ways back in. No sign-in method is asked for at the door, and none of the ways back in
// makes an account. A refusal is said plainly and nothing else is offered (R-ACCOUNT-011, R-ACCOUNT-012). While
// sign-ups are switched off, the full screen instead, which asks again once the server's wait is over (R-SERVER-032).
// Inside the invite page the card is the start, so the gate begins at the age screen there, and the username stands
// under it (the card makes the life, not the door).
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import { counting } from "../../shared/analytics/start";
import { Gate, GateSheet } from "../../shared/frontdoor/Gate";
import type { AccountApi, AgeStanding, Full as FullStanding } from "../../shared/net/auth";
import { say } from "../../shared/words/text";
import { AgeScreen } from "./AgeScreen";
import { failureWords } from "./CodeForm";
import { Full, type FullCheck } from "./Full";
import { GuestForm, useGuestDoor, type GuestDoor } from "./GuestStart";
import { LegalLinks } from "./LegalLinks";
import { SignIn } from "./SignIn";
import { refreshAccount } from "./standing";
import { StartScreen } from "./StartScreen";
import { loadTurnstile, siteKey, type LoadTurnstile } from "./Turnstile";

type Standing = AgeStanding | FullStanding | "loading" | "failed";

/** Where the player is on the way in: the start screen, the age screen, or the ways back in to a kept life. */
type Step = "start" | "age" | "returning";

/** The screen a standing and a step show; `door` is the three-screen door, the new life's page at its end. */
type Shown = "start" | "age" | "door" | "returning" | "other";

function shownOf(standing: Standing, step: Step, embedded: boolean): Shown {
  if (typeof standing === "object") return "other";
  if (standing !== "unasked" && standing !== "passed") return "other";
  if (step === "returning") return "returning";
  if (step === "start" && !embedded) return "start";
  return standing === "unasked" ? "age" : "door";
}

/** The counter key of a screen (R-ANALYTICS-002); the start screen has none in content's list yet. */
function counted(shown: Shown, embedded: boolean): string | null {
  if (shown === "age") return "age";
  if (shown === "door" && !embedded) return "scenario";
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
  /** The door after the age screen, drawn by the shell, whose Begin starts the guest life; the invite page's form without it. */
  door?: ((guest: GuestDoor) => ReactNode) | null;
  /** A seam for tests: how long Begin waits for the unseen check's token. */
  botWaitMs?: number;
}

/** The new life after the age screen: the door with the guest start at Begin, or, inside the invite page, the form. */
function NewLife({ account, sitekey, load, botWaitMs, door, onExpired, onFull, onStarted, onReturning }: { account: AccountApi; sitekey: string | null; load: LoadTurnstile; botWaitMs?: number; door: ((guest: GuestDoor) => ReactNode) | null; onExpired: () => void; onFull: () => void; onStarted: () => Promise<void>; onReturning: () => void }) {
  const guest = useGuestDoor({ account, sitekey, load, onExpired, onFull, onStarted, ...(botWaitMs === undefined ? {} : { botWaitMs }) });
  return door === null ? <GuestForm door={guest} onReturning={onReturning} /> : <>{door(guest)}</>;
}

export function AccountGate({ load = loadTurnstile, sitekey, embedded = false, agent, href, door = null, botWaitMs }: AccountGateProps) {
  const account = useGame((state) => state.account);
  const notice = useGame((state) => state.accountNotice);
  const signedIn = useGame((state) => state.signedIn);
  const [standing, setStanding] = useState<Standing>("loading");
  const [step, setStep] = useState<Step>("start");
  const [back, setBack] = useState<string | null>(null);
  const shown = shownOf(standing, step, embedded);
  const key = counted(shown, embedded);

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
  const enter = async (api: AccountApi): Promise<void> => {
    void refreshAccount(api);
    await signedIn();
  };
  const ways = (api: AccountApi) => (
    <SignIn
      account={api}
      problem={back}
      onBack={toStart}
      onSignedIn={() => void enter(api)}
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
          case "door":
          case "other":
            return newLife(api);
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

  function newLife(api: AccountApi) {
    return (
      <NewLife
        account={api}
        sitekey={sitekeyShown}
        load={load}
        {...(botWaitMs === undefined ? {} : { botWaitMs })}
        door={embedded ? null : door}
        onExpired={() => setStanding("unasked")}
        onFull={() => setStanding({ full: true, retryAfter: 30 })}
        onStarted={() => enter(api)}
        onReturning={() => setStep("returning")}
      />
    );
  }

  if (embedded)
    return (
      <div className="flex flex-col gap-6">
        {body(account)}
        <LegalLinks />
      </div>
    );
  // The door draws its own scene and sheets over the compound.
  if (shown === "door" && door !== null) return newLife(account);

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
        <LegalLinks />
      </GateSheet>
    </Gate>
  );
}
