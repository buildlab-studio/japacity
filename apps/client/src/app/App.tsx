// The shell. A first visit downloads the start screen, the age screen, the door, sign in, the splash and the trouble cards, and no more
// (engine:first-download-has-budget): everything the game draws once a life exists is one part of its own (Life.tsx), fetched while the
// player is on the start screen, at once for a returning player with a life, and failing softly (world:lazy-part-fails-softly). The invite
// page keeps its own screen. The admin page is its own chunk, fetched only at /admin (moderation:admin-view-for-admin-list).
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";

import type { AccountReply } from "@japacity/api";

import { accountAtBoot, bootGame } from "../authority/boot";
import { CountedBoundary } from "../shared/analytics/CountedBoundary";
import { SoundNotice } from "../shared/sound/SoundNotice";
import { Rejection } from "../shared/ui/Rejection";
import { FaultCard, reloadPage, TroubleCard, TroubleFace } from "../shared/ui/Trouble";
import { Splash } from "../shared/ui/Splash";
import { Waiting } from "../shared/ui/Loader";
import { GameProvider, useGame } from "../authority/GameProvider";
import { VIEW_RETRY_MS, type GameStore } from "../authority/store";
import { readPerson } from "../shared/front-door/person";
import { AccountGate } from "../features/account/AccountGate";
import { StartTrouble } from "../features/account/StartTrouble";
import { canDraw } from "../shared/front-door/Gate";
import { inviteCodeOf, InvitePage } from "../features/account/InvitePage";
import { useAccountView } from "../features/account/standing";
import { HoldParts, softLazy, type SoftPart, useFetchAhead } from "../shared/net/parts";
import { pageStale, type StaleGuard } from "../shared/net/stale";
import { replaceAddress } from "../shared/back/back";
import { api } from "../shared/net/http";
import { addressOf, listedAsAdmin, showRoot, type Address } from "./address";
import { FrontDoor } from "../features/front-door/FrontDoor";
import { say } from "../shared/words/text";
import { useScreenCount } from "../shared/analytics/useScreenCount";

/** The life's screens' module (Life.tsx), fetched apart: only its type is read here. */
type LifeModule = typeof import("./Life");

// world:lazy-part-fails-softly: the parts a player opens fail softly, the connection card up with Retry over what stands.
const StartCity = softLazy(() => import("../features/map/StartCity"));

/** The life's screens as a part, and the chain fetched ahead from the start screen. */
export interface LifeParts {
  shell: SoftPart<LifeModule["default"]>;
  ahead: readonly Pick<SoftPart<LifeModule["default"]>, "ahead">[];
}

/**
 * The life's screens (engine:first-download-has-budget). The world's first load waits on them, so a failed fetch is made again after the
 * view's pauses before the card shows (world:lazy-part-fails-softly), and a tab left on an older build reloads once to the newer one.
 * Once here, the build is the server's: a later release may reload this tab once again (stale.ts). The chain fetched ahead is the
 * life's screens, then the place's scene and three.js, one after another. `load`, `wait` and `stale`: a test's own.
 */
export function lifeParts({ load = () => import("./Life"), wait, stale = pageStale }: { load?: () => Promise<LifeModule>; wait?: (ms: number) => Promise<void>; stale?: StaleGuard } = {}): LifeParts {
  let here: LifeModule | null = null;
  const shell = softLazy(
    () =>
      load().then((life) => {
        here = life;
        stale.loaded();
        return life;
      }),
    { again: VIEW_RETRY_MS, stale, ...(wait === undefined ? {} : { wait }) },
  );
  const scene = { ahead: () => here?.sceneAhead() ?? Promise.resolve() };
  return { shell, ahead: [shell, scene] };
}

const LIFE = lifeParts();

/** Whether WebGL draws here, asked once: each ask makes a context. */
let drawsHere: boolean | null = null;
function draws(): boolean {
  drawsHere ??= canDraw();
  return drawsHere;
}

/** The live city behind the start screen (account:start-screen-over-live-city), loaded apart from the first screen's code. */
function StartCityBehind() {
  return (
    <Suspense fallback={null}>
      <StartCity />
    </Suspense>
  );
}

/** moderation:admin-view-for-admin-list: the admin page, its own chunk, fetched only at /admin and only for an account the server names as listed. */
const AdminRoute = lazy(() => import("../features/admin/AdminRoute").then((admin) => ({ default: admin.AdminRoute })));

/**
 * The account read an address is judged on: online, the one the game makes as it starts, so judging asks nothing more.
 * With the local authority (development only) there is none, and /admin reads the dev server's account route.
 */
export function accountForAddress(address: Address): Promise<AccountReply | null> {
  const booted = accountAtBoot();
  if (booted !== null) return booted;
  if (address !== "admin") return Promise.resolve(null);
  return api({ baseUrl: "" })
    .get<AccountReply>("/api/account")
    .catch(() => null);
}

/**
 * server:unknown-address-becomes-root, moderation:admin-view-for-admin-list: the game at every address. Once the game's account
 * read has settled, an address the game does not know becomes `/`; /admin stays, and fetches the admin chunk, only for an account
 * the server names as listed. To anyone else /admin is any unknown address: the same game, the same requests, the same `/`.
 */
export function AddressGate({ children, path, read = accountForAddress }: { children: ReactNode; path?: string; read?: (address: Address) => Promise<AccountReply | null> }) {
  const [address] = useState<Address>(() => addressOf(path ?? (typeof location === "undefined" ? "/" : location.pathname)));
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (address === "root" || address === "invite") return undefined;
    let live = true;
    const judge = (reply: AccountReply | null) => {
      if (!live) return;
      if (address === "admin" && listedAsAdmin(reply)) setAdmin(true);
      else showRoot();
    };
    read(address).then(judge, () => judge(null));
    return () => {
      live = false;
    };
  }, [address, read]);
  if (!admin) return <>{children}</>;
  return (
    <Suspense fallback={<Splash />}>
      <AdminRoute>{children}</AdminRoute>
    </Suspense>
  );
}

/** engine:browser-authority-for-dev-only: the loading screen says it is still at it after this long. */
export const SLOW_MS = 5_000;

/**
 * The splash (engine:browser-authority-for-dev-only) with "Opening your life..." under the game's name and the bar under it, a second line under
 * the bar once it takes long, and the card under the mark in the words' place when the view could not be read.
 * Online, for a visitor this device has no life for, the start screen's frame instead: never "Opening your life" for
 * someone with no life, and with the server down the card stands in its sheet, naming the game (engine:browser-authority-for-dev-only).
 */
/** True once the loading screen has stood this long. */
function useSlow(): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return slow;
}

function Opening() {
  const trouble = useGame((state) => state.trouble);
  // server:log-rows-hash-state: a life the server must check is refused before it opens; its sheet, with Retry, stands in the loading screen's place.
  const diverged = useGame((state) => state.rejection?.code === "diverged");
  const online = useGame((state) => state.account !== null);
  const [lifeKept] = useState(() => readPerson() !== null);
  const slow = useSlow();
  if (diverged) {
    return (
      <div className="mx-auto w-full max-w-[420px] p-4">
        <Rejection />
      </div>
    );
  }
  if (online && !lifeKept) return <StartTrouble trouble={trouble} />;
  return (
    <Splash data-opening="">
      {trouble !== null ? (
        <TroubleFace trouble={trouble} inline />
      ) : (
        <Waiting words={say("ui.loading")} more={slow ? say("ui.loading.slow") : null} />
      )}
    </Splash>
  );
}

/**
 * world:lazy-part-fails-softly: while the life's screens are fetched, the opening screen the player already sees stays, never a blank:
 * the splash with "Opening your life...", or online for a browser that keeps no person, the start screen's frame as `Opening` showed it.
 * A fetch that failed shows the Shell's connection card over it, never a second card here.
 */
function OpeningLife() {
  const online = useGame((state) => state.account !== null);
  const [lifeKept] = useState(() => readPerson() !== null);
  const slow = useSlow();
  if (online && !lifeKept) return <StartTrouble trouble={null} />;
  return (
    <Splash data-opening="">
      <Waiting words={say("ui.loading")} more={slow ? say("ui.loading.slow") : null} />
    </Splash>
  );
}

/**
 * The life's screens are fetched while the start screen, the door or the opening splash stand: when the page is idle, or at once for a
 * player this browser has a life for (a kept person, or an account the server says has a character), even when the player asked to
 * save data, since that life opens on them. The place's scene and three.js follow in the same chain.
 */
function LifeAhead({ parts }: { parts: LifeParts }) {
  const [kept] = useState(() => readPerson() !== null);
  const character = useBootCharacter();
  useFetchAhead(parts.ahead, true, kept || character);
  return null;
}

/** True once the account the game read as it started (boot.ts, no request of its own) says it has a character. */
function useBootCharacter(): boolean {
  const [character, setCharacter] = useState(false);
  useEffect(() => {
    const booted = accountAtBoot();
    if (booted === null) return undefined;
    let live = true;
    booted.then(
      (reply) => {
        if (live && reply.ok && reply.account.character !== null) setCharacter(true);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return character;
}

/**
 * The door for a signed-in account with no character, on the sign-in path or for a later life: its username was chosen
 * before the door (account:sign-in-without-secret), so the door's name starts from it, never from the pool
 * (prologue:front-door-builds-a-person). Offline there is no account and no username, and the pool fills the name.
 */
function ChosenDoor() {
  const me = useAccountView();
  const signedIn = useGame((state) => state.account !== null);
  return <FrontDoor username={me?.username ?? null} signedIn={signedIn} />;
}

/** The screen, with the card over it while a request waits to be sent again; the loading screen shows the card in its own place. */
function Shell({ life }: { life: LifeParts }) {
  const waiting = useGame((state) => state.view === null && !state.signedOut && !state.choosingLife && state.failed === null);
  return (
    <>
      <Screen life={life} />
      <LifeAhead parts={life} />
      <HoldParts />
      {waiting ? null : <TroubleCard />}
    </>
  );
}

function Screen({ life }: { life: LifeParts }) {
  const view = useGame((state) => state.view);
  const failed = useGame((state) => state.failed);
  const choosingLife = useGame((state) => state.choosingLife);
  const signedOut = useGame((state) => state.signedOut);
  // The version the prologue's handover was passed at, so it shows once.
  const [handedOver, setHandedOver] = useState<number | null>(null);
  useScreenCount(choosingLife ? "scenario" : view !== null && view.prologue !== null ? "prologue" : view?.place.where === "road" ? "road" : null);
  // The game's own fault: the same card on the splash, with Reload, never red text.
  if (failed !== null)
    return (
      <Splash>
        <div className="fade mx-auto w-full max-w-[420px] p-4">
          <FaultCard role="alert" line={say("ui.failed")} detail={say(`ui.failed.${failed}.detail`)}>
            <button type="button" className="press-button w-full" onClick={reloadPage}>
              {say("ui.trouble.reload")}
            </button>
          </FaultCard>
        </div>
      </Splash>
    );
  // Online and signed out: the start screen, the age screen, then the door, whose Begin makes the guest life (account:start-screen-over-live-city).
  // The live city stands behind it where WebGL draws; the compound comes back at the door.
  if (signedOut) return <AccountGate door={(guest) => <FrontDoor guest={guest} />} {...(draws() ? { behind: <StartCityBehind /> } : {})} />;
  if (choosingLife) return <ChosenDoor />;
  if (view === null) return <Opening />;
  return (
    <Suspense fallback={<OpeningLife />}>
      <life.shell handedOver={handedOver} onHandedOver={setHandedOver} />
    </Suspense>
  );
}

/** `path`: the page's path, for tests; the browser's own otherwise. `life`: the life's screens' part, for tests; the fetched one otherwise. */
export function App({ store: given, path, life = LIFE }: { store?: GameStore; path?: string; life?: LifeParts }) {
  const [store] = useState(() => given ?? bootGame());
  // pair:invite-link-single-use: a friend's invite link opens its own page before the game.
  const [invite, setInvite] = useState(() => inviteCodeOf(path ?? (typeof location === "undefined" ? "/" : location.pathname)));
  useEffect(() => {
    void store.getState().refresh();
  }, [store]);
  const leaveInvite = () => {
    if (typeof history !== "undefined") replaceAddress("/");
    setInvite(null);
  };
  return (
    <CountedBoundary>
      <SoundNotice />
      <AddressGate {...(path === undefined ? {} : { path })}>
        <GameProvider store={store}>{invite === null ? <Shell life={life} /> : <InvitePage code={invite} onDone={leaveInvite} />}</GameProvider>
      </AddressGate>
    </CountedBoundary>
  );
}
