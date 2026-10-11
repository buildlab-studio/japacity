// The view: all the interface ever sees (R-ENGINE-007). Every kind gives its
// part and the engine joins them, adds japacity, and refuses to hand out a
// view with a key missing.
import { firstPayAbroadCard } from "../activity/activity.logic";
import { chapterCard, sendOffCard } from "../chapter/chapter.logic";
import { japacity } from "../japacity/japacity.logic";
import { registry } from "../kinds";
import { drawWinCard } from "../lottery/lottery.logic";
import { roadCard } from "../route/gates/road";
import { grantedCard } from "../route/route.logic";
import { decemberCard } from "../setpiece/setpiece.logic";
import { securedCard } from "../status/status.logic";
import type { Registry } from "./kind";
import type { PlayerView, ReadCtx } from "./types";

/** Every key of PlayerView. Fails to compile when the type gains or loses one. */
export const VIEW_KEYS = [
  "v",
  "scenario",
  "month",
  "ended",
  "turns",
  "locks",
  "japacity",
  "qualities",
  "runDown",
  "job",
  "freeSlots",
  "activities",
  "lastSlots",
  "pockets",
  "queued",
  "rates",
  "bankAllowanceLeft",
  "keptMonths",
  "wallet",
  "documents",
  "routes",
  "setpiece",
  "obligations",
  "offers",
  "chapter",
  "plan",
  "news",
  "report",
  "place",
  "status",
  "credit",
  "goals",
  "prologue",
  "hometown",
  "era",
  "card",
  "lottery",
  "people",
  "interview",
  "adverts",
  "home",
] as const satisfies readonly (keyof PlayerView)[];

export const VIEW_KEYS_COMPLETE: [Exclude<keyof PlayerView, (typeof VIEW_KEYS)[number]>] extends [never] ? true : never = true;

/** Names that must never appear as a key anywhere in a view. */
export const HIDDEN_KEYS = ["seed", "draws", "secret"] as const;

/** Walks any value and returns the paths of keys named in HIDDEN_KEYS. Empty when the view is clean. */
export function hiddenPaths(value: unknown, path = ""): string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => hiddenPaths(item, `${path}[${String(index)}]`));
  const found: string[] = [];
  for (const [key, inner] of Object.entries(value)) {
    const here = path === "" ? key : `${path}.${key}`;
    if ((HIDDEN_KEYS as readonly string[]).includes(key)) found.push(here);
    found.push(...hiddenPaths(inner, here));
  }
  return found;
}

/** The era with its ticks read as this player's months: one tick is one month played (R-DIRECTOR-002). */
function eraView(read: ReadCtx): PlayerView["era"] {
  const era = read.world.era;
  if (era === null) return null;
  const now = read.state.turn.month - read.state.tick;
  return { ...era, sinceMonth: now + era.since, untilMonth: now + era.until };
}

/** The view for a given registry. Tests use this to swap kinds in. */
export function viewWith(kinds: Registry, read: ReadCtx): PlayerView {
  // The engine gives the parts no kind owns: japacity, the world's era, and the card.
  const joined: Partial<PlayerView> = { japacity: japacity(read), era: eraView(read), card: cardDue(read), adverts: advertsAllowed(read) };
  for (const kind of kinds) {
    const part = kind.view?.(read) ?? {};
    for (const key of Object.keys(part)) {
      if (key in joined) throw new Error(`Two kinds give the view key ${key}; the ${kind.kind} kind is the second.`);
    }
    Object.assign(joined, part);
  }
  const missing = VIEW_KEYS.filter((key) => !(key in joined));
  if (missing.length > 0) throw new Error(`No kind gives the view keys: ${missing.join(", ")}.`);
  return joined as PlayerView;
}

/**
 * R-SHARE-001: each kind says when its card is due; the view carries one. The
 * send-off and the road's cards come first, then the rarer moment before the
 * commoner, so a chapter that closes on a grant gives the granted card.
 */
function cardDue(read: ReadCtx): PlayerView["card"] {
  return (
    sendOffCard(read) ??
    roadCard(read) ??
    grantedCard(read) ??
    securedCard(read) ??
    firstPayAbroadCard(read) ??
    decemberCard(read) ??
    drawWinCard(read) ??
    chapterCard(read)
  );
}

/** R-ADVERT-003: an advert may show only at home or abroad, outside a set piece, in a chapter without `noAdverts`. */
function advertsAllowed(read: ReadCtx): boolean {
  if (read.state.place.where === "road" || read.state.setpiece.open !== null) return false;
  const chapter = read.state.chapter.current === null ? null : read.content.chapter[read.state.chapter.current];
  return chapter?.noAdverts !== true;
}

/** What one player may see of the state. */
export function viewFor(read: ReadCtx): PlayerView {
  return viewWith(registry(), read);
}
