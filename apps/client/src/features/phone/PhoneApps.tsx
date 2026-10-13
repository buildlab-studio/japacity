// The phone's apps on the real view (docs/rules/world.md R-WORLD-018, 019), composed for the
// shell: `usePhoneApps` gives the contract's `PhoneApp` list, `usePhoneWaiting` the dot for the
// Phone button (R-WORLD-004), and `PhoneApps` the whole handset with its apps. What the phone needs
// from other features (the account's settings, the pair routes) the shell hands in.
import { content } from "@japacity/content";
import type { ReactNode } from "react";

import { useJapaMark } from "../../shared/world/briefHanded";
import { Tile } from "../../shared/tiles/Tile";
import { TILE_TABLE } from "../../shared/tiles/tiles.data";
import { nameOf } from "../../shared/words/text";
import { useGame, useView } from "../../authority/GameProvider";
import { todayWords } from "../../shared/words/format";
import type { PhoneApp } from "../../shared/world/contract";
import { Refused } from "./act";
import { Bank } from "./apps/Bank";
import { Bills } from "./apps/Bills";
import { Chats, PhonePeople, PhoneTalk, type PairTalk, type PhonePeopleScreens } from "./apps/Chats";
import { Japa } from "./apps/Japa";
import { Jobs } from "./apps/Jobs";
import { Market } from "./apps/Market";
import { Lotto } from "./apps/Lotto";
import { News } from "./apps/News";
import { type PaperCards, Papers } from "./apps/Papers";
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
  papers: "folder-open",
  jobs: "briefcase",
  market: "shopping-bag",
  lotto: "ticket",
  bills: "receipt",
  news: "newspaper",
  settings: "settings",
};

/**
 * What an app opens on: the Bank on its send chooser (`bank:send`); the Calendar on its coming list
 * or its teach card; Papers on an act's card (`papers:activity.get-transcript`, the nudge's step, R-WORLD-003).
 */
type Opening = string | null;

/** The Calendar's screen, handed in by the shell with what it opens on (R-WORLD-002), so the phone knows nothing of the month. */
export type CalendarScreen = (opening: string | null) => ReactNode;

/** What the shell hands the phone: the Calendar's screen and the acts' cards, so the phone imports no other feature. */
interface Handed {
  calendar: CalendarScreen | null;
  cards: PaperCards | null;
  /** The road's log for Japa (the plan 16): the briefs handed so far, from the shell. */
  briefs: ReactNode;
  /** The place the world shows, for the Market: it sells only at home. */
  here: string | null;
}

function screenOf(id: AppId, account: ReactNode, about: ReactNode, opening: Opening, handed: Handed): ReactNode {
  switch (id) {
    case "calendar":
      return handed.calendar?.(opening) ?? null;
    case "bank":
      return <Bank opening={opening === "send" ? "send" : null} />;
    case "chats":
      return <Chats />;
    case "japa":
      return <Japa briefs={handed.briefs} />;
    case "papers":
      return <Papers opening={opening} cards={handed.cards} />;
    case "jobs":
      return <Jobs />;
    case "market":
      return <Market here={handed.here} />;
    case "lotto":
      return <Lotto />;
    case "bills":
      return <Bills />;
    case "news":
      return <News />;
    case "settings":
      return <Settings account={account} about={about} />;
    default: {
      const never: never = id;
      throw new Error(`Unknown app ${String(never)}.`);
    }
  }
}

/** The apps, each with its dot from what the player has not seen. */
export function usePhoneApps({ account = null, about = null, opening = null, calendar = null, cards = null, briefs = null, here = null }: { account?: ReactNode; about?: ReactNode; opening?: { app: string; act: Opening } | null; calendar?: CalendarScreen | null; cards?: PaperCards | null; briefs?: ReactNode; here?: string | null } = {}): PhoneApp[] {
  const view = useView();
  // A brief handed changes no view, so its mark is read as it is kept.
  useJapaMark(view.scenario);
  const waiting = waitingOf(marksOf(view), useSeen());
  return APP_IDS.map((id) => ({
    id,
    name: phoneWords(`phone.app.${id}`),
    icon: ICON[id],
    tint: `--app-${id}`,
    screen: (
      <>
        <Refused />
        {screenOf(id, account, about, opening?.app === id ? opening.act : null, { calendar, cards, briefs, here })}
      </>
    ),
    waiting: waiting[id],
  }));
}

/** True when any app has something the player has not seen, or a line of the month waits (R-WORLD-030): the dot on the Phone button. */
export function usePhoneWaiting(): boolean {
  const view = useView();
  // A brief handed changes no view, so its mark is read as it is kept.
  useJapaMark(view.scenario);
  const waiting = waitingOf(marksOf(view), useSeen());
  const signals = useSignalsWaiting();
  // A result whose morning has come waits on the lock screen (R-CLOCK-032).
  const morning = useGame((state) => state.opened.length > 0);
  return signals || morning || APP_IDS.some((id) => waiting[id]);
}

export interface PhoneAppsProps {
  onClose: () => void;
  /** The place on screen, for the wallpaper. */
  area: string;
  /** The account's settings, for the Settings app. */
  account?: ReactNode;
  /** About the game, under its own heading at the foot of Settings: the Credits row (city.md R-CITY-021). */
  about?: ReactNode;
  /** The pair routes online, or null offline, for Chats. */
  talk?: PairTalk | null;
  /** The people feature's screens for Chats, from the shell: a bond's head and the slots (R-WORLD-020). */
  people?: PhonePeopleScreens | null;
  now?: () => Date;
  /** An app to open on; `bank:send` opens the Bank on its send chooser, `calendar:coming` the Calendar on what is coming. */
  start?: string | null;
  /** The Calendar's screen, from the shell (R-WORLD-002). */
  calendar?: CalendarScreen | null;
  /** An act's card, from the shell, for Papers (R-WORLD-019). */
  cards?: PaperCards | null;
  /** Puts the phone away onto the map at a stop, from the shell: a paper's visit (R-WORLD-019). */
  onMap?: (stop: string) => void;
  /** The road's log for Japa, from the shell (the plan 16). */
  briefs?: ReactNode;
  /** The place the world shows, by id, for the Market. */
  here?: string | null;
}

/** The place's picture for the wallpaper's pill: the place whose name the shell hands in, where the tiles have one. */
function areaPicture(area: string): ReactNode {
  const place = Object.values(content.place).find((entry) => nameOf(entry.id) === area && TILE_TABLE[entry.id] !== undefined);
  return place === undefined ? null : <Tile of={place.id} size={26} />;
}

/** The handset with its apps, ready for the shell to show over the world. */
export function PhoneApps({ onClose, area, account = null, about = null, talk = null, people = null, now, start = null, calendar = null, cards = null, onMap, briefs = null, here = null }: PhoneAppsProps) {
  const view = useView();
  const [app, act] = start === null ? [null, null] : start.split(":");
  const apps = usePhoneApps({ account, about, opening: app === undefined || app === null ? null : { app, act: act ?? null }, calendar, cards, briefs, here });
  const marks = marksOf(view);
  return (
    <PhoneTalk value={talk}>
      <PhonePeople value={people}>
        <Phone
          apps={apps}
          onClose={onClose}
          area={area}
          when={todayWords(now?.())}
          areaPicture={areaPicture(area)}
          start={app ?? null}
          notices={<Notices />}
          onOpen={(id) => {
            if ((APP_IDS as readonly string[]).includes(id)) markSeen(id as AppId, marks[id as AppId]);
          }}
          {...(now === undefined ? {} : { now })}
          {...(onMap === undefined ? {} : { onMap })}
        />
      </PhonePeople>
    </PhoneTalk>
  );
}
