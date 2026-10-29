// What a signed-out player sees online. The start screen first, over the compound with no title and the two lights hung over
// it (account:start-screen-over-live-city, account:two-lights-and-wink-lines): Play goes to
// the age screen (account:age-screen-refuses-minors) and on to the door, where Begin on the page makes the guest life (account:guest-and-secured-states)
// with the username the player typed into an empty box (account:username-typed-and-checked) and the bot check run unseen (GuestStart.tsx); "I already have a life
// here", on the start screen and in one line on the age screen, goes straight to the ways back in. In a browser a kept
// life was open in, the start screen turns its two doors round (marks.ts). A guest who chose to open its kept life
// instead lands on the ways back in. An age answer that runs out twice in a row, or a browser with cookies off, is
// told that the browser is not keeping the sign-in (account:bot-check-on-guest-creation). Each move to another screen
// takes the focus to its heading. No sign-in method is asked for at the door, and none of the ways back in
// makes an account. A refusal is said plainly and nothing else is offered (account:sign-up-open-everywhere, account:age-screen-refuses-minors). While
// sign-ups are switched off, the full screen instead, which asks again once the server's wait is over (server:signups-off-shows-full).
// Inside the invite page the card is the start, so the gate begins at the age screen there, and the username stands
// under it (the card makes the life, not the door). A notice the last screen left ("You have signed out.") shows on
// the first screen here and goes as soon as the player moves on: to the age screen, to the ways back in, back to the
// start, or into a life (account:guest-and-secured-states). The right code for an address no account uses proves it for a new
// life (account:sign-in-without-secret): the gate goes on to the age screen, unless this browser passed it already, and to the
// username's own step, each under a line that says why the player is here; Continue there makes the account, kept by the
// email, and the door follows as for any signed-in account with no character. The server says on load when this browser
// holds a live proof, so a reload or another tab opens on that step again with the address shown. Google's return with no
// life holds the same proof, of the address and the Google identity, so it opens the same steps in Google's words, and
// Continue makes the account saved with Google.
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import { LEVEL, useBackLayer } from "../../shared/back/back";
import { counting } from "../../shared/analytics/start";
import { Gate, GateSheet } from "../../shared/front-door/Gate";
import type { AccountApi, AgeStanding, Full as FullStanding, HeldProof, NewLifeEmail } from "../../shared/net/auth";
import { Loader } from "../../shared/ui/Loader";
import { say } from "../../shared/words/text";
import { AgeScreen } from "./AgeScreen";
import { failureWords } from "./CodeForm";
import { Full, type FullCheck } from "./Full";
import { cookiesOff, GuestForm, LAPSES_TOLD, useGuestDoor, type GuestDoor } from "./GuestStart";
import { inAppBrowser } from "./inApp";
import { KeptLine, KeptName } from "./KeptStart";
import { doneWaysBackIn, keptHere, nameBackFromGoogle, waysBackInAsked } from "./marks";
import { SheetColumn } from "../../shared/ui/look/SheetColumn";
import { LegalLinks } from "../../shared/ui/LegalLinks";
import { Wordmark } from "../../shared/ui/Wordmark";
import { SignIn, type SignedInBy } from "./SignIn";
import { refreshAccount } from "./standing";
import { StartScreen } from "./StartScreen";
import { useLights } from "./lights";
import { TwoLights } from "./TwoLights";
import { tellWay } from "./WayToast";
import { loadTurnstile, siteKey, type LoadTurnstile } from "./Turnstile";

type Standing = AgeStanding | FullStanding | "loading" | "failed";

/** Where the player is on the way in: the start screen, the age screen (the door once the age is passed), or the ways back in to a kept life. */
type Step = "start" | "age" | "returning";

/**
 * The screen a standing and a step show; `door` is the three-screen door, the new life's page at its end; `username` is the
 * username's own step of a life that came by the code (account:sign-in-without-secret).
 */
type Shown = "start" | "age" | "door" | "username" | "returning" | "other";

/** account:sign-in-without-secret: the live proof this browser holds: the address, and whether Google proved it. */
interface Proof {
  email: string;
  google: boolean;
}

function shownOf(standing: Standing, step: Step, embedded: boolean, proof: Proof | null): Shown {
  if (typeof standing === "object") return "other";
  if (standing !== "unasked" && standing !== "passed") return "other";
  if (step === "returning") return "returning";
  if (step === "start" && !embedded) return "start";
  if (proof !== null) return standing === "unasked" ? "age" : "username";
  return standing === "unasked" ? "age" : "door";
}

/** A standing read on load or after the full screen, with a live proof this browser holds apart. */
function heldOf(found: AgeStanding | FullStanding | HeldProof): { standing: AgeStanding | FullStanding; proof: Proof | null } {
  if (typeof found === "object" && "proved" in found) return { standing: found.passed ? "passed" : "unasked", proof: { email: found.proved, google: found.google === true } };
  return { standing: found, proof: null };
}

/** The counter key of a screen (analytics:client-sends-interface-counts); the start screen is not in content's list, so it counts nothing. */
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
  /** What stands behind the start screen and the ways in, drawn by the shell: the live city (account:start-screen-over-live-city); the compound when left out. */
  behind?: ReactNode;
}

/** The two lights over the start screen, edge to edge from the very top (account:two-lights-and-wink-lines). */
function StartLights() {
  const shown = useLights();
  return (
    <div className="-mx-3 -mt-[max(10px,env(safe-area-inset-top))]">
      <TwoLights shown={shown} />
    </div>
  );
}

/** The username's own step of a life that came by the code or by Google: the guest start marked proved and kept (account:sign-in-without-secret). */
function KeptLife({ account, proof, sitekey, load, botWaitMs, lapses, username, onUsername, onLapse, onExpired, onFull, onStarted, onOther, onSignedIn, back }: { account: AccountApi; proof: Proof; sitekey: string | null; load: LoadTurnstile; botWaitMs?: number; lapses: number; username: string; onUsername: (username: string) => void; onLapse: () => void; onExpired: () => void; onFull: () => void; onStarted: (email: NewLifeEmail | null) => Promise<void>; onOther: () => void; onSignedIn: () => void; back: ReactNode }) {
  const guest = useGuestDoor({ account, sitekey, load, lapses, kept: true, proved: true, onLapse, onExpired, onFull, onStarted, ...(botWaitMs === undefined ? {} : { botWaitMs }) });
  return <KeptName account={account} email={proof.email} google={proof.google} door={guest} username={username} onUsername={onUsername} onOther={onOther} onHere={() => void onStarted("kept")} onSignedIn={onSignedIn} back={back} />;
}

/** The new life after the age screen: the door with the guest start at Begin, or, inside the invite page, the form. */
function NewLife({ account, sitekey, load, botWaitMs, door, lapses, onLapse, onExpired, onFull, onStarted, onReturning }: { account: AccountApi; sitekey: string | null; load: LoadTurnstile; botWaitMs?: number; door: ((guest: GuestDoor) => ReactNode) | null; lapses: number; onLapse: () => void; onExpired: () => void; onFull: () => void; onStarted: (email: NewLifeEmail | null) => Promise<void>; onReturning: () => void }) {
  const guest = useGuestDoor({ account, sitekey, load, lapses, onLapse, onExpired, onFull, onStarted, ...(botWaitMs === undefined ? {} : { botWaitMs }) });
  return door === null ? <GuestForm door={guest} onReturning={onReturning} /> : <>{door(guest)}</>;
}

export function AccountGate({ load = loadTurnstile, sitekey, embedded = false, agent, href, door = null, botWaitMs, behind }: AccountGateProps) {
  const account = useGame((state) => state.account);
  const notice = useGame((state) => state.accountNotice);
  const signedIn = useGame((state) => state.signedIn);
  const [standing, setStanding] = useState<Standing>("loading");
  // A guest that chose to open its kept life lands on the ways back in, its address filled in.
  const [asked] = useState(waysBackInAsked);
  const [step, setStep] = useState<Step>(asked === null ? "start" : "returning");
  const [kept] = useState(keptHere);
  // Once the player moves on from the screen the gate opened on, the notice it carried is done with.
  const [moved, setMoved] = useState(false);
  // How the ways back in open after a new life's step was left: the address filled in, or emptied with the focus in it.
  const [waysFill, setWaysFill] = useState<{ email: string; focus: boolean } | null>(null);
  const go = (next: Step) => {
    setMoved(true);
    setStep(next);
    if (next !== "returning") setWaysFill(null);
  };
  const [back, setBack] = useState<{ said: string; none: boolean } | null>(null);
  // account:sign-in-without-secret: this browser's live proof, from the code just typed or the server on load.
  const [proof, setProof] = useState<Proof | null>(null);
  // The username typed on the username's own step, kept while the full screen, a new code or a trip to Google stands in its place.
  const [keptName, setKeptName] = useState(nameBackFromGoogle);
  // Google came back with a new life's proof: the standing read on load names it, and opens the ways back in if it does not.
  const fromGoogle = useRef(false);
  // How many times in a row the guest start found the age answer or the session gone: the cookie did not stay.
  const [lapses, setLapses] = useState(0);
  const shown = shownOf(standing, step, embedded, proof);
  // A new life's step is left for the ways back in: its proof is dropped, and the address goes back filled in, or emptied with
  // the focus in it; where Google proved it, the ways back in open as they stand.
  const leaveProof = (fill: string | null) => {
    void account?.dropNewLife();
    setProof(null);
    go("returning");
    if (fill !== null) setWaysFill({ email: fill, focus: true });
  };
  const backFill = (held: Proof) => (held.google ? null : held.email);
  const otherFill = (held: Proof) => (held.google ? null : "");
  // world:back-closes-topmost: the age screen, the door and the ways back in are a step over the start screen; Back and Escape
  // return to it. An age already answered stays answered, so Play goes on to the door. A new life's step came from the ways
  // back in, so Back returns there, its address filled in.
  useBackLayer(!embedded && step !== "start", () => (proof !== null && step === "age" ? leaveProof(backFill(proof)) : go("start")), { level: LEVEL.step });
  const key = counted(shown, embedded);
  const sheet = useRef<HTMLDivElement>(null);
  // The notice, said through one live region mounted before its words come.
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    if (key !== null) counting().count("screen/opened", key);
  }, [key, shown]);

  useEffect(() => {
    if (asked !== null) doneWaysBackIn();
  }, [asked]);

  useEffect(() => setSaid(notice === null || moved ? null : say(notice)), [notice, moved]);

  // A move to another screen takes the focus to its heading; the screen the gate opened on keeps the page's own, and the ways
  // back in opened from a new life's step keep it in the email field.
  useEffect(() => {
    if (!moved || (shown === "returning" && waysFill?.focus === true)) return;
    const heading = sheet.current?.querySelector<HTMLElement>("h1");
    if (heading === null || heading === undefined) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [moved, shown, waysFill]);

  // A trip to Google that was refused comes back here with the reason (account:guest-and-secured-states). One that went through opens
  // the life instead, where the shell tells it (Secure.tsx), so it never lands here; one that proved a new life's address is
  // opened by the standing read on load (account:sign-in-without-secret).
  useEffect(() => {
    const failed = account?.returnedFromGoogle() ?? null;
    if (failed === "new-life") fromGoogle.current = true;
    // A deletion's trip that came back signed out has nothing to confirm; the start screen stands.
    if (failed === null || failed === "kept" || failed === "signed-in" || failed === "delete" || failed === "new-life") return;
    setStep("returning");
    setBack({ said: failureWords({ ok: false, why: failed }) ?? "", none: failed === "no-life" });
  }, [account]);

  const check = useCallback(async (): Promise<FullCheck> => {
    if (account === null) return "full";
    const found = heldOf(await account.ageStatus());
    if (typeof found.standing === "object") return "full";
    setStanding(found.standing);
    return "open";
  }, [account]);

  useEffect(() => {
    if (account === null) return;
    let gone = false;
    account
      .ageStatus()
      .then((answer) => {
        if (gone) return;
        const found = heldOf(answer);
        setStanding(found.standing);
        // account:sign-in-without-secret: a live proof means the player proved an address before this reload, or in another tab, so
        // the gate opens on that life's step with the address shown.
        if (found.proof !== null) {
          setProof(found.proof);
          setStep((now) => (now === "start" ? "age" : now));
        } else if (fromGoogle.current) {
          // Google said it proved a new life, but this browser holds no proof (its cookie did not stay): the trip did not finish.
          setStep("returning");
          setBack({ said: failureWords({ ok: false, why: "google" }) ?? "", none: false });
        }
        fromGoogle.current = false;
        // account:age-screen-refuses-minors: a pass still held means the player was past the age screen before this reload or Back,
        // so the gate opens on the door's step (its run kept) instead of the start screen and the age asked again.
        if (found.standing === "passed") setStep((now) => (now === "start" ? "age" : now));
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
  const browser = agent ?? (typeof navigator === "undefined" ? "" : navigator.userAgent);
  const toStart = embedded ? null : () => go("start");
  const enter = async (api: AccountApi, by: SignedInBy | null = null, email: NewLifeEmail | null = null, google = false): Promise<void> => {
    setMoved(true);
    // account:guest-secures-the-life: the sheet closes as the life opens, and the world says which way it was; a new life born
    // kept by its email, or with Google, says so as a kept guest's does, and one whose address an account took meanwhile says that.
    if (by !== null) tellWay(api, `in.${by}`);
    if (email !== null) tellWay(api, email === "taken" ? "taken.email" : google ? "kept.google" : "kept.email");
    void refreshAccount(api);
    await signedIn();
  };
  const ways = (api: AccountApi) => (
    <SignIn
      account={api}
      problem={back?.said ?? null}
      noneFound={back?.none === true}
      filled={waysFill?.email ?? asked?.email ?? null}
      focusEmail={waysFill?.focus === true}
      onBack={toStart}
      onSignedIn={(by) => void enter(api, by)}
      onNewLife={(proved) => {
        setProof(proved === null ? null : { email: proved, google: false });
        go("age");
      }}
      {...(agent === undefined ? {} : { agent })}
      {...(href === undefined ? {} : { href })}
    />
  );

  function body(api: AccountApi) {
    if (typeof standing === "object") return <Full retryAfter={standing.retryAfter} check={check} onOpen={() => undefined} />;
    switch (standing) {
      case "loading":
        // The words with the shared loader under them (world:reach-and-read).
        return (
          <p role="status" className="flex flex-col gap-2 text-text-2">
            {say("ui.account.loading")}
            <Loader label={say("ui.account.loading")} />
          </p>
        );
      case "failed":
        return <p role="alert">{say("ui.account.fail.unreachable")}</p>;
      case "refused":
        return <p role="alert">{say("ui.account.age.refused")}</p>;
      case "unasked":
      case "passed":
        switch (shown) {
          case "start":
            return <StartScreen kept={kept} inApp={inAppBrowser(browser) ? { agent: browser, ...(href === undefined ? {} : { href }) } : null} onPlay={() => go("age")} onReturning={() => go("returning")} />;
          case "age":
            return proof === null ? (
              <AgeScreen key={lapses} account={api} onStanding={setStanding} onBack={toStart} onReturning={() => go("returning")} said={ageSaid()} />
            ) : (
              // A life that came by the code: the line says why the player is here, and no line sends them to the ways back in they just tried.
              <AgeScreen
                key={lapses}
                account={api}
                onStanding={(answer) => {
                  // A minor's refusal drops the proof on the server too (account:age-screen-refuses-minors).
                  if (answer === "refused") setProof(null);
                  setStanding(answer);
                }}
                onBack={embedded ? null : () => leaveProof(backFill(proof))}
                lead={<KeptLine email={proof.email} google={proof.google} onOther={() => leaveProof(otherFill(proof))} />}
                intro={say("ui.account.age.intro.kept")}
                said={ageSaid()}
              />
            );
          case "username":
            return proof === null ? newLife(api) : keptLife(api, proof);
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

  /** Why the age screen asks again: the answer ran out, or, a second time in a row or with cookies off, the browser keeps no sign-in. */
  function ageSaid(): string | null {
    if (cookiesOff() || lapses >= LAPSES_TOLD) return say("ui.account.cookies");
    return lapses > 0 ? say("ui.account.guest.expired") : null;
  }

  function keptLife(api: AccountApi, held: Proof) {
    return (
      <KeptLife
        account={api}
        proof={held}
        sitekey={sitekeyShown}
        load={load}
        {...(botWaitMs === undefined ? {} : { botWaitMs })}
        lapses={lapses}
        username={keptName}
        onUsername={setKeptName}
        onLapse={() => setLapses((count) => count + 1)}
        onExpired={() => {
          setLapses((count) => count + 1);
          setStanding("unasked");
        }}
        onFull={() => setStanding({ full: true, retryAfter: 30 })}
        onStarted={(started) => enter(api, null, started ?? "kept", held.google)}
        onOther={() => leaveProof(otherFill(held))}
        onSignedIn={() => void enter(api, "email")}
        back={
          embedded ? null : (
            <button type="button" aria-label={say("ui.account.back")} className="press flex size-11 shrink-0 items-center justify-center rounded-[6px] bg-sheet-muted" onClick={() => leaveProof(backFill(held))}>
              <ArrowLeft size={18} />
            </button>
          )
        }
      />
    );
  }

  function newLife(api: AccountApi) {
    return (
      <NewLife
        account={api}
        sitekey={sitekeyShown}
        load={load}
        {...(botWaitMs === undefined ? {} : { botWaitMs })}
        door={embedded ? null : door}
        lapses={lapses}
        onLapse={() => setLapses((count) => count + 1)}
        onExpired={() => {
          setLapses((count) => count + 1);
          setStanding("unasked");
        }}
        onFull={() => setStanding({ full: true, retryAfter: 30 })}
        onStarted={(email) => enter(api, null, email)}
        onReturning={() => go("returning")}
      />
    );
  }

  if (embedded)
    return (
      <div className="flex flex-col gap-6">
        <div ref={sheet}>{body(account)}</div>
        <LegalLinks />
      </div>
    );
  // The door draws its own scene and sheets over the compound.
  if (shown === "door" && door !== null) return newLife(account);

  // The wordmark tops the account screens only: the ways back in, the username's own step and the full screen, on the theme's band across the top
  // as the door's page has its header, so its ground is the look's own and never the compound's walls. The start and age
  // screens are the door's first, and carry no title over the figure; the sheet's words carry them.
  // The username's own step is an account screen too: it carries the band and rises to it, so it fits a small phone whole.
  const marked = typeof standing === "object" || shown === "returning" || shown === "username";
  const top = (
    <div className="band-2 adire -mx-3 -mt-[max(10px,env(safe-area-inset-top))] px-3 pt-[max(20px,env(safe-area-inset-top))] pb-4" data-account-top>
      <Wordmark ground="dark" />
    </div>
  );
  // Over the start screen alone hang the two lights (account:two-lights-and-wink-lines); the account screens carry the wordmark instead.
  const over = marked ? top : shown === "start" ? <StartLights /> : null;
  return (
    <Gate mark="start" {...(over === null ? {} : { over })} {...(behind === undefined ? {} : { scene: behind })}>
      {/* On a wide screen the sheet stands in a centred column at a reading width, the scene filling the window around it;
          on a phone the column is the screen. */}
      <SheetColumn>
        <GateSheet mark={shown} label={say("ui.game")} tall={shown === "returning" || shown === "username"}>
          <p role="status" className={said === null ? "sr-only" : "mb-3 rounded-[5px] border-l-4 border-l-action bg-sheet-muted p-3 text-[14px]"}>
            {said ?? ""}
          </p>
          <div ref={sheet} data-account-step={shown}>
            {body(account)}
          </div>
          <LegalLinks />
        </GateSheet>
      </SheetColumn>
    </Gate>
  );
}
