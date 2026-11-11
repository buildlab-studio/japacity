// The admin page (moderation:admin-view-for-admin-list, admin:sections-alarms-first): seven sections in a rail, Health
// first, with a count in alarm and a count waiting for a person on the rail. The page reads and acts only through the
// admin routes; nothing on it reaches the simulation or the game's store. The loads the sections share (the checks, the
// queue, the campaigns, the stats and the dashboard) are made once here and handed down, so a figure is asked for once.
import "./admin.css";

import type { CampaignRow, ChecksReply, CampaignsReply, DashboardReply, QueueReply, StatsReply } from "@japacity/api";
import { useEffect, useState, type ReactNode } from "react";

import { AdvertsSection } from "./AdvertsSection";
import { HealthSection } from "./HealthSection";
import { ModerationSection } from "./ModerationSection";
import { MoneySection } from "./MoneySection";
import { OverviewSection } from "./OverviewSection";
import { PlayersSection } from "./PlayersSection";
import { SettingsSection } from "./SettingsSection";
import { words, type AdminKey } from "./admin.words";
import type { AdminApi } from "./api";
import { Badge, useLoad, type Load, type Period } from "./admin.ui";

export const ADMIN_SECTIONS = ["health", "overview", "players", "money", "moderation", "adverts", "settings"] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

const GROUPS: readonly { key: "watch" | "read" | "act"; sections: readonly AdminSection[] }[] = [
  { key: "watch", sections: ["health", "overview"] },
  { key: "read", sections: ["players", "money"] },
  { key: "act", sections: ["moderation", "adverts", "settings"] },
];

/** What every section is handed: the api, the shared loads, the period and where to go. */
export interface Shared {
  api: AdminApi;
  period: Period;
  setPeriod: (period: Period) => void;
  checks: Load<ChecksReply>;
  queue: Load<QueueReply>;
  campaigns: Load<CampaignsReply>;
  stats: Load<StatsReply>;
  dashboard: Load<DashboardReply>;
  /** The dashboard's last day, null for today. */
  day: string | null;
  setDay: (day: string | null) => void;
  /** The character the rollback check is opened on. */
  character: string;
  open: (section: AdminSection, character?: string) => void;
}

/** advert:named-person-approves-creatives: a campaign waits for a person while it or any of its creatives is pending. */
export function campaignWaiting(row: CampaignRow): boolean {
  return row.campaign.status === "pending" || row.campaign.status === "paused" || row.creatives.some((creative) => creative.status === "pending");
}

export function AdminPage({ api, tab: first = "health" }: { api: AdminApi; tab?: AdminSection }) {
  const [section, setSection] = useState<AdminSection>(first);
  const [character, setCharacter] = useState("");
  const [period, setPeriod] = useState<Period>("last7");
  const [day, setDay] = useState<string | null>(null);
  const checks = useLoad(() => api.checks());
  const queue = useLoad(() => api.queue());
  const campaigns = useLoad(() => api.campaigns());
  const stats = useLoad(() => api.stats());
  const dashboard = useLoad(() => api.analytics(day));
  useEffect(() => {
    document.title = `${words("admin.title")} | Japacity`;
  }, []);
  const shared: Shared = {
    api,
    period,
    setPeriod,
    checks,
    queue,
    campaigns,
    stats,
    dashboard,
    day,
    setDay: (next) => {
      setDay(next);
      dashboard.reload();
    },
    character,
    open: (next, id) => {
      if (id !== undefined) setCharacter(id);
      setSection(next);
    },
  };
  const inAlarm = checks.reply?.ok === true ? checks.reply.checks.filter((check) => check.state === "alarm").length : 0;
  const moderationWaiting = queue.reply?.ok === true ? queue.reply.queue.items.length : 0;
  const advertsWaiting = campaigns.reply?.ok === true ? campaigns.reply.campaigns.filter(campaignWaiting).length : 0;
  const badges: Partial<Record<AdminSection, ReactNode>> = {
    health: <Badge count={inAlarm} tone="alarm" />,
    moderation: <Badge count={moderationWaiting} tone="wait" />,
    adverts: <Badge count={advertsWaiting} tone="wait" />,
  };
  const panels: Record<AdminSection, () => ReactNode> = {
    health: () => <HealthSection shared={shared} />,
    overview: () => <OverviewSection shared={shared} />,
    players: () => <PlayersSection shared={shared} />,
    money: () => <MoneySection shared={shared} />,
    moderation: () => <ModerationSection shared={shared} />,
    adverts: () => <AdvertsSection shared={shared} />,
    settings: () => <SettingsSection shared={shared} />,
  };
  return (
    <div className="min-h-dvh bg-sheet text-ink" data-page="admin">
      <div className="mx-auto max-w-[96rem] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav className="border-b border-sheet-line px-4 pt-4 pb-3 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0 lg:px-4 lg:py-5">
          <div className="mb-3 flex items-baseline gap-2 lg:mb-6">
            <h1 className="text-base font-bold">{words("admin.title")}</h1>
            <a href="/" className="ml-auto text-xs text-text-2 underline underline-offset-4 hover:text-ink">
              {words("admin.back")}
            </a>
          </div>
          {/* The sections wrap on a phone, so the last ones never run off the edge unseen; on a desktop they stand in a rail. */}
          <div role="tablist" aria-label={words("admin.tabs")} className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-5">
            {GROUPS.map((group) => (
              <div key={group.key} className="contents lg:flex lg:flex-col lg:gap-0.5">
                <span className="hidden text-[11px] font-semibold tracking-wider text-text-2 uppercase lg:mb-1.5 lg:block lg:px-2.5">{words(`admin.group.${group.key}`)}</span>
                {group.sections.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`admin-tab-${id}`}
                    aria-selected={id === section}
                    aria-controls="admin-panel"
                    onClick={() => setSection(id)}
                    className={`flex min-h-9 items-center gap-2 rounded-lg border px-2.5 text-sm font-medium transition-colors lg:border-transparent ${id === section ? "border-(--accent-fill) bg-(--accent-fill) text-(--accent-text)" : "border-sheet-line text-ink hover:bg-sheet-muted"}`}
                  >
                    {words(`admin.section.${id}` as AdminKey)}
                    {badges[id]}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>
        <main id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${section}`} className="flex min-w-0 flex-col gap-5 px-4 py-5 lg:px-7">
          {panels[section]()}
        </main>
      </div>
    </div>
  );
}
