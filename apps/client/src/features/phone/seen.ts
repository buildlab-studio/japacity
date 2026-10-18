// What each app has that the player has not seen (world:phone-rises-over-scene): a short mark of
// what is in the app now, and the mark seen last, kept on the device under one key. An app whose
// mark is not empty and differs from the one seen carries a dot. Opening the app sees it.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { useSyncExternalStore } from "react";

import { newsMarkOf } from "../../shared/phone/newsSeen";
import { japaMark } from "../../shared/world/briefHanded";
import { familyFeedLines } from "./feed";
import { papersMarkOf } from "./papers";
import { browserStorage, SEEN_KEY } from "../../shared/kept/storage";
import { listeners } from "../../shared/listeners/listeners";

// The Calendar sits first among the apps: the month lives on the phone (world:top-band-is-lively-pill). Papers sits beside Japa: the
// plan's papers, held and on their way (world:phone-holds-what-phones-hold).
export const APP_IDS = ["calendar", "bank", "chats", "japa", "papers", "jobs", "market", "lotto", "bills", "news", "settings"] as const;
export type AppId = (typeof APP_IDS)[number];

export type Seen = Partial<Record<AppId, string>>;

/** The offers that are jobs: the offer's group in content, or a job carried in its terms. */
export function jobOffers(view: Pick<PlayerView, "offers">): PlayerView["offers"] {
  return view.offers.filter((offer) => content.offer[offer.entry]?.group === "job" || typeof offer.terms.job === "string");
}

/** The bills with something to pay this month. */
function billsDue(view: Pick<PlayerView, "obligations">): PlayerView["obligations"] {
  return view.obligations.filter((owed) => owed.due > 0);
}

/** Each app's mark of what is in it now; empty when there is nothing to tell. */
export function marksOf(view: PlayerView): Record<AppId, string> {
  const feed = familyFeedLines(view);
  const peopleLines = (view.report?.lines ?? []).filter((line) => line.key.startsWith("line.people.")).length;
  const chats = feed.length === 0 && peopleLines === 0 ? "" : `${String(view.month)}:${feed.at(-1)?.id ?? ""}:${String(peopleLines)}`;
  const bills = billsDue(view);
  return {
    // The Calendar carries no dot: what it holds is the player's own plan, never news.
    calendar: "",
    bank: "",
    chats,
    // The brief last handed (design page 09 section 4): the dot until Japa is opened.
    japa: japaMark(view.scenario),
    // A paper that landed or moved this month (world:month-passes-as-lived): the dot until Papers is opened.
    papers: papersMarkOf(view),
    jobs: jobOffers(view).map((offer) => offer.id).join(","),
    // The Market carries no dot: what it sells is always there.
    market: "",
    lotto: view.lottery?.last === null || view.lottery?.last === undefined ? "" : String(view.lottery.last.draw),
    bills: bills.length === 0 ? "" : `${String(view.month)}:${bills.map((owed) => owed.id).join(",")}`,
    news: newsMarkOf(view),
    settings: "",
  };
}

export function waitingOf(marks: Record<AppId, string>, seen: Seen): Record<AppId, boolean> {
  const waiting = {} as Record<AppId, boolean>;
  for (const id of APP_IDS) waiting[id] = marks[id] !== "" && seen[id] !== marks[id];
  return waiting;
}

function read(): Seen {
  try {
    const kept = browserStorage()?.getItem(SEEN_KEY) ?? null;
    const parsed: unknown = kept === null ? {} : JSON.parse(kept);
    if (typeof parsed !== "object" || parsed === null) return {};
    const seen: Seen = {};
    for (const id of APP_IDS) {
      const mark = (parsed as Record<string, unknown>)[id];
      if (typeof mark === "string") seen[id] = mark;
    }
    return seen;
  } catch {
    return {};
  }
}

let seen: Seen | null = null;
const { subscribe, notify } = listeners();

function current(): Seen {
  seen ??= read();
  return seen;
}

/** Marks an app's content as seen, on the device and for every screen showing a dot. */
export function markSeen(id: AppId, mark: string): void {
  if (current()[id] === mark) return;
  seen = { ...current(), [id]: mark };
  try {
    browserStorage()?.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Storage may be shut; the dot clears for this visit only.
  }
  notify();
}

/** Reads the kept marks again, for tests that change storage under the phone. */
export function reloadSeen(): void {
  seen = read();
  notify();
}

export function useSeen(): Seen {
  return useSyncExternalStore(subscribe, current, current);
}
