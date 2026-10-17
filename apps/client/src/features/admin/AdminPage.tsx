// The admin page (R-MODERATION-012): one tab per area of the server's admin
// routes. It reads and acts only through those routes; nothing on it reaches
// the simulation or the game's store.
import { useEffect, useState, type ReactNode } from "react";

import { AdvertsTab } from "./AdvertsTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { words, type AdminKey } from "./admin.words";
import type { AdminApi } from "./api";
import { ModerationTab } from "./ModerationTab";
import { NumbersTab } from "./NumbersTab";
import { MoneyTab, RejectionsTab, RollbackTab } from "./ServerTabs";
import { SwitchesTab } from "./SwitchesTab";

export const ADMIN_TABS = ["money", "rejections", "rollback", "moderation", "analytics", "numbers", "adverts", "switches"] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

const TAB_WORDS: Record<AdminTab, AdminKey> = {
  money: "admin.tab.money",
  rejections: "admin.tab.rejections",
  rollback: "admin.tab.rollback",
  moderation: "admin.tab.moderation",
  analytics: "admin.tab.analytics",
  numbers: "admin.tab.numbers",
  adverts: "admin.tab.adverts",
  switches: "admin.tab.switches",
};

export function AdminPage({ api, tab: first = "money" }: { api: AdminApi; tab?: AdminTab }) {
  const [tab, setTab] = useState<AdminTab>(first);
  const [character, setCharacter] = useState("");
  useEffect(() => {
    document.title = `${words("admin.title")} | Japacity`;
  }, []);
  const panels: Record<AdminTab, () => ReactNode> = {
    money: () => (
      <MoneyTab
        api={api}
        onRollback={(id) => {
          setCharacter(id);
          setTab("rollback");
        }}
      />
    ),
    rejections: () => <RejectionsTab api={api} />,
    rollback: () => <RollbackTab api={api} character={character} />,
    moderation: () => <ModerationTab api={api} />,
    analytics: () => <AnalyticsTab api={api} />,
    numbers: () => <NumbersTab api={api} />,
    adverts: () => <AdvertsTab api={api} />,
    switches: () => <SwitchesTab api={api} />,
  };
  return (
    <div className="min-h-dvh bg-sheet text-ink" data-page="admin">
      <header className="sticky top-0 z-20 border-b border-sheet-line bg-sheet">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-bold">{words("admin.title")}</h1>
          <a href="/" className="ml-auto text-sm underline underline-offset-4">
            {words("admin.back")}
          </a>
        </div>
        {/* The tabs wrap to a second row on a phone: in one scrolling row the last ones would run off the edge with no
            sign. */}
        <div role="tablist" aria-label={words("admin.tabs")} className="mx-auto flex max-w-[90rem] flex-wrap gap-x-1 px-4">
          {ADMIN_TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`admin-tab-${id}`}
              aria-selected={id === tab}
              aria-controls="admin-panel"
              onClick={() => setTab(id)}
              className={`min-h-11 shrink-0 border-b-2 px-3 text-sm ${id === tab ? "border-ink font-semibold" : "border-transparent text-text-2"}`}
            >
              {words(TAB_WORDS[id])}
            </button>
          ))}
        </div>
      </header>
      <main id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`} className="mx-auto flex max-w-[90rem] flex-col gap-6 px-4 py-6">
        {panels[tab]()}
      </main>
    </div>
  );
}
