// The life's screens: everything the game draws once a life exists, one part of its own (engine:first-download-has-budget), so a first
// visit downloads the start screen, the door and sign in alone, and this part is fetched while the player is on them (App.tsx). Once a
// life is playing, the world is the game (world:world-fills-the-screen): the place fills the screen, the support pages live in the
// phone, and the month plans and ends from sheets over the scene. The prologue, the road and the ending keep their own screens. It reads
// the one game store through GameProvider, as every screen does: it never makes a store of its own.
import { Suspense } from "react";

import { useGame, useView } from "../authority/GameProvider";
import { DedicationLater } from "../features/account/DedicationLater";
import { glowFill } from "../features/account/TwoLights";
import { AgentSheets } from "../features/advice/AgentSheet";
import { GuestReminder, SecureAsk } from "../features/account/Secure";
import { OFFER_PLACES } from "../features/city/nudge/nudge";
import { PARCEL } from "../shared/world/parcel.ask";
import { ParcelWaybill } from "../shared/world/Waybill";
import { AccountButton } from "../features/account/AccountButton";
import { useAccountView } from "../features/account/standing";
import { ActivityPicker } from "../features/activity/ActivityView";
import { PhoneTile, PlaceAdverts } from "../features/advert/placed";
import { BoardsView } from "../features/boards/BoardsView";
import { EndingView } from "../features/share/EndingView";
import { CardView, Keepsake } from "../features/share/ShareCard";
import { ChapterView } from "../features/chapter/ChapterView";
import { City, sceneAhead as citySceneAhead } from "../features/city/City";
import { CreditsRow } from "../features/city/Credits";
import { GuidesMenu } from "../features/guide/GuidesMenu";
import { Map, MapAhead, type MapDedication } from "../features/map/Map";
import { softLazy } from "../shared/net/parts";
import { MomentCard } from "../features/moment/MomentCard";
import { HeldShareCard } from "../features/notify/HeldShareCard";
import { NotifyAsk } from "../features/notify/NotifyAsk";
import { NotifySetting } from "../features/notify/NotifySetting";
import { askerOf, OfferView } from "../features/offer/OfferView";
import { nameOf } from "../shared/words/text";
import { usePairApi } from "../features/person/pairApi";
import { BondHead, PeopleSlots } from "../features/person/PeopleOnPhone";
import { iconFor } from "../features/phone/PhoneIcon";
import { PhoneApps, usePhoneWaiting } from "../features/phone/PhoneApps";
import { InterviewView } from "../features/interview/InterviewView";
import { KioskSheet } from "../features/lottery/KioskSheet";
import { RunDownBanner } from "../features/health/RunDownBanner";
import { ClockBanner } from "../features/status/ClockBanner";
import { OverstayBanner } from "../features/status/OverstayBanner";
import { PageHandover, prologueJustClosed, PrologueView } from "../features/prologue/PrologueView";
import { RoadView } from "../features/road/RoadView";
import { ReadyEntry } from "../shared/front-door/ReadyEntry";
import { SetpieceView, useClosingOpen } from "../features/setpiece/SetpieceView";
import { Calendar, calendarOpening } from "../features/turn/Calendar";
import { BriefLog } from "../features/city/brief/BriefLog";
import { Results } from "../features/turn/Results";
import { usePaint } from "../shared/world/paint";
import { useScreenCount } from "../shared/analytics/useScreenCount";

/** The send-off's plane cut over the painted map (world:plane-cut-at-send-off), fetched with the scene that shows it. */
const PlaneCut = softLazy(() => import("../features/map/paper/PlaneCut"));

/** world:lazy-part-fails-softly: the place's scene and three.js, fetched ahead right after this part (App.tsx's chain). */
export function sceneAhead(): Promise<void> {
  return citySceneAhead();
}

/**
 * The warnings that stand, above every app on the phone: the status clock abroad (status:lost-job-starts-clock), the overstay's
 * stage (status:view-shows-status) and being run down (health:view-shows-health-warning).
 */
function PhoneWarnings() {
  return (
    <>
      <ClockBanner className="mb-3" />
      <OverstayBanner className="mb-3" />
      <RunDownBanner className="mb-3" />
    </>
  );
}

/**
 * What the map is handed for the lantern canoe (world:lantern-canoe-on-map): the dedication page, fetched on its first opening
 * (account:dedication-page-and-its-doors), and the two lights' one glow for the lantern (world:colours-are-role-tokens).
 */
const MAP_DEDICATION: MapDedication = { page: (open, onClose) => <DedicationLater open={open} onClose={onClose} />, glow: glowFill };

/** The world is the game: the place fills the screen under a see-through bar, the month plays in the scene, and the map is a fly-over. */
function WorldPlaying() {
  const view = useView();
  // moderation:blocked-list-in-settings: only a secured account has a Blocked list in Settings; unknown or a guest's, none.
  const secured = useAccountView()?.state === "secured";
  const talk = usePairApi();
  const phoneWaiting = usePhoneWaiting();
  const reportOpen = useGame((state) => state.reportOpen);
  // The officer's closing line holds the asks sheet after the interview closes, until Leave the room.
  const closing = useClosingOpen();
  // The sheets over the world take the night's paint when the world's clock says night (decision 0025).
  usePaint();
  useScreenCount("world");
  useScreenCount(reportOpen ? "report" : null);
  useScreenCount(view.setpiece === null ? null : "setpiece");
  return (
    <div className="min-h-dvh">
      <MapAhead />
      <City
        world
        adverts={(place) => <PlaceAdverts place={place} />}
        // A thing's act opens the sheet of what it stages (world:things-are-tappable-models): an activity's card, an open offer, the set piece's question, or the chapter's steps.
        actions={(ids) => {
          const [first] = ids;
          if (first?.startsWith("offer.") === true) return <AgentSheets ids={ids} others={(only) => <OfferView only={only} />} />;
          if (first?.startsWith("setpiece.") === true) return <SetpieceView />;
          if (first?.startsWith("chapter.") === true) return <ChapterView />;
          return <ActivityPicker only={ids} />;
        }}
        // moment:card-shows-when-outcome-lands: a moment of the month stands over the results sheet, inside its tree, and is dismissed back to it.
        results={(place, ask) => <Results place={place} onAsk={ask} foot={<><GuestReminder afterFirstChapter /><MomentCard over="results" /></>} />}
        // world:one-action-one-sheet: one ask at a time: the set piece's question, the interview's, then each open offer on its own.
        asks={[
          ...(view.setpiece === null && !closing ? [] : [<SetpieceView key="setpiece" />]),
          ...((view.interview?.question ?? null) === null ? [] : [<InterviewView key="interview" />]),
          ...[...view.offers].sort((a, b) => a.expiresMonth - b.expiresMonth).map((offer) =>
            // The parcel is collected through its waybill wherever it is asked for (streets:parcels-shipped-home).
            offer.entry === PARCEL ? <ParcelWaybill key={offer.id} onClose={() => undefined} /> : <AgentSheets key={offer.id} ids={[offer.entry]} others={(only) => <OfferView only={(candidate) => candidate.id === offer.id && only(candidate)} />} />),
        ]}
        // An ask that belongs at home (the family's send-off, chapter:family-marks-the-grant) is answered there: away from it the sheet says who waits and offers the way (world:one-action-one-sheet).
        asksAt={[
          ...(view.setpiece === null && !closing ? [] : [null]),
          ...((view.interview?.question ?? null) === null ? [] : [null]),
          ...[...view.offers].sort((a, b) => a.expiresMonth - b.expiresMonth).map((offer) => (OFFER_PLACES[offer.entry] ?? null)),
        ]}
        // world:one-action-one-sheet: who asks, each ask's sheet named for them: the set piece, the interview, the asker.
        askWho={[
          ...(view.setpiece === null && !closing ? [] : [view.setpiece === null ? undefined : nameOf(view.setpiece.entry)]),
          ...((view.interview?.question ?? null) === null ? [] : [nameOf("interview.genuineness")]),
          ...[...view.offers].sort((a, b) => a.expiresMonth - b.expiresMonth).map((offer) => askerOf(offer)),
        ]}
        asksHold={closing}
        phone={(close, area, app, toMap, here) => <PhoneApps onClose={close} area={area} here={here ?? null} account={
          <>
            <AccountButton more={<NotifySetting />} />
            <ReadyEntry />
          </>
        } about={<><CreditsRow /><GuidesMenu row /></>} talk={talk} people={{ head: (bond) => <BondHead bond={bond} api={talk} />, slots: <><PeopleSlots api={talk} /><BoardsView /></> }} start={app ?? null} calendar={(opening) => <Calendar opening={calendarOpening(opening)} />} cards={(ids) => <ActivityPicker only={ids} />} briefs={<BriefLog />} warnings={<PhoneWarnings />} advert={<PhoneTile />} dedication={(open, onClose) => <DedicationLater open={open} onClose={onClose} />} keepsake={<Keepsake />} secured={secured} {...(toMap === undefined ? {} : { onMap: toMap })} />}
        phoneWaiting={phoneWaiting}
        askIcon={iconFor}
        cityMap={(props) => <Map {...props} dedication={MAP_DEDICATION} />}
        // lottery:draw-runs-online-only: online the street kiosk sells the Friday draw from its own sheet.
        kiosk={(close, label) => <KioskSheet open onClose={close} label={label} />}
        // chapter:send-off-scene-in-beats beat 4: the send-off's plane cut, the map's own layer, handed to the scene.
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
      {/* moment:card-shows-when-outcome-lands: a moment an act or the draw's letter brings stands over the world. */}
      <MomentCard over="world" />
      <SecureAsk />
      {/* guide:nothing-asked-before-early-win: the notice is asked once, after the early win's good moment. */}
      <NotifyAsk />
    </div>
  );
}

/**
 * The screen of a life that exists: the prologue, its handover page once, the ending, the road, or the world. `handedOver`: the version
 * the prologue's handover was passed at, kept by the screen above so it shows once however often this part is drawn.
 */
export default function Life({ handedOver, onHandedOver }: { handedOver: number | null; onHandedOver: (version: number) => void }) {
  const view = useView();
  const lines = useGame((state) => state.lines);
  if (view.prologue !== null) return <PrologueView />;
  if (prologueJustClosed(lines) && handedOver !== view.v) return <PageHandover onDone={() => onHandedOver(view.v)} />;
  if (view.ended && view.card !== null && view.card.kind !== "send-off") return <EndingView />;
  if (view.place.where === "road") return <RoadView offers={(only) => <OfferView only={only} />} city={<City adverts={(place) => <PlaceAdverts place={place} />} />} />;
  return <WorldPlaying />;
}
