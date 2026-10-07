// The shell. On a phone: one panel at a time, a tab bar, and the month's
// action always above it. From 1024px: profile and money on the left, the
// month plan in the centre, ways out and news on the right.
import { CalendarDays, Newspaper, Plane, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { bootGame } from "./authority/boot";
import { GameProvider, useGame, useView } from "./authority/GameProvider";
import type { GameStore } from "./authority/store";
import { ActivityView } from "./features/activity/ActivityView";
import { ChapterView } from "./features/chapter/ChapterView";
import { DocumentView } from "./features/document/DocumentView";
import { JapacityView } from "./features/japacity/JapacityView";
import { NewsView } from "./features/news/NewsView";
import { ObligationView } from "./features/obligation/ObligationView";
import { OfferView } from "./features/offer/OfferView";
import { QualityView } from "./features/quality/QualityView";
import { RouteView } from "./features/route/RouteView";
import { ScenarioView } from "./features/scenario/ScenarioView";
import { SetpieceView } from "./features/setpiece/SetpieceView";
import { TurnBar } from "./features/turn/TurnBar";
import { TurnView } from "./features/turn/TurnView";
import { WalletView } from "./features/wallet/WalletView";
import { Button } from "./shared/ui/Button";
import { say } from "./shared/words/text";

type Tab = "month" | "you" | "money" | "japa" | "news";

const TABS: { id: Tab; icon: LucideIcon }[] = [
  { id: "month", icon: CalendarDays },
  { id: "you", icon: UserRound },
  { id: "money", icon: Wallet },
  { id: "japa", icon: Plane },
  { id: "news", icon: Newspaper },
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
        <h1 className="text-lg font-bold">{say("ui.game")}</h1>
        <span className="text-muted">{say("ui.month.planning", { month: view.month + 1 })}</span>
        <span className="ml-auto flex items-center gap-2 text-sm text-muted">
          {say("ui.japacity.title")}
          <JapacityView compact />
        </span>
      </div>
    </header>
  );
}

function TabBar({ current, onChange }: { current: Tab; onChange: (tab: Tab) => void }) {
  const view = useView();
  const waiting = view.offers.length > 0 || view.setpiece !== null;
  return (
    <nav aria-label={say("ui.tabs")} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid grid-cols-5">
        {TABS.map(({ id, icon: Icon }) => (
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

function Playing() {
  const [tab, setTab] = useState<Tab>("month");
  const openLifeChooser = useGame((state) => state.openLifeChooser);
  const showTab = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-[90rem] px-4 pt-4 pb-48 lg:grid lg:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start lg:gap-6 lg:pb-10">
        <div className="flex flex-col gap-6">
          <Group tab="you" current={tab}>
            <QualityView />
            {openLifeChooser === null ? null : (
              <div>
                <Button small variant="quiet" onClick={openLifeChooser}>
                  {say("ui.life.again")}
                </Button>
              </div>
            )}
          </Group>
          <Group tab="money" current={tab}>
            <WalletView />
            <ObligationView />
          </Group>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Group tab="month" current={tab}>
            <TurnView />
            <SetpieceView />
            <ChapterView />
            <OfferView />
            <ActivityView />
          </Group>
          {/* One action bar: fixed above the tabs on a phone, at the foot of the plan on a desktop. */}
          <div className="fixed inset-x-0 bottom-14 z-20 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-sm lg:sticky lg:bottom-4 lg:rounded-xl lg:border lg:bg-surface lg:shadow-lg">
            <TurnBar />
          </div>
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
      <TabBar current={tab} onChange={showTab} />
    </div>
  );
}

function Shell() {
  const view = useGame((state) => state.view);
  const failed = useGame((state) => state.failed);
  const choosingLife = useGame((state) => state.choosingLife);
  if (failed !== null) return <p className="p-4 text-bad">{say("ui.failed", { why: failed })}</p>;
  if (choosingLife) return <ScenarioView />;
  if (view === null) return <p className="p-4 text-muted">{say("ui.loading")}</p>;
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
