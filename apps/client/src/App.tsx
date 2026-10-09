// The shell. Once a life is playing, the world is the game (docs/rules/world.md R-WORLD-001): the
// place fills the screen, the support pages live in the phone, and the month plans and ends from
// sheets over the scene. The prologue, the life chooser, the road, the ending and the invite page
// keep their own screens. The old month page stays behind `?classic` (R-WORLD-024), loaded only
// when asked for.
import { lazy, Suspense, useEffect, useState } from "react";

import { bootGame } from "./authority/boot";
import { CountedBoundary } from "./shared/analytics/CountedBoundary";
import { SoundNotice } from "./shared/sound/SoundNotice";
import { GameProvider, useGame, useView } from "./authority/GameProvider";
import type { GameStore } from "./authority/store";
import { AccountGate } from "./features/account/AccountGate";
import { AgentSheets } from "./features/advice/AgentSheet";
import { inviteCodeOf, InvitePage } from "./features/account/InvitePage";
import { AdminRoute } from "./features/admin/AdminRoute";
import { AccountButton } from "./features/account/Settings";
import { ActivityPicker } from "./features/activity/ActivityView";
import { PlaceAdverts } from "./features/adverts/placed";
import { EndingView } from "./features/card/EndingView";
import { CardView } from "./features/card/ShareCard";
import { ChapterView } from "./features/chapter/ChapterView";
import { City } from "./features/city/City";
import { Map } from "./features/map/Map";
import { HeldShareCard } from "./features/notify/held";
import { NotifySetting } from "./features/notify/NotifySetting";
import { OfferView } from "./features/offer/OfferView";
import { usePairApi } from "./features/people/pairApi";
import { iconFor } from "./features/phone/icons";
import { PhoneApps, usePhoneWaiting } from "./features/phone/PhoneApps";
import { InterviewView } from "./features/interview/InterviewView";
import { PrologueHandover, prologueJustClosed, PrologueView } from "./features/prologue/PrologueView";
import { RoadView } from "./features/road/RoadView";
import { ScenarioView } from "./features/scenario/ScenarioView";
import { SetpieceView } from "./features/setpiece/SetpieceView";
import { MonthSheet } from "./features/turn/MonthSheet";
import { Results } from "./features/turn/Results";
import { say } from "./shared/words/text";
import { useScreenCount } from "./useScreenCount";

/** R-WORLD-024: the old month page, its own chunk, fetched only when `?classic` asks for it. */
const Classic = lazy(() => import("./Classic"));

/** R-WORLD-024: `?classic` opens the old month page instead of the world. */
export function classicAsked(search: string): boolean {
  return new URLSearchParams(search).has("classic");
}

function classicMode(): boolean {
  return typeof location !== "undefined" && classicAsked(location.search);
}

/** The world is the game: the place fills the screen under a see-through bar, the month plays in the scene, and the map is a fly-over. */
function WorldPlaying() {
  const view = useView();
  const talk = usePairApi();
  const phoneWaiting = usePhoneWaiting();
  const reportOpen = useGame((state) => state.reportOpen);
  // R-WORLD-008: the month's end lands as one results sheet; the old page's moment cards are not shown, so their lines go straight through.
  const moments = useGame((state) => state.moments);
  const nextMoment = useGame((state) => state.nextMoment);
  useEffect(() => {
    if (moments.length > 0) nextMoment();
  }, [moments, nextMoment]);
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
        month={<MonthSheet />}
        results={(place) => <Results place={place} />}
        asks={
          <div className="flex flex-col gap-4">
            <SetpieceView />
            <InterviewView />
            <OfferView />
          </div>
        }
        phone={(close, area) => <PhoneApps onClose={close} area={area} account={<AccountButton more={<NotifySetting />} />} talk={talk} />}
        phoneWaiting={phoneWaiting}
        askIcon={iconFor}
        cityMap={(props) => <Map {...props} />}
      />
      {/* The share card opens full screen when it is due; its tile on the old page has no place in the world. */}
      <div hidden>
        <HeldShareCard>
          <CardView />
        </HeldShareCard>
      </div>
    </div>
  );
}

function Shell() {
  const view = useGame((state) => state.view);
  const failed = useGame((state) => state.failed);
  const choosingLife = useGame((state) => state.choosingLife);
  const signedOut = useGame((state) => state.signedOut);
  const lines = useGame((state) => state.lines);
  // The version the prologue's handover was passed at, so it shows once.
  const [handedOver, setHandedOver] = useState<number | null>(null);
  useScreenCount(choosingLife ? "scenario" : view !== null && view.prologue !== null ? "prologue" : view?.place.where === "road" ? "road" : null);
  if (failed !== null) return <p className="p-4 text-bad">{say("ui.failed", { why: failed })}</p>;
  if (signedOut) return <AccountGate />;
  if (choosingLife) return <ScenarioView />;
  if (view === null) return <p className="p-4 text-muted">{say("ui.loading")}</p>;
  if (view.prologue !== null) return <PrologueView />;
  if (prologueJustClosed(lines) && handedOver !== view.v) return <PrologueHandover onDone={() => setHandedOver(view.v)} />;
  if (view.ended && view.card !== null && view.card.kind !== "send-off") return <EndingView />;
  if (view.place.where === "road") return <RoadView offers={(only) => <OfferView only={only} />} city={<City adverts={(place) => <PlaceAdverts place={place} />} />} />;
  if (classicMode())
    return (
      <Suspense fallback={<p className="p-4 text-muted">{say("ui.loading")}</p>}>
        <Classic />
      </Suspense>
    );
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
      <AdminRoute>
        <GameProvider store={store}>{invite === null ? <Shell /> : <InvitePage code={invite} onDone={leaveInvite} />}</GameProvider>
      </AdminRoute>
    </CountedBoundary>
  );
}
