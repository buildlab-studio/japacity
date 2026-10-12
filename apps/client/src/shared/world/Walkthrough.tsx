// The first-use labels (docs/rules/world.md R-WORLD-033): nothing lectures before play. On a device that has not
// played, the Map and Phone thumbs each carry a short word at their foot until each is tapped once; the calendar's tap
// says its own words (R-WORLD-027). The device keeps what was tapped under the walkthrough's old key, and keeps that
// it has played once both were, as the walkthrough kept that it was seen.
import { useEffect, useState } from "react";

import { CentredColumn } from "../ui/lively/CentredColumn";
import { say } from "../words/text";

export const WALK_KEY = "japacity.walkthrough";
/** What the key holds once the device has played: the walkthrough's own mark, so a device that saw it shows no labels. */
const PLAYED = "1";

/** The thumbs that carry a first-use label, and each one's word. */
export const FIRST_THUMBS = [
  { id: "map", words: "ui.first.map" },
  { id: "phone", words: "ui.first.phone" },
] as const;
export type FirstThumb = (typeof FIRST_THUMBS)[number]["id"];

function storage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function kept(): string | null {
  try {
    return storage()?.getItem(WALK_KEY) ?? null;
  } catch {
    return null;
  }
}

/** True once this device has played: both thumbs tapped, or the old walkthrough seen. */
export function walkSeen(): boolean {
  return kept() === PLAYED;
}

/** The thumbs this device has tapped; every one once it has played. */
export function thumbsTapped(): Set<FirstThumb> {
  const value = kept();
  if (value === PLAYED) return new Set(FIRST_THUMBS.map((thumb) => thumb.id));
  return new Set(FIRST_THUMBS.map((thumb) => thumb.id).filter((id) => (value ?? "").split(",").includes(id)));
}

/** Keeps that a thumb was tapped; once both were, that the device has played. */
export function markThumbTapped(thumb: FirstThumb): Set<FirstThumb> {
  const tapped = thumbsTapped();
  tapped.add(thumb);
  const all = FIRST_THUMBS.every((one) => tapped.has(one.id));
  try {
    storage()?.setItem(WALK_KEY, all ? PLAYED : [...tapped].join(","));
  } catch {
    // Storage may be shut; the labels then go for this visit only.
  }
  return tapped;
}

/** Keeps that this device has played, so no label shows on it again. */
export function markPlayed(): void {
  try {
    storage()?.setItem(WALK_KEY, PLAYED);
  } catch {
    // Storage may be shut; the labels then show again on the next visit.
  }
}

/**
 * The thumbs tapped on this device, and a tap that keeps it. `mapOpen`: the map is open now, however it was opened. `played`: the life opened with a month behind it, so the
 * device has played already (a save from before the labels): it is kept as played and no label shows.
 */
export function useFirstUse(played: boolean, mapOpen = false): { tapped: ReadonlySet<FirstThumb>; tap: (thumb: FirstThumb) => void } {
  const [tapped, setTapped] = useState<ReadonlySet<FirstThumb>>(() => {
    if (played && thumbsTapped().size === 0) markPlayed();
    return thumbsTapped();
  });
  // The map opened any way, by the nudge as by its thumb, has been found: its label goes.
  useEffect(() => {
    if (mapOpen) setTapped((now) => (now.has("map") ? now : markThumbTapped("map")));
  }, [mapOpen]);
  return {
    tapped,
    tap: (thumb) => {
      if (!tapped.has(thumb)) setTapped(markThumbTapped(thumb));
    },
  };
}

/**
 * The labels at the thumbs' foot, toward the middle of the screen, each beside its thumb until it is tapped once.
 * `hidden` while the thumbs hide or something covers the world.
 */
export function FirstUseLabels({ tapped, hidden }: { tapped: ReadonlySet<FirstThumb>; hidden: boolean }) {
  if (hidden) return null;
  const shown = FIRST_THUMBS.filter((thumb) => !tapped.has(thumb.id));
  if (shown.length === 0) return null;
  return (
    <CentredColumn className="pointer-events-none fixed inset-x-0 bottom-0 z-[38] flex justify-between px-3 pb-[max(14px,env(safe-area-inset-bottom))]" data-first-labels>
      {FIRST_THUMBS.map((thumb) => (
        <div key={thumb.id} className={`flex h-16 items-end ${thumb.id === "map" ? "pl-[70px]" : "pr-[70px]"}`}>
          {tapped.has(thumb.id) ? null : (
            <span className="chip fade px-2 py-1 text-[12px] leading-tight font-bold" data-first-label={thumb.id}>
              {say(thumb.words)}
            </span>
          )}
        </div>
      ))}
    </CentredColumn>
  );
}
