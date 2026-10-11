// The phone's apps on the real view (docs/rules/world.md R-WORLD-018, 019), composed for the
// shell: `usePhoneApps` gives the contract's `PhoneApp` list, `usePhoneWaiting` the dot for the
// Phone button (R-WORLD-004), and `PhoneApps` the whole handset with its apps. What the phone needs
// from other features (the account's settings, the pair routes) the shell hands in.
import type { ReactNode } from "react";

import { useView } from "../../authority/GameProvider";
import { todayWords } from "../../shared/words/format";
import type { PhoneApp } from "../../shared/world/contract";
import { Refused } from "./act";
import { Bank } from "./apps/Bank";
import { Bills } from "./apps/Bills";
import { Chats, PhoneTalk, type PairTalk } from "./apps/Chats";
import { Japa } from "./apps/Japa";
import { Jobs } from "./apps/Jobs";
import { Lotto } from "./apps/Lotto";
import { News } from "./apps/News";
import { Settings } from "./apps/Settings";
import { Notices, useSignalsWaiting } from "./Notices";
import { Phone } from "./Phone";
import { phoneWords } from "./phone.words";
import { APP_IDS, type AppId, markSeen, marksOf, useSeen, waitingOf } from "./seen";

const ICON: Record<AppId, string> = {
  calendar: "calendar",
  bank: "landmark",
  chats: "message-circle",
  japa: "plane",
  jobs: "briefcase",
  lotto: "ticket",
  bills: "receipt",
  news: "newspaper",
  settings: "settings",
};

/** What an app opens on: the Bank on its send chooser (`bank:send`); the Calendar on its coming list or its teach card. */
type Opening = string | null;

/** The Calendar's screen, handed in by the shell with what it opens on (R-WORLD-002), so the phone knows nothing of the month. */
export type CalendarScreen = (opening: string | null) => ReactNode;

function screenOf(id: AppId, account: ReactNode, opening: Opening = null, calendar: CalendarScreen | null = null): ReactNode {
  switch (id) {
    case "calendar":
      return calendar?.(opening) ?? null;
    case "bank":
      return <Bank opening={opening === "send" ? "send" : null} />;
    case "chats":
      return <Chats />;
    case "japa":
      return <Japa />;
    case "jobs":
      return <Jobs />;
    case "lotto":
      return <Lotto />;
    case "bills":
      return <Bills />;
    case "news":
      return <News />;
    case "settings":
      return <Settings account={account} />;
    default: {
      const never: never = id;
      throw new Error(`Unknown app ${String(never)}.`);
    }
  }
}

/** The apps, each with its dot from what the player has not seen. */
export function usePhoneApps({ account = null, opening = null, calendar = null }: { account?: ReactNode; opening?: { app: string; act: Opening } | null; calendar?: CalendarScreen | null } = {}): PhoneApp[] {
  const view = useView();
  const waiting = waitingOf(marksOf(view), useSeen());
  return APP_IDS.map((id) => ({
    id,
    name: phoneWords(`phone.app.${id}`),
    icon: ICON[id],
    tint: `--app-${id}`,
    screen: (
      <>
        <Refused />
        {screenOf(id, account, opening?.app === id ? opening.act : null, calendar)}
      </>
    ),
    waiting: waiting[id],
  }));
}

/** True when any app has something the player has not seen, or a line of the month waits (R-WORLD-030): the dot on the Phone button. */
export function usePhoneWaiting(): boolean {
  const view = useView();
  const waiting = waitingOf(marksOf(view), useSeen());
  const signals = useSignalsWaiting();
  return signals || APP_IDS.some((id) => waiting[id]);
}

export interface PhoneAppsProps {
  onClose: () => void;
  /** The place on screen, for the wallpaper. */
  area: string;
  /** The account's settings, for the Settings app. */
  account?: ReactNode;
  /** The pair routes online, or null offline, for Chats. */
  talk?: PairTalk | null;
  now?: () => Date;
  /** An app to open on; `bank:send` opens the Bank on its send chooser, `calendar:coming` the Calendar on what is coming. */
  start?: string | null;
  /** The Calendar's screen, from the shell (R-WORLD-002). */
  calendar?: CalendarScreen | null;
}

/** The handset with its apps, ready for the shell to show over the world. */
export function PhoneApps({ onClose, area, account = null, talk = null, now, start = null, calendar = null }: PhoneAppsProps) {
  const view = useView();
  const [app, act] = start === null ? [null, null] : start.split(":");
  const apps = usePhoneApps({ account, opening: app === undefined || app === null ? null : { app, act: act ?? null }, calendar });
  const marks = marksOf(view);
  return (
    <PhoneTalk value={talk}>
      <Phone
        apps={apps}
        onClose={onClose}
        area={area}
        when={todayWords(now?.())}
        start={app ?? null}
        notices={<Notices />}
        onOpen={(id) => {
          if ((APP_IDS as readonly string[]).includes(id)) markSeen(id as AppId, marks[id as AppId]);
        }}
        {...(now === undefined ? {} : { now })}
      />
    </PhoneTalk>
  );
}
