// The shell. On a phone: one panel at a time, a tab bar, and the month's
// action always above it. From 1024px: profile and money on the left, the
// month plan in the centre, ways out and news on the right. Where the
// character is changes the shell: abroad the tabs are the month, you, money,
// status and home; on the road there is one panel and nothing else. Before
// the first month a life from sixteen plays its prologue, one card at a time.
// The warnings that stand (the status clock, being run down) sit above every tab.
import { BadgeCheck, CalendarDays, House, Newspaper, Plane, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { bootGame } from "./authority/boot";
import { GameProvider, useGame, useView } from "./authority/GameProvider";
import type { GameStore } from "./authority/store";
import { AccountGate } from "./features/account/AccountGate";
import { AccountButton } from "./features/account/Settings";
import { ActivityView } from "./features/activity/ActivityView";
import { EndingView } from "./features/card/EndingView";
import { CardView } from "./features/card/ShareCard";
import { ChapterView } from "./features/chapter/ChapterView";
import { CreditView } from "./features/credit/CreditView";
import { DocumentView } from "./features/document/DocumentView";
import { GoalView } from "./features/goal/GoalView";
import { JapacityView } from "./features/japacity/JapacityView";
import { ModerationMenu } from "./features/moderation/ModerationMenu";
import { NewsView } from "./features/news/NewsView";
import { ObligationView } from "./features/obligation/ObligationView";
import { OfferView } from "./features/offer/OfferView";
import { RunDownBanner } from "./features/health/RunDownBanner";
import { FamilyView } from "./features/place/FamilyView";
import { PlaceView } from "./features/place/PlaceView";
import { PrologueHandover, prologueJustClosed, PrologueView } from "./features/prologue/PrologueView";
import { QualityView } from "./features/quality/QualityView";
import { RoadView } from "./features/road/RoadView";
import { RouteView } from "./features/route/RouteView";
import { ScenarioView } from "./features/scenario/ScenarioView";
import { SetpieceView } from "./features/setpiece/SetpieceView";
import { ClockBanner, StatusView } from "./features/status/StatusView";
import { Moment } from "./features/turn/Moment";
import { TurnBar } from "./features/turn/TurnBar";
import { TurnView } from "./features/turn/TurnView";
import { WalletView } from "./features/wallet/WalletView";
import { Button } from "./shared/ui/Button";
import { playerMonth } from "./shared/words/format";
import { say } from "./shared/words/text";

type Tab = "month" | "you" | "money" | "japa" | "news" | "status" | "home";

type TabSet = readonly { id: Tab; icon: LucideIcon }[];

const HOME_TABS: TabSet = [
  { id: "month", icon: CalendarDays },
  { id: "you", icon: UserRound },
  { id: "money", icon: Wallet },
  { id: "japa", icon: Plane },
  { id: "news", icon: Newspaper },
];

const ABROAD_TABS: TabSet = [
  { id: "month", icon: CalendarDays },
  { id: "you", icon: UserRound },
  { id: "money", icon: Wallet },
  { id: "status", icon: BadgeCheck },
  { id: "home", icon: House },
];

/** A group of panels: on a phone only the current tab's group shows; on a desktop every group does. */
function Group({ tab, current, children }: { tab: Tab; current: Tab; children: ReactNode }) {
  return (
    <div data-tab={tab} className={`${tab === current ? "flex" : "hidden"} flex-col gap-6 lg:flex`}>
      {children}
    </div>
  );
}

function Header() {
  const view = useView();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[90rem] items-center gap-3 px-4 py-3">
        {/* On a phone the name would sit beside the japacity label, so it is kept for screen readers only. */}
        <h1 className="sr-only text-lg font-bold sm:not-sr-only">{say("ui.game")}</h1>
        <span className="text-muted">{say("ui.month.planning", { month: playerMonth(view.month) })}</span>
        <span className="ml-auto flex items-center gap-2 text-sm text-muted">
          {say("ui.japacity.title")}
          <JapacityView compact />
        </span>
        <ModerationMenu />
        <AccountButton />
      </div>
    </header>
  );
}

function TabBar({ tabs, current, onChange }: { tabs: TabSet; current: Tab; onChange: (tab: Tab) => void }) {
  const view = useView();
  const waiting = view.offers.length > 0 || view.setpiece !== null;
  return (
    <nav aria-label={say("ui.tabs")} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map(({ id, icon: Icon }) => (
          <li key={id}>
            <button
              type="button"
              aria-current={id === current ? "page" : undefined}
              onClick={() => onChange(id)}
              className={`relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs ${id === current ? "font-semibold text-ink" : "text-muted"}`}
            >
              <Icon size={20} />
              {say(`ui.tab.${id}`)}
              {id === "month" && waiting ? <span className="absolute top-2 right-[30%] size-2 rounded-full bg-accent ring-2 ring-paper" /> : null}
              {id === current ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-ink" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function LifeAgain() {
  const openLifeChooser = useGame((state) => state.openLifeChooser);
  if (openLifeChooser === null) return null;
  return (
    <div>
      <Button small variant="quiet" onClick={openLifeChooser}>
        {say("ui.life.again")}
      </Button>
    </div>
  );
}

/** The month plan: the same at home and abroad. */
function MonthGroup({ tab }: { tab: Tab }) {
  return (
    <Group tab="month" current={tab}>
      <TurnView />
      <SetpieceView />
      <CardView />
      <ChapterView />
      <OfferView />
      <ActivityView />
    </Group>
  );
}

function ActionBar() {
  return (
    // One action bar: fixed above the tabs on a phone, at the foot of the plan on a desktop.
    <div className="fixed inset-x-0 bottom-14 z-20 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-sm lg:sticky lg:bottom-4 lg:rounded-xl lg:border lg:bg-surface lg:shadow-lg">
      <TurnBar />
    </div>
  );
}

const GRID = "mx-auto max-w-[90rem] px-4 pt-4 pb-48 lg:grid lg:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start lg:gap-6 lg:pb-10";

function AtHome({ tab }: { tab: Tab }) {
  return (
    <main className={GRID} data-where="home">
      <RunDownBanner className="mb-4 lg:col-span-3 lg:mb-0" />
      <div className="flex flex-col gap-6">
        <Group tab="you" current={tab}>
          <QualityView />
          <GoalView />
          <PlaceView />
          <LifeAgain />
        </Group>
        <Group tab="money" current={tab}>
          <WalletView />
          <ObligationView />
        </Group>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <MonthGroup tab={tab} />
        <ActionBar />
      </div>

      <div className="flex flex-col gap-6">
        <Group tab="japa" current={tab}>
          <JapacityView />
          <RouteView />
          <DocumentView />
        </Group>
        <Group tab="news" current={tab}>
          <NewsView />
        </Group>
      </div>
    </main>
  );
}

function Abroad({ tab }: { tab: Tab }) {
  return (
    <main className={GRID} data-where="abroad">
      <ClockBanner className="mb-4 lg:col-span-3 lg:mb-0" />
      <RunDownBanner className="mb-4 lg:col-span-3 lg:mb-0" />
      <div className="flex flex-col gap-6">
        <Group tab="you" current={tab}>
          <QualityView />
          <GoalView />
          <LifeAgain />
        </Group>
        <Group tab="money" current={tab}>
          <WalletView />
          <ObligationView />
          <CreditView />
        </Group>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <MonthGroup tab={tab} />
        <ActionBar />
      </div>

      <div className="flex flex-col gap-6">
        <Group tab="status" current={tab}>
          <StatusView />
          <RouteView />
          <DocumentView />
          <NewsView />
        </Group>
        <Group tab="home" current={tab}>
          <PlaceView />
          <FamilyView />
        </Group>
      </div>
    </main>
  );
}

function Playing() {
  const view = useView();
  const abroad = view.place.where === "abroad";
  const tabs = abroad ? ABROAD_TABS : HOME_TABS;
  const [chosen, setTab] = useState<Tab>("month");
  // A tab that does not exist where the character now is falls back to the month.
  const tab = tabs.some(({ id }) => id === chosen) ? chosen : "month";
  const showTab = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh">
      <Header />
      {abroad ? <Abroad tab={tab} /> : <AtHome tab={tab} />}
      <TabBar tabs={tabs} current={tab} onChange={showTab} />
      <Moment />
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
  if (failed !== null) return <p className="p-4 text-bad">{say("ui.failed", { why: failed })}</p>;
  if (signedOut) return <AccountGate />;
  if (choosingLife) return <ScenarioView />;
  if (view === null) return <p className="p-4 text-muted">{say("ui.loading")}</p>;
  if (view.prologue !== null) return <PrologueView />;
  if (prologueJustClosed(lines) && handedOver !== view.v) return <PrologueHandover onDone={() => setHandedOver(view.v)} />;
  if (view.ended && view.card !== null && view.card.kind !== "send-off") return <EndingView />;
  if (view.place.where === "road") return <RoadView offers={(only) => <OfferView only={only} />} />;
  return <Playing />;
}

export function App({ store: given }: { store?: GameStore }) {
  const [store] = useState(() => given ?? bootGame());
  useEffect(() => {
    void store.getState().refresh();
  }, [store]);
  return (
    <GameProvider store={store}>
      <Shell />
    </GameProvider>
  );
}
