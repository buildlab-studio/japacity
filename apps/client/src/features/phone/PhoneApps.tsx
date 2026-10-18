// The phone's apps on the real view (world:phone-rises-over-scene, world:phone-holds-what-phones-hold), composed for the
// shell: `usePhoneApps` gives the contract's `PhoneApp` list, `usePhoneWaiting` the dot for the
// Phone button (world:thumb-buttons-carry-dots), and `PhoneApps` the whole handset with its apps. What the phone needs
// from other features (the account's settings, the pair routes) the shell hands in.
import { content } from "@japacity/content";
import type { ReactNode } from "react";

import { counting } from "../../shared/analytics/start";
import { useJapaMark } from "../../shared/world/briefHanded";
import { Tile } from "../../shared/tiles/Tile";
import { TILE_TABLE } from "../../shared/tiles/tiles.data";
import { nameOf, say } from "../../shared/words/text";
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
import { type DedicationScreen, Settings } from "./apps/Settings";
import { Notices, useSignalsWaiting } from "./Notices";
import { Phone } from "./Phone";
import { appContext } from "./context";
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

/** analytics:client-sends-interface-counts: each opening of an app counts its screen once, keyed by the feature that leads it. */
const APP_SCREEN: Record<AppId, string> = {
  calendar: "turn",
  bank: "wallet",
  chats: "people",
  japa: "route",
  papers: "document",
  jobs: "activity",
  lotto: "lottery",
  bills: "obligation",
  news: "news",
  settings: "settings",
  // The market spends the wallet: its openings count under the wallet's screen, as it has no screen of its own.
  market: "wallet",
};

/**
 * What an app opens on: the Bank on its send chooser (`bank:send`); the Calendar on its coming list
 * or its teach card; Papers on an act's card (`papers:activity.get-transcript`, the nudge's step, world:nudge-says-one-thing).
 */
type Opening = string | null;

/** The Calendar's screen, handed in by the shell with what it opens on (world:top-band-is-lively-pill), so the phone knows nothing of the month. */
type CalendarScreen = (opening: string | null) => ReactNode;

/** What the shell hands the phone: the Calendar's screen and the acts' cards, so the phone imports no other feature. */
interface Handed {
  calendar: CalendarScreen | null;
  cards: PaperCards | null;
  /** The road's log for Japa (world:phone-holds-what-phones-hold): the briefs handed so far, from the shell. */
  briefs: ReactNode;
  /** The place the world shows, for the Market: it sells only at home. */
  here: string | null;
  /** The dedication page the version line's five taps open, from the shell (account:dedication-page-and-its-doors). */
  dedication: DedicationScreen | null;
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
      return <Settings account={account} about={about} dedication={handed.dedication} />;
    default: {
      const never: never = id;
      throw new Error(`Unknown app ${String(never)}.`);
    }
  }
}

/** The apps, each with its dot from what the player has not seen. */
function usePhoneApps({ account = null, about = null, opening = null, calendar = null, cards = null, briefs = null, warnings = null, here = null, dedication = null }: { account?: ReactNode; about?: ReactNode; opening?: { app: string; act: Opening } | null; calendar?: CalendarScreen | null; cards?: PaperCards | null; briefs?: ReactNode; warnings?: ReactNode; here?: string | null; dedication?: DedicationScreen | null } = {}): PhoneApp[] {
  const view = useView();
  // A brief handed changes no view, so its mark is read as it is kept.
  useJapaMark(view.scenario);
  const waiting = waitingOf(marksOf(view), useSeen());
  return APP_IDS.map((id) => ({
    id,
    name: say(`phone.app.${id}`),
    icon: ICON[id],
    tint: `--app-${id}`,
    screen: (
      <>
        {warnings}
        <Refused />
        {screenOf(id, account, about, opening?.app === id ? opening.act : null, { calendar, cards, briefs, here, dedication })}
      </>
    ),
    waiting: waiting[id],
    // Jobs, Lotto, Bills and Bank say what is there now beside their name (world:phone-rises-over-scene).
    context: appContext(id, view),
  }));
}

/** True when any app has something the player has not seen, or a line of the month waits (world:month-passes-as-lived): the dot on the Phone button. */
export function usePhoneWaiting(): boolean {
  const view = useView();
  // A brief handed changes no view, so its mark is read as it is kept.
  useJapaMark(view.scenario);
  const waiting = waitingOf(marksOf(view), useSeen());
  const signals = useSignalsWaiting();
  // A result whose morning has come waits on the lock screen (clock:envelopes-show-real-waits).
  const morning = useGame((state) => state.opened.length > 0);
  return signals || morning || APP_IDS.some((id) => waiting[id]);
}

export interface PhoneAppsProps {
  onClose: () => void;
  /** The place on screen, for the wallpaper. */
  area: string;
  /** The account's settings, for the Settings app. */
  account?: ReactNode;
  /** About the game, under its own heading at the foot of Settings: the Credits row (city:credits-screen-attributions). */
  about?: ReactNode;
  /** The pair routes online, or null offline, for Chats. */
  talk?: PairTalk | null;
  /** The people feature's screens for Chats, from the shell: a bond's head and the slots (world:nobody-picked-from-list). */
  people?: PhonePeopleScreens | null;
  now?: () => Date;
  /** An app to open on; `bank:send` opens the Bank on its send chooser, `calendar:coming` the Calendar on what is coming. */
  start?: string | null;
  /** The Calendar's screen, from the shell (world:top-band-is-lively-pill). */
  calendar?: CalendarScreen | null;
  /** An act's card, from the shell, for Papers (world:phone-holds-what-phones-hold). */
  cards?: PaperCards | null;
  /** Puts the phone away onto the map at a stop, from the shell: a paper's visit (world:phone-holds-what-phones-hold). */
  onMap?: (stop: string) => void;
  /** The road's log for Japa, from the shell (world:phone-holds-what-phones-hold). */
  briefs?: ReactNode;
  /**
   * The warnings that stand, from the shell: the status clock abroad (status:lost-job-starts-clock) and being run down
   * (health:view-shows-health-warning), above every app whichever is open and on the phone's home above its notices.
   */
  warnings?: ReactNode;
  /** The phone's one sponsored tile, from the shell, standing among the tiles when the hour fills it (advert:slots-capped-per-place). */
  advert?: ReactNode;
  /** The place the world shows, by id, for the Market. */
  here?: string | null;
  /** The dedication page, from the shell, which the five taps on Settings' version line open (account:dedication-page-and-its-doors). */
  dedication?: DedicationScreen | null;
  /** The send-off card where the phone keeps the cards, from the shell (share:send-off-card-kept): a tile on the home among the notices. */
  keepsake?: ReactNode;
}

/** The place's picture for the wallpaper's pill: the place whose name the shell hands in, where the tiles have one. */
function areaPicture(area: string): ReactNode {
  const place = Object.values(content.place).find((entry) => nameOf(entry.id) === area && TILE_TABLE[entry.id] !== undefined);
  return place === undefined ? null : <Tile of={place.id} size={26} />;
}

/** The handset with its apps, ready for the shell to show over the world. */
export function PhoneApps({ onClose, area, account = null, about = null, talk = null, people = null, now, start = null, calendar = null, cards = null, onMap, briefs = null, warnings = null, here = null, advert = null, dedication = null, keepsake = null }: PhoneAppsProps) {
  const view = useView();
  const [app, act] = start === null ? [null, null] : start.split(":");
  const apps = usePhoneApps({ account, about, opening: app === undefined || app === null ? null : { app, act: act ?? null }, calendar, cards, briefs, warnings, here, dedication });
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
          notices={
            <>
              {warnings === null ? null : (
                <div className="mt-4 px-4 empty:hidden" data-phone-warnings>
                  {warnings}
                </div>
              )}
              {keepsake}
              <Notices />
              {/* The phone's one sponsored tile among its tiles, when the hour fills it online (advert:slots-capped-per-place). */}
              {advert === null ? null : (
                <div className="mt-4 flex justify-center px-4 empty:hidden" data-phone-advert>
                  {advert}
                </div>
              )}
            </>
          }
          onOpen={(id) => {
            if (!(APP_IDS as readonly string[]).includes(id)) return;
            markSeen(id as AppId, marks[id as AppId]);
            counting().count("screen/opened", APP_SCREEN[id as AppId]);
          }}
          {...(now === undefined ? {} : { now })}
          {...(onMap === undefined ? {} : { onMap })}
        />
      </PhonePeople>
    </PhoneTalk>
  );
}
