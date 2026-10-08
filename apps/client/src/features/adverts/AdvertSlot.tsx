// One advert slot (R-ADVERT-001 to 005, R-ADVERT-022): the approved image with
// the game's own "Advert" label, or the slot's own empty board. Tapping opens
// the game's advert card; the link opens only after the leaving notice, and
// only when the player chooses it. Nothing here touches the game's state.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { useEffect, useRef, useState } from "react";

import { useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { say } from "../../shared/words/text";
import { ADVERT_COUNTERS, advertsShown, countImpression } from "./adverts";
import type { CountAdvert, ServedAdvert } from "./adverts";

export interface AdvertSlotProps {
  slot: Id<"advert">;
  /** The hour's advert for this slot, or nothing to show the empty board. */
  served: ServedAdvert | null | undefined;
  /** Where the server is; the image path is relative to it. */
  baseUrl?: string;
  onCount?: CountAdvert;
}

const HALF_VISIBLE = 0.5;

/** R-ADVERT-022: on screen at least half visible for `impressionMs`, then counted once. */
function useImpression(slot: Id<"advert">, active: boolean, onCount: CountAdvert | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!active || onCount === undefined || element === null || typeof IntersectionObserver === "undefined") return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry !== undefined && entry.isIntersecting && entry.intersectionRatio >= HALF_VISIBLE) {
          timer = setTimeout(() => {
            countImpression(onCount, slot);
            observer.disconnect();
          }, content.tuning.advert.impressionMs);
        }
      },
      { threshold: [HALF_VISIBLE] },
    );
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [slot, active, onCount]);
  return ref;
}

function AdvertCard({ served, open, onOpenChange }: { served: ServedAdvert; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [leaving, setLeaving] = useState(false);
  const close = (next: boolean) => {
    if (!next) setLeaving(false);
    onOpenChange(next);
  };
  return (
    <Sheet open={open} onOpenChange={close} title={served.advertiser} description={say("advert.card.note")}>
      <p data-advert-text>{served.text}</p>
      {served.link === null ? null : leaving ? (
        <div className="flex flex-col gap-3" data-advert-leaving>
          <p className="font-semibold">{say("advert.card.leaving.title")}</p>
          <p className="text-muted">{say("advert.card.leaving.body")}</p>
          <p className="break-all text-sm text-muted">{served.link}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={served.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-accent bg-accent px-4 font-semibold text-accent-ink"
            >
              {say("advert.card.leaving.go")}
            </a>
            <Button onClick={() => setLeaving(false)}>{say("advert.card.leaving.back")}</Button>
          </div>
        </div>
      ) : (
        <Button variant="primary" onClick={() => setLeaving(true)}>
          {say("advert.card.visit")}
        </Button>
      )}
      <Button variant="quiet" onClick={() => close(false)}>
        {say("advert.card.close")}
      </Button>
    </Sheet>
  );
}

export function AdvertSlot({ slot, served, baseUrl = "", onCount }: AdvertSlotProps) {
  const view = useView();
  const entry = content.advert[slot];
  const shown = advertsShown(view) && entry !== undefined;
  const filled = shown && served !== null && served !== undefined;
  const ref = useImpression(slot, filled, onCount);
  const [open, setOpen] = useState(false);
  if (!shown) return null;
  const ratio = { aspectRatio: `${String(entry.width)} / ${String(entry.height)}` };
  if (served === null || served === undefined) {
    return <div data-advert-slot={slot} data-advert-empty role="img" aria-label={say("advert.empty")} style={ratio} className="w-full rounded-md border border-line bg-sunk" />;
  }
  return (
    <div ref={ref} data-advert-slot={slot} className="relative w-full" style={ratio}>
      <button
        type="button"
        className="block size-full overflow-hidden rounded-md border border-line focus-visible:outline-2 focus-visible:outline-ink"
        onClick={() => {
          setOpen(true);
          onCount?.(ADVERT_COUNTERS.tap, slot);
        }}
      >
        <img src={`${baseUrl}${served.image}`} width={served.width} height={served.height} alt={`${say("advert.label")}: ${served.advertiser}`} className="size-full object-cover" />
      </button>
      <span data-advert-label className="pointer-events-none absolute top-1 left-1 rounded-sm bg-ink px-1.5 py-0.5 text-xs font-semibold text-paper">
        {say("advert.label")}
      </span>
      <AdvertCard served={served} open={open} onOpenChange={setOpen} />
    </div>
  );
}
