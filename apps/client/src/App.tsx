// The shell. Once a life is playing, the world is the game (docs/rules/world.md R-WORLD-001): the
// place fills the screen, the support pages live in the phone, and the month plans and ends from
// sheets over the scene. The prologue, the life chooser, the road, the ending and the invite page
// keep their own screens. The admin page is its own chunk, fetched only at /admin (R-MODERATION-012).
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";

import { bootGame } from "./authority/boot";
import { CountedBoundary } from "./shared/analytics/CountedBoundary";
import { SoundNotice } from "./shared/sound/SoundNotice";
import { Rejection } from "./shared/ui/Rejection";
import { FaultCard, reloadPage, TroubleCard, TroubleFace } from "./shared/ui/Trouble";
import { Splash } from "./shared/ui/Splash";
import { Waiting } from "./shared/ui/Loader";
import { GameProvider, useGame, useView } from "./authority/GameProvider";
import type { GameStore } from "./authority/store";
import { readPerson } from "./authority/person";
import { AccountGate } from "./features/account/AccountGate";
import { DedicationLater } from "./features/account/DedicationLater";
import { glowFill } from "./features/account/TwoLights";
import { StartTrouble } from "./features/account/StartTrouble";
import { canDraw } from "./shared/frontdoor/Gate";
import { AgentSheets } from "./features/advice/AgentSheet";
import { inviteCodeOf, InvitePage } from "./features/account/InvitePage";
import { GuestReminder, SecureAsk } from "./features/account/Secure";
import { adminAsked } from "./features/admin/adminPath";
import { OFFER_PLACES } from "./features/city/nudge";
import { PARCEL } from "./shared/world/parcel.ask";
import { ParcelWaybill } from "./shared/world/Waybill";
import { AccountButton } from "./features/account/Settings";
import { ActivityPicker } from "./features/activity/ActivityView";
import { PhoneTile, PlaceAdverts } from "./features/adverts/placed";
import { BoardsView } from "./features/boards/BoardsView";
import { EndingView } from "./features/card/EndingView";
import { CardView, Keepsake } from "./features/card/ShareCard";
import { ChapterView } from "./features/chapter/ChapterView";
import { City } from "./features/city/City";
import { CreditsRow } from "./features/city/Credits";
import { GuidesMenu } from "./features/guides/GuidesMenu";
import { Map, type MapDedication } from "./features/map/Map";
import { MomentCard } from "./features/moment/MomentCard";
import { HeldShareCard } from "./features/notify/held";
import { NotifyAsk } from "./features/notify/NotifyAsk";
import { NotifySetting } from "./features/notify/NotifySetting";
import { OfferView } from "./features/offer/OfferView";
import { usePairApi } from "./features/people/pairApi";
import { BondHead, PeopleSlots } from "./features/people/PeopleOnPhone";
import { iconFor } from "./features/phone/icons";
import { PhoneApps, usePhoneWaiting } from "./features/phone/PhoneApps";
import { InterviewView } from "./features/interview/InterviewView";
import { KioskSheet } from "./features/lottery/KioskSheet";
import { RunDownBanner } from "./features/health/RunDownBanner";
import { ClockBanner } from "./features/status/ClockBanner";
import { PageHandover, prologueJustClosed, PrologueView } from "./features/prologue/PrologueView";
import { RoadView } from "./features/road/RoadView";
import { ScenarioView } from "./features/scenario/ScenarioView";
import { ReadyEntry } from "./shared/frontdoor/ReadyEntry";
import { SetpieceView, useClosingOpen } from "./features/setpiece/SetpieceView";
import { Calendar, calendarOpening } from "./features/turn/Calendar";
import { BriefLog } from "./features/city/brief/BriefLog";
import { Results } from "./features/turn/Results";
import { say } from "./shared/words/text";
import { usePaint } from "./shared/world/paint";
import { useScreenCount } from "./useScreenCount";

const StartCity = lazy(() => import("./features/map/StartCity"));
/** The send-off's plane cut over the painted map (world.md R-WORLD-037), fetched with the scene that shows it. */
const PlaneCut = lazy(() => import("./features/map/paper/PlaneCut"));

/** Whether WebGL draws here, asked once: each ask makes a context. */
let drawsHere: boolean | null = null;
function draws(): boolean {
  drawsHere ??= canDraw();
  return drawsHere;
}

/** The live city behind the start screen (account.md R-ACCOUNT-029), loaded apart from the first screen's code. */
function StartCityBehind() {
  return (
    <Suspense fallback={null}>
      <StartCity />
    </Suspense>
  );
}

/** R-MODERATION-012: the admin page, its own chunk, fetched only at /admin, so a player never downloads it. */
const AdminRoute = lazy(() => import("./features/admin/AdminRoute").then((admin) => ({ default: admin.AdminRoute })));

/** Anywhere but /admin the game as it is; at /admin the admin chunk is fetched, and it shows the game to anyone off the admin list. */
function AdminGate({ children }: { children: ReactNode }) {
  const [asked] = useState(() => typeof location !== "undefined" && adminAsked(location.pathname));
  if (!asked) return <>{children}</>;
  return (
    <Suspense fallback={<Splash />}>
      <AdminRoute>{children}</AdminRoute>
    </Suspense>
  );
}

/** The warnings that stand, above every app on the phone: the status clock abroad (R-STATUS-003) and being run down (R-HEALTH-007). */
function PhoneWarnings() {
  return (
    <>
      <ClockBanner className="mb-3" />
      <RunDownBanner className="mb-3" />
    </>
  );
}

/**
 * What the map is handed for the lantern canoe (world.md R-WORLD-036): the dedication page, fetched on its first opening
 * (account.md R-ACCOUNT-032), and the two lights' one glow for the lantern (R-WORLD-021).
 */
const MAP_DEDICATION: MapDedication = { page: (open, onClose) => <DedicationLater open={open} onClose={onClose} />, glow: glowFill };

/** The world is the game: the place fills the screen under a see-through bar, the month plays in the scene, and the map is a fly-over. */
function WorldPlaying() {
  const view = useView();
  const talk = usePairApi();
  const phoneWaiting = usePhoneWaiting();
  const reportOpen = useGame((state) => state.reportOpen);
  // The officer's closing line holds the asks sheet after the interview closes, until Leave the room.
  const closing = useClosingOpen();
  // The sheets over the world take the night's paint when the world's clock says night (decision 0038).
  usePaint();
  useScreenCount("world");
  useScreenCount(reportOpen ? "report" : null);
  useScreenCount(view.setpiece === null ? null : "setpiece");
  return (
    <div className="min-h-dvh">
      <City
        world
        adverts={(place) => <PlaceAdverts place={place} />}
        // A thing's act opens the sheet of what it stages (R-WORLD-005): an activity's card, an open offer, the set piece's question, or the chapter's steps.
        actions={(ids) => {
          const [first] = ids;
          if (first?.startsWith("offer.") === true) return <AgentSheets ids={ids} others={(only) => <OfferView only={only} />} />;
          if (first?.startsWith("setpiece.") === true) return <SetpieceView />;
          if (first?.startsWith("chapter.") === true) return <ChapterView />;
          return <ActivityPicker only={ids} />;
        }}
        // R-MOMENT-006: a moment of the month stands over the results sheet, inside its tree, and is dismissed back to it.
        results={(place) => <Results place={place} foot={<><GuestReminder afterFirstChapter /><MomentCard over="results" /></>} />}
        // R-WORLD-006: one ask at a time: the set piece's question, the interview's, then each open offer on its own.
        asks={[
          ...(view.setpiece === null && !closing ? [] : [<SetpieceView key="setpiece" />]),
          ...((view.interview?.question ?? null) === null ? [] : [<InterviewView key="interview" />]),
          ...[...view.offers].sort((a, b) => a.expiresMonth - b.expiresMonth).map((offer) =>
            // The parcel is collected through its waybill wherever it is asked for (R-STREET-010).
            offer.entry === PARCEL ? <ParcelWaybill key={offer.id} onClose={() => undefined} /> : <AgentSheets key={offer.id} ids={[offer.entry]} others={(only) => <OfferView only={(candidate) => candidate.id === offer.id && only(candidate)} />} />),
        ]}
        // An ask that belongs at home (the family's send-off, R-CHAPTER-008) is answered there: away from it the sheet says who waits and offers the way (R-WORLD-006).
        asksAt={[
          ...(view.setpiece === null && !closing ? [] : [null]),
          ...((view.interview?.question ?? null) === null ? [] : [null]),
          ...[...view.offers].sort((a, b) => a.expiresMonth - b.expiresMonth).map((offer) => (OFFER_PLACES[offer.entry] ?? null)),
        ]}
        asksHold={closing}
        phone={(close, area, app, toMap, here) => <PhoneApps onClose={close} area={area} here={here ?? null} account={
          <>
            <AccountButton more={<NotifySetting />} />
            <ReadyEntry />
          </>
        } about={<><CreditsRow /><GuidesMenu row /></>} talk={talk} people={{ head: (bond) => <BondHead bond={bond} api={talk} />, slots: <><PeopleSlots api={talk} /><BoardsView /></> }} start={app ?? null} calendar={(opening) => <Calendar opening={calendarOpening(opening)} />} cards={(ids) => <ActivityPicker only={ids} />} briefs={<BriefLog />} warnings={<PhoneWarnings />} advert={<PhoneTile />} dedication={(open, onClose) => <DedicationLater open={open} onClose={onClose} />} keepsake={<Keepsake />} {...(toMap === undefined ? {} : { onMap: toMap })} />}
        phoneWaiting={phoneWaiting}
        askIcon={iconFor}
        cityMap={(props) => <Map {...props} dedication={MAP_DEDICATION} />}
        // R-LOTTERY-001: online the street kiosk sells the Friday draw from its own sheet.
        kiosk={(close, label) => <KioskSheet open onClose={close} label={label} />}
        // R-CHAPTER-012 beat 4: the send-off's plane cut, the map's own layer, handed to the scene.
        planeCut={(slot) => (
          <Suspense fallback={null}>
            <PlaneCut {...slot} />
          </Suspense>
        )}
      />
      {/* The share card opens full screen when it is due; its tile has no place in the world. */}
      <div hidden>
        <HeldShareCard>
          <CardView />
        </HeldShareCard>
      </div>
      {/* R-MOMENT-006: a moment an act or the draw's letter brings stands over the world. */}
      <MomentCard over="world" />
      <SecureAsk />
      {/* R-GUIDE-015: the notice is asked once, after the early win's good moment, as the old page asked it. */}
      <NotifyAsk />
    </div>
  );
}

/** R-ENGINE-015: the loading screen says it is still at it after this long. */
export const SLOW_MS = 5_000;

/**
 * The splash (R-ENGINE-015) with "Opening your life..." under the game's name and the bar under it, a
 * second line under the bar once it takes long,
 * and the card under the mark in the words' place when the view could not be read.
 * Online, for a visitor this device has no life for, the start screen's frame instead: never "Opening your life" for
 * someone with no life, and with the server down the card stands in its sheet, naming the game (R-ENGINE-015, amended
 * 11 Oct 2026).
 */
function Opening() {
  const trouble = useGame((state) => state.trouble);
  // R-SERVER-003: a life the server must check is refused before it opens; its sheet, with Retry, stands in the loading screen's place.
  const diverged = useGame((state) => state.rejection?.code === "diverged");
  const online = useGame((state) => state.account !== null);
  const [lifeKept] = useState(() => readPerson() !== null);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(timer);
  }, []);
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

/** The screen, with the card over it while a request waits to be sent again; the loading screen shows the card in its own place. */
function Shell() {
  const waiting = useGame((state) => state.view === null && !state.signedOut && !state.choosingLife && state.failed === null);
  return (
    <>
      <Screen />
      {waiting ? null : <TroubleCard />}
    </>
  );
}

function Screen() {
  const view = useGame((state) => state.view);
  const failed = useGame((state) => state.failed);
  const choosingLife = useGame((state) => state.choosingLife);
  const signedOut = useGame((state) => state.signedOut);
  const lines = useGame((state) => state.lines);
  // The version the prologue's handover was passed at, so it shows once.
  const [handedOver, setHandedOver] = useState<number | null>(null);
  useScreenCount(choosingLife ? "scenario" : view !== null && view.prologue !== null ? "prologue" : view?.place.where === "road" ? "road" : null);
  // The game's own fault: the same card on the splash, with Reload.
  if (failed !== null)
    return (
      <Splash>
        <div className="fade mx-auto w-full max-w-[420px] p-4">
          <FaultCard role="alert" line={say("ui.failed", { why: failed })} detail={say("ui.failed.detail")}>
            <button type="button" className="press-button w-full" onClick={reloadPage}>
              {say("ui.trouble.reload")}
            </button>
          </FaultCard>
        </div>
      </Splash>
    );
  // Online and signed out: the start screen, the age screen, then the door, whose Begin makes the guest life (R-ACCOUNT-029).
  // The live city stands behind it, as designed, where WebGL draws; the compound comes back at the door.
  if (signedOut) return <AccountGate door={(guest) => <ScenarioView guest={guest} />} {...(draws() ? { behind: <StartCityBehind /> } : {})} />;
  if (choosingLife) return <ScenarioView />;
  if (view === null) return <Opening />;
  if (view.prologue !== null) return <PrologueView />;
  if (prologueJustClosed(lines) && handedOver !== view.v) return <PageHandover onDone={() => setHandedOver(view.v)} />;
  if (view.ended && view.card !== null && view.card.kind !== "send-off") return <EndingView />;
  if (view.place.where === "road") return <RoadView offers={(only) => <OfferView only={only} />} city={<City adverts={(place) => <PlaceAdverts place={place} />} />} />;
  return <WorldPlaying />;
}


/** `path`: the page's path, for tests; the browser's own otherwise. */
export function App({ store: given, path }: { store?: GameStore; path?: string }) {
  const [store] = useState(() => given ?? bootGame());
  // R-PAIR-008: a friend's invite link opens its own page before the game.
  const [invite, setInvite] = useState(() => inviteCodeOf(path ?? (typeof location === "undefined" ? "/" : location.pathname)));
  useEffect(() => {
    void store.getState().refresh();
  }, [store]);
  const leaveInvite = () => {
    if (typeof history !== "undefined") history.replaceState(null, "", "/");
    setInvite(null);
  };
  return (
    <CountedBoundary>
      <SoundNotice />
      <AdminGate>
        <GameProvider store={store}>{invite === null ? <Shell /> : <InvitePage code={invite} onDone={leaveInvite} />}</GameProvider>
      </AdminGate>
    </CountedBoundary>
  );
}
