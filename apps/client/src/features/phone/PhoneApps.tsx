// The phone's eight apps on the real view (docs/rules/world.md R-WORLD-018, 019), composed for the
// shell: `usePhoneApps` gives the contract's `PhoneApp` list, `usePhoneWaiting` the dot for the
// Phone button (R-WORLD-004), and `PhoneApps` the whole handset with its apps. What the phone needs
// from other features (the account's settings, the pair routes) the shell hands in.
import type { ReactNode } from "react";

import { useView } from "../../authority/GameProvider";
import { playerMonth } from "../../shared/words/format";
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
import { Phone } from "./Phone";
import { phoneWords } from "./phone.words";
import { APP_IDS, type AppId, markSeen, marksOf, useSeen, waitingOf } from "./seen";

const ICON: Record<AppId, string> = {
  bank: "landmark",
  chats: "message-circle",
  japa: "plane",
  jobs: "briefcase",
  lotto: "ticket",
  bills: "receipt",
  news: "newspaper",
  settings: "settings",
};

function screenOf(id: AppId, account: ReactNode): ReactNode {
  switch (id) {
    case "bank":
      return <Bank />;
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

/** The eight apps, each with its dot from what the player has not seen. */
export function usePhoneApps({ account = null }: { account?: ReactNode } = {}): PhoneApp[] {
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
        {screenOf(id, account)}
      </>
    ),
    waiting: waiting[id],
  }));
}

/** True when any app has something the player has not seen: the dot on the Phone button. */
export function usePhoneWaiting(): boolean {
  const view = useView();
  const waiting = waitingOf(marksOf(view), useSeen());
  return APP_IDS.some((id) => waiting[id]);
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
}

/** The handset with its apps, ready for the shell to show over the world. */
export function PhoneApps({ onClose, area, account = null, talk = null, now }: PhoneAppsProps) {
  const view = useView();
  const apps = usePhoneApps({ account });
  const marks = marksOf(view);
  return (
    <PhoneTalk value={talk}>
      <Phone
        apps={apps}
        onClose={onClose}
        area={area}
        when={phoneWords("phone.wall.month", { month: playerMonth(view.month) })}
        onOpen={(id) => {
          if ((APP_IDS as readonly string[]).includes(id)) markSeen(id as AppId, marks[id as AppId]);
        }}
        {...(now === undefined ? {} : { now })}
      />
    </PhoneTalk>
  );
}
